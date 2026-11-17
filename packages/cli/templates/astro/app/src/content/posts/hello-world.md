---
title: Hello, world
description: The first post, and how this site is put together.
date: 2026-01-01
---

This site is [Astro](https://astro.build): every page is HTML, built ahead of time.

## Writing a post

Add a Markdown file to `src/content/posts`. Its frontmatter is checked against the schema in
`src/content.config.ts`, and its file name is its address: `hello-world.md` is `/posts/hello-world/`.
Set `draft: true` to keep it off the site.

## Interactive parts

The header is a React component that Astro hydrates (`client:load`), so its color-mode button
works. Everything else on this page is plain HTML and ships no JavaScript.
