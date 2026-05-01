#!/usr/bin/env python3
"""
ytclip.py — YouTube Clip Downloader
-------------------------------------
Downloads a YouTube video in the best available quality (up to 1080p)
and cuts it to an exact time range using yt-dlp + ffmpeg.

Usage:
    python ytclip.py
    python ytclip.py <URL> <start> <end> [output_name]

Time format: SS | MM:SS | HH:MM:SS
"""

import argparse
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path


# ─── Colour helpers ──────────────────────────────────────────────────────────
def _c(code: str, text: str) -> str:
    """Wrap text in ANSI colour if stdout is a TTY."""
    if sys.stdout.isatty():
        return f"\033[{code}m{text}\033[0m"
    return text


def ok(msg: str):   print(_c("32;1", "✔ ") + msg)
def err(msg: str):  print(_c("31;1", "✘ ") + msg, file=sys.stderr)
def info(msg: str): print(_c("36",   "▶ ") + msg)
def warn(msg: str): print(_c("33",   "⚠ ") + msg)


# ─── Time helpers ─────────────────────────────────────────────────────────────
def parse_time(t: str) -> float:
    """Convert SS / MM:SS / HH:MM:SS to total seconds (float)."""
    t = t.strip()
    parts = t.split(":")
    if len(parts) == 1:
        return float(parts[0])
    elif len(parts) == 2:
        return int(parts[0]) * 60 + float(parts[1])
    elif len(parts) == 3:
        return int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2])
    raise ValueError(f"Unrecognised time format: '{t}'")


def seconds_to_hms(s: float) -> str:
    s = int(s)
    h, rem = divmod(s, 3600)
    m, sec = divmod(rem, 60)
    return f"{h:02d}:{m:02d}:{sec:02d}"


# ─── Dependency checks ────────────────────────────────────────────────────────
def find_exe(name: str) -> str | None:
    """Return full path to an executable, or None."""
    import shutil
    return shutil.which(name)


def ensure_yt_dlp() -> str:
    """Return 'yt-dlp' command; installs via pip if missing."""
    path = find_exe("yt-dlp")
    if path:
        return path

    warn("yt-dlp not found — installing via pip …")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "yt-dlp"])
    ok("yt-dlp installed.")

    # After install it should be on PATH (pip scripts dir)
    path = find_exe("yt-dlp")
    if path:
        return path

    # Fallback: run as a module
    return f"{sys.executable} -m yt_dlp"


def ensure_ffmpeg() -> str:
    """Return path to ffmpeg binary; tries PATH first, then local bin/."""
    path = find_exe("ffmpeg")
    if path:
        return path

    local = Path(__file__).parent / "bin" / "ffmpeg.exe"
    if local.exists():
        return str(local)

    err(
        "ffmpeg not found.\n"
        "  Option A — Install via winget:   winget install --id=Gyan.FFmpeg -e\n"
        "  Option B — Install via scoop:    scoop install ffmpeg\n"
        "  Option C — Download manually from https://ffmpeg.org/download.html\n"
        "             then place ffmpeg.exe in the 'bin\\' folder next to this script.\n"
        "Re-run the script after installing ffmpeg."
    )
    sys.exit(1)


# ─── Core logic ───────────────────────────────────────────────────────────────
def sanitise_filename(name: str) -> str:
    """Strip characters that are invalid in Windows filenames."""
    return re.sub(r'[\\/*?:"<>|]', "_", name).strip()


