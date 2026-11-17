import type { Layer, LayerSpec } from "../model.ts";
import { requireApp, requirePorts, requireUi } from "./require.ts";
import {
  CHAKRA,
  REACT,
  REACT_TYPES,
  STORYBOOK,
  storybookScripts,
  TYPESCRIPT,
  VITE_REACT,
} from "./shared.ts";

/** The libraries Tauri builds against on Linux. */
const TAURI_LINUX_LIBRARIES = "libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf";

/**
 * The root Cargo workspace and `crates/core`, which the first Tauri app creates: the logic its
 * commands call, tested on its own, whose types ts-rs writes to TypeScript for that app.
 */
export const rust: Layer = (ctx) => {
  const app = requireApp(ctx.app);
  return {
    id: "rust",
    packages: {
      root: {
        scripts: {
          // The core's types, as TypeScript, for the first Tauri app (.cargo/config.toml).
          bindings: `cargo test -p app-core export_bindings && oxfmt ${app.dir}/src/bindings`,
        },
        fields: { "lint-staged": { "*.rs": "cargo fmt --" } },
      },
    },
    lines: { ".gitignore": ["target/", "**/src-tauri/gen/"] },
    yaml: {
      ".github/workflows/ci.yml": {
        jobs: {
          rust: {
            name: "Rust",
            "runs-on": "ubuntu-latest",
            steps: [
              { uses: "actions/checkout@__ACTION[actions/checkout]__" },
              {
                name: "Install the libraries Tauri builds against",
                run: `sudo apt-get update && sudo apt-get install -y ${TAURI_LINUX_LIBRARIES}`,
              },
              // A toolchain channel, not a version: the action's branches are named for them.
              {
                uses: "dtolnay/rust-toolchain@stable",
                with: { components: "clippy, rustfmt" },
              },
              { uses: "Swatinem/rust-cache@__ACTION[Swatinem/rust-cache]__" },
              { uses: "pnpm/action-setup@__ACTION[pnpm/action-setup]__" },
              {
                uses: "actions/setup-node@__ACTION[actions/setup-node]__",
                with: { "node-version-file": ".nvmrc", cache: "pnpm" },
              },
              { run: "pnpm install --frozen-lockfile" },
              // Each Tauri app's crate embeds its built front end (`dist`) when it compiles.
              { run: "pnpm build" },
              { run: "cargo fmt --all --check" },
              { run: "cargo clippy --workspace --all-targets -- -D warnings" },
              { run: "cargo test --workspace" },
              {
                name: "The TypeScript bindings match the Rust types",
                run: `pnpm bindings && git diff --exit-code ${app.dir}/src/bindings || (echo "Run pnpm bindings and commit the result." && exit 1)`,
              },
            ],
          },
        },
      },
    },
    agents: [
      {
        region: "apps",
        id: "rust",
        body: [
          "- `crates/core` (`app-core`) — the Rust logic the Tauri apps' commands call, tested on its",
          "  own (`cargo test -p app-core`). The root `Cargo.toml` is the workspace: `crates/*` and",
          "  `apps/*/src-tauri`.",
        ].join("\n"),
      },
      {
        region: "rules",
        id: "rust",
        body: [
          "- **Rust:** `cargo fmt`, and `cargo clippy --workspace --all-targets -- -D warnings` clean.",
          "  Work goes in `crates/core`; a Tauri command only converts between it and the front end.",
          `  A type the front end sees derives \`TS\` with \`#[ts(export)]\`; \`pnpm bindings\` writes it to`,
          `  \`${app.dir}/src/bindings\`, and CI fails when that's out of date.`,
        ].join("\n"),
      },
    ],
  };
};

