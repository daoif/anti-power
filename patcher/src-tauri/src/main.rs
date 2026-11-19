// Hide the console window in Windows release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    anti_power_lib::run()
}
