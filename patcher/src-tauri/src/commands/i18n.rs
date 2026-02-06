use serde_json::Value;
use std::sync::OnceLock;

#[derive(Debug)]
pub enum CommandError {
    Localized {
        key: &'static str,
        vars: Vec<(String, String)>,
    },
    Raw(String),
}

impl CommandError {
    pub fn key(key: &'static str) -> Self {
        Self::Localized {
            key,
            vars: Vec::new(),
        }
    }

    pub fn key_with(key: &'static str, vars: &[(&str, String)]) -> Self {
        Self::Localized {
            key,
            vars: vars
                .iter()
                .map(|(name, value)| ((*name).to_string(), value.clone()))
                .collect(),
        }
    }

    pub fn to_message(&self, locale: Option<&str>) -> String {
        match self {
            Self::Localized { key, vars } => {
                let mut message = text(locale, key);
                for (name, value) in vars {
                    message = message.replace(&format!("{{{}}}", name), value);
                }
                message
            }
            Self::Raw(message) => message.clone(),
        }
    }

    pub fn details_for_match(&self) -> String {
        match self {
            Self::Localized { vars, .. } => vars
                .iter()
                .map(|(_, value)| value.as_str())
                .collect::<Vec<_>>()
                .join("\n"),
            Self::Raw(message) => message.clone(),
        }
    }
}

impl From<String> for CommandError {
    fn from(value: String) -> Self {
        Self::Raw(value)
    }
}

const LOCALE_ZH_JSON: &str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../src/locales/zh-CN.json"
));
const LOCALE_EN_JSON: &str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../src/locales/en-US.json"
));

pub fn is_zh_locale(locale: Option<&str>) -> bool {
    if let Some(value) = locale {
        return value.to_ascii_lowercase().starts_with("zh");
    }
    true
}

fn locale_root(locale: Option<&str>) -> &'static Value {
    static ZH: OnceLock<Value> = OnceLock::new();
    static EN: OnceLock<Value> = OnceLock::new();

    if is_zh_locale(locale) {
        ZH.get_or_init(|| serde_json::from_str(LOCALE_ZH_JSON).unwrap_or(Value::Null))
    } else {
        EN.get_or_init(|| serde_json::from_str(LOCALE_EN_JSON).unwrap_or(Value::Null))
    }
}

pub fn text(locale: Option<&str>, key: &str) -> String {
    let pointer = format!("/{}", key.replace('.', "/"));
    locale_root(locale)
        .pointer(&pointer)
        .and_then(Value::as_str)
        .map(ToString::to_string)
        .unwrap_or_else(|| key.to_string())
}

#[allow(dead_code)]
pub fn text_with(locale: Option<&str>, key: &str, vars: &[(&str, String)]) -> String {
    let mut message = text(locale, key);
    for (name, value) in vars {
        message = message.replace(&format!("{{{}}}", name), value);
    }
    message
}
