#!/usr/bin/env python3
"""Generate the fixed judge-demo narration locally with macOS Tingting.

Source: docs/showcase/storyboard.json. No network calls or third-party packages.
Run with --check on any Python 3 host to verify the committed deliverables.
"""

import argparse
import array
import hashlib
import json
import subprocess
import sys
import tempfile
import unicodedata
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs/showcase/storyboard.json"
OUTPUT = ROOT / "public/showcase"
RATE = 48000
BYTES_PER_FRAME = 2
SHOT_IDS = ["opening", "explore", "annotate", "footprints", "home", "mix", "montage", "finale"]


def wave_read(path):
    with wave.open(str(path), "rb") as source:
        if (source.getnchannels(), source.getsampwidth(), source.getframerate()) != (1, 2, RATE):
            raise ValueError(f"Expected 48 kHz mono PCM16: {path}")
        return source.readframes(source.getnframes())


def wave_write(path, pcm):
    with wave.open(str(path), "wb") as target:
        target.setnchannels(1)
        target.setsampwidth(BYTES_PER_FRAME)
        target.setframerate(RATE)
        target.writeframes(pcm)


def timecode(seconds):
    milliseconds = round(seconds * 1000)
    hours, remainder = divmod(milliseconds, 3600000)
    minutes, remainder = divmod(remainder, 60000)
    seconds, milliseconds = divmod(remainder, 1000)
    return f"{hours:02}:{minutes:02}:{seconds:02},{milliseconds:03}"


def width(text):
    return sum(2 if unicodedata.east_asian_width(char) in ("W", "F") else 1 for char in text)


def subtitle_lines(text):
    """Prefer a phrase boundary; permit at most two lines of 24 CJK columns."""
    if width(text) <= 48:
        return text
    candidates = [index for index in range(1, len(text))
                  if width(text[:index]) <= 48 and width(text[index:]) <= 48]
    if not candidates:
        raise ValueError(f"Subtitle needs more than two lines; shorten this cue: {text}")
    punctuation = [index for index in candidates if text[index - 1] in "，。；：！？”"]
    split = min(punctuation or candidates, key=lambda index: abs(width(text[:index]) - width(text[index:])))
    return text[:split].strip() + "\n" + text[split:].strip()


def validate_story(story):
    if [shot["id"] for shot in story["shots"]] != SHOT_IDS:
        raise ValueError("Shot order must match the fixed eight-shot director contract")
    elapsed = 0
    for shot in story["shots"]:
        if shot["start"] != elapsed or shot["duration"] <= 0:
            raise ValueError(f"Non-contiguous shot: {shot['id']}")
        elapsed += shot["duration"]
        last_at = -1
        for cue in shot["cues"]:
            if not last_at < cue["at"] < shot["duration"]:
                raise ValueError(f"Unordered cue: {shot['id']}")
            last_at = cue["at"]
            subtitle_lines(cue["text"])
    if elapsed != story["duration"] or elapsed != 180 or story["cleanFinale"]["start"] != 175:
        raise ValueError("The film must be 180 seconds, with a clean final five seconds")


def synthesize(cue, voice, cache):
    spoken = cue.get("spoken", cue["text"])
    fingerprint = hashlib.sha256(json.dumps([voice, spoken], ensure_ascii=False).encode()).hexdigest()
    cached = cache / f"{fingerprint}.wav"
    if cached.exists():
        return wave_read(cached)
    with tempfile.TemporaryDirectory(prefix="wanderwise-voice-") as directory:
        directory = Path(directory)
        text = directory / "cue.txt"
        aiff = directory / "cue.aiff"
        wav = directory / "cue.wav"
        text.write_text(spoken, encoding="utf-8")
        subprocess.run(["/usr/bin/say", "-v", voice["name"], "-r", str(voice["rate"]),
                        "-f", str(text), "-o", str(aiff)], check=True, timeout=45)
        subprocess.run(["/usr/bin/afconvert", "-f", "WAVE", "-d", "LEI16@48000", "-c", "1",
                        str(aiff), str(wav)], check=True, timeout=45)
        raw = wave_read(wav)
    samples = array.array("h", raw)
    if sys.byteorder != "little":
        samples.byteswap()
    active = [index for index, sample in enumerate(samples) if abs(sample) > 90]
    if not active:
        raise ValueError(f"Tingting returned silent audio: {spoken}")
    start = max(0, active[0] - round(0.08 * RATE))
    end = min(len(samples), active[-1] + round(0.15 * RATE))
    trimmed = raw[start * 2:end * 2]
    wave_write(cached, trimmed)
    return trimmed


