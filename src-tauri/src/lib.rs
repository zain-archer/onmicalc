// OmniCalc shell — shared by desktop, Android and iOS.
//
// The web build is embedded as-is: every calculation happens in the same
// TypeScript engine the browser uses, and the app makes no network requests.
// `tauri android init` / `tauri ios init` require this `run()` entry point;
// `main.rs` calls it on desktop.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running OmniCalc");
}
