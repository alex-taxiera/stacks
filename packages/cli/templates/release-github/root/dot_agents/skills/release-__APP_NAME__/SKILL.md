---
name: release-__APP_NAME__
description: Cut a release of __APP_TITLE__ (apps/__APP_NAME__) - the version bump PR, the release notes, the __APP_NAME__@v* tag, the draft GitHub release the release-__APP_NAME__ workflow builds, checking its installers, and publishing it. Use whenever the user wants to release, ship, publish, tag or cut a new version of __APP_TITLE__, bump its version, write its release notes, or finish or fix a release of it that is still a draft or whose build failed, even if they do not say "release".
---

# Releasing __APP_TITLE__

A release is a GitHub release named **__APP_TITLE__ v<version>**, tagged `__APP_NAME__@v<version>`,
holding the Windows, macOS and Linux installers. Pushing the tag makes
`.github/workflows/release-__APP_NAME__.yml` build all three platforms and attach them to a draft.
Publishing the draft is what ships it.

Hold on to these throughout:

- **Publishing is the release, and pushing the tag is public too.** Show the user the version and
  notes and get a yes before pushing the tag, and ask again before publishing. Everything before
  the tag push is local or a PR and can be redone freely.
# stacks:slot updater-rules
- **The tag must match `tauri.conf.json`.** The workflow names the release from
  `apps/__APP_NAME__/src-tauri/tauri.conf.json`'s version (`tagName: __APP_NAME__@v__VERSION__`),
  not from the tag. A tag pushed on a commit that still has the old version builds into the old
  version's release, which is already published. Check before tagging, every time.
- **Only this app's tags.** Other apps in the repo release under their own `<name>@v*` tags; never
  touch them. Never create one of this app's releases by hand (`gh release create`): the workflow
  makes the draft.
- **No pre-releases.** The workflow publishes with `prerelease: false`, and Windows' MSI bundler
  rejects versions like `0.3.0-rc1`. If the user wants one, say so; it needs workflow changes first.

The remote is `origin` and the default branch is `trunk`. Commit messages and PR titles follow
Conventional Commits, scoped to the app: `chore(__APP_NAME__): release <version>`.

`gh`'s subcommands differ a lot between versions, so the steps below use `gh api` and
`--json`/`--jq`, which work with any version. `gh api` fills `{owner}/{repo}` in itself. A draft
has no tag yet as far as the API's `releases/tags/` is concerned, so find a release by listing:

```bash
gh api 'repos/{owner}/{repo}/releases?per_page=30' --jq '.[] | select(.tag_name=="__APP_NAME__@v<version>") | {id, name, draft}'
```

and use its `id` as `<release-id>` below.

## 1. Is there something to release?

```bash
git fetch origin --tags
git describe --tags --abbrev=0 --match '__APP_NAME__@v*' origin/trunk   # the last release, if any
git log --oneline <last-tag>..origin/trunk -- apps/__APP_NAME__ crates packages/ui
gh run list --workflow ci.yml --limit 20 --json headBranch,status,conclusion --jq '[.[] | select(.headBranch=="trunk")][0]'   # must be completed, success
```

- If nothing since the last tag touches the app (`apps/__APP_NAME__`, `crates/`, `packages/ui/`),
  say so: other apps, docs, CI and agent changes don't need a release. Ask whether one is really
  wanted.
- If CI on trunk's head is red or still running, stop until it's green.
- Check the release list for a leftover draft of this app. If one exists for the version you're
  about to cut, this is a resumed release: skip to the step it got to.

Work from `origin/trunk`, not from whatever is checked out. If the working tree has uncommitted
changes, don't stash or touch them: do the release in a worktree
(`git worktree add ../__APP_NAME__-release origin/trunk`) and work there.

## 2. Version

Pick it with the user if they didn't give one: `MAJOR.MINOR.PATCH`, a minor bump for new features,
a patch bump for fixes only. The tag is `__APP_NAME__@v<version>`; check it doesn't exist yet
(`git ls-remote --tags origin '__APP_NAME__@v<version>'`).

## 3. Release notes

There is no changelog file. The notes go in the release PR's body and then on the release. Write
them for someone who uses the app, not for a developer: what they can now do, what was fixed. No
commit subjects, crate names, refactors, CI, Storybook or agent changes. Work out what changed from
`git log <last-tag>..origin/trunk -- apps/__APP_NAME__ crates packages/ui` and the merged PRs'
bodies (`gh pr view <n> --json body`). Follow the last release's shape if there is one; otherwise:

```markdown
# stacks:slot updater-notes
To install it fresh, download the installer for your system below.

## New

### <A headline feature>

<What it is, in a sentence or two.>

- <How to use it, naming controls in **bold** as the app labels them.>

### Also new

- <Smaller additions.>

## Fixed

- <What was wrong, as the user saw it, and that it no longer is.>
```