/** A desktop app: Tauri 2 around a Vite, React and Chakra window, its commands in Rust. */
export const tauri: Layer = (ctx) => {
  const app = requireApp(ctx.app);
  const { devPort, storybookPort } = requirePorts(app);
  const ui = requireUi(ctx).package;
  const typegen = `pnpm --filter ${ui} typegen`;
  return {
    id: "tauri",
    packages: {
      app: {
        dependencies: [
          ...CHAKRA,
          ...REACT,
          "@tauri-apps/api",
          "@tauri-apps/plugin-dialog",
          "@tauri-apps/plugin-opener",
        ],
        workspaceDependencies: [ui],
        devDependencies: [
          ...REACT_TYPES,
          ...STORYBOOK,
          ...TYPESCRIPT,
          ...VITE_REACT,
          "@tauri-apps/cli",
        ],
        scripts: {
          dev: `${typegen} && vite`,
          build: `${typegen} && tsc --noEmit && vite build`,
          tauri: "tauri",
          typecheck: `${typegen} && tsc --noEmit`,
          test: "vitest run",
          ...storybookScripts(storybookPort),
        },
      },
    },
    mcp: {
      [`storybook-${app.name}`]: { type: "http", url: `http://localhost:${storybookPort}/mcp` },
    },
    agents: [
      {
        region: "apps",
        id: `app:${app.name}`,
        body: [
          `- \`apps/${app.name}\` (package \`${app.name}\`) — ${app.title}: a Tauri 2 desktop app. The window is`,
          "  Vite, React and Chakra (`src/`); its commands are Rust (`src-tauri/src/lib.rs`), over",
          "  `crates/core`.",
          `  - \`pnpm --filter ${app.name} tauri dev\` opens it (Vite on ${devPort}); \`tauri build\` makes the installers.`,
          "  - The front end calls Rust only through `src/api.ts`, which Storybook mocks",
          "    (`.storybook/preview.tsx`), as it does every `@tauri-apps/*` module the app uses.",
          "  - Plugins: dialog (the system's file pickers) and opener (links in the browser), through `api`.",
          "  - What the window may do is in `src-tauri/capabilities/`: grant a command or plugin there,",
          "    narrowly, before using it. The content security policy is in `tauri.conf.json`.",
        ].join("\n"),
      },
      {
        region: "mcp",
        id: `storybook-${app.name}`,
        body: `- \`storybook-${app.name}\` — \`apps/${app.name}\`'s Storybook, port ${storybookPort}.`,
      },
    ],
    post: [
      {
        title: `Drawing ${app.name}'s icons`,
        command: "pnpm",
        args: ["--filter", app.name, "tauri", "icon", "app-icon.svg"],
        needsInstall: true,
      },
    ],
  };
};

/** What the release skill says about the updater, in the places it left for it. */
function releaseSkillFills(
  name: string,
  secret: string,
  endpoint: string,
): Record<string, string[]> {
  const fence = "```";
  return {
    "updater-rules": [
      "- **Publishing is also the update.** Publishing makes",
      `  \`.github/workflows/updater-${name}.yml\` copy the release's \`latest.json\` to the`,
      `  \`${name}-updater\` release, and every installed copy offers the update the next time it starts.`,
      "  Setting the release back to a draft doesn't undo that: see step 8.",
    ],
    "updater-notes": [
      "If you have <previous version> installed, the app offers this update when it starts.",
    ],
    "updater-failures": [
      `- Signing errors mean the \`${secret}_UPDATER_KEY\` and \`${secret}_UPDATER_KEY_PASSWORD\``,
      `  secrets are missing or wrong. \`pnpm --filter ${name} updater:keys --secrets\` sets them from`,
      "  the key in `~/.tauri`, on the machine that has it. Only its owner can; tell the user.",
    ],
    "updater-assets": [
      "",
      "The updater adds `latest.json`, macOS `_universal.app.tar.gz`, and a `.sig` beside every file but",
      "the `.dmg`. Check the manifest, which is what installed copies read:",
      "",
      `${fence}bash`,
      "gh api 'repos/{owner}/{repo}/releases/<release-id>' --jq '.assets[] | select(.name==\"latest.json\") | .id'",
      "gh api 'repos/{owner}/{repo}/releases/assets/<asset-id>' -H 'Accept: application/octet-stream' > <scratch dir>/latest.json",
      "jq '{version, platforms: (.platforms | keys)}' <scratch dir>/latest.json",
      fence,
      "",
      "`version` must be `<version>`, and `platforms` must cover `windows-x86_64`, `darwin-aarch64`,",
      "`darwin-x86_64` and `linux-x86_64`. A platform missing from it gets no update.",
    ],
    "updater-publish": [
      "",
      `Publishing also starts \`.github/workflows/updater-${name}.yml\`, which points \`${name}-updater\``,
      "at this release. Watch it, then check what installed copies now see:",
      "",
      `${fence}bash`,
      `gh run watch $(gh run list --workflow updater-${name}.yml --limit 5 --json databaseId,event --jq '[.[] | select(.event=="release")][0].databaseId') --exit-status`,
      `curl -sL ${endpoint} | jq -r .version   # <version>`,
      fence,
      "",
      "If the run failed, installed copies aren't offered the update yet: re-run it with",
      "`gh api -X POST 'repos/{owner}/{repo}/actions/runs/<run-id>/rerun'`.",
    ],
    "updater-rollback": [
      `It doesn't stop the update, though: installed copies are offered it until \`${name}-updater\``,
      "points back at the last good release:",
      "",
      `${fence}bash`,
      "gh release download <last-good-tag> --pattern latest.json --dir <scratch dir>",
      `gh release upload ${name}-updater <scratch dir>/latest.json --clobber`,
      fence,
      "",
      "Copies that already updated stay on the bad build.",
    ],
  };
}

