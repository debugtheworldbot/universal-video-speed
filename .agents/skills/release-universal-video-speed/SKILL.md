---
name: release-universal-video-speed
description: Release the Universal Video Speed browser extension from /Users/tian/Developer/universal-video-speed. Use when the user asks to release, publish a release, create a GitHub Release, or ship a new version of this repository. By default increment the current version by 0.0.1, validate the project, build the ZIP, generate a changelog, commit and tag the version, push it, create the GitHub Release, upload the ZIP, and verify the published result.
---

# Release Universal Video Speed

Publish a complete, verified GitHub Release. Treat a request such as “release” as authorization for the version commit, tag, push, GitHub Release creation, and ZIP upload described below.

## Establish the release

1. Work only in `/Users/tian/Developer/universal-video-speed`.
2. Read the repository instructions, including referenced instruction files that exist.
3. Inspect `git status --short`, the current branch and upstream, remotes, recent commits, existing tags, `gh auth status`, and any existing Release for the target tag. Never reuse remembered remote state.
4. Preserve unrelated work. If the worktree is not clean or the target tag/Release already exists, diagnose the collision and stop before mutating release state unless the user explicitly directs how to proceed.
5. Read the current versions from `package.json`, `package-lock.json`, and `public/manifest.json`. Require them to agree before calculating the next version.
6. If the user supplied a version, use it after validating SemVer. Otherwise increment the patch component by one (`0.1.1` becomes `0.1.2`). Use the plain version in files and `v<version>` for the Git tag and Release tag.

## Prepare and verify

1. Identify the previous release tag from the live repository and review the actual commits and diff from that tag through `HEAD`.
2. Generate a concise user-facing changelog from that range. Use the `git-tag-changelog` skill when it is available. Describe shipped behavior, fixes, and other user-relevant changes; do not invent changes from commit titles alone when the diff clarifies them.
3. Update the version consistently in:
   - `package.json`
   - `package-lock.json`
   - `public/manifest.json`
4. Run `npm run check` and require it to pass.
5. Run `npm run zip`. Require `universal-video-speed.zip` to exist, inspect its file list, and verify that the archive's `manifest.json` contains the target version.
6. Compute the ZIP SHA-256 for the final report.
7. Review the diff and `git status --short`. Do not include the generated ZIP in the commit; it is a regenerated Release asset.

Do not continue to publishing if version synchronization, tests, build, archive inspection, or changelog review fails.

## Commit and publish

1. Commit only the three version files with message `chore: release <version>`, following the repository's atomic-commit rules.
2. Recheck status, create tag `v<version>` at that commit, and push the current release branch plus the tag to its configured upstream.
3. Write the changelog to a temporary Markdown file with real newlines. Use a clear heading and Markdown bullets. Never pass escaped multiline text such as literal `\\n` through `--notes`.
4. Create a non-draft, non-prerelease GitHub Release titled `v<version>` using the Markdown file via `--notes-file`, and attach `universal-video-speed.zip`.
5. Re-read the live Release with `gh release view`. Verify all of the following:
   - the tag and title are correct;
   - `isDraft` and `isPrerelease` are false;
   - the rendered body has real headings, blank lines, and bullets rather than literal escape sequences;
   - `universal-video-speed.zip` is present as an asset.
6. Confirm the final local worktree state. Leave the generated ZIP untracked when that matches the repository's established behavior.

If a push, tag, or GitHub operation fails, inspect the live state before retrying so that a retry cannot create conflicting release objects. Never delete or overwrite a tag or published Release without explicit user approval. Never print credentials or edit environment files.

## Report completion

Report the released version, commit and tag, checks performed, ZIP filename and SHA-256, and clickable GitHub Release URL. Clearly identify anything that could not be verified; do not describe a local version bump as a completed release.
