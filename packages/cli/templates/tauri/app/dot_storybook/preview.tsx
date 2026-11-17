import { basePreview, resetUi } from "__UI_PKG__/storybook";
import type { Preview } from "@storybook/react-vite";
import { mocked, sb } from "storybook/test";

import { api } from "../src/api.ts";

// Storybook has no Tauri backend, so every module that reaches it is mocked. Each export becomes
// a spy; the defaults below answer as the Rust side would, and a story overrides them with
// `mocked(api.x)` in its `beforeEach`.
sb.mock(import("../src/api.ts"));
sb.mock(import("@tauri-apps/api/core"));
sb.mock(import("@tauri-apps/plugin-opener"));

const preview: Preview = {
  ...basePreview,
  beforeEach: () => {
    mocked(api.greet).mockImplementation(async (name) => ({
      message: `Hello, ${name.trim() || "world"}!`,
    }));
    mocked(api.openInBrowser).mockResolvedValue();
    resetUi();
  },
};

export default preview;
