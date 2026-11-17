import type { Ctx } from "../model.ts";

/**
 * Templates stay valid, lintable source: they name the repo, the app and versions with
 * `__UPPER_CASE__` tokens, which are identifiers and strings in any language the templates use.
 */
export function tokensFor(ctx: Ctx): Record<string, string> {
  const tokens: Record<string, string> = {
    REPO_NAME: ctx.repo.name,
    REPO_TITLE: ctx.repo.title,
    SCOPE: ctx.repo.scope,
    UI_PKG: ctx.repo.uiPackage,
    UI_STORYBOOK_PORT: String(ctx.ui.storybookPort),
    ACCENT: ctx.repo.accent,
    NODE_MAJOR: ctx.versions.node,
    PNPM_VERSION: ctx.versions.pnpm,
    TODAY: ctx.today,
  };
  if (ctx.app) {
    Object.assign(tokens, {
      APP_NAME: ctx.app.name,
      APP_TITLE: ctx.app.title,
      APP_DIR: `apps/${ctx.app.name}`,
      DEV_PORT: String(ctx.app.devPort),
      STORYBOOK_PORT: String(ctx.app.storybookPort),
    });
  }
  return tokens;
}

const TOKEN = /__([A-Z][A-Z0-9_]*[A-Z0-9])__/g;
const ACTION = /__ACTION\[([\w.-]+\/[\w.-]+)\]__/g;

export function replaceTokens(text: string, ctx: Ctx, file = "template"): string {
  const tokens = tokensFor(ctx);
  return text
    .replace(ACTION, (_match, repo: string) => {
      const tag = ctx.versions.actions[repo];
      if (!tag) throw new Error(`${file}: no version for the action ${repo} in the snapshot`);
      return tag;
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

/** Tokens a rendered file still has: a typo, or one the context doesn't define. */
export function leftoverTokens(text: string): string[] {
  const known = new Set(["STORYBOOK"]);
  return [...text.matchAll(TOKEN)]
    .map((match) => match[1] as string)
    .filter((name) => !known.has(name));
}
