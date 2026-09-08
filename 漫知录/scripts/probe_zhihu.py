#!/usr/bin/env python3
"""Explicit one-query live integration probe. No API secret or raw payload is printed."""
import argparse
import asyncio
from dataclasses import replace
import json
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from backend.config import Config
from backend.store import Store
from backend.content import ContentService,ProviderError

async def main(query):
    cfg=replace(Config(),mode='live')
    service=ContentService(cfg,Store(cfg.db_path))
    result=await service.search({'id':'integration-probe','title':query},'', 'local-admin-probe')
    print(json.dumps({'mode':result['mode'],'cached':result['cached'],'count':len(result['items']),'kinds':sorted({x['kind'] for x in result['items']}),'allSourcesHaveHttpsLinks':all(x['url'].startswith('https://') for x in result['items'])},ensure_ascii=False,indent=2))

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--live',action='store_true',help='确认允许一次真实搜索；缓存未命中时消耗开发者额度')
    p.add_argument('--query',default='如何发现自己的兴趣')
    a=p.parse_args()
    if not a.live:p.error('必须显式传 --live；本脚本不会默认消耗真实额度。')
    if not 2<=len(a.query)<=180:p.error('query 长度需要为 2–180 个字符')
    try:asyncio.run(main(a.query))
    except ProviderError as e:print(f'接入检查未通过（{e.status}）：{e}',file=sys.stderr);sys.exit(1)
