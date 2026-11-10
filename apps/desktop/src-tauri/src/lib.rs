use serde::{Deserialize, Serialize};
use std::{
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    path::{Path, PathBuf},
    process::Command,
    sync::Mutex,
};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_dialog::{DialogExt, FilePath, MessageDialogButtons, MessageDialogKind};
use uuid::Uuid;

const MAX_FILE_BYTES: u64 = 1_000_000;
const MAX_CHAT_TEXT_CHARS: usize = 16_000;
const MAX_SAVE_BYTES: usize = 1_000_000;

#[derive(Clone, Serialize, Deserialize)]
struct ApprovedApplication {
    id: String,
    name: String,
    path: String,
}

#[derive(Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
struct DevicePermissions {
    read_selected_files: bool,
    save_new_files: bool,
    launch_approved_apps: bool,
}

#[derive(Default, Serialize)]
#[serde(rename_all = "camelCase")]
struct DeviceStatus {
    permissions: DevicePermissions,
    emergency_stopped: bool,
    approved_apps: Vec<ApprovedApplicationSummary>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ApprovedApplicationSummary {
    id: String,
    name: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SelectedTextFile {
    name: String,
    text: String,
}

#[derive(Default)]
struct DeviceState {
    permissions: DevicePermissions,
    emergency_stopped: bool,
    approved_apps: Vec<ApprovedApplication>,
    approved_apps_path: PathBuf,
}

fn path_from_dialog(value: FilePath) -> Result<PathBuf, String> {
    match value {
        FilePath::Path(path) => Ok(path),
        FilePath::Url(url) => url
            .to_file_path()
            .map_err(|_| "The selected location is not a local file.".to_string()),
    }
}

fn state_status(state: &DeviceState) -> DeviceStatus {
    DeviceStatus {
        permissions: state.permissions.clone(),
        emergency_stopped: state.emergency_stopped,
        approved_apps: state
            .approved_apps
            .iter()
            .map(|app| ApprovedApplicationSummary {
                id: app.id.clone(),
                name: app.name.clone(),
            })
            .collect(),
    }
}

fn lock_state<'a>(
    state: &'a State<'_, Mutex<DeviceState>>,
) -> Result<std::sync::MutexGuard<'a, DeviceState>, String> {
    state
        .lock()
        .map_err(|_| "Desktop permission state is unavailable.".to_string())
}

fn ensure_active(
    state: &DeviceState,
    permission_enabled: bool,
    message: &str,
) -> Result<(), String> {
    if state.emergency_stopped {
        return Err(
            "Emergency stop is active. Reset it in Desktop controls before continuing.".to_string(),
        );
    }
    if !permission_enabled {
        return Err(message.to_string());
    }
    Ok(())
}

fn persist_approved_apps(path: &Path, apps: &[ApprovedApplication]) -> Result<(), String> {
    let bytes =
        serde_json::to_vec(apps).map_err(|_| "Approved apps could not be saved.".to_string())?;
    fs::write(path, bytes).map_err(|error| format!("Approved apps could not be saved: {error}"))
}

fn write_new_text_file(path: &Path, content: &str) -> Result<(), String> {
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map_err(|error| {
            if error.kind() == std::io::ErrorKind::AlreadyExists {
                "That file already exists. Choose a new name; Vornokia never overwrites files."
                    .to_string()
            } else {
                format!("The new file could not be created: {error}")
            }
        })?;
    file.write_all(content.as_bytes())
        .map_err(|error| format!("The new file could not be saved: {error}"))
}

fn validate_text_input_path(path: &Path) -> Result<(), String> {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .map(str::to_ascii_lowercase);
    if matches!(extension.as_deref(), Some("txt" | "md" | "csv" | "json")) {
        Ok(())
    } else {
        Err("Choose a TXT, Markdown, CSV, or JSON file.".to_string())
    }
}

fn validate_text_output_path(path: &mut PathBuf) -> Result<(), String> {
    match path
        .extension()
        .and_then(|value| value.to_str())
        .map(str::to_ascii_lowercase)
        .as_deref()
    {
        Some("txt" | "md") => Ok(()),
        None => {
            path.set_extension("txt");
            Ok(())
        }
        _ => Err("Choose a new TXT or Markdown file.".to_string()),
    }
}

fn confirm_native(app: &AppHandle, title: &str, message: &str) -> bool {
    app.dialog()
        .message(message)
        .title(title)
        .kind(MessageDialogKind::Warning)
        .buttons(MessageDialogButtons::YesNo)
        .blocking_show()
}

