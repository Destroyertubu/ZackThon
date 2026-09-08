"""Small, explicit configuration; .env never reaches the web server."""
from dataclasses import dataclass
from pathlib import Path
import os

ROOT = Path(__file__).resolve().parents[1]

def load_dotenv() -> None:
    p = ROOT / '.env'
    if p.exists():
        for line in p.read_text(encoding='utf-8').splitlines():
            s = line.strip()
            if s and not s.startswith('#') and '=' in s:
                key, value = s.split('=', 1)
                os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))

load_dotenv()

@dataclass(frozen=True)
class Config:
    mode: str = os.getenv('ZHIYE_MODE', 'demo')
    db_path: str = os.getenv('ZHIYE_DB', str(ROOT / 'data/zhiye.sqlite3'))
    secret: str = os.getenv('ZHIHU_ACCESS_SECRET', '')
    provider: str = os.getenv('ZHIYE_PROVIDER', 'http')
    cli_path: str = os.getenv('ZHIHU_CLI_PATH', 'zhihu-cli')
    schema_file: str = os.getenv('ZHIHU_SCHEMA_FILE', '')
    upstream_limit: int = int(os.getenv('ZHIHU_SEARCH_DAILY_LIMIT', '5000'))
    guest_limit: int = int(os.getenv('ZHIYE_GUEST_DAILY_LIMIT', '80'))
    # Zero (or a negative value) keeps successful searches locally without an
    # automatic refresh. A positive value explicitly opts into a freshness TTL.
    cache_seconds: int = int(os.getenv('ZHIYE_CACHE_SECONDS', '0'))
    origins: tuple[str, ...] = tuple(os.getenv('ZHIYE_ALLOWED_ORIGINS', 'http://127.0.0.1:8000,http://localhost:8000').split(','))
    secure_cookie: bool = os.getenv('ZHIYE_SECURE_COOKIE', '0') == '1'
    admin_token: str = os.getenv('ZHIYE_ADMIN_TOKEN', '')
