#!/usr/bin/env python3
"""Launch Wanderwise without Node/npm. Creates a local venv when needed.
--live reads the developer key from the terminal without echo or disk persistence.
"""
from __future__ import annotations
import argparse,getpass,importlib.util,os,subprocess,sys,threading,venv,webbrowser
from pathlib import Path
ROOT=Path(__file__).resolve().parent

def main():
    p=argparse.ArgumentParser(description='Wanderwise Land · 漫知录')
    p.add_argument('--live',action='store_true',help='安全输入服务端 Access Secret；不写入文件')
    p.add_argument('--host',default='127.0.0.1');p.add_argument('--port',type=int,default=8000)
    p.add_argument('--no-browser',action='store_true');p.add_argument('--use-current',action='store_true',help='使用已安装依赖的当前 Python，不创建虚拟环境')
    p.add_argument('--no-install',action='store_true',help='缺少依赖时退出，不连接软件源')
    args=p.parse_args()
    if sys.version_info<(3,11):p.error('需要 Python 3.11 或更高版本；本包在 Python 3.13 测试。')
    os.chdir(ROOT)
    in_venv=Path(sys.prefix).resolve()==(ROOT/'.venv').resolve()
    if not args.use_current and not in_venv:
        exe=ROOT/'.venv'/('Scripts/python.exe' if os.name=='nt' else 'bin/python')
        if not exe.exists():
            if args.no_install:p.error('本项目虚拟环境不存在；可使用 --use-current 或允许首次安装。')
            print('正在创建项目虚拟环境 .venv …',flush=True);venv.EnvBuilder(with_pip=True).create(ROOT/'.venv')
        checked=subprocess.run([str(exe),'-c','import fastapi,uvicorn,pydantic,httpx'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        if checked.returncode:
            if args.no_install:p.error('虚拟环境缺少依赖。')
            print('首次安装 Python 依赖；完成后演示路线不再需要外网。',flush=True)
            installed=subprocess.run([str(exe),'-m','pip','install','-r',str(ROOT/'requirements.txt')])
            if installed.returncode:print('依赖安装失败；请检查网络。未启动应用。',file=sys.stderr);return 2
        return subprocess.call([str(exe),str(ROOT/'start.py'),*sys.argv[1:]])
    missing=[x for x in ('fastapi','uvicorn','pydantic','httpx') if importlib.util.find_spec(x) is None]
    if missing:p.error('缺少依赖：'+', '.join(missing)+'。运行 pip install -r requirements.txt。')
    if args.live:
        secret=getpass.getpass('知乎 Access Secret（隐藏输入，仅存在当前服务进程中）：').strip()
        if not secret:p.error('输入为空；未启动实时模式。')
        os.environ['ZHIHU_ACCESS_SECRET']=secret
    secret_file=os.getenv('ZHIHU_ACCESS_SECRET_FILE')
    if secret_file and not os.getenv('ZHIHU_ACCESS_SECRET'):
        os.environ['ZHIHU_ACCESS_SECRET']=Path(secret_file).read_text().strip()
    display_host='127.0.0.1' if args.host in ('0.0.0.0','::') else args.host
    url=f'http://{display_host}:{args.port}'
    print('\n漫知录 · Wanderwise Land\n'+url+'\n数据目录：'+str(ROOT/'data')+'\nCtrl+C 停止。不要同时启动多个 SQLite 实例。',flush=True)
    if os.getenv('ZHIHU_ACCESS_SECRET'):print('已配置服务端凭证；是否有效仍以实际接口结果为准。')
    else:print('未配置开发者凭证；原创演示路线可用，不冒充真实知乎数据。')
    if not args.no_browser:threading.Timer(1.4,lambda:webbrowser.open(url)).start()
    import uvicorn
    uvicorn.run('backend.app.main:app',host=args.host,port=args.port,access_log=False,log_level='warning',workers=1)
    return 0
if __name__=='__main__':
    try:sys.exit(main())
    except KeyboardInterrupt:pass
