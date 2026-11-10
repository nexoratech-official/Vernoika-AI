fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "device_status",
            "set_device_permission",
            "emergency_stop",
            "reset_emergency_stop",
            "read_selected_text_file",
            "save_new_text_file",
            "add_approved_application",
            "remove_approved_application",
            "launch_approved_application",
        ]),
    ))
    .expect("failed to build Vornokia Tauri app manifest");
}
