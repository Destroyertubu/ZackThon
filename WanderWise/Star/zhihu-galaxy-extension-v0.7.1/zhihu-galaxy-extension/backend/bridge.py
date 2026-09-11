#!/usr/bin/env python3
import json, os, re, sys, time, subprocess, shutil, urllib.parse, urllib.request, urllib.error
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from difflib import SequenceMatcher
from html import unescape
from pathlib import Path

HOST=os.environ.get('ZH_GALAXY_HOST','127.0.0.1')
PORT=int(os.environ.get('ZH_GALAXY_PORT','8765'))
SEARCH_PASSES=max(1,min(3,int(os.environ.get('ZH_GALAXY_SEARCH_PASSES','2'))))
USE_ZHIDA=os.environ.get('ZH_GALAXY_USE_ZHIDA','0') not in ('0','false','False')

META_RE=re.compile(r'(?i)\b(?:src|href|data|v\d+|api|jpe?g|png|gif|webp|svg|com|cn|net|org|io|https?|www|zhimg|picx)\b')
URL_RE=re.compile(r'https?://\S+|www\.\S+',re.I)
TAG_RE=re.compile(r'<[^>]+>')
BAD_LABELS={'跟我','跟你','跟他','好的人','从来','从来都不是','这份','那份','的人','好的','时候','的时候','后来','同时','件事','事情','东西','情况','方式','方面','地方','内容','文章','回答','问题','结果','原因','感觉','说法','做法','过程','程度','角度','人们','别人','某人','大家','有人','这件事','一件事','一部分','一点','一下','一类','一种','一些','评论区','脑子里','我说','他说','她说','不知道','是不是','都没有','仍然是','依然是','同学','老师','教授','研究生','本科生','学生'}
BAD_EDGES=('跟我','跟你','跟他','好的人','从来','从来都不是','这份','那份','的人','的时候','时候','后来','同时','其实','但是','而且','并且','所以','因为','如果','有人','很多人','大部分人','一般来说','可以说','我觉得','我认为','实际上','事实上','这件事','一件事','也就是说','换句话说','评论区','脑子里','我说','他说','她说','不知道','是不是','都没有')


def clean_text(s):
    s=unescape(str(s or ''))
    s=TAG_RE.sub(' ',s)
    s=URL_RE.sub(' ',s)
    s=re.sub(r'(?i)\b\w+\.(?:jpe?g|png|gif|webp|svg|avif|mp4|webm)(?:\?\S*)?',' ',s)
    s=re.sub(r'(?i)["\']?(?:src|href|data|url|image|avatar|thumbnail)["\']?\s*:\s*["\'][^"\']*["\']',' ',s)
    s=META_RE.sub(' ',s)
    s=re.sub(r'\s+',' ',s).strip()
    return s


def norm_title(s):
    return re.sub(r'[^0-9A-Za-z\u3400-\u9fff]+','',clean_text(s)).lower()


def title_similarity(a,b):
    a,b=norm_title(a),norm_title(b)
    if not a or not b:return 0
    if a==b:return 1
    if a in b or b in a:return min(len(a),len(b))/max(len(a),len(b))+.2
    return SequenceMatcher(None,a,b).ratio()


def find_cli():
    explicit=os.environ.get('ZHIHU_CLI')
    if explicit and Path(explicit).is_file():return explicit
    found=shutil.which('zhihu-cli') or shutil.which('zhihu-cli.exe')
    if found:return found
    home=Path.home()
    candidates=[
        home/'.local/share/zhihu-cli/current/zhihu-cli',
        home/'Library/Application Support/zhihu-cli/current/zhihu-cli',
        Path(os.environ.get('LOCALAPPDATA',''))/'zhihu-cli/current/zhihu-cli.exe' if os.environ.get('LOCALAPPDATA') else None,
        Path(os.environ.get('APPDATA',''))/'zhihu-cli/current/zhihu-cli.exe' if os.environ.get('APPDATA') else None,
    ]
    for p in candidates:
        if p and p.is_file():return str(p)
    return None


def run_cli(args,timeout=25):
    cli=find_cli()
    if not cli:raise RuntimeError('zhihu-cli not found')
    p=subprocess.run([cli,*args],capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=timeout)
    if p.returncode!=0:
        msg=(p.stdout or p.stderr or 'zhihu-cli failed').strip()
        raise RuntimeError(msg[:500])
    try:return json.loads(p.stdout)
    except Exception as e:raise RuntimeError('zhihu-cli returned invalid JSON') from e


