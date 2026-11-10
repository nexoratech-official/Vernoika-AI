# Vornokia Desktop

Vornokia Desktop is a Tauri v2 shell around the authenticated Vornokia web app. The web app and its server-side AI gateway remain hosted services; the desktop package does not embed provider credentials or a local model server.

## Requirements

- Node.js compatible with `apps/web`
- Rust 1.90 or newer and the Cargo toolchain
- Tauri's platform prerequisites: Microsoft C++ Build Tools and WebView2 on Windows; Xcode command-line tools on macOS; GTK/WebKitGTK and the Tauri-required system libraries on Linux
- A deployed Vornokia HTTPS origin for production packaging, with Supabase authentication and redirect URLs configured for that origin

## Development

Install the web and desktop dependencies:

```powershell
Set-Location apps\web
npm install
Set-Location ..\desktop
npm install
npm run dev
```

`npm run dev` starts the Next.js app on `http://localhost:3000`, generates a development-only Tauri config for that loopback origin, and launches the desktop shell. Do not bind the development server to a public network interface.

## Production packaging

Set `VORNOKIA_DESKTOP_URL` to the exact deployed HTTPS origin (without a path or trailing route), then run the Tauri build on the target operating system:

```powershell
$env:VORNOKIA_DESKTOP_URL = "https://your-deployed-vornokia-origin"
npm run build
```

The build fails closed when the URL is missing or is not HTTPS. The generated Tauri capability allows the native bridge only to that exact origin. Do not use a wildcard or a user-controlled runtime URL. Windows, macOS, and Linux installers must be built and tested on their respective platforms; a successful build on Windows does not certify the other operating systems.

## Local-device controls

Desktop controls appear in **App → Settings** and in the live chat composer. Each permission is off when the app starts and must be enabled through a native confirmation dialog. Permissions last only for the current app session.

- **Read selected files:** opens a native picker for UTF-8 TXT, Markdown, CSV, or JSON files up to 1 MB / 16,000 characters. The user must press Send to transmit the attached contents to the configured AI provider. Persisted chat stores the filename and a placeholder, not the file contents.
- **Save new files:** saves assistant text to a new user-selected TXT or Markdown path. The file is created exclusively; existing files are never overwritten.
- **Launch approved apps:** only executable paths added through the native picker are allowed. Each launch requires another native confirmation and passes no arguments. macOS accepts `.app` bundles, Windows accepts `.exe`, and Linux requires a user-selected executable file. The allowlist is stored locally; the emergency stop clears it.

The emergency stop disables every desktop permission and clears the app allowlist. It blocks future actions but does not close an application that was already launched. There is no arbitrary shell access, autonomous file access, file deletion, or general keyboard/mouse automation.

## Trust boundary

Only the exact configured web origin receives the remote Tauri capability. Native file selection and app-launch confirmations are displayed by the operating system, and Rust commands independently check permission and emergency-stop state. No shell, filesystem, or dialog plugin commands are exposed directly to remote JavaScript. Keep the hosted web app and its dependencies secure: trusted-origin access is still a sensitive boundary.

The development server uses loopback HTTP only. Production is HTTPS-only. The Tauri/Rust bridge has not yet been validated on macOS or Linux in this Windows environment.
