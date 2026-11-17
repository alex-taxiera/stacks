import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";
import { config } from "__UI_PKG__/theme";
// stacks:slot imports

/**
 * __APP_TITLE__'s own layer over the theme every app shares (`__UI_PKG__/theme`). Like the shared
 * recipes, what goes here only adds to Chakra's own. The provider (`main.tsx`) and Storybook
 * (`.storybook/preview.tsx`) both use this system.
 */
const app = defineConfig({
  theme: {
    // stacks:slot theme
  },
});

export const system = createSystem(defaultConfig, config, app);
