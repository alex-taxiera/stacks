/** Everything about where the site lives and what it links to. */

/** The site's address, for canonical links, `<meta>` tags and the sitemap. */
export const SITE_URL = "https://stacks.taxiera.net/";

export const APP_NAME = "stacks";

export const DESCRIPTION =
  "Scaffold pnpm workspaces of Chakra UI apps and npm CLIs, with the tooling, agent setup and known-good versions already in place.";

/** The npm package, and the command that starts a repo with it. */
export const PACKAGE = "@alex-taxiera/stacks";
export const NEW_COMMAND = `pnpm dlx ${PACKAGE} new my-repo`;

export const GITHUB_URL = "https://github.com/alex-taxiera/stacks";
export const NPM_URL = `https://www.npmjs.com/package/${PACKAGE}`;

/** The header's links, in order. */
export const NAV = [
  { href: "/", label: "Home" },
  { href: "/docs/", label: "Docs" },
  { href: GITHUB_URL, label: "GitHub" },
] as const;
