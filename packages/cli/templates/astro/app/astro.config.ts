import react from "@astrojs/react";
import { defineConfig } from "astro/config";

import { SITE_URL } from "./src/site-config";

export default defineConfig({
  site: SITE_URL,
  integrations: [react()],
  server: { port: __DEV_PORT__ },
  vite: {
    resolve: {
      // One copy of each, for this app and the UI package's source alike. pnpm can install two
      // copies when their optional peers differ, and two Chakras or Reacts don't share a context.
      dedupe: ["@chakra-ui/react", "@emotion/react", "next-themes", "react", "react-dom"],
    },
  },
});
