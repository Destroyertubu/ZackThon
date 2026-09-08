#!/usr/bin/env python3
"""Download the exact user-supplied official Skill ZIP; never execute its contents.
Network failure is reported, not replaced by an unofficial/generated Skill.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import stat
import sys
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
import zipfile

URL='https://developer-cdn.zhihu.com/zhihu-cli/releases/beta/skill/0.5.3-beta.20260904115023/zhihu-cli-skill-0.5.3-beta.20260904115023.zip'
ROOT=Path(__file__).resolve().parents[1]
LIMIT=40*1024*1024

def download_and_extract(output:Path):
    output=output.resolve()
    req=Request(URL,headers={'User-Agent':'Zhiye-Official-Skill-Downloader/1.0'})
    with urlopen(req,timeout=35) as response:
        host=urlsplit(response.url).hostname or ''
        if urlsplit(response.url).scheme!='https' or not(host=='zhihu.com' or host.endswith('.zhihu.com')):
            raise ValueError('下载跳转离开知乎 HTTPS 域名，已停止。')
        raw=response.read(LIMIT+1)
    if len(raw)>LIMIT:raise ValueError('压缩包超过 40 MiB，已停止。')
    archive=zipfile.ZipFile(io.BytesIO(raw));items=archive.infolist()
    if len(items)>2000 or sum(x.file_size for x in items)>100*1024*1024:
        raise ValueError('压缩包解压体积或文件数过大。')
    for info in items:
        p=PurePosixPath(info.filename)
        if p.is_absolute() or '..' in p.parts or '\\' in info.filename or ':' in info.filename or stat.S_ISLNK(info.external_attr>>16):
            raise ValueError('压缩包含有不安全的路径或符号链接。')
    if output.exists() and any(output.iterdir()):
        raise ValueError('输出目录非空，请使用新的目录，避免覆盖已核验的 Skill。')
    output.mkdir(parents=True,exist_ok=True)
    for info in items:
        destination=output.joinpath(*PurePosixPath(info.filename).parts)
        if info.is_dir():destination.mkdir(parents=True,exist_ok=True)
        else:
            destination.parent.mkdir(parents=True,exist_ok=True)
            destination.write_bytes(archive.read(info))
    manifest={'source':URL,'sha256':hashlib.sha256(raw).hexdigest(),'files':len(items),'bytes':len(raw),'executed':False,'notice':'哈希只标识本次下载文件，不是官方签名或预先核验的摘要。'}
    (output/'DOWNLOAD_RECEIPT.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(manifest,ensure_ascii=False,indent=2))
    print('下载完成；请人工检查 Skill 的安装说明、权限和只读搜索用法。脚本没有执行或安装其中的代码。')

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,default=ROOT/'vendor/official-skill')
    args=parser.parse_args()
    try:download_and_extract(args.output)
    except Exception as exc:
        print('官方 Skill 未下载完成：'+str(exc),file=sys.stderr);sys.exit(1)
