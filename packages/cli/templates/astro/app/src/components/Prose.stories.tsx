import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import { Prose } from "./Prose";

const meta = {
  component: Prose,
  args: {
    children: (
      <>
        <p>
          A paragraph with <a href="#link">a link</a> and some <code>code</code>.
        </p>
        <h2>A heading</h2>
        <ul>
          <li>One</li>
          <li>Two</li>
        </ul>
        <blockquote>A quotation.</blockquote>
      </>
    ),
  },
} satisfies Meta<typeof Prose>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { name: "A heading" })).toBeVisible();
    await expect(canvas.getAllByRole("listitem")).toHaveLength(2);
  },
};
