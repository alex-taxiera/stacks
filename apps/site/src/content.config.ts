import { glob } from "astro/loaders";
import { defineCollection, z } from "astro:content";

/** Markdown docs in `src/content/docs`; a file's name is its slug, `order` its place. */
const docs = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/docs" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    order: z.number(),
    /** A table from the CLI's own definitions, rendered after the page's text. */
    appendix: z.enum(["stacks", "addons"]).optional(),
  }),
});

export const collections = { docs };
