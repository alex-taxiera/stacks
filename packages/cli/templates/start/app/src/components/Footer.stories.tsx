import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect } from "storybook/test";

import { Footer } from "./Footer";

const meta = {
  component: Footer,
} satisfies Meta<typeof Footer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("contentinfo")).toBeVisible();
  },
};
