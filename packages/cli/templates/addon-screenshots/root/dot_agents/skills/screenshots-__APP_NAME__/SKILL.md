---
name: screenshots-__APP_NAME__
description: Take or retake __APP_TITLE__'s screenshots (apps/__APP_NAME__) in docs/screenshots/__APP_NAME__, which the README and anything else that shows the app use. Use whenever the user asks to take, update, retake or refresh screenshots of __APP_TITLE__, or to add a new one; and after any change that alters what a screenshot shows (theme, colours, fonts, layout, wording on screen), even if the user doesn't mention screenshots.
---

# __APP_TITLE__'s screenshots

`docs/screenshots/__APP_NAME__/*.png` are taken from the app's own Storybook, not drawn. One
command takes them all:

```sh
pnpm --filter __APP_NAME__ screenshots               # build Storybook, then every scene
pnpm --filter __APP_NAME__ screenshots app-default   # only the scenes named
pnpm --filter __APP_NAME__ screenshots --no-build    # reuse storybook-static as it is
```

Each is the window's default size (`src-tauri/tauri.conf.json`) at 150%, as on a Windows laptop,
in light and dark.

## How it works

`apps/__APP_NAME__/scripts/screenshots.ts`:

1. Builds Storybook and serves `storybook-static` with Vite.
2. Finds every story tagged `screenshot` in its `index.json`. That story is a scene. Its file is
   the story's id with one dash, such as `app--default` becoming `app-default-light.png`.
3. Opens each scene in headless Chromium, once in each colour mode, through Storybook's theme
   global. It waits for Storybook to say that the story rendered and its `play` function ran,
   parks the mouse in a corner, and saves the picture.

Storybook already stands in for Rust and every `@tauri-apps/*` module (`.storybook/preview.tsx`),
so a scene needs nothing of its own besides its story.

## Retaking them

1. Run `pnpm --filter __APP_NAME__ screenshots`.
2. **Look at every image you took** with the Read tool before calling it done. Compare each with
   the one in git: run `git show HEAD:docs/screenshots/__APP_NAME__/<file> > <scratch dir>/old.png`
   and read that too. Look for:
   - something that didn't load
   - a hovered or focused control that shouldn't be
   - text that's cut off
   - a palette or font that isn't the theme's
   - the change you made, actually showing
3. If a shot's content changed, check that its alt text, wherever it's used, still describes it.
4. Commit the images with the change that made them differ, or on their own as
   `docs(__APP_NAME__): retake the screenshots`.

A scene that fails names the story and Storybook's error. Run the story in Storybook
(`pnpm --filter __APP_NAME__ storybook`) to see it. Usually its `play` function no longer matches
the UI, or the preview's mocks no longer answer what the app asks.

## Adding a scene

1. Write or pick a story that shows the state: data from its `beforeEach` (`mocked(api.x)`), and
   a `play` function that gets there with role- or label-based queries. End with nothing focused
   that the picture isn't about.
2. Give it `tags: ["screenshot"]` and `parameters: { layout: "fullscreen" }`.
3. Take it, look at it, and put it where it's shown, with alt text that says what it shows.
