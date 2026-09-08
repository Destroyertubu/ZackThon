"""Start Zhiye from any working directory: python run.py [--port 8000]."""
import argparse
import os
from pathlib import Path
import sys

def main():
    parser=argparse.ArgumentParser(description='知野：知识群岛探索')
    parser.add_argument('--host',default='127.0.0.1')
    parser.add_argument('--port',type=int,default=8000)
    parser.add_argument('--reload',action='store_true')
    args=parser.parse_args()
    if not 1<=args.port<=65535:parser.error('端口必须为 1–65535')
    root=Path(__file__).resolve().parent;os.chdir(root)
    try:import uvicorn
    except ImportError:
        print('请先运行：python -m pip install -r requirements.txt',file=sys.stderr);sys.exit(1)
    print(f'知野启动地址：http://{args.host}:{args.port}')
    if not (root/'node_modules/three/build/three.module.js').exists():
        print('Three.js 未安装：将使用可操作的软件三维模式。增强画面请运行 npm install 后重启。')
    uvicorn.run('backend.main:app',host=args.host,port=args.port,reload=args.reload,workers=1)

if __name__=='__main__':main()