#[tauri::command]
fn device_status(state: State<'_, Mutex<DeviceState>>) -> Result<DeviceStatus, String> {
    let state = lock_state(&state)?;
    Ok(state_status(&state))
}

#[tauri::command]
async fn set_device_permission(
    app: AppHandle,
    state: State<'_, Mutex<DeviceState>>,
    permission: String,
    enabled: bool,
) -> Result<DeviceStatus, String> {
    let (label, description) = match permission.as_str() {
        "readSelectedFiles" => ("Read selected files", "Allow Vornokia to read text from a file you select. Each read still opens a native file picker."),
        "saveNewFiles" => ("Save new files", "Allow Vornokia to save text only to a new file location you select. Existing files are never overwritten."),
        "launchApprovedApps" => ("Launch approved apps", "Allow Vornokia to launch only apps you add to the local allowlist. Each launch still requires confirmation."),
        _ => return Err("Unknown desktop permission.".to_string()),
    };

    if enabled {
        {
            let state = lock_state(&state)?;
            if state.emergency_stopped {
                return Err(
                    "Reset the emergency stop before enabling a device permission.".to_string(),
                );
            }
        }
        let message = format!("{description}\n\nEnable \"{label}\" for this desktop session?");
        if !confirm_native(&app, "Vornokia desktop permission", &message) {
            return device_status(state);
        }
    }

    let mut state = lock_state(&state)?;
    if enabled && state.emergency_stopped {
        return Err("Reset the emergency stop before enabling a device permission.".to_string());
    }
    match permission.as_str() {
        "readSelectedFiles" => state.permissions.read_selected_files = enabled,
        "saveNewFiles" => state.permissions.save_new_files = enabled,
        "launchApprovedApps" => state.permissions.launch_approved_apps = enabled,
        _ => return Err("Unknown desktop permission.".to_string()),
    }
    Ok(state_status(&state))
}

#[tauri::command]
fn emergency_stop(state: State<'_, Mutex<DeviceState>>) -> Result<DeviceStatus, String> {
    let mut state = lock_state(&state)?;
    state.emergency_stopped = true;
    state.permissions = DevicePermissions::default();
    state.approved_apps.clear();
    persist_approved_apps(&state.approved_apps_path, &state.approved_apps)?;
    Ok(state_status(&state))
}

#[tauri::command]
async fn reset_emergency_stop(
    app: AppHandle,
    state: State<'_, Mutex<DeviceState>>,
) -> Result<DeviceStatus, String> {
    let mut state = lock_state(&state)?;
    if !state.emergency_stopped {
        return Ok(state_status(&state));
    }
    if !confirm_native(
        &app,
        "Reset Vornokia emergency stop?",
        "This will allow you to re-enable desktop permissions. All permissions remain off until separately approved.",
    ) {
        return Ok(state_status(&state));
    }
    state.emergency_stopped = false;
    Ok(state_status(&state))
}

#[tauri::command]
async fn read_selected_text_file(
    app: AppHandle,
    state: State<'_, Mutex<DeviceState>>,
) -> Result<Option<SelectedTextFile>, String> {
    {
        let state = lock_state(&state)?;
        ensure_active(
            &state,
            state.permissions.read_selected_files,
            "Enable selected-file reading in Desktop controls first.",
        )?;
    }
    let Some(selection) = app
        .dialog()
        .file()
        .add_filter("Text files", &["txt", "md", "csv", "json"])
        .blocking_pick_file()
    else {
        return Ok(None);
    };
    let state = lock_state(&state)?;
    ensure_active(
        &state,
        state.permissions.read_selected_files,
        "File reading was disabled before the selected file could be read.",
    )?;
    let path = path_from_dialog(selection)?;
    validate_text_input_path(&path)?;
    let metadata = fs::metadata(&path)
        .map_err(|error| format!("The selected file could not be inspected: {error}"))?;
    if !metadata.is_file() || metadata.len() > MAX_FILE_BYTES {
        return Err("Choose a text file smaller than 1 MB.".to_string());
    }
    let mut bytes = Vec::new();
    File::open(&path)
        .and_then(|file| file.take(MAX_FILE_BYTES + 1).read_to_end(&mut bytes))
        .map_err(|error| format!("The selected file could not be read: {error}"))?;
    if bytes.len() as u64 > MAX_FILE_BYTES {
        return Err("The selected file is larger than 1 MB.".to_string());
    }
    let text = String::from_utf8(bytes).map_err(|_| "Choose a UTF-8 text file.".to_string())?;
    if text.chars().count() > MAX_CHAT_TEXT_CHARS {
        return Err("The selected file exceeds the 16,000-character chat limit.".to_string());
    }
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("selected-file.txt")
        .to_string();
    Ok(Some(SelectedTextFile { name, text }))
}

