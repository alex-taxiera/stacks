# __APP_TITLE__

A fullstack app rendered on the server: TanStack Start on Nitro, TanStack Query, better-auth and
Drizzle on Postgres, with Chakra UI from `__UI_PKG__`.

## Run it

1. Copy `.env.example` to `.env.local` and set `BETTER_AUTH_SECRET` (`openssl rand -base64 32`).
2. Start Postgres on port __DB_PORT__. With Docker: `docker compose up -d postgres` in this folder.
3. Apply the migrations, then start the dev server on http://localhost:__DEV_PORT__:

   ```sh
   pnpm --filter __APP_NAME__ db:migrate
   pnpm --filter __APP_NAME__ dev
   ```

Emails (sign-in codes, confirmation links) print to the dev server's terminal until
`src/server/email.server.ts` sends them through a provider.

## Change the database

Edit `src/db/schema.ts`, then `pnpm --filter __APP_NAME__ db:generate` writes a migration to
`drizzle/`. Read it, apply it with `db:migrate`, and commit both. The app never migrates itself:
deploys run the migrations before the new release starts.

## Layout

| Path                  | What                                                                  |
| --------------------- | --------------------------------------------------------------------- |
| `src/routes/`         | File routes. `api/` holds server routes: `auth/$` and `health`.        |
| `src/server/`         | Server-only code; `*.functions.ts` files hold the server functions.    |
| `src/lib/auth.ts`     | better-auth's server setup; `auth-client.ts` is the browser's.         |
| `src/lib/viewer.ts`   | Who's signed in, loaded once by the root route and cached by Query.    |
| `src/db/`             | The Drizzle client and schema.                                          |
| `server/`             | Nitro plugins and tasks.                                                |
