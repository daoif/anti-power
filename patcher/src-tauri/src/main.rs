// Keep this attribute to hide the console in Windows release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    patcher_lib::run()
}
