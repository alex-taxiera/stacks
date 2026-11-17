import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  plugins: [emailOTPClient()],
});

type Result<T> =
  | { data: T; error: null }
  | { data: null; error: { message?: string; status: number } };

/** better-auth's client calls resolve to `{ data, error }`; this throws the error instead. */
export async function unwrap<T>(result: Promise<Result<T>>): Promise<T> {
  const { data, error } = await result;
  if (error) throw new Error(error.message || `Request failed (${error.status})`);
  return data;
}
