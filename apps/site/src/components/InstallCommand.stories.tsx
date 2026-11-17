import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, spyOn, userEvent, waitFor } from "storybook/test";

import { InstallCommand } from "./InstallCommand";

const COMMAND = "pnpm dlx @alex-taxiera/stacks new my-repo";

const meta = {
  component: InstallCommand,
  args: { command: COMMAND },
} satisfies Meta<typeof InstallCommand>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText(COMMAND)).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Copy the command" })).toBeEnabled();
  },
};

export const Copied: Story = {
  // The test browser won't let a page write the clipboard, so this stands in for it.
  beforeEach: () => {
    const writeText = spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    return () => writeText.mockRestore();
  },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Copy the command" }));
    await waitFor(() => expect(canvas.getByRole("button", { name: "Copied" })).toBeVisible());
    await expect(navigator.clipboard.writeText).toHaveBeenCalledWith(COMMAND);
  },
};
