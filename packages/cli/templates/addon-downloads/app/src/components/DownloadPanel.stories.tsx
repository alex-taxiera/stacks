import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import { release } from "#/downloads/__fixtures__/release";

import { DownloadPanel } from "./DownloadPanel";

const meta = {
  component: DownloadPanel,
  args: { state: { status: "ready", release }, os: "windows", arch: "x64" },
} satisfies Meta<typeof DownloadPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A Windows visitor is offered the installer, with the MSI under it. */
export const Windows: Story = {
  play: async ({ canvas }) => {
    const download = canvas.getByRole("link", { name: /Download for Windows/ });
    await expect(download).toHaveAttribute(
      "href",
      expect.stringMatching(/App_0\.2\.0_x64-setup\.exe$/),
    );
    await expect(canvas.getByText("Version 0.2.0, released November 1, 2026.")).toBeVisible();
    await expect(canvas.getByRole("link", { name: "MSI package, 64-bit" })).toBeVisible();
    // The updater's files never show; a file no rule knows does, under "Other files".
    await expect(canvas.queryByText("latest.json")).toBeNull();
    await expect(canvas.getByRole("link", { name: "checksums.txt" })).toBeVisible();
  },
};

/** A Mac visitor's tab opens first. */
export const Mac: Story = {
  args: { os: "macos", arch: null },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("tab", { name: "macOS" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(canvas.getByText("Disk image · Apple silicon and Intel · 9.3 MB")).toBeVisible();
  },
};

/** Another system's tab can be picked. */
export const PicksLinux: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("tab", { name: "Linux" }));
    await expect(canvas.getByRole("link", { name: /Download for Linux/ })).toBeVisible();
    await expect(canvas.getByText("Running the AppImage")).toBeVisible();
  },
};

export const Loading: Story = {
  args: { state: { status: "loading" } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/Finding the latest release/)).toBeVisible();
  },
};

/** GitHub couldn't be reached: the releases page is the way out. */
export const Failed: Story = {
  args: { state: { status: "error", message: "GitHub answered 503." } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Couldn't load the latest release from GitHub")).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Go to the releases" })).toBeVisible();
  },
};