#[tauri::command]
async fn save_new_text_file(
    app: AppHandle,
    state: State<'_, Mutex<DeviceState>>,
    content: String,
) -> Result<Option<String>, String> {
    {
        let state = lock_state(&state)?;
        ensure_active(
            &state,
            state.permissions.save_new_files,
            "Enable saving new files in Desktop controls first.",
        )?;
    }
    if content.len() > MAX_SAVE_BYTES {
        return Err("Text to save exceeds the 1 MB limit.".to_string());
    }
    let Some(selection) = app
        .dialog()
        .file()
        .add_filter("Text files", &["txt", "md"])
        .blocking_save_file()
    else {
        return Ok(None);
    };
    let state = lock_state(&state)?;
    ensure_active(
        &state,
        state.permissions.save_new_files,
        "File saving was disabled before the new file could be created.",
    )?;
    let mut path = path_from_dialog(selection)?;
    validate_text_output_path(&mut path)?;
    write_new_text_file(&path, &content)?;
    Ok(Some(
        path.file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("new file")
            .to_string(),
    ))
}

#[tauri::command]
async fn add_approved_application(
    app: AppHandle,
    state: State<'_, Mutex<DeviceState>>,
) -> Result<DeviceStatus, String> {
    {
        let state = lock_state(&state)?;
        ensure_active(
            &state,
            state.permissions.launch_approved_apps,
            "Enable approved-app launching in Desktop controls first.",
        )?;
    }

    #[cfg(target_os = "macos")]
    let selection = app.dialog().file().blocking_pick_folder();
    #[cfg(target_os = "windows")]
    let selection = app
        .dialog()
        .file()
        .add_filter("Windows application executable", &["exe"])
        .blocking_pick_file();
    #[cfg(target_os = "linux")]
    let selection = app.dialog().file().blocking_pick_file();

    let Some(selection) = selection else {
        return device_status(state);
    };
    let path = path_from_dialog(selection)?;
    let canonical_path = fs::canonicalize(&path)
        .map_err(|error| format!("The selected application could not be verified: {error}"))?;
    validate_application_path(&canonical_path)?;
    let name = canonical_path
        .file_stem()
        .or_else(|| canonical_path.file_name())
        .and_then(|value| value.to_str())
        .unwrap_or("Approved application")
        .to_string();
    if !confirm_native(
        &app,
        "Add approved application",
        &format!(
            "Add \"{name}\" at {} to Vornokia's local launch allowlist? No command-line arguments will be supplied.",
            canonical_path.display()
        ),
    ) {
        return device_status(state);
    }

    let mut state = lock_state(&state)?;
    ensure_active(
        &state,
        state.permissions.launch_approved_apps,
        "App launching was disabled before the application could be added.",
    )?;
    let path_text = canonical_path.to_string_lossy().into_owned();
    if !state
        .approved_apps
        .iter()
        .any(|item| item.path == path_text)
    {
        state.approved_apps.push(ApprovedApplication {
            id: Uuid::new_v4().to_string(),
            name,
            path: path_text,
        });
        persist_approved_apps(&state.approved_apps_path, &state.approved_apps)?;
    }
    Ok(state_status(&state))
}

#[cfg(target_os = "macos")]
fn validate_application_path(path: &Path) -> Result<(), String> {
    if path.is_dir() && path.extension().is_some_and(|extension| extension == "app") {
        Ok(())
    } else {
        Err("Select a macOS application bundle ending in .app.".to_string())
    }
}

#[cfg(target_os = "windows")]
fn validate_application_path(path: &Path) -> Result<(), String> {
    if path.is_file()
        && path
            .extension()
            .is_some_and(|extension| extension.eq_ignore_ascii_case("exe"))
    {
        Ok(())
    } else {
        Err("Select a Windows application executable (.exe).".to_string())
    }
}

#[cfg(target_os = "linux")]
fn validate_application_path(path: &Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;

    let metadata = fs::metadata(path)
        .map_err(|error| format!("The application could not be inspected: {error}"))?;
    if metadata.is_file() && metadata.permissions().mode() & 0o111 != 0 {
        Ok(())
    } else {
        Err("Select an executable file with launch permission.".to_string())
    }
}

