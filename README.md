# YouTube Clipper 🎬

A fast, lightweight, and user-friendly desktop application designed to download YouTube videos and precisely extract clips. 

Whether you need a specific 15-second soundbite or an entire 1080p video, YouTube Clipper handles it natively on your desktop without relying on ad-heavy web converters.

![App Preview](app-icon-fixed.png) *(Logo concept)*

---

## 📥 Download & Install (For Regular Users)

You don't need any programming knowledge to use this app! Just download the installer and run it like any normal program.

1. **Download the App**: Go to the **[Releases](../../releases/latest)** section on the right side of this GitHub page.
2. **Get the Setup File**: Click on `YT Downloader_0.1.0_x64-setup.exe` to download it.
3. **Install**: Double-click the downloaded `.exe` file to install the app on your Windows PC.
   > **Note:** Because this is a brand new app, Windows SmartScreen might show a blue warning saying "Windows protected your PC." This is completely normal for new indie apps. Just click **"More info"** and then **"Run anyway"**.
4. **Open**: Once installed, you will find "YT Downloader" in your Windows Start Menu!

---

## ✨ Features

- **Precise Video Clipping**: Enter a start and end time (e.g., `00:01:30` to `00:02:15`) to download exactly the segment you want. It saves bandwidth and time by only downloading the necessary parts of the video.
- **Full Video Downloads**: Prefer the whole thing? Check the "Download Entire Video" option to bypass clipping and grab the full video.
- **High Quality**: Automatically fetches the best available quality up to **1080p** (merging the best video and audio streams seamlessly into an MP4).
- **Live Terminal Logs**: See exactly what is happening under the hood with a built-in terminal log viewer tracking the download progress in real-time.
- **Sleek Dark Mode UI**: A modern, native interface built for speed and simplicity.
- **No Playlists**: To prevent massive accidental downloads, playlist downloading is disabled by default—it focuses purely on the single video link you provide.

---

## 🚀 How to Use

1. **Launch the App**: Open the app from your Start Menu or Desktop.
2. **Paste the URL**: Copy your desired YouTube video link and paste it into the "YouTube URL" field.
3. **Choose Your Mode**:
   - **Clip Mode**: Leave the checkbox empty, and type in your exact Start and End times.
   - **Full Video Mode**: Check "Download Entire Video (No Clipping)".
4. **Select Output Location**: Click "Browse" to choose exactly where the `.mp4` file will be saved on your computer.
5. **Download**: Click "Download & Cut Clip". You can watch the real-time progress in the Logs window on the right side.
6. **Done!** Your video is ready to watch or edit.

---

## ⚙️ Under the Hood (For Developers)

While this app has a simple interface, it is powered by industry-standard tools:
- **Engine**: The downloads are handled by a managed instance of `yt-dlp` (via Python), ensuring maximum compatibility with YouTube's ever-changing architecture.
- **Desktop Framework**: Built with **Tauri** and **React**, resulting in a tiny app footprint compared to traditional Electron apps, with lightning-fast performance.
