---
name: release-__APP_NAME__
description: Cut a release of __PACKAGE_NAME__ (__APP_DIR__) to npm - checking there is something to ship, picking the bump, writing the release notes, running the release-__APP_NAME__ workflow, checking what reached npm and GitHub, and recovering a release that failed partway. Use whenever the user wants to release, ship, publish, tag or cut a new version of __PACKAGE_NAME__ or the __BIN_NAME__ command, bump its version, write its release notes, or fix a release of it that failed, even if they do not say "release".
---

# Releasing __PACKAGE_NAME__

A release is version `<version>` of __PACKAGE_NAME__ on npm, with provenance, plus a GitHub
release tagged `__APP_NAME__@v<version>`. One run of `.github/workflows/release-__APP_NAME__.yml`
does all of it: given a bump (`patch`, `minor` or `major`), it works out the version from the last
`__APP_NAME__@v*` tag, checks the package, commits the version to `trunk`, tags it, publishes to
npm and makes the GitHub release. Nothing is done by hand.

Hold on to these throughout:

- **Running the workflow is the release.** npm keeps a published version for good: it can be
  deprecated, but its number can never be used again. Show the user the version and the notes and
  get a yes before running it. Everything before that is local and can be redone freely.
- **Never set the version by hand**, in `package.json` or the skill's `library_version`, and never
  tag, `pnpm publish` or `gh release create` by hand. The workflow does each of them, in an order
  that keeps a broken build from leaving a tag behind.
- **Always start a new run; never re-run an old one.** A re-run checks out the commit the first run
  started from, not `trunk` as it is now, so it can't pick up a fix, and once a run has pushed its
  commit, a re-run's push is refused.
- **Only this package's tags.** Other packages and apps in the repo release under their own
  `<name>@v*` tags; never touch them.
- **No pre-releases.** The workflow only takes `patch`, `minor` or `major`. If the user wants a
  `-beta`, say so; it needs workflow changes first.

The remote is `origin` and the default branch is `trunk`. `gh`'s subcommands differ a lot between
versions, so the steps below use `gh api` and `--json`/`--jq`, which work with any version; `gh api`
fills `{owner}/{repo}` in itself. Ask npm with `pnpm view`: `npm` is refused inside the repo.

## 1. Is there something to release?

```bash
git fetch origin --tags
git describe --tags --abbrev=0 --match '__APP_NAME__@v*' origin/trunk   # the last release, if any
pnpm view __PACKAGE_NAME__ dist-tags --json                            # what npm has as latest
```

The last tag is the base everything below compares against. If there's no tag:

- **npm has no version either**: the package has never been published. The workflow can't make the
  first publish, since npm only trusts a workflow for a package that exists. Stop and tell the user:
  they publish it once by hand (`pnpm --filter __PACKAGE_NAME__ publish`, logged in to npm), then
  add the trusted publisher (below).
- **npm has a version**: it was published by hand, and the workflow counts on from the `version` in
  `__APP_DIR__/package.json`, which should match npm's `latest`. Use the last commit on `trunk`
  before that publish as the base:
  `git log -1 --format=%h --before="$(pnpm view __PACKAGE_NAME__ time.<latest>)" origin/trunk`.
