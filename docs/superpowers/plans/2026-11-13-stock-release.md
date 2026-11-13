# Stock Repository and Six-Platform Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Execute inline; user explicitly authorizes remote repository, submodule and release effects.

**Goal:** Create ootools/otools-stock, register xyito submodule, and release six installable platform assets plus accurate market metadata.

**Architecture:** Shared pure-frontend ZIP payload across six standard OTools suffixes; one platform policy defines pack names, verifiers and market URL fields. Keep universal direct CLI for backward-compatible tests. Publish only verified committed output.

**Tech Stack:** Existing Vue/TypeScript/Node scripts, Git/gh CLI, GitHub Actions build workflow, OTools market HTTP API.

**Spec:** `docs/superpowers/specs/2026-11-13-stock-release-design.md`

## Global Constraints

- Existing main; no branch/worktree. Plugin and parent .gitmodules/gitlink are only write/commit scopes.
- Version 0.1.0; tag plugin-otools-stock-v0.1.0; public repo ootools/otools-stock; xyito path otools/otools-stock.
- Exactly six .oplg in dist-pack/release; no native binaries, no fake platform execution claims; portable frontend shared.
- Production flags stripped, market packageMode=1, six standard URLs, tagged raw SVG logo.
- PAT read into process env only; mask removed before logs. No unrelated user commits/files.

## Review Focus

- Missing/duplicate/misnamed platform artifacts must fail before publication.
- Bad or changed SHA256/CRC/inside manifest must not pass aggregate verification.
- Preserve parent staged/dirty modules when committing gitlink and .gitmodules only.
- Existing tag/release must be checked before upload; never overwrite foreign commit.
- No token/log leak or false actual platform/browser validation claim.

### Task 1: Six-package release tooling

**Files:** Create scripts/platform-packages.mjs, tests/platform-packages.test.mjs; modify scripts/pack-plugin.mjs, scripts/verify-plugin.mjs, scripts/publish-market.mjs, package.json.

**Interfaces:** platformVariants()/platformVariant(platform,arch), release filename/URL policy; pack all six to out directory and aggregate meta; verifier recognizes single or aggregate mode.

- [ ] Write target/publish/aggregate pack/tamper/missing-artifact tests and observe RED.
- [ ] Implement shared policy, pack flags, six-artifact verifier and opt-in market payload.
- [ ] Complete tests/typecheck/build/live smoke/pack/verify; inspect exactly six archives and matching payload fields.

### Task 2: Repository/source CI and registration

**Files:** Create .github/workflows/build-plugin.yml and docs/RELEASE.md; update README.md/docs/VERIFICATION.md; parent .gitmodules and stock gitlink.

- [ ] Add conservative build-only CI (no implicit publish/secrets) and release/install instructions.
- [ ] Scan the new source/SDK artifacts for secrets and run fresh suite; initialize local main, scope source commit.
- [ ] Create public GitHub repository and push main; verify remote commit.
- [ ] Register/absorb stock submodule; verify .gitmodules diff and gitlink commit are the only staged parent changes.

### Task 3: Release, market and final verification

- [ ] Create immutable tag for built commit; create GitHub Release with six assets/checksums/metadata, then verify/digest-check downloaded artifacts.
- [ ] Publish OTools market packageMode=1 using local PAT with redacted output; confirm success via API and read-back when accessible.
- [ ] Commit/push only parent .gitmodules + stock gitlink and verify both remotes/submodule path/tag/release assets.
- [ ] Record final evidence, hashes and public locations. Distinguish artifact/contract checks from actual OS/UI execution.
