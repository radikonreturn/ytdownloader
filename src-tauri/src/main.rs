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
}

#[tauri::command]
fn download_video(app: AppHandle, args: DownloadArgs) -> Result<String, String> {
    let url = args.url;
    let start = args.start_time;
    let end = args.end_time;
    let save_path = args.save_path;
    let full_video = args.full_video;

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
        "-f".to_string(),
        "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]".to_string(),
        "--merge-output-format".to_string(),
        "mp4".to_string(),
    ];

    if !full_video {
        let section = format!("*{}-{}", start, end);
        cmd_args.push("--download-sections".to_string());
        cmd_args.push(section);
        cmd_args.push("--force-keyframes-at-cuts".to_string());
    }

    cmd_args.push("-o".to_string());
    cmd_args.push(save_path);
    cmd_args.push(url);

    let mut child = Command::new("python")
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

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![download_video])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
