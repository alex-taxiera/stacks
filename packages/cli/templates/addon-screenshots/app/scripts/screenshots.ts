// Takes __APP_TITLE__'s screenshots (docs/screenshots/__APP_NAME__) from its own Storybook: every
// story tagged "screenshot", in light and dark, at the window's default size and 150%, as on a
// Windows laptop. Storybook already stands in for Rust and every `@tauri-apps/*` module
// (.storybook/preview.tsx), so a scene is a story: its `beforeEach` sets the data, its `play`
// gets the app into the state to show.
//
//   pnpm --filter __APP_NAME__ screenshots               build Storybook, then shoot every scene
//   pnpm --filter __APP_NAME__ screenshots app-default   only the scenes named
//   pnpm --filter __APP_NAME__ screenshots --no-build    reuse storybook-static as it is

import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import { chromium } from "playwright";
import { preview } from "vite";

const app = path.resolve(import.meta.dirname, "..");
const output = path.resolve(app, "../../docs/screenshots/__APP_NAME__");
const built = path.join(app, "storybook-static");

/** The window's default size, as `src-tauri/tauri.conf.json` opens it. */
const WINDOW = { width: 1100, height: 720 };
const SCHEMES = ["light", "dark"] as const;
/** Long enough for toasts, tooltips and dialogs to finish animating in. */
const SETTLE_MS = 600;

const { values, positionals: names } = parseArgs({
  options: { "no-build": { type: "boolean" } },
  allowPositionals: true,
});

if (!values["no-build"]) {
  const command = "pnpm exec storybook build --quiet";
  // Windows needs the shell for pnpm.cmd, and the shell one command line.
  const build =
    process.platform === "win32"
      ? spawnSync(command, { cwd: app, stdio: "inherit", shell: true })
      : spawnSync("pnpm", command.split(" ").slice(1), { cwd: app, stdio: "inherit" });
  if (build.status !== 0) process.exit(build.status ?? 1);
}

/** A story or docs page in Storybook's `index.json`. */
interface IndexEntry {
  id: string;
  type: "story" | "docs";
  tags?: string[];
}

/** A scene's file name: `app--default` becomes `app-default`. */
const sceneName = (id: string) => id.replace("--", "-");

const index: { entries: Record<string, IndexEntry> } = JSON.parse(
  readFileSync(path.join(built, "index.json"), "utf8"),
);
const tagged = Object.values(index.entries).filter(
  (entry) => entry.type === "story" && entry.tags?.includes("screenshot"),
);
if (tagged.length === 0) throw new Error('No story is tagged "screenshot"');
const unknown = names.filter((name) => !tagged.some((entry) => sceneName(entry.id) === name));
if (unknown.length > 0) {
  const known = tagged.map((entry) => sceneName(entry.id)).join(", ");
  throw new Error(`No scene ${unknown.join(", ")}; there are ${known}`);
}
const scenes = tagged.filter((entry) => names.length === 0 || names.includes(sceneName(entry.id)));

const server = await preview({
  configFile: false,
  root: app,
  logLevel: "warn",
  build: { outDir: built },
  preview: { port: 6400, strictPort: false },
});
const url = server.resolvedUrls?.local[0];
if (!url) throw new Error("The preview server didn't say where it's listening");

mkdirSync(output, { recursive: true });
const browser = await chromium.launch();
try {
  for (const scene of scenes) {
    for (const scheme of SCHEMES) {
      const page = await browser.newPage({
        viewport: WINDOW,
        deviceScaleFactor: 1.5,
        colorScheme: scheme,
      });
      page.on("pageerror", (error) => console.error(`${scene.id}: ${error.message}`));
      // Storybook says on its channel when the story has rendered and its play function has run,
      // or that it failed. Listen from the start, before the story can finish.
      await page.addInitScript(() => {
        const FAILURES = ["storyErrored", "storyThrewException", "playFunctionThrewException"];
        const listen = () => {
          const channel = Reflect.get(window, "__STORYBOOK_ADDONS_CHANNEL__");
          if (!channel) {
            setTimeout(listen, 5);
            return;
          }
          channel.on("storyRendered", () => Reflect.set(window, "__sceneState", "ready"));
          for (const event of FAILURES)
            channel.on(event, (error: unknown) =>
              Reflect.set(window, "__sceneState", `${event}: ${JSON.stringify(error)}`),
            );
        };
        listen();
      });
      const params = new URLSearchParams({
        id: scene.id,
        viewMode: "story",
        globals: `theme:${scheme}`,
      });
      await page.goto(`${url}iframe.html?${params}`);
      const state = await page.waitForFunction(() => Reflect.get(window, "__sceneState"));
      const outcome = await state.jsonValue();
      if (outcome !== "ready") throw new Error(`${scene.id} failed: ${String(outcome)}`);
      // Out of the way, so nothing shows as hovered unless the story hovers it.
      await page.mouse.move(0, WINDOW.height - 1);
      await page.waitForTimeout(SETTLE_MS);
      const file = path.join(output, `${sceneName(scene.id)}-${scheme}.png`);
      await page.screenshot({ path: file });
      console.log(path.relative(process.cwd(), file));
      await page.close();
    }
  }
} finally {
  await browser.close();
  await server.close();
}
