//! The desktop app: Tauri commands over `app-core`. The window only shows what these answer; the
//! work happens in the core.

use app_core::Greeting;

/// Greets `name`. A command converts between the core and the front end, and does nothing else.
#[tauri::command]
fn greet(name: &str) -> Greeting {
    app_core::greet(name)
}

/// Opens the main window from its entry in `tauri.conf.json`, which leaves that to this
/// (`"create": false`), so the window can be shaped in code as it opens.
fn open_main_window(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let config = app
        .config()
        .app
        .windows
        .iter()
        .find(|window| window.label == "main")
        .ok_or("tauri.conf.json has no main window")?;
    let window = tauri::WebviewWindowBuilder::from_config(app.handle(), config)?;
    // stacks:slot main-window
    window.build()?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init());
    // stacks:slot plugins
    builder
        .setup(|app| {
            open_main_window(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("the app failed to start");
}
