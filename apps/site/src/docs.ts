/** What the pages need from the docs collection: its order, and each page's neighbours. */

/** The fields `sortDocs` reads. */
export interface Ordered {
  id: string;
  data: { order: number; title: string };
}

export interface DocLink {
  href: string;
  title: string;
}

/** The docs in reading order. */
export function sortDocs<T extends Ordered>(docs: readonly T[]): T[] {
  return docs.toSorted((a, b) => a.data.order - b.data.order);
}

export const docHref = (id: string) => `/docs/${id}/`;

/** The pages before and after `id` in reading order, for the links at a page's foot. */
export function neighbours(
  sorted: readonly Ordered[],
  id: string,
): { previous?: DocLink; next?: DocLink } {
  const index = sorted.findIndex((doc) => doc.id === id);
  const link = (doc: Ordered | undefined) =>
    doc && { href: docHref(doc.id), title: doc.data.title };
  const previous = index > 0 ? link(sorted[index - 1]) : undefined;
  const next = index >= 0 ? link(sorted[index + 1]) : undefined;
  return { ...(previous ? { previous } : {}), ...(next ? { next } : {}) };
}
