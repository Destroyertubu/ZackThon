#!/usr/bin/env python3
"""SQLite online backup: includes committed WAL data. No raw file-copy race."""
import argparse,sqlite3,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from backend.app import db
p=argparse.ArgumentParser();p.add_argument('destination',type=Path);a=p.parse_args()
if a.destination.exists():p.error('备份目标已存在；不会覆盖。')
if not db.path().exists():p.error('数据库不存在。')
a.destination.parent.mkdir(parents=True,exist_ok=True)
with db.connect() as source,sqlite3.connect(a.destination) as target:
    source.backup(target)
    if target.execute('PRAGMA integrity_check').fetchone()[0]!='ok':raise RuntimeError('备份完整性检查未通过')
print('备份完成：',a.destination,'（包含访客私人数据，请妥善保护）')
