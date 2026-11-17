type Json = unknown;

const isObject = (value: Json): value is Record<string, Json> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * `patch` merged into `base`: objects deeply, arrays as a union that keeps `base`'s order, and any
 * other value replaced by `patch`'s.
 */
export function deepMerge(base: Json, patch: Json): Json {
  if (Array.isArray(base) && Array.isArray(patch)) {
    const seen = new Set(base.map((item) => JSON.stringify(item)));
    return [...base, ...patch.filter((item) => !seen.has(JSON.stringify(item)))];
  }
  if (isObject(base) && isObject(patch)) {
    const merged: Record<string, Json> = { ...base };
    for (const [key, value] of Object.entries(patch)) {
      merged[key] = key in base ? deepMerge(base[key], value) : value;
    }
    return merged;
  }
  return patch;
}

/** `object` with its keys sorted, for dependency maps and the catalog. */
export function sortKeys<T>(object: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(object).toSorted(([a], [b]) => a.localeCompare(b)));
}

const markers = (region: string) => ({
  start: `<!-- stacks:${region}:start -->`,
  end: `<!-- stacks:${region}:end -->`,
});
const blockMarkers = (id: string) => ({
  open: `<!-- stacks:block:${id} -->`,
  close: `<!-- /stacks:block:${id} -->`,
});

/**
 * Puts `body` into AGENTS.md's `region`, as the block `id`: replacing the block if it's there,
 * appending it to the region otherwise. Text outside the blocks is the user's and kept as it is.
 */
export function upsertBlock(markdown: string, region: string, id: string, body: string): string {
  const { start, end } = markers(region);
  const startAt = markdown.indexOf(start);
  const endAt = markdown.indexOf(end);
  if (startAt === -1 || endAt === -1 || endAt < startAt) {
    throw new Error(`AGENTS.md has no ${start} … ${end} region`);
  }
  const { open, close } = blockMarkers(id);
  // Blank lines inside the markers, as a Markdown formatter puts them, so formatting doesn't make
  // a repo look out of date to `stacks update --check`.
  const block = `${open}\n\n${body.trim()}\n\n${close}`;
  const inner = markdown.slice(startAt + start.length, endAt);
  const openAt = inner.indexOf(open);
  let nextInner: string;
  if (openAt === -1) {
    nextInner = `${inner.trimEnd()}\n${block}\n`;
  } else {
    const closeAt = inner.indexOf(close, openAt);
    if (closeAt === -1) throw new Error(`AGENTS.md's block ${id} has no closing marker`);
    nextInner = inner.slice(0, openAt) + block + inner.slice(closeAt + close.length);
  }
  if (!nextInner.startsWith("\n")) nextInner = `\n${nextInner}`;
  return markdown.slice(0, startAt + start.length) + nextInner + markdown.slice(endAt);
}

/** `lines` appended to `text`, skipping any it already has. */
export function appendLines(text: string, lines: string[]): string {
  const have = new Set(text.split(/\r?\n/).map((line) => line.trim()));
  const missing = lines.filter((line) => !have.has(line.trim()));
  if (missing.length === 0) return text;
  return `${text.trimEnd()}\n${missing.join("\n")}\n`;
}
