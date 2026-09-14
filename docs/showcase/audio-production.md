# 三分钟旁白与字幕的生成方式

声音来源为用户已选定的 macOS 系统普通话语音 **Tingting**，由 `/usr/bin/say` 在本机离线合成。语速参数为 175，不使用云端 TTS，不依赖录制时的浏览器朗读。片中字幕保留 Minecraft 的英文名，配音读作“我的世界”。

## 可编辑源与输出

`docs/showcase/storyboard.json` 是分镜与旁白的唯一可编辑清单。`shots` 的顺序固定为 opening、explore、annotate、footprints、home、mix、montage、finale，时长分别为 12、31、35、22、24、25、17、14 秒。各句的 `at` 是段内开始秒数。

执行：

```sh
python3 scripts/showcase-audio.py
```

脚本使用 macOS 自带的 say、afconvert 和 Python 标准库，不安装第三方依赖。每句分别生成、测量时长，按固定时间写入静音底轨；若一句超出预留时间，直接报错，不截断音频，也不加速人声。句尾保留 150 毫秒，不裁到发音。

生成物：

- `public/showcase/narration.wav`：180 秒、48 kHz、单声道、16 位 PCM 主旁白，适合服务器与视频混流。
- `public/showcase/audio/{id}.wav`：八段足长音轨，拼接后与主旁白逐字节一致。
- `public/showcase/subtitles.srt`：25 条字幕，最多两行，每行最多相当于 24 个汉字的显示宽度。
- `public/showcase/storyboard.json`：保留源分镜，并增加每句实测 `duration`、全片 `start/end`、排好行的 `lines`、音频链接和源文件指纹。
- `public/showcase/introduction.md`、`introduction-short.md`、`narration.md`：供录制页下载的文稿；完整文案和逐镜头旁白同时保存在 docs 目录。

句段缓存位于 `docs/showcase/.audio-cache/`，按语音配置与文本内容哈希复用。此目录不纳入 Git，也不复制进网站 public 资源。macOS 版本或语音包变化后，如需重新合成，删除该缓存再执行生成命令。

## 校验与使用

在 macOS 或 Linux 上均可执行：

```sh
python3 scripts/showcase-audio.py --check
```

校验原始旁白音轨严格为 180 秒，最后五秒全静音，字幕无时间重叠、无越界、最多两行，八段拼接与主音轨一致，源分镜没有在生成后发生变更。无需在 RTX 服务器安装 macOS 语音；服务器直接使用生成好的 WAV 与 SRT。

实测旁白发声共 124.401 秒，其余时间用于片段内观看操作与换气。最后一条字幕于 173.134 秒结束，175–180 秒无旁白、无字幕，最终成片的背景音乐在这五秒内淡出；原始旁白音轨本身在该区间保持静音。主音轨 SHA-256：`bbae57aab068166740a12782b2899baca32582cc857263493b71682544c45286`。

画面、旁白和字幕按每段自己的零点分别处理，再按分镜顺序拼接。场景预热与加载等待发生在有效片段之外，避免旁白先于画面。
