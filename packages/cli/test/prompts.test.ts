import { describe, expect, it } from "vitest";

import { addonChoices, appNameProblem, equivalentCommand } from "../src/prompts.ts";
import { makeApp } from "../src/scaffold.ts";
import { STACKS } from "../src/stacks.ts";

const unavailable = (choices: ReturnType<typeof addonChoices>) =>
  Object.fromEntries(
    choices.flatMap((choice) => (choice.unavailable ? [[choice.id, choice.unavailable]] : [])),
  );

describe("addonChoices", () => {
  it("rules out an add-on the deploy target can't take", () => {
    expect(unavailable(addonChoices(STACKS.spa, "gh-pages", []))).toEqual({
      worker: "needs --deploy cloudflare",
    });
    expect(unavailable(addonChoices(STACKS.spa, "cloudflare", []))).toEqual({});
  });

  it("offers downloads only once the repo has a tauri app", () => {
    expect(unavailable(addonChoices(STACKS.astro, "cloudflare", []))).toEqual({
      downloads: "needs a tauri app first",
    });
    const desktop = makeApp(STACKS.tauri, [], { name: "desktop" });
    expect(unavailable(addonChoices(STACKS.astro, "cloudflare", [desktop]))).toEqual({});
  });

  it("lists every add-on the stack has, and none for cli", () => {
    expect(addonChoices(STACKS.tauri, "releases", []).map((choice) => choice.id)).toEqual(
      Object.keys(STACKS.tauri.addons),
    );
    expect(addonChoices(STACKS.cli, "npm", [])).toEqual([]);
  });
});

describe("appNameProblem", () => {
  it("needs a usable, free folder", () => {
    expect(appNameProblem("My App", STACKS.spa)).toBeUndefined();
    expect(appNameProblem("!!!", STACKS.spa)).toMatch(/folder name/);
    expect(appNameProblem("ui", STACKS.cli)).toMatch(/UI package/);
    expect(appNameProblem("ui", STACKS.spa)).toBeUndefined();
    expect(appNameProblem("web", STACKS.spa, (dir) => dir === "apps/web")).toMatch(
      /apps\/web already exists/,
    );
  });
});

describe("equivalentCommand", () => {
  it("writes each answered flag, and leaves out what wasn't", () => {
    expect(
      equivalentCommand(["stacks", "new", "my-app"], {
        stack: "spa",
        "package-name": undefined,
        with: ["e2e", "zustand"],
        install: false,
        git: undefined,
        yes: true,
      }),
    ).toBe("stacks new my-app --stack spa --with e2e,zustand --no-install --yes");
  });

  it("leaves out an empty add-on list", () => {
    expect(equivalentCommand(["stacks", "add", "spa", "web"], { with: [] })).toBe(
      "stacks add spa web",
    );
  });

  it("quotes values a shell would split or expand", () => {
    expect(
      equivalentCommand(["stacks", "new", "my app"], { title: 'My "Cool" $App', github: "me/app" }),
    ).toBe('stacks new "my app" --title "My \\"Cool\\" \\$App" --github me/app');
  });
});
