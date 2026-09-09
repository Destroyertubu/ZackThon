#!/usr/bin/env python3
"""Explicit live, read-only verification. No background crawling; no publishing.
Default: list metadata only. --work-id loads exactly one listed work; --first-work
loads the first item only. --search issues one cached search. No real AI call.
"""
from __future__ import annotations
import argparse,getpass,hashlib,json,os,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from backend.app import db,providers
from backend.app.errors import AppError

def main():
    parser=argparse.ArgumentParser(description='知乎 API 最小核验，不发布内容')
    parser.add_argument('--search',help='一次搜索，成功后缓存；2–100 字')
    parser.add_argument('--work-id',help='从真实列表选择的作品 ID，不猜造')
    parser.add_argument('--first-work',action='store_true',help='明确授权：从目录选择第一个作品，读取一个详情')
    parser.add_argument('--prompt-key',action='store_true',help='隐藏输入开发者 Access Secret')
    args=parser.parse_args()
    if args.prompt_key:os.environ['ZHIHU_ACCESS_SECRET']=getpass.getpass('Access Secret（隐藏输入，不落盘）：').strip()
    db.init();report={'checkedAt':db.now(),'scope':'explicit read-only verification','checks':[],'realAiCall':False}
    if args.search:
        try:
            cs,mode,at=providers.search(args.search)
            record={'capability':'search','status':'passed','count':len(cs),'dataMode':mode,'sourceFetchedAt':at,
              'samples':[{'contentId':x['id'],'externalId':x['externalId'],'title':x['title'],'coverage':x['coverage'],'sourceUrl':x['sourceUrl'],'snapshotId':x['snapshotId']} for x in cs[:2]]}
            # Add a verified search route without exporting bodies.
            preset={'id':'verified-search-'+hashlib.sha256(args.search.encode()).hexdigest()[:16],'seedText':args.search,'description':'由核验工具生成的真实知乎搜索缓存路线','contentIds':[x['id'] for x in cs],'sourceFetchedAt':at,'dataMode':'cached','sourceLabel':'知乎搜索'}
            with db.tx() as c:c.execute('INSERT OR REPLACE INTO presets VALUES(?,?)',(preset['id'],db.dumps(preset)))
            report['checks'].append(record)
        except AppError as e:report['checks'].append({'capability':'search','status':'failed','error':e.public()})
    try:
        items=providers.knowledge_list();report['checks'].append({'capability':'knowledge_list','status':'passed','count':len(items),'sampleIds':[x['id'] for x in items[:3]]})
        wid=args.work_id or (items[0]['id'] if args.first_work and items else None)
        if wid:
            cs,mode,at=providers.knowledge(wid);x=cs[0];report['checks'].append({'capability':'knowledge_body','status':'passed','workId':x['workId'],'title':x['title'],'coverage':x['coverage'],'canEnterField':x['canEnterField'],'paragraphCount':len(x['paragraphs']),'snapshotId':x['snapshotId'],'sourceFetchedAt':at,'dataMode':mode})
    except AppError as e:report['checks'].append({'capability':'knowledge','status':'failed','error':e.public()})
    report['allRequestedChecksPassed']=all(x['status']=='passed' for x in report['checks'])
    out=ROOT/'reports';out.mkdir(exist_ok=True);file=out/('live_verification_'+db.now().replace(':','-')+'.json');file.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False,indent=2));print('已写入脱敏报告：',file)
    return 0 if report['allRequestedChecksPassed'] else 2
if __name__=='__main__':sys.exit(main())
