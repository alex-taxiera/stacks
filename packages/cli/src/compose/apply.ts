import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import semver from "semver";
import { isMap, isScalar, isSeq, parseDocument, type Document, YAMLMap, YAMLSeq } from "yaml";

import type { Ctx, LayerSpec, Layer, PackageContribution, PostStep, Target } from "../model.ts";
import { TEMPLATES_DIR } from "../paths.ts";
import { appendLines, deepMerge, sortKeys, upsertBlock } from "./merge.ts";
import type { Overlay } from "./overlay.ts";
import { replaceTokens, templatePath } from "./tokens.ts";

const BINARY = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".icns",
  ".woff",
  ".woff2",
]);

export function targetDir(target: Target, ctx: Ctx): string {
  if (target === "root") return "";
  if (target === "ui") return "packages/ui";
  if (!ctx.app) throw new Error("an app template was applied without an app");
  return ctx.app.dir;
}

async function* walk(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

async function copyTemplates(overlay: Overlay, ctx: Ctx, spec: LayerSpec) {
  if (spec.templates === false) return;
  const base = path.join(TEMPLATES_DIR, spec.templates ?? spec.id);
  for (const target of ["root", "ui", "app"] as const) {
    const source = path.join(base, target);
    if (!existsSync(source)) continue;
    const dest = targetDir(target, ctx);
    for await (const file of walk(source)) {
      const relative = path.relative(source, file);
      const out = path.posix.join(dest, templatePath(relative, ctx));
      const label = `templates/${spec.templates ?? spec.id}/${target}/${relative.replaceAll("\\", "/")}`;
      const content = BINARY.has(path.extname(file).toLowerCase())
        ? await readFile(file)
        : replaceTokens(await readFile(file, "utf8"), ctx, label);
      overlay.create(out, content, label);
    }
  }
}

interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  [key: string]: unknown;
}

function basePackage(target: Target, ctx: Ctx): PackageJson {
  if (target === "root") return { name: ctx.repo.name, private: true, type: "module" };
  if (target === "ui") {
    if (!ctx.ui) throw new Error("a UI package file was written before the UI package exists");
    return { name: ctx.ui.package, version: "0.0.0", private: true, type: "module" };
  }
  if (!ctx.app) throw new Error("an app package was written without an app");
  // A package that's published can't be private; it says so in its own fields.
  const isPackage = ctx.app.kind === "package";
  return {
    name: ctx.app.packageName,
    version: "0.0.0",
    ...(isPackage ? {} : { private: true }),
    type: "module",
  };
}

/** The order npm's docs and most packages list `package.json`'s keys in; the rest follow. */
const KEY_ORDER = [
  "name",
  "version",
  "private",
  "description",
  "license",
  "type",
  "bin",
  "exports",
  "imports",
  "files",
  "keywords",
  "repository",
  "scripts",
  "dependencies",
  "devDependencies",
  "peerDependencies",
];

function rank(key: string): number {
  const index = KEY_ORDER.indexOf(key);
  return index === -1 ? KEY_ORDER.length : index;
}

function ordered(pkg: PackageJson): PackageJson {
  return Object.fromEntries(Object.entries(pkg).toSorted(([a], [b]) => rank(a) - rank(b)));
}

