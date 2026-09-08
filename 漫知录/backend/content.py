"""Source-preserving Zhihu adapter. No scraping, publishing, or guessed OAuth.

Verified upstream contract: GET /api/v1/content/zhihu_search, Query=..., Bearer
and X-Request-Timestamp. Response mapping is defensive/configurable because the
provided beta Skill could not be downloaded in the build environment.
"""
import asyncio
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import time
from urllib.parse import urlsplit
import httpx
from .world import normalized, hash_id


class ProviderError(Exception):
    def __init__(self, message, status=502):
        super().__init__(message)
        self.status = status


class _PlainText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts, self.skip = [], 0
    def handle_starttag(self, tag, attrs):
        if tag in ('script','style'):
            self.skip += 1
        elif tag in ('p','br','div','li'):
            self.parts.append('\n')
    def handle_endtag(self, tag):
        if tag in ('script','style'):
            self.skip = max(0, self.skip-1)
        elif tag in ('p','div','li'):
            self.parts.append('\n')
    def handle_data(self, data):
        if not self.skip:
            self.parts.append(data)


def plain(value, max_len=12000):
    if not isinstance(value, (str,int,float)):
        return ''
    p = _PlainText()
    p.feed(str(value)[:50000])
    return re.sub(r'[ \t]+',' ', ''.join(p.parts)).strip()[:max_len]


def safe_zhihu_url(url):
    if not isinstance(url, str) or len(url)>2048 or any(ord(c)<32 for c in url):
        return None
    try:
        p = urlsplit(url)
        host = (p.hostname or '').lower()
        if p.scheme=='https' and p.port in (None,443) and not p.username and not p.password and (host=='zhihu.com' or host.endswith('.zhihu.com')):
            return url
    except ValueError:
        pass
    return None


def field(obj, *names):
    normalized_fields = {str(k).replace('_','').lower():v for k,v in obj.items()}
    for n in names:
        if (value := normalized_fields.get(n.replace('_','').lower())) is not None:
            return value
    return None


def locate_list(payload, depth=0):
    if depth>5:
        return None
    if isinstance(payload,list):
        return payload
    if isinstance(payload,dict):
        for name in ('data','results','result','items','contents','content','list','documents'):
            x = field(payload,name)
            if isinstance(x,(list,dict)):
                result = locate_list(x,depth+1)
                if result is not None:
                    return result
    return None


def get_path(data, path):
    for component in path.split('.'):
        if component:
            data = data[int(component)] if isinstance(data,list) else data[component]
    return data


def normalize_results(payload, node, schema=None):
    """Schema mappings name JSON paths, not executable code. Never invent a source."""
    if isinstance(payload,dict):
        code = field(payload,'code')
        if code not in (None,0,'0',200,'200'):
            raise ProviderError('知乎接口返回业务错误；请在服务端核查权限、额度与响应契约。')
    try:
        rows = get_path(payload,schema['items']) if schema and 'items' in schema else locate_list(payload)
    except (KeyError,IndexError,TypeError,ValueError) as exc:
        raise ProviderError('配置的知乎响应字段映射不匹配。') from exc
    if not isinstance(rows,list):
        raise ProviderError('未识别知乎响应结构。请按官方 Skill 核对 schema.example.json；未切换为演示内容。')
    results=[]
    for raw in rows[:30]:
        if not isinstance(raw,dict):
            continue
        # Some search systems put the document under an `object` field.
        item = field(raw,'object','document') or raw
        if not isinstance(item,dict):
            continue
        def pick(key, *aliases):
            if schema and key in schema:
                try:
                    return get_path(item,schema[key])
                except (KeyError,IndexError,TypeError,ValueError):
                    return None
            return field(item,key,*aliases)
        title = plain(pick('title','name'),220)
        url = safe_zhihu_url(pick('url','link','content_url'))
        summary = plain(pick('summary','snippet','abstract','excerpt','content','body'),6000)
        author = pick('author','author_name')
        if isinstance(author,dict):
            author = field(author,'name','display_name')
        if not title or not url:
            continue
        # A search snippet is NEVER promoted to an exact original quotation.
        results.append(dict(
            id=hash_id(url,summary[:200]), nodeId=node['id'], title=title,
            text=summary[:160] or '接口未返回摘要，请前往知乎阅读原文。', body=summary,
            author=plain(author,80) or '作者信息未返回', url=url,
            kind='search_summary', source='zhihu',
            provenance='知乎搜索摘要 · 非经核验的逐字引文',
            retrievedAt=int(time.time()), verifiedQuote=False,
        ))
        if len(results)>=6:
            break
    if rows and not results:
        raise ProviderError('返回结果中没有可验证的知乎原文链接；请核对响应字段映射。')
    return results


