import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import { Header } from "./Header";

const meta = {
  component: Header,
  args: { currentPath: "/" },
} satisfies Meta<typeof Header>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Home: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("navigation", { name: "Main" })).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Home" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(canvas.getByRole("link", { name: "Docs" })).not.toHaveAttribute("aria-current");
  },
};

export const InTheDocs: Story = {
  args: { currentPath: "/docs/getting-started/" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("link", { name: "Docs" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  },
};
