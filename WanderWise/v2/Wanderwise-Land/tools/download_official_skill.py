#!/usr/bin/env python3
"""Download the exact user-provided official archive and safely inspect/extract it.
Does not execute any downloaded installation script or alter agent configuration.
"""
import argparse,hashlib,json,stat,sys,urllib.request,zipfile,io
from pathlib import Path,PurePosixPath
URL='https://developer-cdn.zhihu.com/zhihu-cli/releases/beta/skill/0.5.3-beta.20260904115023/zhihu-cli-skill-0.5.3-beta.20260904115023.zip'
def main():
    p=argparse.ArgumentParser();p.add_argument('--output',type=Path,default=Path('official-skill-local'));args=p.parse_args()
    try:
        req=urllib.request.Request(URL,headers={'User-Agent':'Wanderwise-Explicit-Skill-Download/1.0'})
        with urllib.request.urlopen(req,timeout=20) as r:
            if not r.geturl().startswith('https://developer-cdn.zhihu.com/'):raise ValueError('下载跳转到非预期域名')
            body=r.read(10_000_001)
        if len(body)>10_000_000:raise ValueError('压缩包超过大小限制')
        z=zipfile.ZipFile(io.BytesIO(body));members=z.infolist()
        if len(members)>1000 or sum(x.file_size for x in members)>30_000_000:raise ValueError('压缩包展开大小超过限制')
        for m in members:
            posix=PurePosixPath(m.filename)
            if posix.is_absolute() or '..' in posix.parts or '\\' in m.filename or ':' in m.filename or stat.S_ISLNK(m.external_attr>>16):raise ValueError('压缩包含不安全路径或符号链接')
        args.output.mkdir(parents=True,exist_ok=True)
        if any(args.output.iterdir()):raise ValueError('目标目录不是空目录；未覆盖已有文件')
        z.extractall(args.output)
        manifest={'url':URL,'version':'0.5.3-beta.20260904115023','sha256':hashlib.sha256(body).hexdigest(),'files':[x.filename for x in members],'note':'该 SHA-256 是本次下载校验值，不是官方签名。未执行任何下载的脚本。'}
        (args.output/'DOWNLOAD_MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
        print('已下载并安全解压：',args.output);print('SHA-256：',manifest['sha256']);print('请阅读其中 SKILL.md 和 HTTP/OAuth/黑客松文档，再完成真实联调。');return 0
    except Exception as e:
        print('官方包下载/检查失败：'+str(e),file=sys.stderr);return 2
if __name__=='__main__':sys.exit(main())
