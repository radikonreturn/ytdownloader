#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use std::thread;
use tauri::{AppHandle, Manager};

#[derive(Serialize, Deserialize, Clone)]
struct LogPayload {
    message: String,
    level: String,
}

#[derive(Serialize, Deserialize)]
struct DownloadArgs {
    url: String,
    start_time: String,
    end_time: String,
    save_path: String,
    full_video: bool,
    video_quality: String,
    format: String,
}

#[tauri::command]
fn download_video(app: AppHandle, args: DownloadArgs) -> Result<String, String> {
    let url = args.url;
    let start = args.start_time;
    let end = args.end_time;
    let save_path = args.save_path;
    let full_video = args.full_video;
    let format_ext = args.format;

    // Helper to emit logs to frontend
    let emit_log = |msg: String, level: &str| {
        let _ = app.emit_all(
            "download-log",
            LogPayload {
                message: msg,
                level: level.to_string(),
            },
        );
    };

    emit_log(format!("Starting download for: {}", url), "info");

    let mut cmd_args = vec![
        "-m".to_string(),
        "yt_dlp".to_string(),
        "--no-playlist".to_string(),
    ];

    if format_ext == "mp3" || format_ext == "m4a" {
        cmd_args.push("-f".to_string());
        cmd_args.push("bestaudio".to_string());
        cmd_args.push("-x".to_string());
        cmd_args.push("--audio-format".to_string());
        cmd_args.push(format_ext.clone());
    } else {
        let height_filter = match args.video_quality.as_str() {
            "Best" => "".to_string(),
            "1080p" => "[height<=1080]".to_string(),
            "720p" => "[height<=720]".to_string(),
            "480p" => "[height<=480]".to_string(),
            _ => "".to_string(),
        };

        let format_str = if format_ext == "mp4" {
            format!("bestvideo{}[ext=mp4]+bestaudio[ext=m4a]/bestvideo{}+bestaudio/best{}", height_filter, height_filter, height_filter)
        } else {
            format!("bestvideo{}+bestaudio/best{}", height_filter, height_filter)
        };

        cmd_args.push("-f".to_string());
        cmd_args.push(format_str);
        cmd_args.push("--merge-output-format".to_string());
        cmd_args.push(format_ext.clone());
    }

    if !full_video {
        let section = format!("*{}-{}", start, end);
        cmd_args.push("--download-sections".to_string());
        cmd_args.push(section);
        cmd_args.push("--force-keyframes-at-cuts".to_string());
    }

    cmd_args.push("-o".to_string());
    cmd_args.push(save_path);
    cmd_args.push(url);

    let mut child = Command::new("python").env("PYTHONIOENCODING", "utf-8")
        .args(&cmd_args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start python -m yt_dlp: {}", e))?;

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();

    // Read stdout in a separate task to stream logs
    let app_clone = app.clone();
    thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            if let Ok(l) = line {
                let _ = app_clone.emit_all(
                    "download-log",
                    LogPayload {
                        message: l,
                        level: "info".to_string(),
                    },
                );
            }
        }
    });

    let app_clone_err = app.clone();
    thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines() {
            if let Ok(l) = line {
                let _ = app_clone_err.emit_all(
                    "download-log",
                    LogPayload {
                        message: l,
                        level: "error".to_string(),
                    },
                );
            }
        }
    });

    let status = child.wait().map_err(|e| format!("Process error: {}", e))?;

    if status.success() {
        emit_log(
            "Download and cut completed successfully!".to_string(),
            "success",
        );
        Ok("Success".to_string())
    } else {
        emit_log(
            "yt-dlp failed. Check logs for details.".to_string(),
            "error",
        );
        Err("yt-dlp exited with error".to_string())
    }
}

#[derive(Serialize, Deserialize)]
struct VideoInfo {
    duration: f64,
    title: String,
}

#[tauri::command]
fn get_video_info(url: String) -> Result<VideoInfo, String> {
    let output = Command::new("python").env("PYTHONIOENCODING", "utf-8")
        .args(&["-m", "yt_dlp", "--print", "%(duration)s|%(title)s", &url])
        .output()
        .map_err(|e| format!("Failed to execute python -m yt_dlp: {}", e))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        let parts: Vec<&str> = stdout.trim().splitn(2, '|').collect();
        if parts.len() == 2 {
            let duration = parts[0].parse::<f64>().unwrap_or(0.0);
            let title = parts[1].to_string();
            Ok(VideoInfo { duration, title })
        } else {
            // fallback if output doesn't match format
            Ok(VideoInfo { duration: 0.0, title: "clip".to_string() })
        }
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("yt-dlp error: {}", stderr))
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![download_video, get_video_info])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
