// OmniCalc desktop entry point. Mobile uses `omnica_lib::run()` directly.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    omnica_lib::run();
}
