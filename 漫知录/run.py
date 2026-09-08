"""Start 漫知录 from any working directory: python run.py [--live] [--port 8000]."""
import argparse
import os
from pathlib import Path
import sys


def official_cli_path():
    """Locate the official user install without executing it or reading credentials."""
    explicit = os.environ.get('ZHIHU_CLI_PATH', '').strip()
    if explicit:
        binary = Path(explicit).expanduser()
        if not binary.is_absolute():
            raise ValueError('ZHIHU_CLI_PATH 必须是官方 CLI 可执行文件的绝对路径。')
    else:
        configured_home = os.environ.get('ZHIHU_CLI_HOME', '').strip()
        if configured_home:
            cli_home = Path(configured_home).expanduser()
        elif sys.platform == 'darwin':
            cli_home = Path.home() / 'Library' / 'Application Support' / 'zhihu-cli'
        elif sys.platform == 'win32':
            cli_home = Path(os.environ.get('LOCALAPPDATA', str(Path.home() / 'AppData' / 'Local'))) / 'ZhihuCLI'
        else:
            data_home = Path(os.environ.get('XDG_DATA_HOME') or str(Path.home() / '.local' / 'share')).expanduser()
            cli_home = data_home / 'zhihu-cli'
        if not cli_home.is_absolute():
            raise ValueError('ZHIHU_CLI_HOME / XDG_DATA_HOME 必须指向绝对路径。')
        binary = cli_home / 'current' / ('zhihu-cli.exe' if sys.platform == 'win32' else 'zhihu-cli')
    if not binary.is_file() or not os.access(binary, os.X_OK):
        raise ValueError(
            f'未找到可执行的官方知乎 CLI：{binary}。请先用官方 Skill 安装 CLI，'
            '或设置 ZHIHU_CLI_PATH 为其绝对路径。实时模式未启动，也不会切换为演示内容。'
        )
    return binary.resolve()


def configure_local_origins(root, host, port):
    """Respect explicit environment/.env origins; otherwise follow the chosen port."""
    if 'ZHIYE_ALLOWED_ORIGINS' in os.environ:
        return
    env_file = root / '.env'
    if env_file.exists():
        # Only detect this non-secret setting. Config will load its actual value;
        # do not import Config early or copy other .env values into this launcher.
        with env_file.open(encoding='utf-8') as lines:
            for line in lines:
                stripped = line.strip()
                if stripped and not stripped.startswith('#') and '=' in stripped:
                    key = stripped.partition('=')[0].strip()
                    if key == 'ZHIYE_ALLOWED_ORIGINS':
                        return
    origins = [f'http://127.0.0.1:{port}', f'http://localhost:{port}']
    if host not in ('127.0.0.1', 'localhost', '0.0.0.0', '::'):
        hostname = f'[{host}]' if ':' in host and not host.startswith('[') else host
        origins.append(f'http://{hostname}:{port}')
    os.environ['ZHIYE_ALLOWED_ORIGINS'] = ','.join(origins)


def main():
    parser=argparse.ArgumentParser(description='漫知录：三维词云探索与精神家园')
    parser.add_argument('--host',default='127.0.0.1')
    parser.add_argument('--port',type=int,default=8000)
    parser.add_argument('--reload',action='store_true')
    parser.add_argument('--live',action='store_true',help='通过已安装的官方知乎 CLI 搜索真实内容；使用 CLI 已配置的系统凭据')
    args=parser.parse_args()
    if not 1<=args.port<=65535:parser.error('端口必须为 1–65535')
    root=Path(__file__).resolve().parent;os.chdir(root)
    configure_local_origins(root, args.host, args.port)
    if args.live:
        try:
            cli_path = official_cli_path()
        except ValueError as error:
            parser.error(str(error))
        # Set these before importing the application, whose Config reads environment
        # at import time. The CLI itself obtains its credential from the OS store.
        os.environ.update({
            'ZHIYE_MODE': 'live',
            'ZHIYE_PROVIDER': 'cli',
            'ZHIHU_CLI_PATH': str(cli_path),
            'ZHIHU_SCHEMA_FILE': str(root / 'backend' / 'schema.cli.json'),
        })
    try:import uvicorn
    except ImportError:
        print('请先运行：python -m pip install -r requirements.txt',file=sys.stderr);sys.exit(1)
    print(f'漫知录启动地址：http://{args.host}:{args.port}')
    if args.live:
        print(f'知乎实时模式 · 官方 CLI：{cli_path}')
        print('使用 CLI 已配置的系统凭据；开始探索时才按需查询知乎内容。')
    if not (root/'node_modules/three/build/three.module.js').exists():
        print('Three.js 未安装：将使用可操作的软件三维模式。增强画面请运行 npm install 后重启。')
    uvicorn.run('backend.main:app',host=args.host,port=args.port,reload=args.reload,workers=1)

if __name__=='__main__':main()
