/** Packages more than one layer asks for. Names only: versions come from the snapshot. */

export const REACT = ["react", "react-dom"];
export const REACT_TYPES = ["@types/react", "@types/react-dom"];
export const CHAKRA = ["@chakra-ui/react", "@emotion/react", "next-themes", "react-icons"];

/** Storybook 10 with every story run as a Vitest browser test in headless Chromium. */
export const STORYBOOK = [
  "storybook",
  "@storybook/addon-a11y",
  "@storybook/addon-docs",
  "@storybook/addon-mcp",
  "@storybook/addon-themes",
  "@storybook/addon-vitest",
  "@storybook/react-vite",
  "@vitest/browser-playwright",
  "playwright",
  "vitest",
];

export const VITE_REACT = [
  "vite",
  "@vitejs/plugin-react",
  "@rolldown/plugin-babel",
  "babel-plugin-react-compiler",
];

export const TYPESCRIPT = ["typescript", "@types/node"];

export function storybookScripts(port: number) {
  return {
    storybook: `storybook dev -p ${port}`,
    "ci-storybook": `storybook dev -p ${port} --quiet --ci`,
    "build-storybook": "storybook build",
  };
}
