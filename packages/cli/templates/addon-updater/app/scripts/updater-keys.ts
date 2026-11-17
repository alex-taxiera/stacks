// The key __APP_TITLE__'s updates are signed with. Installed copies only accept an update signed by
// it, so this makes it once, keeps it outside the repo, and puts its public half in
// tauri.conf.json.
//
//   pnpm --filter __APP_NAME__ updater:keys             make the key, if there isn't one, and use it
//   pnpm --filter __APP_NAME__ updater:keys --secrets   also give it to GitHub, for release builds
//
// Back up the key file and its password (both in ~/.tauri). Lose them and installed copies can't
// be updated: a new key means everyone reinstalls by hand.

import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const KEY = path.join(homedir(), ".tauri", "__APP_IDENTIFIER__.key");
const PASSWORD = `${KEY}.password`;
const CONFIG = path.join(import.meta.dirname, "../src-tauri/tauri.conf.json");
/** The GitHub secrets release-__APP_NAME__.yml signs with. */
const SECRET_PREFIX = "__APP_CONST__";
const SECRETS = {
  [`${SECRET_PREFIX}_UPDATER_KEY`]: KEY,
  [`${SECRET_PREFIX}_UPDATER_KEY_PASSWORD`]: PASSWORD,
};

const isWindows = process.platform === "win32";

/** Runs a command (through the shell on Windows, for pnpm.cmd), with `input` on its stdin. */
function run(command: string, args: string[], input?: string) {
  const result = spawnSync(command, isWindows ? args.map((arg) => `"${arg}"`) : args, {
    input,
    stdio: [input === undefined ? "inherit" : "pipe", "inherit", "inherit"],
    shell: isWindows,
  });
  if (result.status !== 0) throw new Error(`${command} ${args.slice(0, 3).join(" ")} failed`);
}

if (!existsSync(KEY)) {
  mkdirSync(path.dirname(KEY), { recursive: true });
  const password = randomBytes(24).toString("base64url");
  run("pnpm", ["exec", "tauri", "signer", "generate", "--ci", "-w", KEY, "-p", password]);
  writeFileSync(PASSWORD, password, { mode: 0o600 });
  console.log(`Made ${KEY}, with its password in ${PASSWORD}. Back both up.`);
}

const pubkey = readFileSync(`${KEY}.pub`, "utf8").trim();
const config = readFileSync(CONFIG, "utf8");
const pubkeyField = /"pubkey": "[^"]*"/;
if (!pubkeyField.test(config)) throw new Error(`${CONFIG} has no plugins.updater.pubkey`);
writeFileSync(CONFIG, config.replace(pubkeyField, `"pubkey": "${pubkey}"`));
console.log("The updater checks signatures against this key (tauri.conf.json).");

if (process.argv.includes("--secrets")) {
  for (const [name, file] of Object.entries(SECRETS)) {
    run("gh", ["secret", "set", name], readFileSync(file, "utf8").trim());
  }
  console.log(`Release builds can sign updates: ${Object.keys(SECRETS).join(", ")} are set.`);
} else {
  console.log(
    "Once the repo is on GitHub, run this again with --secrets so release builds can sign updates.",
  );
}
