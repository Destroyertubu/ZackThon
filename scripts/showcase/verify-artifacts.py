"""Inspect real MP4 deliveries with FFmpeg; run in the isolated worker image."""
import argparse
import json
import pathlib
import re
import subprocess


def run(*args):
    result = subprocess.run(args, capture_output=True, text=True, timeout=180)
    if result.returncode:
        raise RuntimeError(result.stderr[-1800:])
    return result.stdout + result.stderr


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('directory')
    args = parser.parse_args()
    directory = pathlib.Path(args.directory)
    review = directory / 'review'
    review.mkdir(exist_ok=True)
    report = {'files': {}, 'frames': []}
    for filename in ['output.mp4', 'output-clean.mp4']:
        probe = json.loads(run('ffprobe', '-v', 'error', '-show_entries',
                              'format=duration,size:stream=codec_name,codec_type,width,height,nb_frames,r_frame_rate,pix_fmt',
                              '-of', 'json', str(directory / filename)))
        video = next(stream for stream in probe['streams'] if stream['codec_type'] == 'video')
        assert video['codec_name'] == 'h264' and video['width'] == 1920 and video['height'] == 1080
        assert video['r_frame_rate'] == '30/1' and video['nb_frames'] == '5400'
        assert abs(float(probe['format']['duration']) - 180) < 0.05
        assert any(stream['codec_name'] == 'aac' for stream in probe['streams'])
        report['files'][filename] = probe
    for second in [2, 6, 10, 67, 105, 120, 138, 143, 148, 158, 174, 175, 177, 179]:
        filename = f'frame-{second:03}.png'
        run('ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-ss', str(second),
            '-i', str(directory / 'output.mp4'), '-frames:v', '1', '-update', '1', str(review / filename))
        report['frames'].append(filename)
    run('ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-ss', '67',
        '-i', str(directory / 'output-clean.mp4'), '-frames:v', '1', '-update', '1', str(review / 'clean-067.png'))
    run('ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(directory / 'output.mp4'),
        '-vn', '-c:a', 'pcm_s16le', str(review / 'mixed-audio.wav'))
    frozen = run('ffmpeg', '-hide_banner', '-ss', '175', '-i', str(directory / 'output.mp4'),
                 '-t', '5', '-vf', 'mpdecimate,showinfo', '-an', '-f', 'null', '-')
    unique_frames = len(re.findall(r'\[Parsed_showinfo_[^\]]+\]\s+n:\s*\d+', frozen))
    report['freezeSignificantFrames'] = unique_frames
    assert unique_frames == 1, f'Last five seconds contain {unique_frames} distinct frames'
    result = run('ffmpeg', '-hide_banner', '-i', str(review / 'frame-177.png'),
                 '-i', str(review / 'frame-179.png'), '-lavfi', 'ssim', '-frames:v', '1', '-f', 'null', '-')
    report['freezeSSIM'] = float(re.findall(r'All:([0-9.]+)', result)[-1])
    # A repeated still may differ slightly after lossy H.264 quantization.
    # mpdecimate above tests visible motion; retain SSIM as measured evidence.
    assert report['freezeSSIM'] > .99, 'Final frozen image drifted'
    closing = run('ffmpeg', '-hide_banner', '-i', str(directory / 'closing.png'),
                  '-i', str(review / 'frame-177.png'), '-lavfi', 'ssim', '-frames:v', '1', '-f', 'null', '-')
    report['closingSSIM'] = float(re.findall(r'All:([0-9.]+)', closing)[-1])
    assert report['closingSSIM'] > .97, 'Closing PNG differs from the encoded finale'
    (review / 'validation.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps({'format': 'passed', 'freeze': 'passed', 'freezeSSIM': report['freezeSSIM'], 'review': str(review)}))


if __name__ == '__main__':
    main()
