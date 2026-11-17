import { Button, Input, Stack } from "@chakra-ui/react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Alert } from "__UI_PKG__/alert";
import { Field } from "__UI_PKG__/field";
import { useState, type FormEvent } from "react";

import { AuthCard } from "#/components/auth/AuthCard";
import { RouterLink } from "#/components/router-link";
import { authClient } from "#/lib/auth-client";
import { APP_NAME } from "#/site-config";

const MIN_PASSWORD_LENGTH = 8;

export const Route = createFileRoute("/signup")({
  beforeLoad: ({ context }) => {
    if (context.viewer.user) throw redirect({ to: "/account" });
  },
  head: () => ({ meta: [{ title: `Create an account · ${APP_NAME}` }] }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await authClient.signUp.email({
      name: name.trim(),
      email: email.trim(),
      password,
      callbackURL: "/account",
    });
    setPending(false);
    if (result.error) {
      setError(
        result.error.status === 422
          ? "There's already an account with this email. Sign in instead."
          : result.error.message || "Couldn't create your account",
      );
      return;
    }
    await navigate({ to: "/verify-email", search: { email: email.trim() } });
  }

  return (
    <AuthCard
      title="Create an account"
      footer={
        <>
          Already have one?{" "}
          <RouterLink to="/login" color="accent.fg">
            Sign in
          </RouterLink>
        </>
      }
    >
      <form onSubmit={submit}>
        <Stack gap={4}>
          <Field required label="Name">
            <Input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field required label="Email">
            <Input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>
          <Field
            required
            label="Password"
            invalid={tooShort}
            errorText={`At least ${MIN_PASSWORD_LENGTH} characters.`}
            helperText={`At least ${MIN_PASSWORD_LENGTH} characters.`}
          >
            <Input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>
          {error && <Alert status="error" title={error} />}
          <Button
            type="submit"
            loading={pending}
            disabled={!name.trim() || !email.includes("@") || password.length < MIN_PASSWORD_LENGTH}
          >
            Create account
          </Button>
        </Stack>
      </form>
    </AuthCard>
  );
}
