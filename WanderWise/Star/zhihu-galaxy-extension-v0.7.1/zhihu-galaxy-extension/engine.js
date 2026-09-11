(() => {
  "use strict";

  const STOP_WORDS = new Set(`的 了 是 在 和 就 都 而 及 与 着 或 一个 没有 我们 你们 他们 自己 这个 那个 这些 那些 因为 所以 如果 但是 其实 然后 还是 以及 对于 关于 什么 怎么 为什么 如何 觉得 认为 可能 可以 不是 已经 比较 非常 很多 一些 这种 这样 那样 时候 事情 东西 问题 回答 知道 看到 里面 之后 之前 现在 目前 真的 基本 一般 当然 不过 而且 并且 需要 应该 进行 通过 由于 其中 甚至 只是 一样 一直 一定 所有 任何 相关 具体 情况 方式 方面 个人 大家 还有 这里 那里 是否 确实 相对 实际 实际上 本身 有些 有的 的是 大量 标准 主要 最后 开始 出现 发现 感觉 直接 确定 估计 反正 原因 结果 说法 一种 两个 三个 比如 例如 也许 或者 只要 只有 不能 不会 并不 并没有 并不是 这么 那么 这么说 总之 后来 同时 于是 因此 那么说 这件事 一件事 件事 人们 别人 某人 有人 大部分 一部分 一点 一下 一类 一般来说 意思 做法 过程 程度 角度 地方 这时候 那时候 的时候 时候里 事实上 换句话说 也就是说 平时 平常 普通 普遍 常见 often literally basically actually and the this that with from have has are was were not but for you your they them its our their what why how when where who into about than then also just very more most some any all can could would should may might`.split(/\s+/));
  const META_WORDS = new Set(`src href data v1 v2 v3 api html css js json jpg jpeg png gif webp svg avif mp4 webm m3u8 com cn net org io www http https zhihu zhimg picx static upload image images source class style span div p br em figure noscript script iframe blob base64 utf charset width height alt title role aria`.split(/\s+/));
  const BAD_EXACT = new Set(`来自网络 文案来自网络 不好意思 可不是说玩烘培 可不是说玩烘焙 不用考虑收益 时间看不到变化 时候 的时候 后来 同时 什么时候 跟我 好的人 从来 从来都不是 这份 那份 的人 好的 件事 事情 东西 情况 方式 方面 地方 内容 文章 回答 问题 结果 原因 感觉 说法 做法 过程 程度 角度 服务 需求 本地 入口 经验 地带 地带路 人们 别人 某人 大家 有人 这件事 一件事 一部分 一点 一下 一类 一种 一些 有些 其实 但是 所以 因为 于是 因此 目前 现在 之前 之后 评论区 脑子里 我说 他说 她说 不知道 是不是 都没有 仍然是 依然是 而不是 还是 某位 一次性 同学 老师 教授 研究生 本科生 学生`.split(/\s+/));
  const BAD_PREFIX = [`跟我`,`跟你`,`跟他`,`这份`,`那份`,`从来`,`从来都不是`,`好的`,`好的人`,`什么时候`,`的时候`,`时候`,`后来`,`同时`,`其实`,`但是`,`而且`,`并且`,`所以`,`因为`,`如果`,`有人`,`很多人`,`大部分人`,`一般来说`,`可以说`,`我觉得`,`我认为`,`实际上`,`事实上`,`这件事`,`一件事`,`也就是说`,`换句话说`];
  const BAD_SUFFIX = [`的人`,`的事`,`的是`,`的东西`,`这份`,`那份`,`从来都不是`,`好的人`,`什么时候`,`的时候`,`时候`,`后来`,`同时`,`这件事`,`一件事`,`件事`,`而已`,`罢了`,`的话`,`来说`,`而言`,`等等`,`之类`,`方面`,`情况`,`方式`,`程度`,`过程`,`出来`,`起来`,`下去`];
  const FUNCTION_TOKENS = new Set(`的 了 着 过 是 有 在 把 被 让 使 给 和 与 或 及 而 但 也 都 就 才 又 还 更 很 太 最 到 从 对 向 为 于 以 由 按 时 后 前 中 上 下 里 外 来 去 能 会 要 可 让 使 若 则`.split(/\s+/));
  const GENERIC_WORDS = new Set(`提供 进行 变成 成为 形成 包装 包装成 看到 看见 发现 出现 购买 使用 讨论 知道 清楚 熟悉 往往 背后 附近 部分 其实 经常 一起 更早 进入 积累 比较 觉得 认为 说明 表示 可能 可以 需要 应该 开始 最后 目前 现在 后来 同时 甚至 直接 相关 具体 主要 大量 一些 很多 本质 依赖 卖 越 长期 首先 解决 不同 真正 面对 完成 告诉 讲清楚 生活 获得 构成 建立 强调`.split(/\s+/));
  const LOW_INFO_RE = /^(?:我|你|他|她|它|我们|你们|他们)?(?:说|觉得|认为|知道|清楚|没有|不知道|是不是|有没有|能不能|会不会|应该|可以|可能|依然|仍然|就是|只是|其实|当然|那么|然后|后来|同时|评论区|脑子里)(?:了|过|呢|吗|吧|啊)?$/;
  const LOW_INFO_FRAGMENT_RE = /(?:评论区|脑子里|我说|他说|她说|不知道|是不是|都没有|仍然是|依然是|而不是|的时候|这件事|一件事)$/;
  const TOPIC_END_RE = /(?:市场|信息|体系|规则|边界|路径|成本|经验|平台|网络|训练|目标|选择|判断|结构|机制|信号|责任|变化|评价|筛选|招聘|就业|升学|学历|能力|行业|环境|岗位|薪资|风险|收益|优势|门槛|时滞|错位|脱节|认知|咨询|职业|教育|学术|科研|实习|校友)$/;
  const topicLike=s=>TOPIC_END_RE.test(String(s||""));
  const SAFE_SINGLE_SUFFIX = new Set(`票 区 业 学 网 车 房 店 费 钱 税 卡 证 机 码 价 款 品 人 方 法 率 量 度 性 化 制 权 链 端 云 币 金 股 课 校 院 药 病 站 路 城 村 厂 岗 书 片 剧 游 戏 茶 酒 表 图 库 盘 包 差 口 门 证 线 源 商 家 端`.split(/\s+/));

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  const hash = (s) => { let h=2166136261; for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);} return h>>>0; };
  const randFrom = (seed) => { let x=seed||123456789; return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return((x>>>0)%1000000)/1000000;}; };

  function cleanPlainText(input) {
    if (!input) return "";
    let raw = String(input).replace(/[\u200b-\u200f\ufeff]/g, " ");
    if (/[<>]/.test(raw)) {
      const d = document.createElement("div");
      d.innerHTML = raw;
      d.querySelectorAll("script,style,noscript,svg,math,iframe,object,embed,source,picture,video,audio,link,meta").forEach(el=>el.remove());
      d.querySelectorAll("img").forEach(el=>{ const alt=el.getAttribute("alt")||""; el.replaceWith(alt && !/^https?:/i.test(alt) ? ` ${alt} ` : " "); });
      d.querySelectorAll("p,li,blockquote,br,h1,h2,h3,h4").forEach(el=>el.appendChild(document.createTextNode(" ")));
      raw = d.textContent || "";
    }
    return raw
      .replace(/data:[a-z0-9.+-]+\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+/gi, " ")
      .replace(/https?:\/\/[^\s<>"'，。！？；：]+/gi, " ")
      .replace(/\bwww\.[a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s]*)?/gi, " ")
      .replace(/\b[a-z0-9_-]+\.(?:jpg|jpeg|png|gif|webp|svg|avif|mp4|webm|json|js|css)(?:\?[^\s]*)?/gi, " ")
      .replace(/\b(?:src|href|data-[\w-]+|class|style|width|height|alt|title)\s*=\s*["'][^"']*["']/gi, " ")
      .replace(/["']?(?:src|href|data|url|image|avatar|thumbnail|original|resource|version|type)["']?\s*:\s*["'][^"']*["']/gi, " ")
      .replace(/\b(?:https?|www|src|href|data|v\d+|api|jpg|jpeg|png|gif|webp|svg|com|cn|net|org|io|zhimg|picx)\b/gi, " ")
      .replace(/=+/g, " ")
      .replace(/(?:^|\s)[a-f0-9]{20,64}(?=\s|$)/gi, " ")
      .replace(/[\[\]{}<>|`~^*_]{2,}/g, " ")
      .replace(/\s+/g, " ")
      .replace(/\s+([，。！？；：、])/g, "$1")
      .trim();
  }

  function stripHtml(html){ return cleanPlainText(html); }

  function looksNatural(text) {
    const s = cleanPlainText(text);
    if (s.length < 25) return false;
    const cjk=(s.match(/[\u3400-\u9fff]/g)||[]).length, letters=(s.match(/[A-Za-z]/g)||[]).length;
    const meta=(s.match(/\b(?:src|href|data|v\d+|api|jpg|png|com|https?)\b/gi)||[]).length;
    return (cjk >= 12 || letters >= 30) && meta <= 2;
  }

  const segmenter = typeof Intl.Segmenter === "function" ? new Intl.Segmenter("zh-CN",{granularity:"word"}) : null;
  function segmentedWords(text) {
    const s=cleanPlainText(text);
    if (!s) return [];
    if (segmenter) {
      return [...segmenter.segment(s)].map(x=>({text:x.segment.trim().toLowerCase(),word:!!x.isWordLike}));
    }
    return s.split(/([，。！？；：、,.!?;:\s]+)/).filter(Boolean).map(x=>({text:x.toLowerCase(),word:/[A-Za-z0-9\u3400-\u9fff]/.test(x)}));
  }

  function isMetaToken(t){
    const low=(t||"").toLowerCase();
    if(META_WORDS.has(low))return true;
    if(/^v\d+$/.test(low)||/^\d+x\d+$/.test(low))return true;
    if(/\.(?:jpg|jpeg|png|gif|webp|svg|avif|mp4|webm)$/i.test(low))return true;
    if(/^(?:https?|www\.|data:|blob:)/i.test(low))return true;
    if(/^[a-f0-9]{20,64}$/i.test(low))return true;
    return false;
  }

  function labelQuality(label, kind="keyword") {
    let t=(label||"").trim().toLowerCase();
    const max=kind==="keyword"?10:18;
    if(t.length<2||t.length>max)return 0;
    if(/(?:来自网络|转载自|侵删|版权归|图片来源|文案来源|可不是说|不好意思)/.test(t))return 0;
    if(isMetaToken(t)||BAD_EXACT.has(t)||STOP_WORDS.has(t)||LOW_INFO_RE.test(t)||LOW_INFO_FRAGMENT_RE.test(t))return 0;
    if(/[<>\[\]{}"'\\]/.test(t))return 0;
    if(/https?|www\.|\.(?:com|cn|net|org|io|jpg|png|gif|webp)/i.test(t))return 0;
    if(/^\d+(?:\.\d+)?$/.test(t))return 0;
    if(BAD_PREFIX.some(x=>t===x||t.startsWith(x)))return 0;
    if(kind==="keyword" && /^(?:这|那|这些|那些|这种|那种|此|该|我|你|他|她|它|跟我|跟你|跟他|从来|一直|已经|仍然|依然|还是|不是|好的)(?:$|[^学术业校院系统场径构制则力率量度性化权链端云金股课岗])/u.test(t) && !topicLike(t))return 0;
    if(kind==="keyword" && /(?:的人|的事|的是|的东西|这份|那份|从来都不是|好的人)$/.test(t))return 0;
    if(kind==="phenomenon" && /^(?:是非|往往|通常|其实|一般|主要|大多|本质上|而不是|就是|只是|无法|不能|不会|可以|需要|应该|期待|某位|一次性|都比|真正|持续|仍然|依然)(?:是|有|会)?/.test(t))return 0;
    if(kind==="phenomenon" && /(?:的时候|这件事|一件事|其实是|往往是|通常是|可以说|我觉得|我认为)/.test(t))return 0;
    if(BAD_SUFFIX.some(x=>t===x||t.endsWith(x)))return 0;
    const parts=segmentedWords(t).filter(x=>x.word).map(x=>x.text);
    const informative=parts.filter(p=>!STOP_WORDS.has(p)&&!FUNCTION_TOKENS.has(p)&&!BAD_EXACT.has(p)&&!GENERIC_WORDS.has(p)&&!isMetaToken(p)&&!LOW_INFO_RE.test(p));
    if(!informative.length)return 0;
    if(kind==="keyword"&&parts.length===1&&t.length===2)return 0.58;
    if(kind==="keyword"&&/^(?:人|学生|老师|教授|同学|研究生|本科生|社会|现实)$/.test(t))return 0;
    if(kind==="keyword"&&/^(?:产生|造成|导致|削弱|尤其|面向|之间|存在|不断|继续|真正|长期|首先|直接|只是|就是|所谓|更|最|很多|一些)/.test(t))return 0;
    if(kind==="phenomenon"&&t.length>=7&&informative.length<2)return 0;
    const cjk=(t.match(/[\u3400-\u9fff]/g)||[]).length;
    const infoChars=informative.join("").replace(/[^A-Za-z0-9\u3400-\u9fff]/g,"").length;
    const density=infoChars/Math.max(1,cjk||t.length);
    if(density<0.48)return 0;
    let q=0.75+Math.min(.45, informative.length*.09);
    if(t.length>=3&&t.length<=8)q+=.15;
    if(kind==="phenomenon"&&t.length>=5&&t.length<=14)q+=.1;
    return q;
  }

  function titleStopSet(title){
    const set=new Set();
    const words=segmentedWords(title).filter(x=>x.word).map(x=>x.text);
    for(const t of words){ if(t.length>=2&&!STOP_WORDS.has(t)&&!GENERIC_WORDS.has(t))set.add(t); }
    for(let i=0;i+1<words.length;i++){
      const a=words[i],b=words[i+1];
      if(STOP_WORDS.has(a)||STOP_WORDS.has(b)||FUNCTION_TOKENS.has(a)||FUNCTION_TOKENS.has(b))continue;
      if(a.length===1&&b.length===1)set.add(a+b);
      if(a.length>=2&&b.length===1&&SAFE_SINGLE_SUFFIX.has(b))set.add(a+b);
    }
    return set;
  }

  function clauseWordGroups(text){
    const segs=segmentedWords(text), groups=[]; let cur=[];
    for(const item of segs){
      if(!item.word){ if(cur.length)groups.push(cur),cur=[]; continue; }
      const t=item.text;if(!t)continue;cur.push(t);
    }
    if(cur.length)groups.push(cur);
    return groups;
  }

  function candidateWindows(text,titleStop,kind="keyword") {
    const out=[];
    for(const words of clauseWordGroups(text)){
      if(kind==="keyword"){
        for(let i=0;i<words.length;i++){
          const a=words[i];
          const validA=!STOP_WORDS.has(a)&&!FUNCTION_TOKENS.has(a)&&!GENERIC_WORDS.has(a)&&!BAD_EXACT.has(a)&&!isMetaToken(a)&&!LOW_INFO_RE.test(a);
          if(validA&&a.length>=3&&a.length<=8&&!titleStop?.has(a)){
            const q=labelQuality(a,"keyword");if(q)out.push({label:a,q:q-.04});
          }
          if(i+1>=words.length)continue;
          const b=words[i+1];
          const validB=!STOP_WORDS.has(b)&&!FUNCTION_TOKENS.has(b)&&!GENERIC_WORDS.has(b)&&!BAD_EXACT.has(b)&&!isMetaToken(b)&&!LOW_INFO_RE.test(b);
          if(!validA||!validB)continue;
          const joined=a+b;
          // Prefer phrases that are contiguous in the original clause. Two meaningful
          // words are much more useful as an overview node than isolated nouns such as
          // “教授 / 同学 / 研究生”. We never cross punctuation or function-word boundaries.
          if(a.length>=2&&b.length>=2&&joined.length>=4&&joined.length<=10&&!titleStop?.has(joined)&&topicLike(joined)){
            const q=labelQuality(joined,"keyword");if(q)out.push({label:joined,q:q+.38});
          }else{
            let label=null;
            if(a.length===1&&b.length===1)label=joined;
            else if(a.length>=2&&a.length<=5&&b.length===1&&SAFE_SINGLE_SUFFIX.has(b))label=joined;
            if(label&&label.length<=8&&!titleStop?.has(label)){const q=labelQuality(label,"keyword");if(q)out.push({label,q:q+.12});}
          }
          if(i+2<words.length){
            const c=words[i+2],validC=!STOP_WORDS.has(c)&&!FUNCTION_TOKENS.has(c)&&!GENERIC_WORDS.has(c)&&!BAD_EXACT.has(c)&&!isMetaToken(c)&&!LOW_INFO_RE.test(c);
            const tri=a+b+c;
            if(validC&&a.length>=2&&b.length>=2&&c.length>=2&&tri.length<=10&&!titleStop?.has(tri)&&topicLike(tri)){const q=labelQuality(tri,"keyword");if(q)out.push({label:tri,q:q+.46});}
          }
        }
        continue;
      }

      // Phenomena are mined only inside high-information runs. Generic connectives
      // and weak verbs are hard boundaries, so we do not manufacture sentence fragments.
      const runs=[];let run=[];
      for(const w of words){
        if(STOP_WORDS.has(w)||FUNCTION_TOKENS.has(w)||GENERIC_WORDS.has(w)||isMetaToken(w)){
          if(run.length)runs.push(run),run=[];
        }else run.push(w);
      }
      if(run.length)runs.push(run);
      for(const r of runs){
        for(let i=0;i<r.length;i++)for(let j=i+1;j<Math.min(r.length,i+5);j++){
          const slice=r.slice(i,j+1);let label=slice.join("");
          if(/^地带路/.test(label))label=label.slice(1);
          if(/^是非(?=[正规标准公开法定正常])/.test(label))label=label.slice(1);
          if(label.length<4||label.length>16)continue;
          if(slice.length>5)continue;
          const first=slice[0],last=slice[slice.length-1];
          if(first.length===1&&i>0)continue;
          if(last.length===1&&!SAFE_SINGLE_SUFFIX.has(last))continue;
          if(/[的了着过]/.test(label))continue;
          const q=labelQuality(label,"phenomenon");if(!q)continue;
          out.push({label,q:q+(slice.length===2?.12:0)});
        }
      }
    }
    return out;
  }

  function splitSentences(text){
    return cleanPlainText(text).split(/[。！？!?；;\n]+/).map(s=>s.trim()).filter(s=>s.length>=5&&s.length<=180);
  }

  function mineLocalKeywords(answers,title){
    const titleStop=titleStopSet(title), N=Math.max(1,answers.length), stats=new Map();
    answers.forEach((a,ai)=>{
      const votes=Math.max(0,Number(a.voteup_count)||0),aw=1+Math.min(2.4,Math.log10(1+votes)*.48);
      for(const c of candidateWindows(a.text,titleStop,"keyword")){
        let r=stats.get(c.label); if(!r)stats.set(c.label,r={label:c.label,tf:0,docs:new Set(),q:c.q,weight:0,maxWeight:1});
        r.tf++;r.docs.add(ai);r.q=Math.max(r.q,c.q);r.weight+=aw;r.maxWeight=Math.max(r.maxWeight,aw);
      }
    });
    const arr=[];
    for(const r of stats.values()){
      const df=r.docs.size,coverage=df/N,domainLike=topicLike(r.label)||/[A-Za-z][A-Za-z0-9+#.-]{2,}/.test(r.label);
      if(coverage>.72)continue;
      if(N>=20&&df<2&&!domainLike)continue;
      if(N>=80&&df<3&&!domainLike&&r.maxWeight<1.9)continue;
      if(df===1&&N>=5&&r.label.length<4)continue;
      const idf=Math.log((N+2.2)/(df+.8))+.38;
      const rare=df===1&&N>8?(.52+.16*Math.min(1,(r.maxWeight-1)/2.4)):1;
      const common=coverage>.48?Math.pow(Math.max(.08,1-coverage),1.7):1;
      const len=r.label.length<=3?.62:r.label.length<=5?1.18:r.label.length<=8?1.34:1.05;
      const phraseBoost=(segmentedWords(r.label).filter(x=>x.word).length>=2?1.18:1)*(domainLike?1.36:.64);
      const score=Math.log1p(r.tf+r.weight*.22)*idf*(.52+Math.sqrt(coverage))*rare*common*len*phraseBoost*r.q;
      arr.push({token:r.label,df,coverage,score,docs:r.docs});
    }
    arr.sort((a,b)=>b.score-a.score);
    const picked=[],target=clamp(Math.round(8+Math.sqrt(N)*1.28),10,28);
    for(const c of arr){
      let handled=false;
      for(let i=0;i<picked.length;i++){
        const p=picked[i];
        if(!(p.token.includes(c.token)||c.token.includes(p.token)))continue;
        if(c.token.length>p.token.length&&c.score>=p.score*.62)picked[i]=c;
        handled=true;break;
      }
      if(!handled)picked.push(c);
      if(picked.length>=target)break;
    }
    return picked.sort((a,b)=>b.score-a.score);
  }

  function phenomenonCandidates(answers,keywords){
    const byLabel=new Map();
    answers.forEach((a,ai)=>{
      const present=keywords.filter(k=>a.text.includes(k.label)).map(k=>k.label);
      if(present.length<2)return;
      for(const sentence of splitSentences(a.text)){
        const near=present.filter(k=>sentence.includes(k));
        for(const c of candidateWindows(sentence,null,"phenomenon")){
          const contained=keywords.filter(k=>c.label.includes(k.label)).map(k=>k.label);
          let related=[...new Set([...contained,...near])];
          if(related.length<2)related=present;
          if(related.length<2)continue;
          let r=byLabel.get(c.label);if(!r)byLabel.set(c.label,r={label:c.label,docs:new Set(),keywords:new Map(),q:c.q});
          r.docs.add(ai);r.q=Math.max(r.q,c.q);
          related.slice(0,4).forEach(k=>r.keywords.set(k,(r.keywords.get(k)||0)+1));
        }
      }
    });
    const arr=[];
    for(const r of byLabel.values()){
      const parents=[...r.keywords.entries()].sort((a,b)=>b[1]-a[1]).slice(0,2).map(x=>x[0]);
      if(parents.length<2)continue;
      const support=r.docs.size, exactParentCount=parents.filter(k=>r.label.includes(k)).length;
      const relation=/(?:变化|差异|错位|边界|时滞|失效|成本|信息差|脱节|取决于|并非|不是|依赖|筛选|路径|规则|机制|责任|收益|风险|门槛|优势|劣势)/.test(r.label);
      if(support<2 && !(exactParentCount>=1&&relation))continue;
      if(!relation && exactParentCount===0)continue;
      const score=(1+Math.log2(1+support))*r.q*(1+exactParentCount*.42)*(relation?1.22:1)*(1-Math.abs(9-r.label.length)*.018);
      arr.push({label:r.label,parents,answerIndexes:[...r.docs],support,score});
    }
    arr.sort((a,b)=>b.score-a.score);
    const picked=[];
    for(const c of arr){
      if(picked.length>=64)break;
      if(picked.some(p=>p.label.includes(c.label)||c.label.includes(p.label)))continue;
      picked.push(c);
    }
    return picked;
  }

  const stableNodeId=(prefix,label)=>`${prefix}-${hash(String(label||"")) .toString(36)}`;
  function nearDuplicateLabel(a,b){a=cleanPlainText(a).trim();b=cleanPlainText(b).trim();if(!a||!b)return false;if(a===b)return true;return (a.includes(b)||b.includes(a))&&Math.abs(a.length-b.length)<=2;}

  function normalizeProvidedSemantic(question,answers){
    const sem=question.semantic;if(!sem||!Array.isArray(sem.keywords))return null;
    const answerIds=new Set(answers.map(a=>String(a.id)));
    const keywords=[];
    for(const item of sem.keywords){
      const label=cleanPlainText(typeof item==="string"?item:item?.label||"").replace(/[，。！？；：、,.!?;:]/g,"").trim();
      if(!labelQuality(label,"keyword"))continue;
      if(keywords.some(k=>nearDuplicateLabel(k.label,label)))continue;
      let ids=(item?.answer_ids||[]).map(String).filter(id=>answerIds.has(id));
      if(!ids.length&&Array.isArray(item?.evidence_indices))ids=item.evidence_indices.map(i=>answers[Number(i)]?.id).filter(Boolean).map(String);
      keywords.push({id:stableNodeId("k",label),type:"keyword",label,score:Number(item?.score)||100-keywords.length,df:Math.max(Number(item?.support)||1,ids.length),answerIds:[...new Set(ids)],anchors:(item?.anchors||[]).map(cleanPlainText).filter(Boolean).slice(0,8),pos:{x:0,y:0,z:0},source:"refined"});
      if(keywords.length>=28)break;
    }
    if(keywords.length<4)return null;
    const pair=new Map();
    answers.forEach((a,idx)=>{
      const present=keywords.filter(k=>a.text.includes(k.label)).map(k=>k.label);
      for(let i=0;i<present.length;i++)for(let j=i+1;j<present.length;j++){
        const key=[present[i],present[j]].sort().join("\u0001");if(!pair.has(key))pair.set(key,{a:present[i],b:present[j],answers:[]});pair.get(key).answers.push(idx);
      }
    });
    layoutKeywords(keywords,pair);
    const phenomena=[];
    for(const item of sem.phenomena||[]){
      const label=cleanPlainText(item?.label||"").replace(/[。！？!?；;]+$/g,"").trim();
      if(!labelQuality(label,"phenomenon"))continue;
      if(keywords.some(k=>nearDuplicateLabel(k.label,label)))continue;
      if(phenomena.some(p=>nearDuplicateLabel(p.label,label)))continue;
      const parentLabels=(item.parent_keywords||item.parents||[]).map(x=>cleanPlainText(x)).filter(Boolean);
      const parents=parentLabels.map(l=>keywords.find(k=>k.label===l)?.id).filter(Boolean);
      if(parents.length<2)continue;
      let ids=(item.answer_ids||[]).map(String).filter(id=>answerIds.has(id));
      if(!ids.length&&Array.isArray(item.evidence_indices))ids=item.evidence_indices.map(i=>answers[Number(i)]?.id).filter(Boolean).map(String);
      if(!ids.length){ids=answers.filter(a=>parentLabels.every(k=>a.text.includes(k))).slice(0,8).map(a=>a.id);}
      const pa=keywords.find(k=>k.id===parents[0]),pb=keywords.find(k=>k.id===parents[1]);if(!pa||!pb)continue;
      const mx=(pa.pos.x+pb.pos.x)/2,my=(pa.pos.y+pb.pos.y)/2,mz=(pa.pos.z+pb.pos.z)/2,n=Math.hypot(mx,my,mz)||1;
      phenomena.push({id:stableNodeId("p",label),type:"phenomenon",label,parents:parents.slice(0,2),answerIds:[...new Set(ids)],evidenceAnswerIds:[...new Set(ids)],anchors:(item?.anchors||[]).map(cleanPlainText).filter(Boolean).slice(0,8),support:Math.max(1,ids.length),score:Number(item.score)||50-phenomena.length,pos:{x:mx/n*41,y:my/n*41,z:mz/n*41},source:"refined"});
      if(phenomena.length>=64)break;
    }
    return {keywords,phenomena,pair};
  }

  function firstParagraphLead(input){
    if(!input)return "";
    let raw=String(input), blocks=[];
    if(/[<>]/.test(raw)){
      try{
        const d=document.createElement("div");d.innerHTML=raw;
        d.querySelectorAll("script,style,noscript,svg,math,iframe,object,embed,source,picture,video,audio,link,meta").forEach(el=>el.remove());
        blocks=[...d.querySelectorAll("p,blockquote,li")].map(el=>(el.textContent||"").trim()).filter(t=>t.length>=4);
        if(!blocks.length)blocks=[d.textContent||""];
      }catch{blocks=[raw];}
    }else blocks=raw.split(/\n+/).map(x=>x.trim()).filter(x=>x.length>=4);
    const badLead=/^(?:谢邀|先说结论|先讲结论|利益相关|人在|人在美国|题主|泻药|简单说|简单回答|补充|更新)[：:，,。！!、\s]*/;
    for(let paragraph of blocks.slice(0,5)){
      paragraph=cleanPlainText(paragraph).replace(/^[\s>「『“"'【\[（(·•\-—–]+/,"").replace(badLead,"").trim();
      if(!paragraph||paragraph.length<6)continue;
      const m=paragraph.match(/^(.{6,96}?[。！？!?])(?:\s|$|.)/);
      let lead=(m?.[1]||paragraph).trim();
      if(/^(?:我觉得|我认为|其实|当然|首先|其次|然后)[，,。\s]*$/.test(lead))continue;
      if(lead.length>72)lead=lead.slice(0,71)+"…";
      return lead;
    }
    const fallback=cleanPlainText(input);return fallback.length>=6?fallback.slice(0,71)+(fallback.length>71?"…":""):"";
  }

  function semanticFeatureSet(text){
    const out=new Set(),parts=segmentedWords(text).filter(x=>x.word).map(x=>x.text);
    for(const t of parts){
      if(t.length<2||t.length>10||STOP_WORDS.has(t)||FUNCTION_TOKENS.has(t)||BAD_EXACT.has(t)||GENERIC_WORDS.has(t)||isMetaToken(t)||LOW_INFO_RE.test(t))continue;
      out.add(t);if(out.size>=90)break;
    }
    return out;
  }
  function featureSimilarity(a,b){
    if(!a?.size||!b?.size)return 0;let hit=0;const small=a.size<=b.size?a:b,big=a.size<=b.size?b:a;
    for(const x of small)if(big.has(x))hit++;
    return hit/Math.sqrt(a.size*b.size);
  }
  function nodeEvidenceIds(node,answers){
    let ids=[...(node.evidenceAnswerIds||node.answerIds||[])].map(String);
    if(!ids.length&&node.type==="keyword")ids=answers.filter(a=>a.text.includes(node.label)).slice(0,12).map(a=>a.id);
    return [...new Set(ids)].slice(0,16);
  }
  function makeAnswerSatellites(answers,keywords,phenomena){
    const byAnswer=new Map(answers.map(a=>[String(a.id),a])),featureCache=new Map();
    const feat=a=>{const id=String(a.id);if(!featureCache.has(id))featureCache.set(id,semanticFeatureSet(a.text));return featureCache.get(id);};
    const nodes=[...phenomena,...keywords],profiles=new Map();
    if(!nodes.length){
      const g=Math.PI*(3-Math.sqrt(5));return answers.map((a,i)=>{const ring=24+Math.sqrt(i)*1.4,ang=g*i,elev=((i%11)-5)*1.05;return{id:`a-${String(a.id)}`,type:"answer",label:a.author||"知乎回答",answerId:String(a.id),parent:"__question__",links:[],pos:{x:Math.cos(ang)*ring,y:elev,z:Math.sin(ang)*ring}};});
    }
    for(const n of nodes){
      const ids=nodeEvidenceIds(n,answers),set=new Set();
      for(const id of ids){const a=byAnswer.get(String(id));if(!a)continue;for(const f of feat(a))set.add(f);}
      for(const a of n.anchors||[])for(const f of semanticFeatureSet(a))set.add(f);
      profiles.set(n.id,set);
    }
    const load=new Map(nodes.map(n=>[n.id,0])),assigned=new Map(nodes.map(n=>[n.id,[]])),satellites=[];
    for(const a of answers){
      const aid=String(a.id),af=feat(a);let candidates=[];
      for(const n of nodes){
        const evidence=nodeEvidenceIds(n,answers),explicit=evidence.includes(aid);
        let score=explicit?(n.type==="phenomenon"?3.4:2.8):featureSimilarity(af,profiles.get(n.id));
        if(!explicit&&n.type==="phenomenon")score*=1.12;
        score-=Math.sqrt(load.get(n.id)||0)*.008;candidates.push({n,score,explicit});
      }
      candidates.sort((x,y)=>y.score-x.score);let chosen=candidates[0]?.n;
      if(!chosen&&keywords.length)chosen=keywords[hash(aid)%keywords.length];if(!chosen)continue;
      const related=candidates.filter(x=>x.n.id!==chosen.id&&x.score>0.035).slice(0,2).map(x=>x.n.id);
      const slot=load.get(chosen.id)||0;load.set(chosen.id,slot+1);assigned.get(chosen.id)?.push(aid);
      const g=Math.PI*(3-Math.sqrt(5)),ang=g*slot+(hash(chosen.id)%100)/100,ring=2.5+Math.sqrt(slot)*.82,elev=((slot%7)-3)*.42,base=chosen.pos||{x:0,y:0,z:0};
      satellites.push({id:`a-${aid}`,type:"answer",label:a.author||"知乎回答",answerId:aid,parent:chosen.id,links:related,pos:{x:base.x+Math.cos(ang)*ring,y:base.y+elev,z:base.z+Math.sin(ang)*ring}});
    }
    // Give every meaningful expandable branch a visible evidence satellite when possible,
    // without cloning answers. We steal only from clusters that already contain >1 answer.
    const required=[...phenomena,...keywords.filter(k=>!phenomena.some(p=>p.parents?.includes(k.id)))];
    for(const n of required){
      if((assigned.get(n.id)||[]).length||!profiles.get(n.id)?.size)continue;
      let best=null;
      for(const sat of satellites){
        const donor=assigned.get(sat.parent)||[];if(donor.length<=1)continue;
        const a=byAnswer.get(String(sat.answerId));if(!a)continue;
        const score=featureSimilarity(feat(a),profiles.get(n.id));if(score>(best?.score||0))best={sat,a,score};
      }
      if(best&&best.score>0){const old=assigned.get(best.sat.parent)||[],idx=old.indexOf(String(best.sat.answerId));if(idx>=0)old.splice(idx,1);best.sat.parent=n.id;assigned.get(n.id)?.push(String(best.sat.answerId));}
    }
    // Re-layout once after balancing so every answer is still a single stable point.
    const slots=new Map();for(const sat of satellites){const parent=nodes.find(n=>n.id===sat.parent),slot=slots.get(sat.parent)||0;slots.set(sat.parent,slot+1);if(!parent)continue;const g=Math.PI*(3-Math.sqrt(5)),ang=g*slot+(hash(sat.parent)%100)/100,ring=2.5+Math.sqrt(slot)*.82,elev=((slot%7)-3)*.42;sat.pos={x:parent.pos.x+Math.cos(ang)*ring,y:parent.pos.y+elev,z:parent.pos.z+Math.sin(ang)*ring};}
    for(const n of nodes){const ids=assigned.get(n.id)||[];n.assignedAnswerIds=ids;if(ids.length){n.answerIds=[...new Set([...(n.answerIds||[]),...ids])];n.support=ids.length;if(n.type==="keyword")n.df=Math.max(Number(n.df)||0,ids.length);}}
    return satellites;
  }

  function buildSemanticGraph(question){
    const answers=(question.answers||[]).map((a,idx)=>({...a,id:String(a.id&&!/^dom-|^state-/.test(String(a.id))?a.id:`local-${hash(cleanPlainText(a.content||a.excerpt||a.text||""))}`),text:cleanPlainText(a.content||a.excerpt||a.text||"").slice(0,14000),lead:cleanPlainText(a.lead||firstParagraphLead(a.content||a.excerpt||a.text||""))})).filter(a=>looksNatural(a.text));
    let provided=normalizeProvidedSemantic(question,answers),keywords,phenomena,pair;
    if(provided){({keywords,phenomena,pair}=provided);}else{
      const picked=mineLocalKeywords(answers,question.title||"");
      keywords=picked.map((k,i)=>({id:stableNodeId("k",k.token),type:"keyword",label:k.token,score:k.score,df:k.df,answerIds:[...(k.docs||[])].slice(0,16).map(x=>answers[x]?.id).filter(Boolean),pos:{x:0,y:0,z:0},source:"local"}));
      pair=new Map();
      answers.forEach((a,idx)=>{const present=keywords.filter(k=>a.text.includes(k.label)).map(k=>k.label);for(let i=0;i<present.length;i++)for(let j=i+1;j<present.length;j++){const key=[present[i],present[j]].sort().join("\u0001");if(!pair.has(key))pair.set(key,{a:present[i],b:present[j],answers:[]});pair.get(key).answers.push(idx);}});
      layoutKeywords(keywords,pair);
      const raw=phenomenonCandidates(answers,keywords);
      phenomena=raw.map((p,i)=>{
        const a=keywords.find(k=>k.label===p.parents[0]),b=keywords.find(k=>k.label===p.parents[1]);const mx=((a?.pos.x||0)+(b?.pos.x||0))/2,my=((a?.pos.y||0)+(b?.pos.y||0))/2,mz=((a?.pos.z||0)+(b?.pos.z||0))/2,n=Math.hypot(mx,my,mz)||1;
        return{id:stableNodeId("p",p.label),type:"phenomenon",label:p.label,parents:[a?.id,b?.id].filter(Boolean),answerIds:p.answerIndexes.map(x=>answers[x]?.id).filter(Boolean),support:p.support,score:p.score,pos:{x:mx/n*(40+Math.min(4,p.support)),y:my/n*(40+Math.min(4,p.support)),z:mz/n*(40+Math.min(4,p.support))},source:"local"};
      }).filter(p=>p.parents.length>=2&&!keywords.some(k=>nearDuplicateLabel(k.label,p.label)));
    }
    const byAnswer=new Map(answers.map(a=>[String(a.id),a]));
    const satellites=makeAnswerSatellites(answers,keywords,phenomena);
    return{question,answers,keywords,phenomena,satellites,byAnswer};
  }

  function layoutKeywords(keywords, pairMap) {
    const n = keywords.length;
    if (!n) return;
    const ga = Math.PI * (3 - Math.sqrt(5));
    keywords.forEach((k, i) => {
      const y = 1 - 2 * ((i + .5) / n);
      const rr = Math.sqrt(Math.max(0, 1 - y*y));
      const a = ga * i;
      k.pos = { x: Math.cos(a)*rr*56, y: y*34, z: Math.sin(a)*rr*56 };
    });
    const idx = new Map(keywords.map((k,i) => [k.label, i]));
    const edges = [];
    for (const p of pairMap.values()) {
      const i = idx.get(p.a), j = idx.get(p.b); if (i == null || j == null) continue;
      edges.push({ i, j, w: Math.min(5, new Set(p.answers).size) });
    }
    for (let iter=0; iter<90; iter++) {
      const force = keywords.map(() => ({x:0,y:0,z:0}));
      for (let i=0;i<n;i++) for (let j=i+1;j<n;j++) {
        const a=keywords[i].pos,b=keywords[j].pos; let dx=a.x-b.x,dy=a.y-b.y,dz=a.z-b.z;
        let d2=dx*dx+dy*dy+dz*dz+4, d=Math.sqrt(d2), f=28/d2;
        dx/=d;dy/=d;dz/=d; force[i].x+=dx*f;force[i].y+=dy*f;force[i].z+=dz*f; force[j].x-=dx*f;force[j].y-=dy*f;force[j].z-=dz*f;
      }
      for (const e of edges) {
        const a=keywords[e.i].pos,b=keywords[e.j].pos; let dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z; const d=Math.hypot(dx,dy,dz)||1;
        const f=(d-34)*.00125*e.w; dx/=d;dy/=d;dz/=d;
        force[e.i].x+=dx*f;force[e.i].y+=dy*f;force[e.i].z+=dz*f; force[e.j].x-=dx*f;force[e.j].y-=dy*f;force[e.j].z-=dz*f;
      }
      for (let i=0;i<n;i++) {
        const p=keywords[i].pos, r=Math.hypot(p.x,p.y,p.z)||1, radial=(51-r)*.0032;
        force[i].x+=p.x/r*radial;force[i].y+=p.y/r*radial;force[i].z+=p.z/r*radial;
        p.x+=force[i].x;p.y+=force[i].y;p.z+=force[i].z;
      }
    }
  }

  function open(question, options={}) {
    close();
    const graph=buildSemanticGraph(question);
    return new globalThis.ZGExperience.GalaxyExplorer(graph,options);
  }
  function close(){const old=document.getElementById("zg-root");if(old){old.__zgApp?.destroy();old.remove();}document.body?.classList.remove("zg-lock-scroll");}
  globalThis.ZhihuGalaxyEngine={open,close,buildSemanticGraph,stripHtml,firstParagraphLead,labelQuality};
})();
