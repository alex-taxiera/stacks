import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import { AddonTable, StackTable } from "./StackTables";

const meta = {
  component: StackTable,
  args: {
    stacks: [
      {
        id: "astro",
        summary: "Site of pages: Astro, Markdown content, and React islands",
        dir: "apps/<name>",
        deploys: [
          { id: "cloudflare", summary: "Cloudflare Workers static assets", isDefault: true },
          { id: "gh-pages", summary: "GitHub Pages", isDefault: false },
        ],
        addons: ["worker", "downloads"],
      },
      {
        id: "cli",
        summary: "Command-line tool published to npm",
        dir: "packages/<name>",
        deploys: [{ id: "npm", summary: "npm, with provenance", isDefault: true }],
        addons: [],
      },
    ],
  },
} satisfies Meta<typeof StackTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Stacks: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole("columnheader")).toHaveLength(4);
    await expect(canvas.getAllByRole("row")).toHaveLength(3);
    await expect(canvas.getAllByText("default")).toHaveLength(2);
  },
};

export const Addons: Story = {
  render: () => (
    <AddonTable
      addons={[
        {
          id: "worker",
          summary: "A Worker in front of the static site",
          stacks: ["spa", "astro"],
          deploys: ["cloudflare"],
        },
        {
          id: "downloads",
          summary: "A download page for the repo's desktop app",
          stacks: ["astro"],
          deploys: [],
          needsStack: "tauri",
        },
        { id: "zustand", summary: "Zustand", stacks: ["spa", "start", "tauri"], deploys: [] },
      ]}
    />
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByText("--deploy cloudflare")).toBeVisible();
    await expect(canvas.getByText(/app in the repo/)).toBeVisible();
  },
};
