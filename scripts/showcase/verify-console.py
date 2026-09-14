"""Read access code privately and verify the isolated showcase control surface."""
import argparse
import http.cookiejar
import json
import pathlib
import time
import urllib.error
import urllib.parse
import urllib.request


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('url')
    parser.add_argument('access_file')
    parser.add_argument('--start-smoke', action='store_true')
    parser.add_argument('--start-full', action='store_true')
    parser.add_argument('--test-cancel', action='store_true')
    parser.add_argument('--verify-job', help='Validate all authenticated artifact downloads without copying entire videos')
    args = parser.parse_args()
    base = args.url.rstrip('/')
    origin = '{0.scheme}://{0.netloc}'.format(urllib.parse.urlsplit(base))
    code = next(line.split('=', 1)[1] for line in pathlib.Path(args.access_file).read_text().splitlines()
                if line.startswith('SELKIES_BASIC_AUTH_PASSWORD='))
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def request(path, payload=None, wrong_origin=False):
        headers = {'Origin': 'https://invalid.example' if wrong_origin else origin}
        if payload is not None:
            headers['Content-Type'] = 'application/json'
        req = urllib.request.Request(base + path, data=json.dumps(payload).encode() if payload is not None else None, headers=headers)
        try:
            with opener.open(req, timeout=30) as response:
                raw = response.read()
                return response.status, json.loads(raw) if 'application/json' in response.headers.get('Content-Type', '') else None
        except urllib.error.HTTPError as error:
            raw = error.read()
            try:
                value = json.loads(raw)
            except ValueError:
                value = None
            return error.code, value

    assert request('/showcase/api/status')[0] == 401
    assert request('/showcase/api/start', {'mode': 'smoke'})[0] == 401
    assert request('/__showcase/next')[0] == 404
    login = urllib.request.Request(base + '/showcase/login', data=urllib.parse.urlencode({'code': code}).encode(), headers={'Origin': origin, 'Content-Type': 'application/x-www-form-urlencoded'})
    with opener.open(login, timeout=30) as response:
        assert response.status == 200
    assert request('/showcase/api/start', {'mode': 'smoke'}, wrong_origin=True)[0] == 403
    assert request('/showcase/api/status')[0] == 200
    print(json.dumps({'accessBoundary': 'passed', 'privateCommandRoute': 'not exposed'}), flush=True)
    if args.verify_job:
        status, value = request('/showcase/api/jobs/' + args.verify_job)
        assert status == 200 and value['job']['status'] == 'completed'
        artifacts = ['download', 'clean', 'audio', 'subtitles', 'closing', 'script', 'introduction', 'short', 'storyboard', 'evidence']
        for artifact in artifacts:
            url = base + '/showcase/api/jobs/' + args.verify_job + '/' + artifact
            try:
                urllib.request.urlopen(url, timeout=30)
                raise AssertionError('Artifact exposed without authentication')
            except urllib.error.HTTPError as error:
                assert error.code == 401
            req = urllib.request.Request(url, headers={'Range': 'bytes=0-1023'})
            with opener.open(req, timeout=30) as response:
                chunk = response.read(1024)
                assert response.status in (200, 206) and chunk
                assert 'no-store' in response.headers.get('Cache-Control', '')
                if artifact in ('download', 'clean'):
                    assert response.status == 206 and chunk[4:8] == b'ftyp'
        print(json.dumps({'downloads': 'passed', 'jobId': args.verify_job, 'artifacts': artifacts}), flush=True)
    if not (args.start_smoke or args.start_full or args.test_cancel):
        return
    status, value = request('/showcase/api/start', {'mode': 'full' if args.start_full else 'smoke'})
    assert status == 202, (status, value)
    job_id = value['job']['id']
    assert request('/showcase/api/start', {'mode': 'smoke'})[0] == 409
    if args.test_cancel:
        started = time.monotonic()
        assert request('/showcase/api/jobs/' + job_id + '/cancel', {})[0] == 200
        assert time.monotonic() - started < 15
        status, value = request('/showcase/api/jobs/' + job_id)
        assert status == 200 and value['job']['status'] == 'cancelled'
        print(json.dumps({'cancellation': 'passed', 'jobId': job_id}), flush=True)
        return
    deadline = time.time() + (1000 if args.start_full else 240)
    previous = None
    while time.time() < deadline:
        status, value = request('/showcase/api/jobs/' + job_id)
        assert status == 200
        job = value['job']
        marker = (job['status'], job.get('shotId'))
        if marker != previous:
            print(json.dumps(job, ensure_ascii=False), flush=True)
            previous = marker
        if job['status'] in ('completed', 'failed', 'cancelled'):
            if job['status'] != 'completed':
                raise RuntimeError('Recording verification did not complete')
            return
        time.sleep(2)
    raise TimeoutError('Recording did not complete within the verification deadline')


if __name__ == '__main__':
    main()
