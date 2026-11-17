/** Everything about where the site lives and what it links to. */

/** The site's address, for canonical links, `<meta>` tags and the sitemap. */
export const SITE_URL = "https://example.com/";

export const APP_NAME = "__APP_TITLE__";

export const DESCRIPTION = "__APP_TITLE__: a short description for search results and link previews.";

/** The header's links, in order. */
export const NAV = [
  { href: "/", label: "Home" },
  { href: "/posts/", label: "Posts" },
  // stacks:slot nav
] as const;
// stacks:slot config
