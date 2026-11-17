import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import { PostList } from "./PostList";

const meta = {
  component: PostList,
  args: {
    posts: [
      {
        href: "/posts/second/",
        title: "The second post",
        description: "Newest first.",
        date: "February 1, 2026",
      },
      {
        href: "/posts/hello-world/",
        title: "Hello, world",
        description: "The first post.",
        date: "January 1, 2026",
      },
    ],
  },
} satisfies Meta<typeof PostList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    const links = canvas.getAllByRole("link");
    await expect(links.map((link) => link.textContent)).toEqual([
      "The second post",
      "Hello, world",
    ]);
    await expect(links[1]).toHaveAttribute("href", "/posts/hello-world/");
  },
};

export const Empty: Story = {
  args: { posts: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("No posts yet")).toBeVisible();
  },
};
