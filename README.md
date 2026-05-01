# ytclip 🎬

Download a YouTube video and cut it to an exact time range — all in one command.

## Requirements

| Tool | How to get it |
|------|--------------|
| Python 3.10+ | https://python.org |
| **yt-dlp** | Auto-installed by the script via `pip` |
| **ffmpeg** | `winget install --id=Gyan.FFmpeg -e` **or** `scoop install ffmpeg` |

> **ffmpeg must be on PATH** (or placed as `bin\ffmpeg.exe` next to the script).

---

## Usage

### Interactive mode (no arguments)
```
python ytclip.py
```
The script will prompt you for everything.

### Command-line mode
```
python ytclip.py <URL> <start> <end> [output_name] [outdir]
```

| Argument | Description | Example |
|----------|-------------|---------|
| `URL` | Full YouTube URL | `https://youtu.be/dQw4w9WgXcQ` |
| `start` | Start time | `1:30` or `90` or `0:01:30` |
| `end` | End time | `2:45` or `165` or `0:02:45` |
| `output_name` | *(optional)* Output filename without extension | `my_clip` |
| `outdir` | *(optional)* Output directory | `./clips` |

### Examples
```bash
# Basic — saves to current directory
python ytclip.py https://youtu.be/dQw4w9WgXcQ 0:30 1:00

# Custom name + output folder
python ytclip.py https://youtu.be/dQw4w9WgXcQ 1:30 2:45 intro_clip ./clips

# Using plain seconds
python ytclip.py https://youtu.be/dQw4w9WgXcQ 90 165
```

---

## How it works

1. **Fetch metadata** — gets the video title for a clean auto-generated filename.
2. **Download clip** — uses `yt-dlp --download-sections` to download **only the requested segment** (no wasted bandwidth).
3. **Fallback** — if `--download-sections` fails (some videos/formats), downloads the full video then cuts with `ffmpeg -ss … -t … -c copy`.
4. **Verify** — confirms file size and probes duration with `ffprobe`.

### Format selection priority
```
bestvideo[height<=1080][ext=mp4] + bestaudio[ext=m4a]   ← preferred (native mp4)
bestvideo[height<=1080] + bestaudio                      ← any container, merged to mp4
best[height<=1080]                                       ← single-stream fallback
```

---

## Output filename (auto-generated)
```
{video_title}_{start}_to_{end}.mp4
```
Example: `Rick_Astley_Never_Gonna_Give_You_Up_0-30_to_1-00.mp4`