- **Either way, this is the workflow's first run.** Ask the user whether this repo and
  `release-__APP_NAME__.yml` are a trusted publisher of __PACKAGE_NAME__ on npmjs.com (the
  package's Settings → Trusted publishing). Without one, the run fails at the publish.

Then:

```bash
git log --oneline <base>..origin/trunk -- __APP_DIR__ pnpm-workspace.yaml
gh run list --workflow ci.yml --limit 20 --json headBranch,status,conclusion --jq '[.[] | select(.headBranch=="trunk")][0]'   # must be completed, success
gh run list --workflow release-__APP_NAME__.yml --limit 5 --json status,event --jq '[.[] | select(.event=="workflow_dispatch" and .status!="completed")]'   # must be []
```

- If nothing since the base touches `__APP_DIR__`, say so: other packages, apps, docs and CI don't
  need a release. `pnpm-workspace.yaml` counts only where the catalog changed a dependency of this
  package. Ask whether a release is really wanted.
- If CI on `trunk`'s head is red or still running, stop until it's green.
- If a release run is already going, don't start another; watch that one (step 5).

## 2. The bump

Pick it with the user if they didn't give one. The workflow adds it to the base version:

- From 1.0.0: `major` for a breaking change (a command, flag or output that's gone or works
  differently), `minor` for something new, `patch` for fixes only.
- Before 1.0.0: a `^0.x.y` range only takes patches, so a `minor` bump is the one users have to opt
  into. Use `minor` for breaking changes and `patch` for the rest, unless the user says otherwise.

Work out the version it will make, and check that neither the tag nor npm has it:

```bash
git ls-remote --tags origin '__APP_NAME__@v<version>'   # must print nothing
pnpm view __PACKAGE_NAME__@<version> version            # must fail: "No matching version"
```

## 3. Release notes

The workflow makes the GitHub release with notes GitHub generates from the merged PRs' titles.
Replace them with notes written for someone who runs `__BIN_NAME__`, not for a developer of it:
what they can now do, what works differently, what was fixed. Name commands, flags and options
exactly as the user types them, in code. No refactors, tests, CI, docs-site or agent changes.

To work out what changed, read:

- `git log <base>..origin/trunk -- __APP_DIR__` and the merged PRs' bodies (`gh pr view <n> --json body`)
- `git diff <base>..origin/trunk -- __APP_DIR__/skills`. The package's skill changes with every
  change to what the command does, so this diff is the list of user-visible changes.

Follow the last release's shape if there is one
(`gh api 'repos/{owner}/{repo}/releases/tags/<last-tag>' --jq .body`); otherwise:

```markdown
## Breaking

- <What changed, and what to do instead: the old command and the new one.>

## New

- <What the user can now do, with the command that does it.>

## Fixed

- <What was wrong, as the user saw it, and that it no longer is.>
```

Drop a section that would be empty. Write the notes to a scratch file, then show the user the
version and the notes together, and ask before going on.

## 4. Run the workflow

Once the user says yes:

```bash
gh workflow run release-__APP_NAME__.yml --ref trunk -f bump=<patch|minor|major>
```

## 5. Watch it

```bash
gh run list --workflow release-__APP_NAME__.yml --limit 5 --json databaseId,event,createdAt --jq '[.[] | select(.event=="workflow_dispatch")][0]'
gh run watch <run-id> --exit-status
```

The run's log names the version it worked out ("This release: `__APP_NAME__@v<version>`"); check it's
the one you showed the user. If it fails, what to do depends on the step
(`gh run view <run-id> --json jobs --jq '.jobs[].steps[] | select(.conclusion=="failure") | .name'`):

- **Work out the next version, Check, Record the version**: nothing was committed, tagged or
  published. Fix the cause on `trunk` through a PR, then start a new run (step 4).
- **Commit and tag**, with "Couldn't push to the default branch": `trunk` moved while the run was
  going, or it's protected. Nothing was published. If it's protection, the user needs to let
  `github-actions[bot]` bypass the rules. Then start a new run.
- **Publish to npm**: the version commit and the tag are pushed, but npm has nothing. Read the log:
  - "403", "OIDC" or "trusted publisher": the trusted publisher isn't set up, or names another
    workflow file. The user fixes it on npmjs.com.
  - Anything else: fix it on `trunk` through a PR.

  Then delete the tag, which is all that stops the next run from making the same version, and start
  a new run with the same bump. It finds the version already committed and tags the new `trunk`:

  ```bash
  git push origin :refs/tags/__APP_NAME__@v<version>
  ```

- **Make the GitHub release**: npm has the version; only the GitHub release is missing. Make it by
  hand, the one exception to the rule above:
  `gh release create __APP_NAME__@v<version> --title "__PACKAGE_NAME__ __APP_NAME__@v<version>" --notes-file <notes file> --verify-tag`

## 6. Check what went out

```bash
pnpm view __PACKAGE_NAME__ dist-tags.latest                   # <version>
pnpm view __PACKAGE_NAME__@<version> dist.attestations --json  # provenance: not empty
gh api 'repos/{owner}/{repo}/releases/tags/__APP_NAME__@v<version>' --jq '{name, draft, html_url}'
```

If the run passed but npm doesn't show the version within a few minutes, npm may be holding it as a
staged release: the user approves it on the package's page on npmjs.com.

Then run what was published, from a scratch directory outside the repo (the repo's
`minimumReleaseAge` refuses versions under three days old):

```bash
pnpm dlx __PACKAGE_NAME__@<version> --help
```

## 7. Notes

Put the notes from step 3 on the GitHub release in place of the generated ones:

```bash
gh api -X PATCH "repos/{owner}/{repo}/releases/$(gh api 'repos/{owner}/{repo}/releases/tags/__APP_NAME__@v<version>' --jq .id)" -F body=@<notes file> --jq .html_url
```

Report the release's URL and the npm version. Repos that pin a release age, as stacks repos do,
pick the new version up three days after it's published.

## 8. If a bad version went out

npm can't take a version back for anyone who already has it, and its number is spent. Ship the fix
as the next patch release (step 1 again). Meanwhile the user can warn anyone installing the bad
one; it needs their npm login, so they run it themselves, from outside the repo:

```bash
npm deprecate __PACKAGE_NAME__@<version> "<what's wrong>; use <next version>"
```

Don't suggest `npm unpublish`: it's refused once anything depends on the version, and it breaks
the builds of everyone who locked it.
