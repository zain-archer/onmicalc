// OmniCalc desktop shell.
//
// The web build is embedded as-is: every calculation happens in the same
// TypeScript engine the browser uses, and the app makes no network requests.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running OmniCalc");
}
