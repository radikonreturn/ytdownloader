// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::{Command, Stdio};
use tauri::Window;
use std::io::{BufRead, BufReader};
use std::thread;

#[tauri::command]
fn get_global_packages() -> Result<String, String> {
    let output = if cfg!(target_os = "windows") {
        Command::new("cmd")
            .args(["/C", "npm list -g --depth=0 --json"])
            .output()
    } else {
        Command::new("npm")
            .args(["list", "-g", "--depth=0", "--json"])
            .output()
    };

    match output {
        Ok(out) => Ok(String::from_utf8_lossy(&out.stdout).to_string()),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn get_outdated_packages() -> Result<String, String> {
    let output = if cfg!(target_os = "windows") {
        Command::new("cmd")
            .args(["/C", "npm outdated -g --json"])
            .output()
    } else {
        Command::new("npm")
            .args(["outdated", "-g", "--json"])
            .output()
    };

    // npm outdated exits with code 1 if there are outdated packages, which is normal.
    match output {
        Ok(out) => {
            let res = String::from_utf8_lossy(&out.stdout).to_string();
            // npm outdated returns empty stdout if nothing is outdated
            if res.trim().is_empty() {
                Ok("{}".to_string())
            } else {
                Ok(res)
            }
        },
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn update_packages(window: Window, packages: Vec<String>) -> Result<(), String> {
    let mut args = vec!["install".to_string(), "-g".to_string()];
    args.extend(packages);

    let mut child = if cfg!(target_os = "windows") {
        let mut cmd_args = vec!["/C".to_string(), "npm".to_string()];
        cmd_args.extend(args);
        Command::new("cmd")
            .args(&cmd_args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| e.to_string())?
    } else {
        Command::new("npm")
            .args(&args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| e.to_string())?
    };

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();

    let window_clone = window.clone();
    thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            if let Ok(l) = line {
                let _ = window_clone.emit("update-log", l);
            }
        }
    });

    let window_clone2 = window.clone();
    thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines() {
            if let Ok(l) = line {
                let _ = window_clone2.emit("update-log", l);
            }
        }
    });

    let status = child.wait().map_err(|e| e.to_string())?;
    if !status.success() {
        return Err("npm update failed".to_string());
    }

    Ok(())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_global_packages,
            get_outdated_packages,
            update_packages
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
