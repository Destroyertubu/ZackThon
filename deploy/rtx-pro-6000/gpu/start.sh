#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
task_state="/home/xiayouyang/.local/state/wanderwise-gpu"
mkdir -p "$task_state/ipc"
chmod 2770 "$task_state/ipc"
if [ ! -f "$task_state/session.env" ]; then
  /usr/bin/python3 - "$task_state/session.env" <<'PY'
import os, secrets, sys
fd = os.open(sys.argv[1], os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, 'w') as out:
    out.write('PASSWD=\nSELKIES_BASIC_AUTH_USER=wanderwise\nSELKIES_BASIC_AUTH_PASSWORD=' + secrets.token_urlsafe(24) + '\n')
PY
fi
if docker container inspect wanderwise-v4-gpu >/dev/null 2>&1; then
  docker start wanderwise-v4-gpu
  exit 0
fi
docker run -d --name wanderwise-v4-gpu --restart unless-stopped --init \
  --network none --cap-drop ALL --security-opt no-new-privileges=true \
  --runtime nvidia --gpus device=GPU-e796262d-3449-6af1-586d-8460d8836d1b \
  --device /dev/dri/renderD130 --group-add 1014 --group-add "$(stat -c %g /dev/dri/renderD130)" \
  --shm-size 2g --memory 12g --cpus 8 --pids-limit 1024 \
  --env-file "$task_state/session.env" \
  --mount "type=bind,src=$task_state/ipc,dst=/run/wanderwise" \
  --mount type=volume,src=wanderwise-v4-gpu-profile,dst=/home/ubuntu/wanderwise-profile \
  --log-opt max-size=10m --log-opt max-file=3 \
  wanderwise-gpu:20260913