def download_and_cut(
    url: str,
    start: str,
    end: str,
    output_name: str | None = None,
    outdir: str = ".",
):
    start_sec = parse_time(start)
    end_sec   = parse_time(end)
    duration  = end_sec - start_sec

    if duration <= 0:
        err(f"End time ({end}) must be after start time ({start}).")
        sys.exit(1)

    yt_dlp  = ensure_yt_dlp()
    ffmpeg  = ensure_ffmpeg()
    outdir  = Path(outdir).resolve()
    outdir.mkdir(parents=True, exist_ok=True)

    # ── Step 1: get video title for a nice filename ──────────────────────────
    info("Fetching video metadata …")
    title_cmd = [yt_dlp, "--get-title", "--no-playlist", url]
    if " " in yt_dlp:          # module fallback: "python -m yt_dlp"
        title_cmd = yt_dlp.split() + title_cmd[1:]

    try:
        title = subprocess.check_output(title_cmd, text=True, stderr=subprocess.DEVNULL).strip()
    except Exception:
        title = "clip"

    safe_title = sanitise_filename(title)[:60]
    start_tag  = start.replace(":", "-")
    end_tag    = end.replace(":", "-")

    if output_name:
        stem = sanitise_filename(output_name)
    else:
        stem = f"{safe_title}_{start_tag}_to_{end_tag}"

    final_path = outdir / f"{stem}.mp4"

    # ── Step 2: try --download-sections (most efficient) ─────────────────────
    info(f"Downloading clip  [{start} → {end}]  …")
    section_spec = f"*{seconds_to_hms(start_sec)}-{seconds_to_hms(end_sec)}"

    dl_cmd = [
        yt_dlp,
        "--no-playlist",
        "-f", "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]",
        "--merge-output-format", "mp4",
        "--download-sections", section_spec,
        "--force-keyframes-at-cuts",
        "-o", str(final_path),
        url,
    ]
    if " " in yt_dlp:
        dl_cmd = yt_dlp.split() + dl_cmd[1:]

    result = subprocess.run(dl_cmd)

    if result.returncode != 0:
        # ── Step 3: fallback — download full then cut with ffmpeg ─────────────
        warn("--download-sections failed; falling back to full-download + ffmpeg cut …")

        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir) / "full.mp4"
            dl_full = [
                yt_dlp,
                "--no-playlist",
                "-f", "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]",
                "--merge-output-format", "mp4",
                "-o", str(tmp_path),
                url,
            ]
            if " " in yt_dlp:
                dl_full = yt_dlp.split() + dl_full[1:]

            subprocess.check_call(dl_full)

            info("Cutting clip with ffmpeg …")
            cut_cmd = [
                ffmpeg, "-y",
                "-ss", str(start_sec),
                "-i", str(tmp_path),
                "-t", str(duration),
                "-c", "copy",
                str(final_path),
            ]
            subprocess.check_call(cut_cmd)

    # ── Step 4: verify output ─────────────────────────────────────────────────
    if not final_path.exists() or final_path.stat().st_size < 1024:
        err(f"Output file missing or too small: {final_path}")
        sys.exit(1)

    probe_cmd = [
        ffmpeg, "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        str(final_path),
    ]
    # Use ffprobe if available, else skip duration probe
    import shutil
    ffprobe = shutil.which("ffprobe") or ffmpeg.replace("ffmpeg", "ffprobe")
    if Path(ffprobe).exists() if os.path.sep in ffprobe else shutil.which(ffprobe):
        try:
            probe_out = subprocess.check_output(
                [ffprobe, "-v", "error",
                 "-show_entries", "format=duration",
                 "-of", "default=noprint_wrappers=1:nokey=1",
                 str(final_path)],
                text=True, stderr=subprocess.DEVNULL
            ).strip()
            actual_dur = float(probe_out)
            ok(f"Done!  Duration: {actual_dur:.2f}s  (requested {duration:.2f}s)")
        except Exception:
            ok("Done!")
    else:
        ok("Done!")

    size_mb = final_path.stat().st_size / (1024 * 1024)
    print(f"\n{'─'*50}")
    print(f"  Output : {final_path}")
    print(f"  Size   : {size_mb:.2f} MB")
    print(f"  Clip   : {start}  →  {end}  ({seconds_to_hms(duration)})")
    print(f"{'─'*50}\n")


# ─── Interactive prompt ───────────────────────────────────────────────────────
def interactive():
    print(_c("35;1", "\n━━━  YouTube Clip Downloader  ━━━\n"))
    url   = input("  YouTube URL  : ").strip()
    start = input("  Start time   : ").strip()
    end   = input("  End time     : ").strip()
    name  = input("  Output name  (leave blank for auto): ").strip() or None
    outd  = input("  Output dir   (leave blank for current dir): ").strip() or "."
    print()
    download_and_cut(url, start, end, output_name=name, outdir=outd)


# ─── Entry point ──────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        description="Download a YouTube video clip (yt-dlp + ffmpeg).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Time format: SS | MM:SS | HH:MM:SS\n\nExample:\n"
               "  python ytclip.py https://youtu.be/xyz 1:30 2:45\n"
               "  python ytclip.py https://youtu.be/xyz 90 165 my_clip ./clips",
    )
    parser.add_argument("url",         nargs="?", help="YouTube URL")
    parser.add_argument("start",       nargs="?", help="Start time")
    parser.add_argument("end",         nargs="?", help="End time")
    parser.add_argument("output_name", nargs="?", help="Output filename (no extension)")
    parser.add_argument("outdir",      nargs="?", default=".", help="Output directory")

    args = parser.parse_args()

    if args.url and args.start and args.end:
        download_and_cut(args.url, args.start, args.end, args.output_name, args.outdir)
    else:
        interactive()


if __name__ == "__main__":
    main()