def http_json(url,method='GET',body=None,timeout=18):
    secret=os.environ.get('ZHIHU_ACCESS_SECRET','').strip()
    if not secret:raise RuntimeError('ZHIHU_ACCESS_SECRET is not configured')
    data=None
    headers={'Authorization':f'Bearer {secret}','X-Request-Timestamp':str(int(time.time())),'Content-Type':'application/json'}
    if body is not None:data=json.dumps(body,ensure_ascii=False).encode('utf-8')
    req=urllib.request.Request(url,data=data,headers=headers,method=method)
    with urllib.request.urlopen(req,timeout=timeout) as r:return json.loads(r.read().decode('utf-8'))


def search_open_platform(query):
    qs=urllib.parse.urlencode({'Query':query,'Count':10})
    return http_json('https://developer.zhihu.com/api/v1/content/zhihu_search?'+qs)


def search_zhihu(query):
    try:return run_cli(['search','zhihu','--query',query,'--count','10'])
    except Exception:
        if os.environ.get('ZHIHU_ACCESS_SECRET'):return search_open_platform(query)
        raise


def query_variants(title):
    title=clean_text(title)[:180]
    vals=[title]
    condensed=re.sub(r'为什么|为何|怎么|如何|是不是|是否|请问|有人说|如何看待|如何评价|意味着什么|是什么',' ',title)
    condensed=re.sub(r'[？?！!，,。；;：:\s]+',' ',condensed).strip()
    if condensed and condensed!=title:
        parts=[p for p in condensed.split() if len(p)>=2]
        q=' '.join(parts)[:70]
        if q and q not in vals:vals.append(q)
    return vals[:SEARCH_PASSES]


def api_items_to_answers(payload,title):
    data=payload.get('Data') or payload.get('data') or {}
    items=data.get('Items') or data.get('items') or []
    out=[]
    for it in items:
        it_title=it.get('Title') or it.get('title') or ''
        if title_similarity(it_title,title)<0.56:continue
        text=clean_text(it.get('ContentText') or it.get('content_text') or '')
        if len(text)<30:continue
        url=it.get('Url') or it.get('URL') or ''
        m=re.search(r'/answer/(\d+)',str(url));cid=(m.group(1) if m else str(it.get('ContentID') or it.get('content_id') or ''))
        out.append({'id':cid or f'openapi-{len(out)}','author':it.get('AuthorName') or '知乎用户','content':text,'excerpt':text[:320],
                    'voteup_count':it.get('VoteUpCount'),'comment_count':it.get('CommentCount'),'created_time':it.get('CreatedTime') or it.get('created_time'),'updated_time':it.get('UpdatedTime') or it.get('updated_time'),'url':url})
    return out


def dedupe_answers(items):
    out=[];by_id={};by_fp={}
    for a in items:
        text=clean_text(a.get('content') or a.get('excerpt') or '')
        if len(text)<30:continue
        aid=str(a.get('id') or '')
        fp=re.sub(r'[^0-9A-Za-z\u3400-\u9fff]+','',text.lower())[:900]
        idx=by_id.get(aid) if aid.isdigit() else None
        if idx is None and len(fp)>=80:idx=by_fp.get(fp)
        item={**a,'content':text,'excerpt':clean_text(a.get('excerpt') or text[:320])}
        if idx is None:
            idx=len(out);out.append(item)
        elif len(item['content'])>len(out[idx].get('content','')) or (not out[idx].get('voteup_count') and item.get('voteup_count')):
            out[idx]={**out[idx],**item}
        if aid.isdigit():by_id[aid]=idx
        if len(fp)>=80:by_fp[fp]=idx
    return out


def extract_json_text(text):
    text=(text or '').strip()
    text=re.sub(r'^```(?:json)?\s*|\s*```$','',text,flags=re.I|re.S).strip()
    first=text.find('{');last=text.rfind('}')
    if first>=0 and last>first:text=text[first:last+1]
    return json.loads(text)


def valid_label(label,kind):
    s=clean_text(label).strip(' ，。！？；：、,.!?;:')
    if not s or s in BAD_LABELS or META_RE.search(s):return None
    if len(s)<2 or len(s)>(10 if kind=='keyword' else 18):return None
    if any(s==x or s.startswith(x) or s.endswith(x) for x in BAD_EDGES):return None
    if kind=='keyword' and (re.search(r'(?:的人|的事|的是|的东西|这份|那份|从来都不是|好的人)$',s) or re.match(r'^(?:这|那|这些|那些|这种|那种|我|你|他|她|它|跟我|从来)',s)):return None
    if re.search(r'[。！？!?；;]|https?|\.(?:com|jpg|png)',s,re.I):return None
    return s


def near_dup(a,b):
    a,b=clean_text(a).strip(),clean_text(b).strip()
    if not a or not b:return False
    if a==b:return True
    return (a in b or b in a) and abs(len(a)-len(b))<=2


def _time_value(v):
    if v is None:return 0
    try:
        n=float(v)
        return n
    except Exception:return 0


