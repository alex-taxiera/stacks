import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { parse, stringify } from "yaml";

/**
 * The target directory as layers see it: reads fall through to disk, writes stay in memory until
 * `flush`, so a scaffold that fails halfway writes nothing.
 */
export class Overlay {
  readonly root: string;
  readonly #changes = new Map<string, string | Buffer>();
  /** Paths a template created in this run, as opposed to ones that were on disk already. */
  readonly #created = new Set<string>();

  constructor(root: string) {
    this.root = root;
  }

  #abs(file: string) {
    return path.join(this.root, file);
  }

  exists(file: string): boolean {
    return this.#changes.has(file) || existsSync(this.#abs(file));
  }

  /** Whether `file` was on disk before this run. */
  existedBefore(file: string): boolean {
    return existsSync(this.#abs(file));
  }

  read(file: string): string | undefined {
    const change = this.#changes.get(file);
    if (change !== undefined) return change.toString();
    return existsSync(this.#abs(file)) ? readFileSync(this.#abs(file), "utf8") : undefined;
  }

  /** Writes a template's file, which may not replace one on disk or one another template wrote. */
  create(file: string, content: string | Buffer, source: string) {
    if (this.#created.has(file))
      throw new Error(`${file}: written by two templates (the second is ${source})`);
    if (this.existedBefore(file))
      throw new Error(`${file} already exists; ${source} would replace it`);
    this.#created.add(file);
    this.#changes.set(file, content);
  }

  write(file: string, content: string) {
    this.#changes.set(file, content);
  }

  readJson<T>(file: string): T | undefined {
    const text = this.read(file);
    return text === undefined ? undefined : (JSON.parse(text) as T);
  }

  writeJson(file: string, value: unknown) {
    this.write(file, `${JSON.stringify(value, null, 2)}\n`);
  }

  readYaml<T>(file: string): T | undefined {
    const text = this.read(file);
    return text === undefined ? undefined : (parse(text) as T);
  }

  writeYaml(file: string, value: unknown) {
    this.write(file, stringify(value, { lineWidth: 0 }));
  }

  /** Every path this run changes, sorted. */
  get changed(): string[] {
    return [...this.#changes.keys()].toSorted();
  }

  async flush() {
    for (const [file, content] of this.#changes) {
      const target = this.#abs(file);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, content);
    }
  }
}
