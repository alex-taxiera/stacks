import { Button, Input, Stack, Tabs } from "@chakra-ui/react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Alert } from "__UI_PKG__/alert";
import { Field } from "__UI_PKG__/field";
import { useState, type FormEvent } from "react";
import { z } from "zod";

import { AuthCard } from "#/components/auth/AuthCard";
import { EmailCodeForm } from "#/components/auth/EmailCodeForm";
import { RouterLink } from "#/components/router-link";
import { authClient, unwrap } from "#/lib/auth-client";
import { safeRedirect } from "#/lib/redirect";
import { useRefreshViewer } from "#/lib/viewer";
import { APP_NAME } from "#/site-config";

export const Route = createFileRoute("/login")({
  validateSearch: z.object({ redirect: z.string().optional() }),
  beforeLoad: ({ context, search }) => {
    if (context.viewer.user) throw redirect({ href: safeRedirect(search.redirect) ?? "/account" });
  },
  head: () => ({ meta: [{ title: `Sign in · ${APP_NAME}` }] }),
  component: LoginPage,
});

function LoginPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const refreshViewer = useRefreshViewer();

  async function finish() {
    await refreshViewer();
    await navigate({ href: safeRedirect(search.redirect) ?? "/account" });
  }

  return (
    <AuthCard
      title="Sign in"
      footer={
        <>
          New here?{" "}
          <RouterLink to="/signup" color="accent.fg">
            Create an account
          </RouterLink>
        </>
      }
    >
      <Tabs.Root defaultValue="password" variant="enclosed" fitted lazyMount unmountOnExit>
        <Tabs.List mb={5}>
          <Tabs.Trigger value="password">Password</Tabs.Trigger>
          <Tabs.Trigger value="code">Email code</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="password">
          <PasswordSignIn onSignedIn={finish} />
        </Tabs.Content>
        <Tabs.Content value="code">
          <EmailCodeForm
            verifyLabel="Sign in"
            onSendCode={async (email) => {
              await unwrap(authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" }));
            }}
            onVerify={async (email, otp) => {
              await unwrap(authClient.signIn.emailOtp({ email, otp }));
              await finish();
            }}
          />
        </Tabs.Content>
      </Tabs.Root>
    </AuthCard>
  );
}

function PasswordSignIn({ onSignedIn }: { onSignedIn: () => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await authClient.signIn.email({ email, password });
    if (result.error) {
      setPending(false);
      setError(
        result.error.status === 403
          ? "Confirm your email first: we've sent you a new link."
          : result.error.message || "Couldn't sign you in",
      );
      return;
    }
    await onSignedIn();
  }

  return (
    <form onSubmit={submit}>
      <Stack gap={4}>
        <Field required label="Email">
          <Input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field required label="Password">
          <Input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        {error && <Alert status="error" title={error} />}
        <Button type="submit" loading={pending} disabled={!email || !password}>
          Sign in
        </Button>
      </Stack>
    </form>
  );
}
