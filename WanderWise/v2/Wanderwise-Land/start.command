#!/bin/bash
set -e
cd "$(dirname "$0")"
if ! command -v python3 >/dev/null; then echo "请先安装 Python 3.11 或更高版本。"; read -r; exit 1; fi
python3 start.py "$@"
