import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import { AppHeader } from "./AppHeader";

const meta = {
  component: AppHeader,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AppHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { level: 1 })).toHaveTextContent("__APP_TITLE__");
    await expect(canvas.getByRole("button", { name: "Toggle color mode" })).toBeVisible();
  },
};
