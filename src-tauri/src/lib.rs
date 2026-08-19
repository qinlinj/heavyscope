use std::sync::Mutex;
use std::time::Instant;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Manager, WindowEvent};

#[cfg(target_os = "macos")]
use tauri::Rect;

const TRAY_ID: &str = "main";

#[cfg(target_os = "macos")]
const PANEL_GAP: f64 = 6.0;
#[cfg(target_os = "macos")]
const BLUR_HIDE_GRACE_MS: u128 = 280;

struct TrayState {
    #[cfg(target_os = "macos")]
    last_rect: Mutex<Option<Rect>>,
    hidden_at: Mutex<Option<Instant>>,
}

#[tauri::command]
fn shell_mode() -> &'static str {
    if cfg!(target_os = "macos") {
        "accessory"
    } else {
        "window"
    }
}

#[tauri::command]
fn set_tray_summary(
    app: tauri::AppHandle,
    summary: String,
    percent: Option<String>,
) -> Result<(), String> {
    let Some(tray) = app.tray_by_id(TRAY_ID) else {
        return Ok(());
    };
    tray.set_tooltip(Some(&summary))
        .map_err(|err| err.to_string())?;

    #[cfg(target_os = "macos")]
    {
        let title = percent.unwrap_or(summary);
        tray.set_title(Some(&title))
            .map_err(|err| err.to_string())?;
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = percent;
        let _ = tray.set_title(None::<&str>);
    }

    Ok(())
}

#[cfg(not(target_os = "macos"))]
fn show_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn hide_main(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
    if let Some(state) = app.try_state::<TrayState>() {
        if let Ok(mut hidden_at) = state.hidden_at.lock() {
            *hidden_at = Some(Instant::now());
        }
    }
}

#[cfg(target_os = "macos")]
fn recently_hidden(app: &tauri::AppHandle) -> bool {
    let Some(state) = app.try_state::<TrayState>() else {
        return false;
    };
    let Ok(hidden_at) = state.hidden_at.lock() else {
        return false;
    };
    hidden_at
        .map(|at| at.elapsed().as_millis() < BLUR_HIDE_GRACE_MS)
        .unwrap_or(false)
}

#[cfg(target_os = "macos")]
fn remember_rect(app: &tauri::AppHandle, rect: Rect) {
    if let Some(state) = app.try_state::<TrayState>() {
        if let Ok(mut last) = state.last_rect.lock() {
            *last = Some(rect);
        }
    }
}

#[cfg(target_os = "macos")]
fn last_rect(app: &tauri::AppHandle) -> Option<Rect> {
    app.try_state::<TrayState>()
        .and_then(|state| state.last_rect.lock().ok().and_then(|guard| *guard))
}

#[cfg(target_os = "macos")]
fn physical_frame(rect: Rect, scale: f64) -> (f64, f64, f64, f64) {
    let pos = rect.position.to_physical::<f64>(scale);
    let size = rect.size.to_physical::<f64>(scale);
    (pos.x, pos.y, size.width, size.height)
}

#[cfg(target_os = "macos")]
fn clamp_to_monitor(
    window: &tauri::WebviewWindow,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    icon_x: f64,
    icon_y: f64,
) -> (f64, f64) {
    let monitors = window.available_monitors().unwrap_or_default();
    let monitor = monitors.into_iter().find(|item| {
        let origin = item.position();
        let size = item.size();
        let left = origin.x as f64;
        let top = origin.y as f64;
        let right = left + size.width as f64;
        let bottom = top + size.height as f64;
        icon_x >= left && icon_x < right && icon_y >= top && icon_y < bottom
    });

    let Some(monitor) = monitor.or_else(|| window.current_monitor().ok().flatten()) else {
        return (x, y);
    };

    let origin = monitor.position();
    let size = monitor.size();
    let left = origin.x as f64 + 8.0;
    let top = origin.y as f64 + 8.0;
    let right = origin.x as f64 + size.width as f64 - width - 8.0;
    let bottom = origin.y as f64 + size.height as f64 - height - 8.0;
    let clamped_x = if right >= left {
        x.clamp(left, right)
    } else {
        left
    };
    let mut clamped_y = y;
    if clamped_y > bottom {
        clamped_y = icon_y - height - PANEL_GAP;
    }
    if clamped_y < top {
        clamped_y = top;
    }
    (clamped_x, clamped_y)
}

/// Anchor the compact panel under the status item, not screen center.
#[cfg(target_os = "macos")]
fn position_panel_under_tray(window: &tauri::WebviewWindow, rect: Rect) {
    let scale = window.scale_factor().unwrap_or(1.0);
    let (icon_x, icon_y, icon_w, icon_h) = physical_frame(rect, scale);
    let panel = window.outer_size().unwrap_or_default();
    let width = panel.width as f64;
    let height = panel.height as f64;
    let x = icon_x + (icon_w / 2.0) - (width / 2.0);
    let y = icon_y + icon_h + PANEL_GAP;
    let (x, y) = clamp_to_monitor(window, x, y, width, height, icon_x, icon_y);
    let _ = window.set_position(tauri::PhysicalPosition::new(x as i32, y as i32));
}

#[cfg(target_os = "macos")]
fn show_macos_panel(app: &tauri::AppHandle, rect: Option<Rect>) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    if let Some(rect) = rect.or_else(|| last_rect(app)) {
        remember_rect(app, rect);
        position_panel_under_tray(&window, rect);
    }
    let _ = window.show();
    let _ = window.set_focus();
}

#[cfg(target_os = "macos")]
fn toggle_macos_panel(app: &tauri::AppHandle, rect: Rect) {
    remember_rect(app, rect);
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    if window.is_visible().unwrap_or(false) {
        hide_main(app);
        return;
    }
    if recently_hidden(app) {
        return;
    }
    show_macos_panel(app, Some(rect));
}

fn load_tray_icon(app: &tauri::App) -> tauri::image::Image<'_> {
    tauri::image::Image::from_bytes(include_bytes!("../icons/tray-template.png")).unwrap_or_else(
        |_| {
            app.default_window_icon()
                .cloned()
                .expect("missing tray template icon")
        },
    )
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(TrayState {
            #[cfg(target_os = "macos")]
            last_rect: Mutex::new(None),
            hidden_at: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![set_tray_summary, shell_mode])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            #[cfg(target_os = "macos")]
            {
                app.set_activation_policy(tauri::ActivationPolicy::Accessory)?;
            }

            let open = MenuItem::with_id(app, "open", "Open", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &quit])?;
            let icon = load_tray_icon(app);

            TrayIconBuilder::with_id(TRAY_ID)
                .icon(icon)
                .icon_as_template(true)
                .menu(&menu)
                .show_menu_on_left_click(false)
                .tooltip("HeavyScope")
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "open" => {
                        #[cfg(target_os = "macos")]
                        show_macos_panel(app, None);
                        #[cfg(not(target_os = "macos"))]
                        show_window(app);
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        rect,
                        ..
                    } = event
                    {
                        #[cfg(target_os = "macos")]
                        toggle_macos_panel(tray.app_handle(), rect);
                        #[cfg(not(target_os = "macos"))]
                        {
                            let _ = rect;
                            show_window(tray.app_handle());
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| match event {
            WindowEvent::CloseRequested { api, .. } => {
                api.prevent_close();
                hide_main(window.app_handle());
            }
            #[cfg(target_os = "macos")]
            WindowEvent::Focused(false) => {
                hide_main(window.app_handle());
            }
            _ => {}
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
