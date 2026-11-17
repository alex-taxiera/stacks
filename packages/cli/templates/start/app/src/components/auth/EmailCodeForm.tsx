import { Button, HStack, Input, Stack, Text } from "@chakra-ui/react";
import { Alert } from "__UI_PKG__/alert";
import { Field } from "__UI_PKG__/field";
import { useEffect, useRef, useState, type FormEvent } from "react";

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 30;

export interface EmailCodeFormProps {
  defaultEmail?: string;
  /** The code step's button, such as "Sign in". */
  verifyLabel?: string;
  onSendCode: (email: string) => Promise<void>;
  onVerify: (email: string, code: string) => Promise<void>;
}

/** Sign in without a password: enter an email, get a six-digit code, enter the code. */
export function EmailCodeForm({
  defaultEmail = "",
  verifyLabel = "Continue",
  onSendCode,
  onVerify,
}: EmailCodeFormProps) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState(defaultEmail);
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function run(action: () => Promise<void>) {
    setPending(true);
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  async function send(event?: FormEvent) {
    event?.preventDefault();
    await run(async () => {
      await onSendCode(email.trim());
      setCode("");
      setStep("code");
      setCooldown(RESEND_COOLDOWN_SECONDS);
      // The code field mounts with this render; focus it once it has.
      setTimeout(() => codeRef.current?.focus());
    });
  }

  async function verify(value: string) {
    if (value.length !== CODE_LENGTH) {
      setError(`Enter the ${CODE_LENGTH}-digit code from the email`);
      return;
    }
    await run(() => onVerify(email.trim(), value));
  }

  if (step === "email") {
    return (
      <form onSubmit={send} noValidate>
        <Stack gap={4}>
          <Field required label="Email">
            <Input
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>
          {error && <Alert status="error" title={error} />}
          <Button type="submit" loading={pending} disabled={!email.includes("@")}>
            Email me a code
          </Button>
        </Stack>
      </form>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void verify(code);
      }}
      noValidate
    >
      <Stack gap={4}>
        <Text color="fg.muted">
          We sent a {CODE_LENGTH}-digit code to{" "}
          <Text as="span" fontWeight="medium" color="fg">
            {email}
          </Text>
          .
        </Text>
        <Field label="Code">
          {/* One field, not six boxes, so autofill, paste and fast typing all work. */}
          <Input
            ref={codeRef}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={CODE_LENGTH}
            value={code}
            onChange={(event) => {
              const digits = event.target.value.replaceAll(/\D/g, "").slice(0, CODE_LENGTH);
              setCode(digits);
              if (digits.length === CODE_LENGTH && !pending) void verify(digits);
            }}
            fontFamily="mono"
            fontSize="2xl"
            letterSpacing="0.4em"
            textAlign="center"
          />
        </Field>
        {error && <Alert status="error" title={error} />}
        <Button type="submit" loading={pending}>
          {verifyLabel}
        </Button>
        <HStack justify="space-between" textStyle="sm">
          <Button
            variant="plain"
            size="sm"
            px={0}
            color="fg.muted"
            onClick={() => {
              setStep("email");
              setError(null);
            }}
          >
            Use a different email
          </Button>
          <Button
            variant="plain"
            size="sm"
            px={0}
            disabled={cooldown > 0 || pending}
            onClick={() => void send()}
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
          </Button>
        </HStack>
      </Stack>
    </form>
  );
}
