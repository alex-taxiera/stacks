import { dbPort } from "../layers/start.ts";
import type { Ctx } from "../model.ts";

/** One part of a bundle identifier, which may only have letters, digits and hyphens. */
const identifierSegment = (value: string) => value.toLowerCase().replaceAll(/[^a-z0-9-]+/g, "-");

/**
 * Templates stay valid, lintable source: they name the repo, the app and versions with
 * `__UPPER_CASE__` tokens, which are identifiers and strings in any language the templates use.
 */
export function tokensFor(ctx: Ctx): Record<string, string> {
  const tokens: Record<string, string> = {
    REPO_NAME: ctx.repo.name,
    REPO_TITLE: ctx.repo.title,
    SCOPE: ctx.repo.scope,
    GITHUB_REPO: ctx.repo.github,
    ACCENT: ctx.repo.accent,
    NODE_MAJOR: ctx.versions.node,
    PNPM_VERSION: ctx.versions.pnpm,
    TODAY: ctx.today,
  };
  // Only what the context has: a template that names a UI token in a repo without a UI package,
  // or a port for a package without one, fails as an unknown token.
  if (ctx.ui) {
    tokens.UI_PKG = ctx.ui.package;
    tokens.UI_STORYBOOK_PORT = String(ctx.ui.storybookPort);
  }
  if (ctx.app) {
    tokens.APP_NAME = ctx.app.name;
    tokens.APP_TITLE = ctx.app.title;
    tokens.APP_DIR = ctx.app.dir;
    tokens.PACKAGE_NAME = ctx.app.packageName;
    tokens.BIN_NAME = ctx.app.packageName.split("/").at(-1) ?? ctx.app.packageName;
    // A Tauri app's Rust library, and its bundle identifier in reverse-domain form.
    tokens.APP_LIB = `${ctx.app.name.replaceAll("-", "_")}_lib`;
    tokens.APP_IDENTIFIER = [
      "io.github",
      identifierSegment(ctx.repo.github.split("/")[0] ?? "app"),
      identifierSegment(ctx.repo.name),
      identifierSegment(ctx.app.name),
    ].join(".");
    if (ctx.app.devPort !== undefined) {
      tokens.DEV_PORT = String(ctx.app.devPort);
      // The app run in Docker locally, beside the dev server, and its Postgres.
      tokens.DOCKER_PORT = String(ctx.app.devPort + 1);
      tokens.DB_PORT = String(dbPort(ctx.app.devPort));
    }
    if (ctx.app.storybookPort !== undefined) tokens.STORYBOOK_PORT = String(ctx.app.storybookPort);
  }
  return tokens;
}

const TOKEN = /__([A-Z][A-Z0-9_]*[A-Z0-9])__/g;
const ACTION = /__ACTION\[([\w.-]+\/[\w.-]+)\]__/g;
const IMAGE = /__IMAGE\[([\w./-]+)\]__/g;
const CRATE = /__CRATE\[([\w-]+)\]__/g;

export function replaceTokens(text: string, ctx: Ctx, file = "template"): string {
  const tokens = tokensFor(ctx);
  return text
    .replace(ACTION, (_match, repo: string) => {
      const tag = ctx.versions.actions[repo];
      if (!tag) throw new Error(`${file}: no version for the action ${repo} in the snapshot`);
      return tag;
    })
    .replace(IMAGE, (_match, image: string) => {
      const tag = ctx.versions.images?.[image];
      if (!tag) throw new Error(`${file}: no tag for the image ${image} in the snapshot`);
      return `${image}:${tag}`;
    })
    .replace(CRATE, (_match, name: string) => {
      const requirement = ctx.versions.crates?.[name];
      if (!requirement)
        throw new Error(`${file}: no version for the crate ${name} in the snapshot`);
      return requirement;
    })
    .replace(TOKEN, (match, name: string) => tokens[name] ?? match);
}

/** `dot_gitignore` → `.gitignore`, `dot_storybook/` → `.storybook/`, and tokens in names. */
export function templatePath(relative: string, ctx: Ctx): string {
  return relative
    .split(/[\\/]/)
    .map((segment) => (segment.startsWith("dot_") ? `.${segment.slice(4)}` : segment))
    .map((segment) => replaceTokens(segment, ctx, relative))
    .join("/");
}

/** Every GitHub Action a template names, for the version refresh. */
export function actionsIn(text: string): string[] {
  return [...text.matchAll(ACTION)].map((match) => match[1] as string);
}

/** Every Docker image a template names with `__IMAGE[name]__`. */
export function imagesIn(text: string): string[] {
  return [...text.matchAll(IMAGE)].map((match) => match[1] as string);
}

/** Every Rust crate a template names with `__CRATE[name]__`. */
export function cratesIn(text: string): string[] {
  return [...text.matchAll(CRATE)].map((match) => match[1] as string);
}

/** Tokens a rendered file still has: a typo, or one the context doesn't define. */
export function leftoverTokens(text: string): string[] {
  // Not ours: tauri-action fills __VERSION__ in itself.
  const known = new Set(["STORYBOOK", "VERSION"]);
  return [...text.matchAll(TOKEN)]
    .map((match) => match[1] as string)
    .filter((name) => !known.has(name));
}
