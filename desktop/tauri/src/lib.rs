use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::{Emitter, Manager};

// ─── App State ──────────────────────────────────────────────

struct AppState {
    backend_process: Mutex<Option<Child>>,
}

/// 编译时解析项目根目录（从 desktop/tauri/ 上溯两级）
fn project_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap() // desktop
        .parent()
        .unwrap() // project root
        .to_path_buf()
}

/// 查找后端可执行文件
///
/// - **debug 构建**：始终使用 `.venv` Python 源码路径，忽略任何打包残留
/// - **release 构建**：优先使用 PyInstaller 打包的 `mofox-backend.exe`，回退 `.venv` Python
fn find_backend_exe() -> (PathBuf, PathBuf) {
    // debug 构建：跳过打包 exe 查找，直接走 Python 源码路径
    if cfg!(debug_assertions) {
        let project = project_root();
        return (project.join(".venv").join("Scripts").join("python.exe"), project);
    }

    // release 构建：查找与 Tauri exe 同目录的 mofox-backend.exe
    if let Ok(exe_path) = std::env::current_exe() {
        let exe_dir = exe_path.parent().unwrap_or_else(|| Path::new("."));
        let bundled_dir = exe_dir.join("mofox-backend");
        let bundled = bundled_dir.join("mofox-backend.exe");
        if bundled.exists() {
            return (bundled, bundled_dir);
        }
    }
    // 回退：使用 .venv python + 项目根目录
    let project = project_root();
    (project.join(".venv").join("Scripts").join("python.exe"), project)
}

/// 向导配置临时文件路径
fn wizard_config_path() -> PathBuf {
    std::env::temp_dir().join("mofox-code-setup.json")
}

// ─── Tauri Commands ─────────────────────────────────────────

/// 启动 Python 后端
#[tauri::command]
fn start_backend(state: tauri::State<'_, AppState>) -> Result<String, String> {
    let mut proc = state.backend_process.lock().map_err(|e| e.to_string())?;

    if let Some(ref mut child) = *proc {
        // 检查是否仍在运行
        match child.try_wait() {
            Ok(None) => return Err("Backend is already running".into()),
            Ok(Some(status)) => {
                eprintln!("[Tauri] Previous backend exited with: {status:?}");
                *proc = None;
            }
            Err(e) => {
                eprintln!("[Tauri] Failed to check backend status: {e}");
                *proc = None;
            }
        }
    }

    let (backend_path, work_dir) = find_backend_exe();
    if !backend_path.exists() {
        return Err(format!(
            "Backend executable not found: {}",
            backend_path.display()
        ));
    }

    let is_bundled = backend_path.extension().map_or(false, |e| e == "exe")
        && !backend_path.to_string_lossy().contains("python");
    let mut cmd = if is_bundled {
        let mut c = Command::new(&backend_path);
        c.current_dir(&work_dir)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        c
    } else {
        let mut c = Command::new(&backend_path);
        c.args(["-m", "desktop.launcher"])
            .current_dir(&work_dir)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        c
    };

    // 如果存在向导配置临时文件，传递 --wizard-config
    let wiz_path = wizard_config_path();
    if wiz_path.exists() {
        cmd.arg("--wizard-config").arg(&wiz_path);
    }

    let mut child = cmd.spawn().map_err(|e| format!("Failed to start backend: {e}"))?;

    // 异步读取 stdout/stderr 避免管道阻塞
    if let Some(stdout) = child.stdout.take() {
        std::thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                if let Ok(line) = line {
                    println!("[Backend] {line}");
                }
            }
        });
    }
    if let Some(stderr) = child.stderr.take() {
        std::thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                if let Ok(line) = line {
                    eprintln!("[Backend] {line}");
                }
            }
        });
    }

    *proc = Some(child);
    Ok("Backend started".into())
}

/// 停止 Python 后端
#[tauri::command]
fn stop_backend(state: tauri::State<'_, AppState>) -> Result<String, String> {
    let mut proc = state.backend_process.lock().map_err(|e| e.to_string())?;

    match proc.take() {
        Some(mut child) => {
            child.kill().map_err(|e| format!("Failed to kill backend: {e}"))?;
            child.wait().map_err(|e| format!("Failed to wait for backend: {e}"))?;
            Ok("Backend stopped".into())
        }
        None => Err("Backend is not running".into()),
    }
}