/** Writes each package's `package.json`; returns every dependency name that needs a catalog entry. */
function writePackages(
  overlay: Overlay,
  ctx: Ctx,
  contributions: Map<Target, PackageContribution[]>,
) {
  const catalogNames = new Set<string>();
  for (const [target, parts] of contributions) {
    const file = path.posix.join(targetDir(target, ctx), "package.json");
    const current = overlay.readJson<PackageJson>(file) ?? basePackage(target, ctx);
    const deps: Record<
      "dependencies" | "devDependencies" | "peerDependencies",
      Record<string, string>
    > = {
      dependencies: { ...current.dependencies },
      devDependencies: { ...current.devDependencies },
      peerDependencies: { ...current.peerDependencies },
    };
    let scripts: Record<string, string> = {};
    let fields: Record<string, unknown> = {};
    for (const part of parts) {
      for (const name of part.workspaceDependencies ?? []) deps.dependencies[name] = "workspace:*";
      for (const name of part.workspaceDevDependencies ?? [])
        deps.devDependencies[name] = "workspace:*";
      for (const kind of ["dependencies", "devDependencies", "peerDependencies"] as const) {
        for (const name of part[kind] ?? []) {
          deps[kind][name] ??= "catalog:";
          catalogNames.add(name);
        }
      }
      scripts = { ...scripts, ...part.scripts };
      fields = deepMerge(fields, part.fields ?? {}) as Record<string, unknown>;
    }
    // A runtime dependency needn't be a dev dependency too.
    for (const name of Object.keys(deps.dependencies)) delete deps.devDependencies[name];

    const { dependencies: _d, devDependencies: _dd, peerDependencies: _pd, ...rest } = current;
    const merged = deepMerge(rest, { ...fields, scripts }) as PackageJson;
    for (const kind of ["dependencies", "devDependencies", "peerDependencies"] as const) {
      if (Object.keys(deps[kind]).length > 0) merged[kind] = sortKeys(deps[kind]);
    }
    // A package this run creates gets the usual key order; one that exists keeps its own.
    overlay.writeJson(file, overlay.existedBefore(file) ? merged : ordered(merged));
  }
  return catalogNames;
}

/** `patch` merged into a YAML document, keeping its comments: objects deeply, arrays as a union. */
function mergeIntoDocument(doc: Document, keys: string[], patch: unknown) {
  if (typeof patch === "object" && patch !== null && !Array.isArray(patch)) {
    if (keys.length > 0 && !isMap(doc.getIn(keys))) doc.setIn(keys, new YAMLMap());
    for (const [key, value] of Object.entries(patch)) mergeIntoDocument(doc, [...keys, key], value);
    return;
  }
  if (Array.isArray(patch)) {
    const existing = doc.getIn(keys);
    if (!isSeq(existing)) {
      doc.setIn(keys, doc.createNode(patch));
      return;
    }
    const have = new Set(
      existing.items.map((item) => JSON.stringify(isScalar(item) ? item.value : item)),
    );
    for (const item of patch)
      if (!have.has(JSON.stringify(item))) (existing as YAMLSeq).add(doc.createNode(item));
    return;
  }
  doc.setIn(keys, patch);
}

const keyOf = (key: unknown) => String(isScalar(key) ? key.value : key);

function sortMap(map: unknown) {
  if (!isMap(map)) return;
  map.items.sort((a, b) => keyOf(a.key).localeCompare(keyOf(b.key)));
}

/**
 * Adds a catalog entry for every name that lacks one. An entry the repo already has is kept, so
 * `add` never upgrades an existing app behind its back; a warning says when it's a major behind.
 */
function writeCatalog(overlay: Overlay, ctx: Ctx, names: Set<string>, warnings: string[]) {
  const file = "pnpm-workspace.yaml";
  const doc = parseDocument(overlay.read(file) ?? "");
  if (!isMap(doc.getIn(["catalog"]))) {
    const catalog = new YAMLMap();
    catalog.commentBefore =
      ' One version of each shared dependency for every package. A package asks for one with\n "react": "catalog:". stacks fills these from its known-good snapshot.';
    doc.setIn(["catalog"], catalog);
  }
  for (const name of [...names].toSorted()) {
    const version = ctx.versions.npm[name];
    if (!version) {
      throw new Error(
        `The version snapshot has no ${name}; run \`stacks versions refresh --write\``,
      );
    }
    const existing = doc.getIn(["catalog", name]);
    if (existing === undefined) {
      doc.setIn(["catalog", name], `^${version}`);
      continue;
    }
    const range = String(isScalar(existing) ? existing.value : existing);
    const floor = semver.minVersion(range);
    if (floor && semver.major(version) > semver.major(floor)) {
      warnings.push(`${name}: the catalog has ${range}; the known-good version is ${version}`);
    }
  }
  sortMap(doc.getIn(["catalog"]));
  overlay.write(file, doc.toString({ lineWidth: 0 }));
}

