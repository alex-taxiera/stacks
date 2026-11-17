import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins/email-otp";
import { tanstackStartCookies } from "better-auth/tanstack-start";

import { db } from "#/db";
import * as schema from "#/db/schema";
import { sendEmailInBackground } from "#/server/email.server";

/**
 * Sign-in with an email and password (verified by email), or with a one-time code sent by email,
 * which creates the user the first time. Reads BETTER_AUTH_URL and BETTER_AUTH_SECRET.
 */
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      sendEmailInBackground({
        to: user.email,
        subject: "Confirm your email",
        text: `Open this link to confirm your email address:\n\n${url}`,
      });
    },
  },
  advanced: {
    // Behind Cloudflare, its header carries the visitor's address; a proxy in between (Traefik)
    // rewrites X-Forwarded-For to its own. Per-address rate limits need the real one.
    ipAddress: { ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"] },
  },
  rateLimit: {
    storage: "database",
    customRules: {
      "/email-otp/send-verification-otp": { window: 60, max: 3 },
      "/sign-in/email-otp": { window: 60, max: 10 },
    },
  },
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 10 * 60,
      allowedAttempts: 5,
      sendVerificationOTP: async ({ email, otp }) => {
        sendEmailInBackground({
          to: email,
          subject: `${otp} is your sign-in code`,
          text: `Your sign-in code is ${otp}. It expires in 10 minutes.`,
        });
      },
    }),
    // Last, so it sets the cookies the other plugins' responses carry.
    tanstackStartCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