/// 重启 Python 后端
#[tauri::command]
fn restart_backend(state: tauri::State<'_, AppState>) -> Result<String, String> {
    // 先尝试停止
    let mut proc = state.backend_process.lock().map_err(|e| e.to_string())?;
    if let Some(mut child) = proc.take() {
        child.kill().ok();
        child.wait().ok();
    }
    drop(proc); // 释放锁，让 start_backend 获取

    start_backend(state)
}

/// 接收前端向导配置 → 写入临时文件
#[tauri::command]
fn submit_setup(config: serde_json::Value) -> Result<String, String> {
    let wiz_path = wizard_config_path();
    let config_str = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {e}"))?;
    std::fs::write(&wiz_path, &config_str)
        .map_err(|e| format!("Failed to write config file: {e}"))?;
    Ok(wiz_path.to_string_lossy().to_string())
}

/// 获取后端进程状态
#[tauri::command]
fn get_backend_status(state: tauri::State<'_, AppState>) -> Result<String, String> {
    let mut proc = state.backend_process.lock().map_err(|e| e.to_string())?;

    match proc.as_mut() {
        None => Ok("stopped".into()),
        Some(child) => match child.try_wait() {
            Ok(None) => Ok("running".into()),
            Ok(Some(status)) => {
                let code = status.code().unwrap_or(-1);
                *proc = None;
                Ok(format!("exited:{code}"))
            }
            Err(e) => {
                *proc = None;
                Ok(format!("error:{e}"))
            }
        },
    }
}

// ─── Tauri Entry ────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let closing = std::sync::Arc::new(AtomicBool::new(false));

    tauri::Builder::default()
        .manage(AppState {
            backend_process: Mutex::new(None),
        })
        .setup(|app| {
            // 应用启动时自动拉起 Python 后端
            let state = app.state::<AppState>();
            match start_backend(state) {
                Ok(msg) => eprintln!("[Tauri] {msg}"),
                Err(e) => eprintln!("[Tauri] Failed to auto-start backend: {e}"),
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            start_backend,
            stop_backend,
            restart_backend,
            submit_setup,
            get_backend_status,
        ])
        .on_window_event({
            let closing = closing.clone();
            move |window, event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    // 第二次触发（来自后台线程的 close()），直接放行
                    if closing.load(Ordering::SeqCst) {
                        return;
                    }
                    closing.store(true, Ordering::SeqCst);

                    if let Some(state) = window.try_state::<AppState>() {
                        if let Ok(mut proc) = state.backend_process.lock() {
                            if proc.is_some() {
                                api.prevent_close();

                                // 通知前端显示"正在关闭"提示
                                let _ = window.emit("closing-backend", ());
                                eprintln!("[Tauri] Closing window — waiting up to 3s for backend to exit gracefully");

                                let mut backend = proc.take().unwrap();
                                drop(proc);
                                let win = window.clone();

                                std::thread::spawn(move || {
                                    let mut grace_exited = false;
                                    let start = std::time::Instant::now();
                                    let timeout = std::time::Duration::from_secs(2);
                                    while start.elapsed() < timeout {
                                        match backend.try_wait() {
                                            Ok(Some(_)) => {
                                                grace_exited = true;
                                                break;
                                            }
                                            Ok(None) => {
                                                std::thread::sleep(std::time::Duration::from_millis(100));
                                            }
                                            Err(_) => break,
                                        }
                                    }
                                    if !grace_exited {
                                        eprintln!("[Tauri] Backend did not exit in 2s, killing...");
                                        backend.kill().ok();
                                        backend.wait().ok();
                                    } else {
                                        eprintln!("[Tauri] Backend exited gracefully");
                                    }
                                    // 触发真正的关闭（closing=true，CloseRequested 直接放行）
                                    let _ = win.close();
                                });
                                return;
                            }
                        }
                    }
                    // 没有后端进程或状态异常，直接关闭
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running MoFox Code Desktop");
}
