import { Button, Stack, Text } from "@chakra-ui/react";
import { createFileRoute } from "@tanstack/react-router";
import { toaster } from "__UI_PKG__/toaster";
import { useState } from "react";
import { z } from "zod";

import { AuthCard } from "#/components/auth/AuthCard";
import { authClient } from "#/lib/auth-client";
import { APP_NAME } from "#/site-config";

export const Route = createFileRoute("/verify-email")({
  validateSearch: z.object({ email: z.string().optional() }),
  head: () => ({ meta: [{ title: `Check your email · ${APP_NAME}` }] }),
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const { email } = Route.useSearch();
  const [pending, setPending] = useState(false);

  async function resend() {
    if (!email) return;
    setPending(true);
    const { error } = await authClient.sendVerificationEmail({ email, callbackURL: "/account" });
    setPending(false);
    toaster.create(
      error
        ? { type: "error", title: error.message || "Couldn't send the email" }
        : { type: "success", title: "We've sent it again" },
    );
  }

  return (
    <AuthCard title="Check your email">
      <Stack gap={4}>
        <Text>
          We sent a link to{" "}
          <Text as="span" fontWeight="medium">
            {email ?? "your email address"}
          </Text>
          . Open it to confirm your address and sign in.
        </Text>
        <Text color="fg.muted" textStyle="sm">
          Nothing there? Check your spam folder, or send it again.
        </Text>
        {email && (
          <Button variant="outline" onClick={resend} loading={pending}>
            Send the link again
          </Button>
        )}
      </Stack>
    </AuthCard>
  );
}