/**
 * In-app updates: the app checks its own `<name>-updater` release for a newer version and installs
 * it. Release builds sign what they make with a key that `updater:keys` makes, once, outside the
 * repo; publishing a draft release is what makes it the update.
 */
export const addonUpdater: Layer = (ctx) => {
  const app = requireApp(ctx.app);
  const secret = app.name.toUpperCase().replaceAll("-", "_");
  const conf = `${app.dir}/src-tauri/tauri.conf.json`;
  const endpoint = `https://github.com/${ctx.repo.github}/releases/download/${app.name}-updater/latest.json`;
  // Code in the stack's own files, where it left room for an updater.
  const slots: LayerSpec["slots"] = {
    [`${app.dir}/src-tauri/Cargo.toml`]: {
      dependencies: [
        "",
        "# Desktop only: phones update through their stores.",
        `[target.'cfg(not(any(target_os = "android", target_os = "ios")))'.dependencies]`,
        'tauri-plugin-process = "__CRATE[tauri-plugin-process]__"',
        'tauri-plugin-updater = "__CRATE[tauri-plugin-updater]__"',
      ],
    },
    [`${app.dir}/src-tauri/src/lib.rs`]: {
      plugins: [
        "#[cfg(desktop)]",
        "let builder = builder",
        "    .plugin(tauri_plugin_process::init())",
        "    .plugin(tauri_plugin_updater::Builder::new().build());",
      ],
    },
    [`${app.dir}/src/App.tsx`]: {
      imports: ['import { UpdateButton } from "#/components/UpdateButton";'],
      "header-actions": ['<UpdateButton key="update" />,'],
    },
    [`${app.dir}/.storybook/preview.tsx`]: {
      imports: [
        'import { relaunch } from "@tauri-apps/plugin-process";',
        'import { check } from "@tauri-apps/plugin-updater";',
      ],
      mocks: [
        'sb.mock(import("@tauri-apps/plugin-process"));',
        'sb.mock(import("@tauri-apps/plugin-updater"));',
      ],
      defaults: ["mocked(check).mockResolvedValue(null);", "mocked(relaunch).mockResolvedValue();"],
    },
    [`.github/workflows/release-${app.name}.yml`]: {
      "tauri-action-env": [
        "# Signs the update bundles; the matching public key is in tauri.conf.json.",
        `TAURI_SIGNING_PRIVATE_KEY: \${{ secrets.${secret}_UPDATER_KEY }}`,
        `TAURI_SIGNING_PRIVATE_KEY_PASSWORD: \${{ secrets.${secret}_UPDATER_KEY_PASSWORD }}`,
      ],
      "tauri-action-with": [
        "# The per-user NSIS installer, which updates without asking for an administrator.",
        "updaterJsonPreferNsis: true",
      ],
    },
    [`.agents/skills/release-${app.name}/SKILL.md`]: releaseSkillFills(app.name, secret, endpoint),
  };
  return {
    id: "addon-updater",
    packages: {
      app: {
        dependencies: ["@tauri-apps/plugin-process", "@tauri-apps/plugin-updater"],
        scripts: { "updater:keys": "node scripts/updater-keys.ts" },
      },
    },
    json: {
      [conf]: {
        plugins: {
          updater: {
            // `updater:keys` fills it in.
            pubkey: "",
            endpoints: [endpoint],
            // A progress window, no questions; the app closes while it installs.
            windows: { installMode: "passive" },
          },
        },
      },
      [`${app.dir}/src-tauri/tauri.release.conf.json`]: {
        bundle: { createUpdaterArtifacts: true },
      },
      [`${app.dir}/src-tauri/capabilities/default.json`]: {
        permissions: ["updater:default", "process:allow-restart"],
      },
      [`${app.dir}/tsconfig.json`]: { include: ["scripts"] },
    },
    slots,
    agents: [
      {
        region: "rules",
        id: `updater:${app.name}`,
        body: [
          `- **\`apps/${app.name}\` updates itself** from the \`${app.name}-updater\` release, which`,
          `  \`.github/workflows/updater-${app.name}.yml\` points at a release when you publish its draft.`,
          `  Release builds sign updates with the \`${secret}_UPDATER_KEY\` and \`${secret}_UPDATER_KEY_PASSWORD\``,
          `  secrets: \`pnpm --filter ${app.name} updater:keys --secrets\` sets them from the key in`,
          "  `~/.tauri`, which must never be lost or committed. A new key strands every installed copy.",
        ].join("\n"),
      },
    ],
    post: [
      {
        title: `Making ${app.name}'s update signing key`,
        command: "pnpm",
        args: ["--filter", app.name, "updater:keys"],
        needsInstall: true,
      },
    ],
  };
};
