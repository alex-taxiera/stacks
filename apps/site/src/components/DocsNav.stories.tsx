import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import { DocList, DocPager, DocsNav } from "./DocsNav";

const DOCS = [
  { href: "/docs/getting-started/", title: "Getting started", description: "Make a repo." },
  { href: "/docs/stacks/", title: "Stacks", description: "What each one makes." },
  { href: "/docs/add-ons/", title: "Add-ons", description: "What each one adds." },
];

const meta = {
  component: DocsNav,
  args: { docs: DOCS, currentHref: "/docs/stacks/" },
} satisfies Meta<typeof DocsNav>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Sidebar: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("navigation", { name: "Docs" })).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Stacks" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(canvas.getByRole("link", { name: "Add-ons" })).not.toHaveAttribute("aria-current");
  },
};

export const Index: Story = {
  render: () => <DocList docs={DOCS} />,
  play: async ({ canvas }) => {
    const links = canvas.getAllByRole("link");
    await expect(links.map((link) => link.textContent)).toEqual([
      "Getting started",
      "Stacks",
      "Add-ons",
    ]);
  },
};

export const Pager: Story = {
  render: () => <DocPager previous={DOCS[0]} next={DOCS[2]} />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("link", { name: "Getting started" })).toHaveAttribute(
      "href",
      "/docs/getting-started/",
    );
    await expect(canvas.getByRole("link", { name: "Add-ons" })).toBeVisible();
  },
};

export const FirstPage: Story = {
  render: () => <DocPager next={DOCS[1]} />,
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole("link")).toHaveLength(1);
  },
};
