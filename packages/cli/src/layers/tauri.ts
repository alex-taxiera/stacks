import type { Layer } from "../model.ts";
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
        dependencies: [...CHAKRA, ...REACT, "@tauri-apps/api", "@tauri-apps/plugin-opener"],
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
