#!/usr/bin/env python3
"""Real loopback TCP smoke test against an isolated Uvicorn process, not an ASGI mock."""
from pathlib import Path
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import httpx

ROOT=Path(__file__).resolve().parents[1]

def main():
    with tempfile.TemporaryDirectory() as tmp:
        with socket.socket() as s:
            s.bind(('127.0.0.1',0));port=s.getsockname()[1]
        base=f'http://127.0.0.1:{port}'
        env=dict(os.environ,ZHIYE_DB=str(Path(tmp)/'http-test.db'),ZHIYE_MODE='demo',ZHIYE_SECURE_COOKIE='0',ZHIYE_ALLOWED_ORIGINS=base)
        process=subprocess.Popen([sys.executable,'run.py','--port',str(port)],cwd=ROOT,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
        try:
            with httpx.Client(base_url=base,timeout=5,trust_env=False) as client:
                for attempt in range(40):
                    try:
                        health=client.get('/api/health');health.raise_for_status();break
                    except httpx.HTTPError:
                        if process.poll() is not None:raise RuntimeError('Server exited during startup')
                        time.sleep(.15)
                else:raise RuntimeError('Server startup timed out')
                assert health.json()['mode']=='demo'
                assert client.get('/').status_code==200
                assert client.get('/static/js/app.js').status_code==200
                assert 'API 契约' in client.get('/api/docs').text
                session=client.post('/api/session');session.raise_for_status()
                assert 'HttpOnly' in session.headers['set-cookie']
                w=client.post('/api/worlds',json={'seed':'如何找到自己的热爱？'},headers={'Origin':base});w.raise_for_status();wid=w.json()['id']
                content=client.get(f'/api/worlds/{wid}/nodes/root/content');content.raise_for_status()
                assert all(x['kind']=='demo_original' for x in content.json()['items'])
                assert client.get('/api/journeys').status_code==200
                assert client.post('/api/worlds',json={'seed':'测试'},headers={'Origin':'https://evil.example'}).status_code==403
                result={'passed':True,'transport':'real loopback TCP / Uvicorn / httpx','browserNetworkTest':False,'checks':['server startup','HTML and ESM static files','local API docs','HTTP-only session cookie and authenticated follow-up','world creation','demo content endpoint','origin rejection']}
                (ROOT/'previews/http-smoke.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
                print(json.dumps(result,ensure_ascii=False,indent=2))
        finally:
            process.terminate()
            try:process.wait(timeout=5)
            except subprocess.TimeoutExpired:process.kill();process.wait(timeout=5)

if __name__=='__main__':main()
