// Draws every icon __APP_TITLE__'s installers need from one drawing: app-icon.svg (or a PNG of at
// least 1024 px given as the argument) becomes src-tauri/icons.
//
//   pnpm --filter __APP_NAME__ icons [path/to/icon.png]

import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

const app = path.resolve(import.meta.dirname, "..");
const icons = path.join(app, "src-tauri/icons");
const source = path.resolve(process.argv[2] ?? path.join(app, "app-icon.svg"));

const isWindows = process.platform === "win32";
// Windows needs the shell for pnpm.cmd, and the shell one quoted command line.
const args = ["exec", "tauri", "icon", source, "--output", icons];
const result = isWindows
  ? spawnSync(["pnpm", ...args.map((arg) => `"${arg}"`)].join(" "), {
      cwd: app,
      stdio: "inherit",
      shell: true,
    })
  : spawnSync("pnpm", args, { cwd: app, stdio: "inherit" });
if (result.status !== 0) process.exit(result.status ?? 1);

// The app is desktop only; `tauri icon` draws phone icons too.
for (const dir of ["android", "ios"]) rmSync(path.join(icons, dir), { recursive: true, force: true });
console.log(`Icons written to ${path.relative(process.cwd(), icons) || "."}`);
