// The questions `stacks`, `new` and `add` ask in a terminal. Runs without one (agents, CI, the e2e
// script) never prompt: they take flags and defaults.

import * as p from "@clack/prompts";

import type { AppInfo } from "./model.ts";
import { kebab } from "./scaffold.ts";
import { STACKS, type StackDefinition } from "./stacks.ts";

/** Chakra's palettes, for the accent prompt; `--accent` takes any palette name. */
export const ACCENTS = [
  "gray",
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "blue",
  "cyan",
  "purple",
  "pink",
] as const;

/** Prompts need a terminal at both ends, and `--yes` turns them off. */
export function isInteractive(yes?: boolean): boolean {
  return !yes && Boolean(process.stdin.isTTY) && Boolean(process.stdout.isTTY);
}

let asked = false;
let introduced = false;

/** Whether this run has asked anything, so a summary is worth confirming. */
export const wasAsked = () => asked;

/** Starts clack's frame once, so the `stacks` menu and the command it runs share one. */
export function intro(title: string) {
  if (introduced) return;
  introduced = true;
  p.intro(title);
}

/** A prompt's answer, or a clean exit when it was cancelled. */
export function answer<T>(value: T): Exclude<T, symbol> {
  if (notCancelled(value)) {
    asked = true;
    return value;
  }
  p.cancel("Cancelled.");
  process.exit(1);
}

/** Clack answers a cancelled prompt with a symbol, and only then. */
const notCancelled = <T>(value: T): value is Exclude<T, symbol> => typeof value !== "symbol";

export async function promptStack(message: string): Promise<StackDefinition> {
  const id = answer(
    await p.select({
      message,
      options: Object.values(STACKS).map((stack) => ({
        value: stack.id,
        label: stack.id,
        hint: stack.summary,
      })),
    }),
  );
  return STACKS[id];
}

/** The deploy target; a stack with one target isn't asked. */
export async function promptDeploy(stack: StackDefinition): Promise<string> {
  if (Object.keys(stack.deploys).length < 2) return stack.defaultDeploy;
  return answer(
    await p.select({
      message: "Where does it deploy?",
      initialValue: stack.defaultDeploy,
      options: Object.entries(stack.deploys).map(([id, target]) => ({
        value: id,
        label: id,
        hint: target.summary,
      })),
    }),
  );
}

export interface AddonChoice {
  id: string;
  summary: string;
  /** Why it can't be chosen here, if it can't. */
  unavailable?: string;
}

/** The stack's add-ons, each marked unavailable when the deploy target or the repo rules it out. */
export function addonChoices(
  stack: StackDefinition,
  deploy: string,
  apps: readonly AppInfo[],
): AddonChoice[] {
  return Object.entries(stack.addons).map(([id, addon]) => {
    let unavailable: string | undefined;
    if (addon.deploys && !addon.deploys.includes(deploy))
      unavailable = `needs --deploy ${addon.deploys.join(" or ")}`;
    else if (addon.needsStack && !apps.some((app) => app.stack === addon.needsStack))
      unavailable = `needs a ${addon.needsStack} app first`;
    return { id, summary: addon.summary, ...(unavailable ? { unavailable } : {}) };
  });
}

/** A multiselect of add-ons; those that can't apply are shown, greyed out, with the reason. */
export async function promptAddons(
  stack: StackDefinition,
  deploy: string,
  apps: readonly AppInfo[],
): Promise<string[]> {
  const choices = addonChoices(stack, deploy, apps);
  if (!choices.some((choice) => !choice.unavailable)) return [];
  return answer(
    await p.multiselect({
      message: "Add-ons",
      required: false,
      options: choices.map((choice) => ({
        value: choice.id,
        label: choice.id,
        hint: choice.unavailable ?? choice.summary,
        disabled: Boolean(choice.unavailable),
      })),
    }),
  );
}

export async function promptText(options: {
  message: string;
  initialValue?: string;
  placeholder?: string;
  validate?: (value: string) => string | undefined;
}): Promise<string> {
  const { validate } = options;
  const value = answer(
    await p.text({
      message: options.message,
      initialValue: options.initialValue,
      placeholder: options.placeholder,
      validate: validate ? (input) => validate((input ?? "").trim()) : undefined,
    }),
  );
  return value.trim();
}

export async function promptConfirm(message: string, initialValue = true): Promise<boolean> {
  return answer(await p.confirm({ message, initialValue }));
}

/** Shows what's about to happen and the command that does it without prompts; false to stop. */
export async function confirmPlan(summary: [string, string][], command: string): Promise<boolean> {
  const width = Math.max(...summary.map(([label]) => label.length));
  p.note(
    [
      ...summary.map(([label, value]) => `${label.padEnd(width)}  ${value}`),
      "",
      "Without prompts:",
      command,
    ].join("\n"),
    "Plan",
  );
  return promptConfirm("Go ahead?");
}

/**
 * Why `name` can't be the new app's folder, if it can't: it must kebab to something, and not
 * collide with `packages/ui` or a folder in `taken` (`apps/<name>` or `packages/<name>`).
 */
export function appNameProblem(
  name: string,
  stack?: StackDefinition,
  taken: (dir: string) => boolean = () => false,
): string | undefined {
  const folder = kebab(name);
  if (!folder) return `Can't make a folder name from "${name}".`;
  const dir = `${stack?.kind === "package" ? "packages" : "apps"}/${folder}`;
  if (dir === "packages/ui") return "packages/ui is the UI package's.";
  if (taken(dir)) return `${dir} already exists.`;
  return undefined;
}

/** npm's rules for a package name, scoped or not. */
export const isPackageName = (value: string) =>
  /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(value);

export const isGithubRepo = (value: string) => /^[\w.-]+\/[\w.-]+$/.test(value);

/** Quotes a word for a shell when it needs it. */
function shellWord(value: string): string {
  return /^[\w@%+=:,./-]+$/.test(value) ? value : `"${value.replace(/(["\\$`])/g, "\\$1")}"`;
}

export type FlagValue = string | boolean | readonly string[] | undefined;

/**
 * The command line that does the same without prompts: `words` as they are, then each flag that
 * has a value. `true` is `--flag`, `false` is `--no-flag`, a list is comma-joined, and `undefined`
 * or an empty list is left out.
 */
export function equivalentCommand(words: string[], flags: Record<string, FlagValue>): string {
  const parts = words.map(shellWord);
  for (const [name, value] of Object.entries(flags)) {
    if (value === undefined) continue;
    if (typeof value === "boolean") parts.push(value ? `--${name}` : `--no-${name}`);
    else if (typeof value === "string") parts.push(`--${name}`, shellWord(value));
    else if (value.length > 0) parts.push(`--${name}`, shellWord(value.join(",")));
  }
  return parts.join(" ");
}
