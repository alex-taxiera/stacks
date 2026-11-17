import { basePreview, resetUi } from "__UI_PKG__/storybook";
import type { Preview } from "@storybook/react-vite";

const preview: Preview = {
  ...basePreview,
  beforeEach: () => {
    resetUi();
  },
};

export default preview;
