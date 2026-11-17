import type { AppInfo, Ctx, UiInfo } from "../model.ts";

export function requireApp(app: AppInfo | undefined): AppInfo {
  if (!app) throw new Error("an app layer was applied without an app");
  return app;
}

export function requireUi(ctx: Ctx): UiInfo {
  if (!ctx.ui)
    throw new Error(`${ctx.app?.dir ?? "this layer"} needs the UI package, and the repo has none`);
  return ctx.ui;
}

export function requirePorts(app: AppInfo): { devPort: number; storybookPort: number } {
  if (app.devPort === undefined || app.storybookPort === undefined) {
    throw new Error(`${app.dir} has no ports; its stack should give it some`);
  }
  return { devPort: app.devPort, storybookPort: app.storybookPort };
}
