import { describe, expect, it } from "vitest";

import { formatDate, sortPosts } from "./posts";

const post = (id: string, date: string, draft = false) => ({
  id,
  data: { date: new Date(date), draft },
});

describe("sortPosts", () => {
  it("puts the newest first and leaves drafts out", () => {
    const sorted = sortPosts([
      post("old", "2026-01-01"),
      post("draft", "2026-03-01", true),
      post("new", "2026-02-01"),
    ]);
    expect(sorted.map((p) => p.id)).toEqual(["new", "old"]);
  });
});

describe("formatDate", () => {
  it("reads the date in UTC", () => {
    expect(formatDate(new Date("2026-01-01"))).toBe("January 1, 2026");
  });
});
