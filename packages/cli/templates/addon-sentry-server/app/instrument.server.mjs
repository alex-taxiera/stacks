// Loaded before the server (`node --import ./instrument.server.mjs`), so Sentry sees everything
// it does. SENTRY_DSN unset leaves it off.
import * as Sentry from "@sentry/tanstackstart-react";

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    // No IP addresses, cookies or request bodies.
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
  });
}