def refine_semantics(title,answers,sort_mode='votes'):
    if not USE_ZHIDA or not find_cli():return None
    if sort_mode=='latest':ordered=sorted(answers,key=lambda a:_time_value(a.get('updated_time') or a.get('created_time')),reverse=True)
    else:ordered=sorted(answers,key=lambda a:int(float(a.get('voteup_count') or 0)),reverse=True)
    head=ordered[:28];rest=ordered[28:]
    tail=[]
    if rest:
        step=max(1,len(rest)//20);tail=rest[::step][:20]
    sample=dedupe_answers([*head,*tail])[:48]
    corpus='\n'.join(f'[A{i}] {clean_text(a.get("content"))[:310]}' for i,a in enumerate(sample))
    prompt=f"""你是“知乎问题星系”的语义地图编辑器。不要做词频词云。目标是让没读过回答的人只看蓝色主题，就能一目了然知道问题到底在讨论哪些维度；再看紫色节点，就能看到具体、有争议或有启发的命题。只能基于给定回答，不补造事实。
问题：{title}

回答片段：
{corpus}

只输出 JSON，不要 Markdown：
{{"keywords":[{{"label":"主题名","anchors":["原文锚词1","原文锚词2"],"evidence_indices":[0,2]}}],"phenomena":[{{"label":"凝练观点/现象","parent_keywords":["主题1","主题2"],"anchors":["原文锚词"],"evidence_indices":[0,2]}}]}}

keywords 硬约束：
1. 输出 16~24 个主题；样本确实单一时可少，但不要只给 6~8 个。4~10 个汉字优先。
2. 主题是“讨论维度/机制/路径”，不是高频原词。单看全部主题应覆盖真正被回答支持的不同维度。
3. 优先“对象 + 机制/结构/路径/权衡/变化/边界/能力/成本”的独立名词短语，如“课程体系取舍”“项目实践能力”“就业路径选择”。
4. 禁止：跟我、好的人、从来都不是、这份、同学、老师、教授、学生、我说、不知道、是不是、评论区等代词/口语/语法残片；若主体重要必须组合成完整议题。
5. anchors 给 2~5 个在证据回答里逐字出现的实词/短语，供程序把其它回答归入该主题。evidence_indices 至少 1 个。

phenomena 硬约束：
6. 输出 24~48 个，5~16 字，必须是可独立理解、值得点击的具体命题/现象，不是原文长句，也不能与 keyword 同名。
7. 尽量让每个 keyword 至少参与 1 个 phenomenon；一个主题若有多种典型观点，可以生成多个。
8. parent_keywords 恰好两个且必须来自 keywords。evidence_indices 必须真实支持该命题；anchors 给 1~5 个原文锚词。
9. 好：“项目经历比课程数量更重要”“低年级先补系统基础”“科研与实习争夺时间”。坏：“人，同时让后来”“从来都不是”“这份”“学习数据结构”（仅复述主题）。
10. 禁止 src/com/jpg/data/v1/v2/api/url/image 等网页残渣。

宁可把次要主题放到第二层，也不要用无意义词凑数。"""
    try:
        resp=run_cli(['answer','--query',prompt,'--model','zhida-fast-1p5'],timeout=55)
        content=((resp.get('choices') or [{}])[0].get('message') or {}).get('content') or ''
        obj=extract_json_text(content)
    except Exception:
        return None
    kws=[]
    for x in obj.get('keywords') or []:
        if not isinstance(x,dict):continue
        lab=valid_label(x.get('label'),'keyword')
        if not lab or any(near_dup(k['label'],lab) for k in kws):continue
        idx=[int(i) for i in (x.get('evidence_indices') or []) if isinstance(i,(int,float)) or str(i).isdigit()]
        idx=[i for i in idx if 0<=i<len(sample)]
        if not idx:continue
        answer_ids=[str(sample[i].get('id')) for i in idx if sample[i].get('id') is not None]
        anchors=[]
        for a in x.get('anchors') or []:
            aa=clean_text(a).strip()
            if 2<=len(aa)<=14 and not META_RE.search(aa) and aa not in anchors:anchors.append(aa)
        kws.append({'label':lab,'anchors':anchors[:8],'evidence_indices':idx,'answer_ids':answer_ids,'support':len(set(answer_ids)),'score':120-len(kws)})
        if len(kws)>=28:break
    known={k['label'] for k in kws};ph=[]
    for x in obj.get('phenomena') or []:
        if not isinstance(x,dict):continue
        lab=valid_label(x.get('label'),'phenomenon');parents=[clean_text(p) for p in (x.get('parent_keywords') or [])]
        parents=[p for p in parents if p in known][:2]
        if not lab or len(parents)!=2 or parents[0]==parents[1] or lab in known:continue
        if any(near_dup(p['label'],lab) for p in ph):continue
        idx=[int(i) for i in (x.get('evidence_indices') or []) if isinstance(i,(int,float)) or str(i).isdigit()]
        idx=[i for i in idx if 0<=i<len(sample)]
        answer_ids=[str(sample[i].get('id')) for i in idx]
        if not answer_ids:continue
        anchors=[]
        for a in x.get('anchors') or []:
            aa=clean_text(a).strip()
            if 2<=len(aa)<=14 and not META_RE.search(aa) and aa not in anchors:anchors.append(aa)
        ph.append({'label':lab,'parent_keywords':parents,'anchors':anchors[:8],'answer_ids':answer_ids,'evidence_indices':idx,'support':len(set(answer_ids)),'score':100-len(ph)})
        if len(ph)>=64:break
    if len(kws)<5:return None
    return {'keywords':kws,'phenomena':ph,'provider':'zhida-fast-1p5','sample_size':len(sample)}


def _fnv1a32(value):
    h=2166136261
    for ch in str(value):
        h=((h^ord(ch))*16777619)&0xffffffff
    return h


def analyze(payload):
    qid=str(payload.get('questionId') or '')
    title=clean_text(payload.get('title') or '')[:240]
    page=payload.get('pageAnswers') or []
    settings=payload.get('settings') or {}
    sort_mode=settings.get('sortMode') if settings.get('sortMode') in ('latest','random') else 'votes'
    try:random_seed=max(1,min(2147483647,int(settings.get('randomSeed') or 731927)))
    except (ValueError,TypeError):random_seed=731927
    try:max_answers=max(10,min(500,int(settings.get('maxAnswers') or 100)))
    except Exception:max_answers=100
    open_answers=[];errors=[]
    for q in query_variants(title):
        try:open_answers.extend(api_items_to_answers(search_zhihu(q),title))
        except Exception as e:errors.append(str(e)[:180]);break
    answers=dedupe_answers([*open_answers,*page])
    if sort_mode=='latest':
        answers=sorted(answers,key=lambda a:_time_value(a.get('updated_time') or a.get('created_time')),reverse=True)
    else:
        answers=sorted(answers,key=lambda a:int(float(a.get('voteup_count') or 0)),reverse=True)
    if sort_mode=='random':
        answers=sorted(answers,key=lambda a:(_fnv1a32(f'{random_seed}:{a.get("id")}'),str(a.get('id'))))
    answers=answers[:max_answers]
    # 0.7 browser never authorizes the old whole-pool remote refinement path.
    sem=refine_semantics(title,answers,sort_mode) if USE_ZHIDA and payload.get('allowLegacyAI') is True else None
    provider='zhihu-cli' if find_cli() else ('open-platform-http' if os.environ.get('ZHIHU_ACCESS_SECRET') else 'page-only')
    source=f'{provider} + page' if page else provider
    return {'questionId':qid,'title':title,'answers':answers,'semantic':sem,'source':source,'diagnostics':{'provider':provider,'sort_mode':sort_mode,'max_answers':max_answers,'open_platform_answers':len(open_answers),'page_answers':len(page),'semantic_refined':bool(sem),'errors':errors[:2]}}

class Handler(BaseHTTPRequestHandler):
    server_version='ZhihuGalaxyBridge/0.7'
    def log_message(self,fmt,*args):sys.stderr.write('[bridge] '+fmt%args+'\n')
    def _headers(self,status=200):
        self.send_response(status);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Access-Control-Allow-Origin','*');self.send_header('Access-Control-Allow-Headers','content-type');self.end_headers()
    def do_OPTIONS(self):self._headers(204)
    def do_GET(self):
        if self.path=='/health':
            self._headers();self.wfile.write(json.dumps({'ok':True,'version':'0.7.0','semanticPolicy':'explicit-only','cli':bool(find_cli()),'secret_env':bool(os.environ.get('ZHIHU_ACCESS_SECRET'))},ensure_ascii=False).encode());return
        self._headers(404);self.wfile.write(b'{"ok":false}')
    def do_POST(self):
        if self.path!='/api/analyze':self._headers(404);self.wfile.write(b'{"ok":false}');return
        try:
            n=int(self.headers.get('Content-Length','0'))
            if n<=0 or n>2_500_000:raise ValueError('invalid request size')
            payload=json.loads(self.rfile.read(n).decode('utf-8'))
            data=analyze(payload);self._headers();self.wfile.write(json.dumps({'ok':True,'data':data},ensure_ascii=False).encode('utf-8'))
        except Exception as e:
            self._headers(500);self.wfile.write(json.dumps({'ok':False,'error':str(e)[:300]},ensure_ascii=False).encode('utf-8'))

if __name__=='__main__':
    cli=find_cli();print(f'Zhihu Galaxy bridge: http://{HOST}:{PORT} | cli={cli or "not found"} | zhida={USE_ZHIDA}',flush=True)
    ThreadingHTTPServer((HOST,PORT),Handler).serve_forever()
