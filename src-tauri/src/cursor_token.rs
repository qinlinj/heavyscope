//! Optional macOS-only read of Cursor `state.vscdb` (`cursorAuth/accessToken`).
//! Never writes the database. Linux / Windows builds compile the stub only.

#[cfg(target_os = "macos")]
mod macos {
    use rusqlite::{Connection, OpenFlags};

    fn b64url_decode(input: &str) -> Result<Vec<u8>, String> {
        let mut s = input.replace('-', "+").replace('_', "/");
        while s.len() % 4 != 0 {
            s.push('=');
        }
        base64::Engine::decode(&base64::engine::general_purpose::STANDARD, s)
            .map_err(|err| err.to_string())
    }

    fn derive_session_token(raw: &str) -> Result<String, String> {
        let token = raw.trim();
        if token.is_empty() {
            return Err("Cursor access token was empty".into());
        }
        if token.contains("%3A%3A") || token.contains("::") {
            return Ok(token.to_string());
        }
        let parts: Vec<&str> = token.split('.').collect();
        if parts.len() < 2 {
            return Err("Cursor access token is not a JWT".into());
        }
        let payload = b64url_decode(parts[1])?;
        let json: serde_json::Value =
            serde_json::from_slice(&payload).map_err(|err| err.to_string())?;
        let sub = json
            .get("sub")
            .and_then(|value| value.as_str())
            .ok_or_else(|| "Cursor JWT is missing sub".to_string())?;
        let user = sub.rsplit('|').next().unwrap_or(sub);
        Ok(format!("{user}::{token}"))
    }

    fn vscdb_path() -> Result<std::path::PathBuf, String> {
        let home = std::env::var("HOME").map_err(|_| "HOME is not set".to_string())?;
        Ok(std::path::PathBuf::from(home)
            .join("Library/Application Support/Cursor/User/globalStorage/state.vscdb"))
    }

    pub fn read_cursor_session_token() -> Result<String, String> {
        let path = vscdb_path()?;
        if !path.exists() {
            return Err(format!(
                "Cursor state.vscdb was not found at {}. This helper only works on a real Mac.",
                path.display()
            ));
        }
        let flags = OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX;
        let conn = Connection::open_with_flags(&path, flags).map_err(|err| err.to_string())?;
        let value: String = conn
            .query_row(
                "SELECT value FROM ItemTable WHERE key = ?1",
                ["cursorAuth/accessToken"],
                |row| row.get(0),
            )
            .map_err(|_| "cursorAuth/accessToken was not found in state.vscdb".to_string())?;
        derive_session_token(&value)
    }
}

#[cfg(target_os = "macos")]
#[tauri::command]
pub fn read_cursor_session_token() -> Result<String, String> {
    macos::read_cursor_session_token()
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub fn read_cursor_session_token() -> Result<String, String> {
    Err("Cursor vscdb helper is only available on a real Mac.".into())
}
