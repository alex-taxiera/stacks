import type { Preview } from "@storybook/tanstack-react";
import { basePreview, resetUi } from "__UI_PKG__/storybook";

// The framework renders every story inside a TanStack router, so router links work.
const preview: Preview = {
  ...basePreview,
  beforeEach: () => {
    resetUi();
  },
};

export default preview;