export interface ApplyResult {
  post: PostStep[];
  warnings: string[];
}

/** Applies `layers` to the overlay: templates, packages, the catalog, then the merged files. */
export async function applyLayers(
  overlay: Overlay,
  ctx: Ctx,
  layers: Layer[],
): Promise<ApplyResult> {
  const specs = layers.map((layer) => layer(ctx));
  const contributions = new Map<Target, PackageContribution[]>();
  const post: PostStep[] = [];
  const warnings: string[] = [];

  for (const spec of specs) {
    await copyTemplates(overlay, ctx, spec);
    for (const [target, part] of Object.entries(spec.packages ?? {}) as [
      Target,
      PackageContribution,
    ][]) {
      contributions.set(target, [...(contributions.get(target) ?? []), part]);
    }
    post.push(...(spec.post ?? []));
  }

  for (const spec of specs) {
    for (const [file, patch] of Object.entries(spec.yaml ?? {})) {
      const doc = parseDocument(overlay.read(file) ?? "");
      mergeIntoDocument(doc, [], patch);
      // Patches name actions and images the way templates do.
      overlay.write(file, replaceTokens(doc.toString({ lineWidth: 0 }), ctx, file));
    }
  }

  const catalogNames = writePackages(overlay, ctx, contributions);
  if (catalogNames.size > 0) writeCatalog(overlay, ctx, catalogNames, warnings);

  for (const spec of specs) {
    const json = { ...spec.json };
    if (spec.mcp)
      json[".agents/mcp.json"] = deepMerge(json[".agents/mcp.json"] ?? {}, {
        mcpServers: spec.mcp,
      });
    for (const [file, patch] of Object.entries(json)) {
      overlay.writeJson(file, deepMerge(overlay.readJson(file) ?? {}, patch));
    }
    for (const [file, lines] of Object.entries(spec.lines ?? {})) {
      overlay.write(file, appendLines(overlay.read(file) ?? "", lines));
    }
    if (spec.agents?.length) {
      let markdown = overlay.read("AGENTS.md");
      if (markdown === undefined) throw new Error("AGENTS.md is missing; is this a stacks repo?");
      for (const block of spec.agents)
        markdown = upsertBlock(markdown, block.region, block.id, block.body);
      overlay.write("AGENTS.md", markdown);
    }
  }

  fillSlots(overlay, specs);
  return { post, warnings };
}

const SLOT = /^([ \t]*)(?:\/\/|#) stacks:slot ([\w-]+)[ \t]*$/;

/**
 * Replaces each slot in the files this run wrote with the lines layers gave it, or removes it.
 * A layer that fills a slot no file has fails, so a renamed slot can't drop code silently.
 */
export function fillSlots(overlay: Overlay, specs: LayerSpec[]) {
  const fills = new Map<string, Map<string, string[]>>();
  for (const spec of specs) {
    for (const [file, slots] of Object.entries(spec.slots ?? {})) {
      const byName = fills.get(file) ?? new Map<string, string[]>();
      for (const [name, lines] of Object.entries(slots))
        byName.set(name, [...(byName.get(name) ?? []), ...lines]);
      fills.set(file, byName);
    }
  }
  const used = new Set<string>();
  for (const file of overlay.changed) {
    if (BINARY.has(path.extname(file).toLowerCase())) continue;
    const text = overlay.read(file);
    if (!text?.includes("stacks:slot")) continue;
    const filled = text.split("\n").flatMap((line) => {
      const match = SLOT.exec(line.replace(/\r$/, ""));
      if (!match) return [line];
      const [, indent = "", name = ""] = match;
      used.add(`${file}#${name}`);
      // The marker's line goes; the lines filling it, if any, take its place and indentation.
      return (fills.get(file)?.get(name) ?? []).map((fill) => (fill ? indent + fill : fill));
    });
    overlay.write(file, filled.join("\n"));
  }
  for (const [file, byName] of fills) {
    for (const name of byName.keys()) {
      if (!used.has(`${file}#${name}`)) throw new Error(`${file} has no slot "${name}" to fill`);
    }
  }
}