#[tauri::command]
async fn remove_approved_application(
    app: AppHandle,
    state: State<'_, Mutex<DeviceState>>,
    application_id: String,
) -> Result<DeviceStatus, String> {
    let application = {
        let state = lock_state(&state)?;
        state
            .approved_apps
            .iter()
            .find(|item| item.id == application_id)
            .cloned()
            .ok_or_else(|| "That application is not in the local allowlist.".to_string())?
    };
    if !confirm_native(
        &app,
        "Remove approved application",
        &format!(
            "Remove \"{}\" from Vornokia's local launch allowlist?",
            application.name
        ),
    ) {
        return device_status(state);
    }
    let mut state = lock_state(&state)?;
    if !state
        .approved_apps
        .iter()
        .any(|item| item.id == application_id)
    {
        return Ok(state_status(&state));
    }
    state.approved_apps.retain(|item| item.id != application_id);
    persist_approved_apps(&state.approved_apps_path, &state.approved_apps)?;
    Ok(state_status(&state))
}

#[tauri::command]
async fn launch_approved_application(
    app: AppHandle,
    state: State<'_, Mutex<DeviceState>>,
    application_id: String,
) -> Result<bool, String> {
    let application = {
        let state = lock_state(&state)?;
        ensure_active(
            &state,
            state.permissions.launch_approved_apps,
            "Enable approved-app launching in Desktop controls first.",
        )?;
        state
            .approved_apps
            .iter()
            .find(|item| item.id == application_id)
            .cloned()
            .ok_or_else(|| "That application is not in the local allowlist.".to_string())?
    };
    let path = PathBuf::from(&application.path);
    validate_application_path(&path)?;
    if !confirm_native(
        &app,
        "Launch approved application",
        &format!(
            "Launch \"{}\" at {} now?",
            application.name, application.path
        ),
    ) {
        return Ok(false);
    }
    let state = lock_state(&state)?;
    ensure_active(
        &state,
        state.permissions.launch_approved_apps,
        "App launching was disabled before the application could start.",
    )?;
    if !state
        .approved_apps
        .iter()
        .any(|item| item.id == application_id)
    {
        return Err("That application was removed from the local allowlist.".to_string());
    }

    #[cfg(target_os = "macos")]
    let result = Command::new("/usr/bin/open").arg("-a").arg(&path).spawn();
    #[cfg(not(target_os = "macos"))]
    let result = Command::new(&path).spawn();

    result
        .map(|_| true)
        .map_err(|error| format!("The approved application could not be launched: {error}"))
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let config_dir = app.path().app_config_dir()?;
            fs::create_dir_all(&config_dir)?;
            let approved_apps_path = config_dir.join("approved-apps.json");
            let approved_apps = match fs::read(&approved_apps_path) {
                Ok(bytes) => serde_json::from_slice(&bytes)?,
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => Vec::new(),
                Err(error) => return Err(error.into()),
            };
            app.manage(Mutex::new(DeviceState {
                approved_apps,
                approved_apps_path,
                ..DeviceState::default()
            }));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            device_status,
            set_device_permission,
            emergency_stop,
            reset_emergency_stop,
            read_selected_text_file,
            save_new_text_file,
            add_approved_application,
            remove_approved_application,
            launch_approved_application,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Vornokia desktop app");
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_directory() -> PathBuf {
        std::env::temp_dir().join(format!("vornokia-desktop-test-{}", Uuid::new_v4()))
    }

    #[test]
    fn extensionless_output_path_defaults_to_txt_and_rejects_other_types() {
        let mut path = PathBuf::from("notes");
        validate_text_output_path(&mut path).expect("extensionless output should be supported");
        assert_eq!(path, PathBuf::from("notes.txt"));
        assert!(validate_text_output_path(&mut PathBuf::from("notes.pdf")).is_err());
    }

    #[test]
    fn saving_never_overwrites_an_existing_file() {
        let directory = test_directory();
        fs::create_dir(&directory).expect("test directory should be created");
        let path = directory.join("existing.txt");
        fs::write(&path, "original").expect("existing file should be created");

        let result = write_new_text_file(&path, "replacement");
        assert!(result.unwrap_err().contains("never overwrites"));
        assert_eq!(
            fs::read_to_string(&path).expect("existing file should remain"),
            "original"
        );

        fs::remove_dir_all(directory).expect("test directory should be removed");
    }
}
