import { basePreview, resetUi } from "@stacks/ui/storybook";
import type { Preview } from "@storybook/react-vite";

const preview: Preview = {
  ...basePreview,
  beforeEach: () => {
    resetUi();
  },
};

export default preview;
