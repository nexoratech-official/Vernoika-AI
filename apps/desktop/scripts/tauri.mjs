import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mode = process.argv[2];

function getBackendOrigin() {
  const configuredUrl = process.env.VORNOKIA_DESKTOP_URL;
  const value = configuredUrl || (mode === "dev" ? "http://localhost:3000" : "");
  if (!value) {
    throw new Error("Set VORNOKIA_DESKTOP_URL to the deployed HTTPS origin before building the desktop package.");
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("VORNOKIA_DESKTOP_URL must be a valid origin URL.");
  }
  const isDevOrigin = mode === "dev" && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
  if (url.protocol !== "https:" && !isDevOrigin) {
    throw new Error("The desktop app requires HTTPS; HTTP is allowed only for localhost development.");
  }
  if (mode === "dev" && !isDevOrigin) {
    throw new Error("Tauri development mode connects only to the local Next.js server at http://localhost:3000.");
  }
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("VORNOKIA_DESKTOP_URL must contain only an origin, without credentials, path, query, or fragment.");
  }
  return url.origin;
}

function buildTauriConfig(origin) {
  return {
    $schema: "https://schema.tauri.app/config/2",
    productName: "Vornokia",
    version: "0.1.0",
    identifier: "com.nexoratech.vornokia",
    build: {
      beforeDevCommand: "node scripts/start-web.mjs",
      devUrl: `${origin}/app/chat`,
      frontendDist: "../www"
    },
    app: {
      windows: [{
        label: "main",
        title: "Vornokia",
        url: `${origin}/app/chat`,
        width: 1280,
        height: 820,
        minWidth: 760,
        minHeight: 560,
        center: true
      }],
      security: {
        capabilities: ["main"]
      }
    },
    bundle: {
      active: true,
      targets: "all",
      icon: [
        "icons/32x32.png",
        "icons/128x128.png",
        "icons/128x128@2x.png",
        "icons/icon.icns",
        "icons/icon.ico"
      ],
      category: "Productivity",
      shortDescription: "Vornokia desktop assistant"
    }
  };
}

async function prepareConfig(origin) {
  const tauriDir = path.join(root, "src-tauri");
  const capabilitiesDir = path.join(tauriDir, "capabilities");
  await mkdir(capabilitiesDir, { recursive: true });
  await writeFile(path.join(tauriDir, "tauri.conf.json"), `${JSON.stringify(buildTauriConfig(origin), null, 2)}\n`);
  const capability = {
    $schema: "../gen/schemas/desktop-schema.json",
    identifier: "main",
    description: "Exact-origin Vornokia web app bridge with only the minimum core permissions.",
    windows: ["main"],
    remote: { urls: [origin] },
    permissions: [
      "core:default",
      "allow-device-status",
      "allow-set-device-permission",
      "allow-emergency-stop",
      "allow-reset-emergency-stop",
      "allow-read-selected-text-file",
      "allow-save-new-text-file",
      "allow-add-approved-application",
      "allow-remove-approved-application",
      "allow-launch-approved-application"
    ]
  };
  await writeFile(path.join(capabilitiesDir, "remote.json"), `${JSON.stringify(capability, null, 2)}\n`);
}

if (!["dev", "build", "config"].includes(mode)) {
  throw new Error("Usage: node scripts/tauri.mjs <dev|build|config>");
}

try {
  const origin = getBackendOrigin();
  await prepareConfig(origin);
  if (mode === "config") {
    console.log(`Tauri config prepared for ${origin}.`);
    process.exit(0);
  }

  const npmExecPath = process.env.npm_execpath;
  if (!npmExecPath) throw new Error("Run this command through npm so the Tauri CLI can be resolved.");
  const result = spawnSync(process.execPath, [npmExecPath, "exec", "--", "tauri", mode], {
    cwd: root,
    stdio: "inherit"
  });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
} catch (error) {
  console.error(error instanceof Error ? error.message : "The desktop command failed.");
  process.exitCode = 1;
}
