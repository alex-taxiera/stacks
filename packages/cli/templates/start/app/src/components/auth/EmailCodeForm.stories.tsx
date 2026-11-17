import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, fn, waitFor } from "storybook/test";

import { EmailCodeForm } from "./EmailCodeForm";

const meta = {
  component: EmailCodeForm,
  args: {
    verifyLabel: "Sign in",
    onSendCode: fn(async () => {}),
    onVerify: fn(async () => {}),
  },
} satisfies Meta<typeof EmailCodeForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EnterEmail: Story = {};

/** The whole way through: the email, then the code, which submits itself once it's complete. */
export const SignInWithCode: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.type(canvas.getByRole("textbox", { name: "Email" }), "ada@example.com");
    await userEvent.click(canvas.getByRole("button", { name: "Email me a code" }));
    await expect(args.onSendCode).toHaveBeenCalledWith("ada@example.com");
    await expect(await canvas.findByText(/We sent a 6-digit code/)).toBeVisible();
    await userEvent.type(canvas.getByRole("textbox", { name: "Code" }), "123456");
    await waitFor(() => expect(args.onVerify).toHaveBeenCalledWith("ada@example.com", "123456"));
  },
};

export const WrongCode: Story = {
  args: {
    defaultEmail: "ada@example.com",
    onVerify: fn(async () => {
      throw new Error("Invalid code");
    }),
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Email me a code" }));
    await userEvent.type(await canvas.findByRole("textbox", { name: "Code" }), "000000");
    await expect(await canvas.findByText("Invalid code")).toBeVisible();
    await expect(canvas.getByRole("button", { name: /Resend in/ })).toBeDisabled();
  },
};