def demo_content(node, seed):
    """All demo wording is original, not attributed to real authors or answers."""
    a = node['title']
    records = [
      (f'{a} · 从一个问题开始', f'先别急着定义「{a}」。回想一个具体的时刻：你做了什么，又为什么还记得它？',
       f'这是一段为知野交互演示创作的文字，不是知乎原文。\n\n当我们谈论「{a}」，可以先把很大的判断，换成一个能够回忆的场景。场景中有谁？你采取了什么行动？什么让你愿意继续？\n\n不必立刻交出漂亮的答案。给这段经历一个想法锚点，下一次走到这里时，再看看自己的理解是否改变。'),
      (f'{a} · 换一个站位', f'关于「{a}」，也许可以同时保留两种解释。先写下你相信的，再认真寻找一个反例。',
       f'这是一段原创演示内容，不是对任何作者观点的引用。\n\n试着从另一个站位重新提出问题：你看到的限制，对另一个人来说会不会是机会？你的答案依赖哪些尚未验证的前提？\n\n把两张卡片放进行囊，再用一句自己的话解释它们之间的分歧。分歧不需要立刻被消除。'),
      (f'{a} · 带回生活', f'带走的不必是一个结论，也可以是一次小小的尝试：明天，我准备怎样重新认识「{a}」？',
       '这是一段知野原创演示文字。\n\n为一次探索设计一个能够完成的小实验。明确要做的动作，记录观察到的变化，再写下什么结果会让你改变想法。\n\n知识行囊不是收藏数量的比赛。把两个片段组合成一个新问题或行动实验，让走过的路在生活中留下回声。'),
    ]
    return [dict(id=hash_id(seed,node['id'],str(i),'demo-v1'),nodeId=node['id'],title=t,text=s,body=b,author='知野 · 原创演示',url=None,kind='demo_original',source='demo',provenance='原创演示 · 非知乎原文',verifiedQuote=False) for i,(t,s,b) in enumerate(records)]


class ContentService:
    def __init__(self,config,store):
        self.config,self.store = config,store
        self.inflight = {}
        self.schema = json.loads(Path(config.schema_file).read_text(encoding='utf-8')) if config.schema_file else None

    async def _http(self,query):
        if not self.config.secret:
            raise ProviderError('尚未配置服务端 ZHIHU_ACCESS_SECRET；实时模式不会伪装为演示数据。',503)
        # No external URL can be supplied by the browser. No redirects are followed.
        headers={'Authorization':'Bearer '+self.config.secret,'X-Request-Timestamp':str(int(time.time())),'Content-Type':'application/json'}
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(20,connect=6),follow_redirects=False) as client:
                response = await client.get('https://developer.zhihu.com/api/v1/content/zhihu_search',params={'Query':query},headers=headers)
            if response.status_code==429:
                raise ProviderError('知乎搜索额度或频率受限，请稍后再试。',429)
            if response.status_code in (401,403):
                raise ProviderError('知乎鉴权或应用权限尚未通过；请在服务端核查。',503)
            response.raise_for_status()
            if len(response.content)>4_000_000:
                raise ProviderError('上游响应过大，已拒绝处理。')
            return response.json()
        except (httpx.HTTPError,ValueError) as exc:
            raise ProviderError('知乎上游暂时不可用；已有行囊与旅程不受影响。') from exc

    async def _cli(self,query):
        """Opt-in CLI bridge: exact readonly args must be checked against local Skill."""
        mapping = self.schema or {}
        args = mapping.get('cli_search_args')
        if mapping.get('cli_readonly_confirmed') is not True or not isinstance(args,list) or not 1<=len(args)<=32 or not all(isinstance(x,str) and len(x)<=1024 and '\x00' not in x for x in args) or not any('{query}' in x for x in args):
            raise ProviderError('CLI 模式需要从官方 Skill 核验只读命令，再配置 cli_search_args 与 cli_readonly_confirmed。',503)
        argv=[arg.replace('{query}',query) for arg in args]
        try:
            proc=await asyncio.create_subprocess_exec(self.config.cli_path,*argv,stdout=asyncio.subprocess.PIPE,stderr=asyncio.subprocess.PIPE,limit=4_000_000)
            try:
                stdout,_=await asyncio.wait_for(proc.communicate(),timeout=25)
            except asyncio.TimeoutError:
                proc.kill()
                await proc.communicate()
                raise ProviderError('知乎 CLI 请求超时。')
            if proc.returncode or len(stdout)>4_000_000:
                raise ProviderError('知乎 CLI 请求失败；请在终端核验初始化与输出格式。')
            return json.loads(stdout)
        except (OSError,ValueError) as exc:
            raise ProviderError('未找到可用的官方 CLI 或其输出不是 JSON。',503) from exc

    async def search(self,node,seed,uid):
        if self.config.mode=='demo':
            return dict(items=demo_content(node,seed),mode='demo',cached=False)
        query=normalized(f"{seed} {node['title']}")[:200]
        key='zhihu:v1:'+hashlib.sha256(query.encode()).hexdigest()
        cached=self.store.cache_get(key)
        if cached is not None:
            return dict(items=[dict(x,nodeId=node['id']) for x in cached],mode='live',cached=True)
        # Budget the user's live cache misses even when requests join a single flight.
        if not self.store.reserve_quota('guest:'+uid,self.config.guest_limit):
            raise ProviderError('当前访客的今日实时探索预算已用完，仍可阅读已缓存内容。',429)
        if key not in self.inflight:
            async def fetch():
                if not self.store.reserve_quota('developer:zhihu_search',self.config.upstream_limit):
                    raise ProviderError('开发者今日知乎搜索总预算已用完，已有缓存仍可使用。',429)
                payload=await (self._cli(query) if self.config.provider=='cli' else self._http(query))
                items=normalize_results(payload,node,self.schema)
                self.store.cache_set(key,items,self.config.cache_seconds)
                return items
            task=asyncio.create_task(fetch())
            self.inflight[key]=task
            def finished(done):
                self.inflight.pop(key,None)
                # Retrieve exceptions if all waiting browser requests were cancelled.
                if not done.cancelled():
                    done.exception()
            task.add_done_callback(finished)
        items=await asyncio.shield(self.inflight[key])
        return dict(items=[dict(x,nodeId=node['id']) for x in items],mode='live',cached=False)
