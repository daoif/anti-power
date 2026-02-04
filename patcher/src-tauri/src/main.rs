//! Anti-Power Patcher entry point
//!
//! Hide the console window in Windows release builds

// Keep this attribute to hide the console in Windows release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

/// Launch the installer
fn main() {
    patcher_lib::run()
}
