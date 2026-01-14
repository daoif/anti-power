// Embedded patch assets
// Embed patch files with include_str! at compile time

/// `cascade-panel.html` sidebar entry point
pub const CASCADE_PANEL_HTML: &str = include_str!("../../patches/cascade-panel.html");

/// Files under `cascade-panel/`
pub mod cascade_panel {
    pub const CASCADE_PANEL_CSS: &str = include_str!("../../patches/cascade-panel/cascade-panel.css");
    pub const CASCADE_PANEL_JS: &str = include_str!("../../patches/cascade-panel/cascade-panel.js");
    pub const CONSTANTS_JS: &str = include_str!("../../patches/cascade-panel/constants.js");
    pub const COPY_JS: &str = include_str!("../../patches/cascade-panel/copy.js");
    pub const EXTRACT_JS: &str = include_str!("../../patches/cascade-panel/extract.js");
    pub const ICONS_JS: &str = include_str!("../../patches/cascade-panel/icons.js");
    pub const MATH_JS: &str = include_str!("../../patches/cascade-panel/math.js");
    pub const MERMAID_JS: &str = include_str!("../../patches/cascade-panel/mermaid.js");
    pub const SCAN_JS: &str = include_str!("../../patches/cascade-panel/scan.js");
    pub const TABLE_FIX_CSS: &str = include_str!("../../patches/cascade-panel/table-fix.css");
    pub const UTILS_JS: &str = include_str!("../../patches/cascade-panel/utils.js");
    // Generate config.json at install time
}

/// All files in the patch payload
pub fn get_all_files() -> Vec<(&'static str, &'static str)> {
    vec![
        ("cascade-panel.html", CASCADE_PANEL_HTML),
        ("cascade-panel/cascade-panel.css", cascade_panel::CASCADE_PANEL_CSS),
        ("cascade-panel/cascade-panel.js", cascade_panel::CASCADE_PANEL_JS),
        ("cascade-panel/constants.js", cascade_panel::CONSTANTS_JS),
        ("cascade-panel/copy.js", cascade_panel::COPY_JS),
        ("cascade-panel/extract.js", cascade_panel::EXTRACT_JS),
        ("cascade-panel/icons.js", cascade_panel::ICONS_JS),
        ("cascade-panel/math.js", cascade_panel::MATH_JS),
        ("cascade-panel/mermaid.js", cascade_panel::MERMAID_JS),
        ("cascade-panel/scan.js", cascade_panel::SCAN_JS),
        ("cascade-panel/table-fix.css", cascade_panel::TABLE_FIX_CSS),
        ("cascade-panel/utils.js", cascade_panel::UTILS_JS),
    ]
}
