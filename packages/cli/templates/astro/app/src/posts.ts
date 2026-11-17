/** What the pages need from the posts collection, newest first and drafts left out. */

/** The fields `sortPosts` reads. */
export interface Dated {
  data: { date: Date; draft: boolean };
}

/** Published posts, newest first. */
export function sortPosts<T extends Dated>(posts: readonly T[]): T[] {
  return posts
    .filter((post) => !post.data.draft)
    .toSorted((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

/** A post's date as people read it, in UTC so the build machine's zone doesn't move it. */
export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