def generate(story):
    if sys.platform != "darwin":
        raise SystemExit("Audio generation requires macOS Tingting. Use --check to validate existing files elsewhere.")
    cache = ROOT / "docs/showcase/.audio-cache"
    cache.mkdir(parents=True, exist_ok=True)
    full = bytearray(round(story["duration"] * RATE) * BYTES_PER_FRAME)
    entries = []
    spoken_seconds = 0
    cue_index = 0
    for shot in story["shots"]:
        segment = bytearray(round(shot["duration"] * RATE) * BYTES_PER_FRAME)
        for index, cue in enumerate(shot["cues"]):
            pcm = synthesize(cue, story["voice"], cache)
            duration = len(pcm) / BYTES_PER_FRAME / RATE
            limit = shot["cues"][index + 1]["at"] - 0.15 if index + 1 < len(shot["cues"]) else shot["duration"] - 0.25
            if shot["id"] == "finale":
                limit = min(limit, story["cleanFinale"]["start"] - shot["start"])
            if cue["at"] + duration > limit:
                raise ValueError(f"Cue overflows {shot['id']} #{index + 1}: ends {cue['at'] + duration:.3f}s, limit {limit:.3f}s. Shorten the words or move the cue; audio is never sped up or cut.")
            offset = round(cue["at"] * RATE) * BYTES_PER_FRAME
            segment[offset:offset + len(pcm)] = pcm
            cue["duration"] = round(duration, 6)
            cue["start"] = round(shot["start"] + cue["at"], 6)
            cue["end"] = round(cue["start"] + duration, 6)
            cue["lines"] = subtitle_lines(cue["text"])
            cue_index += 1
            entries.append(f"{cue_index}\n{timecode(cue['start'])} --> {timecode(cue['end'])}\n{cue['lines']}\n")
            spoken_seconds += duration
            print(f"{shot['id']:12} {index + 1:02} {cue['at']:5.2f}–{cue['at'] + duration:5.2f}s {cue['text']}", flush=True)
        shot["audio"] = {"url": f"/showcase/audio/{shot['id']}.wav", "duration": shot["duration"]}
        wave_write(OUTPUT / "audio" / f"{shot['id']}.wav", segment)
        offset = round(shot["start"] * RATE) * BYTES_PER_FRAME
        full[offset:offset + len(segment)] = segment
    wave_write(OUTPUT / "narration.wav", full)
    (OUTPUT / "subtitles.srt").write_text("\n".join(entries), encoding="utf-8")
    story["audio"] = {"url": "/showcase/narration.wav", "duration": story["duration"],
                      "sampleRate": RATE, "channels": 1, "format": "PCM16", "spokenSeconds": round(spoken_seconds, 3)}
    story["subtitles"] = {"url": "/showcase/subtitles.srt", "cueCount": cue_index, "maxLines": 2}
    story["sourceSha256"] = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    (OUTPUT / "storyboard.json").write_text(json.dumps(story, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    narration = narration_document(story)
    (ROOT / "docs/showcase/narration.md").write_text(narration, encoding="utf-8")
    (OUTPUT / "narration.md").write_text(narration, encoding="utf-8")
    introduction = (ROOT / "docs/showcase/introduction.md").read_text(encoding="utf-8")
    short = introduction.split("## 短版介绍（约 150 字）\n\n")[1].split("\n\n")[0]
    (OUTPUT / "introduction.md").write_text(introduction, encoding="utf-8")
    (OUTPUT / "introduction-short.md").write_text(short + "\n", encoding="utf-8")
    print(f"Generated 180.000s narration, {spoken_seconds:.3f}s spoken, {cue_index} subtitle cues.")


def narration_document(story):
    lines = ["# 三分钟旁白与逐镜头分镜", "", "本稿由 `scripts/showcase-audio.py` 从分镜清单生成。时间为成片时间，末尾五秒无旁白、无字幕，背景音乐淡出。", "",
             "配音：macOS Tingting 普通话，语速 175；字幕中的 Minecraft 旁白读作“我的世界”。", ""]
    for shot in story["shots"]:
        lines += [f"## {timecode(shot['start'])[:8]}–{timecode(shot['start'] + shot['duration'])[:8]} · {shot['title']}", "", shot["visual"], ""]
        for cue in shot["cues"]:
            lines += [f"- {timecode(cue['start'])}–{timecode(cue['end'])}：{cue['text']}"]
        lines.append("")
    return "\n".join(lines)


def check():
    story = json.loads((OUTPUT / "storyboard.json").read_text(encoding="utf-8"))
    validate_story(story)
    raw = wave_read(OUTPUT / "narration.wav")
    assert len(raw) == 180 * RATE * BYTES_PER_FRAME, "Narration must be exactly 180 seconds"
    assert not any(raw[175 * RATE * BYTES_PER_FRAME:]), "Final five seconds must be silent"
    last_end = 0
    combined = bytearray()
    count = 0
    for shot in story["shots"]:
        pcm = wave_read(OUTPUT / "audio" / f"{shot['id']}.wav")
        assert len(pcm) == shot["duration"] * RATE * BYTES_PER_FRAME
        combined.extend(pcm)
        for cue in shot["cues"]:
            assert last_end <= cue["start"] < cue["end"] <= min(shot["start"] + shot["duration"], 175)
            assert len(cue["lines"].splitlines()) <= 2
            assert all(width(line) <= 48 for line in cue["lines"].splitlines())
            last_end = cue["end"]
            count += 1
    assert combined == raw, "Shot audio and full narration diverged"
    srt = (OUTPUT / "subtitles.srt").read_text(encoding="utf-8")
    assert len(srt.strip().split("\n\n")) == count
    source = json.loads(SOURCE.read_text(encoding="utf-8"))
    assert story["sourceSha256"] == hashlib.sha256(SOURCE.read_bytes()).hexdigest(), "Source manifest changed; regenerate narration"
    assert source["voice"] == story["voice"], "Voice configuration changed; regenerate narration"
    for original, generated in zip(source["shots"], story["shots"]):
        assert original["narration"] == generated["narration"], "Source script changed; regenerate narration"
        assert len(original["cues"]) == len(generated["cues"]), "Cue count changed; regenerate narration"
        for a, b in zip(original["cues"], generated["cues"]):
            assert all(a[key] == b[key] for key in a), "Source cue changed; regenerate narration"
    print(json.dumps({"ok": True, "duration": 180, "shots": len(story["shots"]), "cues": count,
                      "lastSubtitleEnd": last_end, "silentFinalSeconds": 5,
                      "spokenSeconds": story["audio"]["spokenSeconds"],
                      "sha256": hashlib.sha256((OUTPUT / 'narration.wav').read_bytes()).hexdigest()}, ensure_ascii=False, indent=2))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Validate outputs without invoking speech synthesis")
    args = parser.parse_args()
    if not args.check:
        story = json.loads(SOURCE.read_text(encoding="utf-8"))
        validate_story(story)
        generate(story)
    check()


if __name__ == "__main__":
    main()
