#!/usr/bin/env python3
"""Copy the real CC0 ambientCG ivy atlas into the garden's runtime texture set.

Run: python3 scripts/prepare-garden-ivy.py
No account, image synthesis, texture repainting, or paid service is used.
"""
from pathlib import Path
import hashlib
import json
import os
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
CACHE = Path(os.environ.get('GARDEN_DETAILS_CACHE', '/tmp/wanderwise-garden-details-source')) / 'ambientcg'
OUTPUT = ROOT / 'public/models/garden/details/ivy'
URL = 'https://ambientcg.com/get?file=LeafSet029_1K-JPG.zip'
ZIP_SHA256 = '27e0fcca8359a6669a5bd4ec990dfa70b3bf17d6d3826777d2b447ebe56aee6f'


def main():
    CACHE.mkdir(parents=True, exist_ok=True)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    archive = CACHE / 'LeafSet029_1K-JPG.zip'
    if not archive.exists():
        request = urllib.request.Request(URL, headers={'User-Agent': 'WanderwiseGardenAssetSelection/1.0'})
        with urllib.request.urlopen(request) as response:
            archive.write_bytes(response.read())
    assert hashlib.sha256(archive.read_bytes()).hexdigest() == ZIP_SHA256, archive
    files = []
    with zipfile.ZipFile(archive) as source:
        assert source.testzip() is None
        for channel, filename in [('Color', 'ivy-color.jpg'), ('Opacity', 'ivy-opacity.jpg'), ('NormalGL', 'ivy-normal.jpg')]:
            data = source.read(f'LeafSet029_1K-JPG_{channel}.jpg')
            (OUTPUT / filename).write_bytes(data)
            files.append({'file': filename, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
    report = {'name': 'Leaf Set 029', 'creator': 'ambientCG / Lennart Demes', 'license': 'CC0-1.0',
              'source': 'https://ambientcg.com/view?id=LeafSet029', 'licenseURL': 'https://docs.ambientcg.com/license/',
              'downloadURL': URL, 'downloadBytes': archive.stat().st_size,
              'downloadSHA256': hashlib.sha256(archive.read_bytes()).hexdigest(),
              'method': 'Photometric Stereo', 'atlasDimensionsMeters': [.25, .25],
              'verifiedAt': '2026-09-13', 'files': files,
              'runtimeBytes': sum(file['bytes'] for file in files)}
    (OUTPUT / 'asset-report.json').write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
