import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, fn } from "storybook/test";

import { Header } from "./Header";

const meta = {
  component: Header,
  args: { viewer: { user: null }, onSignOut: fn(async () => {}) },
} satisfies Meta<typeof Header>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SignedOut: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("navigation", { name: "Main" })).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Sign in" })).toBeVisible();
  },
};

export const SignedIn: Story = {
  args: { viewer: { user: { id: "1", name: "Ada Lovelace", email: "ada@example.com" } } },
  play: async ({ args, canvas, userEvent }) => {
    await expect(canvas.getByRole("link", { name: "Ada Lovelace" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Sign out" }));
    await expect(args.onSignOut).toHaveBeenCalled();
  },
};
