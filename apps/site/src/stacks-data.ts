/**
 * The stacks, deploy targets and add-ons, read from the CLI's own source as the site is built, so
 * the site always lists what the CLI in this commit offers.
 */
import { STACKS, type StackDefinition } from "../../../packages/cli/src/stacks.ts";

export interface DeployRow {
  id: string;
  summary: string;
  isDefault: boolean;
}

export interface StackRow {
  id: string;
  summary: string;
  /** Where `stacks add` puts it: `apps/<name>` or `packages/<name>`. */
  dir: string;
  deploys: DeployRow[];
  addons: string[];
}

export interface AddonRow {
  id: string;
  summary: string;
  /** The stacks that take it, in the CLI's order. */
  stacks: string[];
  /** The deploy targets it's limited to, if any. */
  deploys: string[];
  /** A stack the repo must already have an app of. */
  needsStack?: string;
}

export function stackRows(stacks: Record<string, StackDefinition> = STACKS): StackRow[] {
  return Object.values(stacks).map((stack) => ({
    id: stack.id,
    summary: stack.summary,
    dir: stack.kind === "app" ? "apps/<name>" : "packages/<name>",
    deploys: Object.entries(stack.deploys).map(([id, deploy]) => ({
      id,
      summary: deploy.summary,
      isDefault: id === stack.defaultDeploy,
    })),
    addons: Object.keys(stack.addons),
  }));
}

/** Every add-on once, with the stacks that offer it. */
export function addonRows(stacks: Record<string, StackDefinition> = STACKS): AddonRow[] {
  const rows = new Map<string, AddonRow>();
  for (const stack of Object.values(stacks)) {
    for (const [id, addon] of Object.entries(stack.addons)) {
      const row = rows.get(id);
      if (row) {
        row.stacks.push(stack.id);
        continue;
      }
      rows.set(id, {
        id,
        summary: addon.summary,
        stacks: [stack.id],
        deploys: addon.deploys ?? [],
        ...(addon.needsStack ? { needsStack: addon.needsStack } : {}),
      });
    }
  }
  return [...rows.values()];
}
