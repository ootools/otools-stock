# Stock plugin repository and six-platform release

Date: 2026-11-13. User explicitly requested creating the GitHub repository, registering the xyito submodule, and publishing six platform packages. This supersedes the earlier local-only/no-publication scope.

## Approach

Create public `ootools/otools-stock`, main branch, register in parent `xyito/xyito` at `otools/otools-stock`. Existing siblings are public and use this path/organization convention. Keep package version 0.1.0 (not yet remotely released).

Use the existing verified pure frontend bundle to produce six OTools package assets. Alternatives: publish only universal .oplg (does not satisfy request) or manufacture native binaries/run unnecessary platform compilers (not honest for this architecture). Selected: six named platform distributions of identical portable frontend payload, explicit platform/architecture metadata outside package, no native library.

## Artifacts and platform contract

| Platform | Arch | Asset suffix | Market field |
|---|---|---|---|
| Windows | x64 | windows | packageUrlWindows |
| Windows | arm64 | windows-arm | packageUrlWindowsArm |
| macOS | arm64 | macos | packageUrlMacos |
| macOS | x64 | macos-intel | packageUrlMacosIntel |
| Linux | x64 | linux | packageUrlLinux |
| Linux | arm64 | linux-arm | packageUrlLinuxArm |

`dist-pack/release/` contains exactly six `.oplg`, production `plugin.json`, `logo.svg`, SHA256SUMS and metadata. Market publish opts into `packageMode=1` and six URL fields with no missing universal URL. Same tagged raw logo. Retain direct CLI universal packaging for earlier local tooling/tests, but package.json canonical pack/verify commands select six-platform aggregate.

## Safety and verification

- Tests/production DOM/typecheck/build/live K-line smoke, then pack, CRC + inner/outer manifest + six-target exactness + SHA256 checks.
- Commit all and only new plugin source, vendored SDK runtime/licenses and safe docs/artifacts; no node_modules, dist or credentials. Check secret patterns before any remote upload.
- GitHub Release immutable tag `plugin-otools-stock-v0.1.0`; verify tag points to committed build source. Never clobber an existing tag/release belonging to another commit.
- Publish complete release assets, verify public release/digests/downloaded archive against local output before market POST.
- Market PAT read only from parent local config into environment, mask marker redacted before session/log capture. Never commit/token print or GitHub-secret copy.
- Parent commit changes only `.gitmodules` and `otools/otools-stock` gitlink. Preserve unrelated dirty/staged work, use no worktree/branch. Push plugin before parent so referenced commit exists.
- No actual OTools Panel/OS-runtime visual test is claimed; existing browser unavailable limitation remains in release notes.