Drop a section that would be empty. Write the notes to a scratch file and show them to the user.

## 4. The version bump PR

On a branch `chore/release-__APP_NAME__-<version>` from `origin/trunk`, set `"version"` in
`apps/__APP_NAME__/src-tauri/tauri.conf.json`. That's the app's version, the one the release is
named for and the installed app reports. The Cargo workspace's version is shared by every crate and
stays as it is. `git diff` should show that one line.

Commit as `chore(__APP_NAME__): release <version>`. Once the user agrees to the version and notes,
push the branch and open the PR: a summary of the bump, the commands in step 5 under **After
merging**, and the release notes inside `<details><summary>Draft release notes</summary>`.

Wait for CI on the PR:

```bash
gh run watch $(gh run list --workflow ci.yml --limit 20 --json databaseId,headBranch --jq '[.[] | select(.headBranch=="chore/release-__APP_NAME__-<version>")][0].databaseId') --exit-status
```

Merging is the user's call: ask whether they want you to merge it or will do it themselves.

## 5. Tag

After the PR is merged:

```bash
git switch trunk && git pull --ff-only origin trunk
jq -r .version apps/__APP_NAME__/src-tauri/tauri.conf.json   # must print <version>
git log -1 --format=%s                                        # the release PR's merge
```

If the version doesn't match, stop: see the second rule above. Ask the user, then:

```bash
git tag __APP_NAME__@v<version>
git push origin __APP_NAME__@v<version>
```

Watch the build. It takes a while (macOS builds a universal binary), so watch it in the background:

```bash
gh run watch $(gh run list --workflow release-__APP_NAME__.yml --limit 20 --json databaseId,headBranch,event --jq '[.[] | select(.headBranch=="__APP_NAME__@v<version>" and .event=="push")][0].databaseId') --exit-status
```

The three platforms build independently (`fail-fast: false`). If one fails:

- A flaky step: `gh api -X POST 'repos/{owner}/{repo}/actions/runs/<run-id>/rerun-failed-jobs'`.
# stacks:slot updater-failures
- A real build failure: fix it on trunk through a PR, then build just that platform into the same
  draft with `gh workflow run release-__APP_NAME__.yml --ref trunk -f platform=<windows|macos|linux>`.
  This works because the draft is found by `tauri.conf.json`'s version. Don't move the tag unless
  the fix changes what the other platforms built; if it does, delete the draft and the tag and start
  step 5 again.

## 6. Check the draft

```bash
gh api 'repos/{owner}/{repo}/releases?per_page=30' --jq '.[] | select(.tag_name=="__APP_NAME__@v<version>" or .tag_name=="<last-tag>") | {tag_name, name, draft, assets: [.assets[].name]}'
```

It should be a draft named `__APP_TITLE__ v<version>`, with the same kinds of files as the last
release under the new version: Windows `_x64-setup.exe` and `_x64_en-US.msi`; macOS
`_universal.dmg`; Linux `.AppImage`, `.deb` and `.rpm`.
# stacks:slot updater-assets

Offer the user the chance to install one of the draft's installers before publishing: download it
by its asset id (`gh api 'repos/{owner}/{repo}/releases/assets/<asset-id>' -H 'Accept: application/octet-stream'`)
into a directory of its own.

## 7. Notes and publish

```bash
gh api -X PATCH 'repos/{owner}/{repo}/releases/<release-id>' -F body=@<notes file> --jq .html_url
```

Show the user that URL (a draft's page is visible only to the repo's maintainers). Ask the user
before publishing, then:

```bash
gh api -X PATCH 'repos/{owner}/{repo}/releases/<release-id>' -F draft=false -f tag_name=__APP_NAME__@v<version> --jq '{tag_name, draft, html_url}'
```

Always pass `tag_name`. Without it, GitHub can publish the draft under a placeholder tag,
`untagged-<hash>`, even though `__APP_NAME__@v<version>` exists, and every download link on it is
a 404. The output must show `__APP_NAME__@v<version>`, not `untagged-…`; if it doesn't, set it back
at once with `gh api -X PATCH 'repos/{owner}/{repo}/releases/<release-id>' -f tag_name=__APP_NAME__@v<version>`.
# stacks:slot updater-publish

Report the release's URL.

## 8. If a bad build went out

Setting the release back to a draft
(`gh api -X PATCH 'repos/{owner}/{repo}/releases/<release-id>' -F draft=true`) takes it off the
releases page, so nobody else downloads it.
# stacks:slot updater-rollback
The fix ships as the next patch release, not by replacing files on this one.
