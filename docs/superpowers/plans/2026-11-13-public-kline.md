# Public K-line Interface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Direct inline follow-up to the existing implementation; no delegation needed for this bounded verification/doc addition.

**Goal:** Make the real public K-line API contract explicit and validate all supported history periods instead of just counting a daily array.

**Architecture:** Keep the current Vue/Tencent provider and shared fixed-target proxy policy. Add pure opt-in smoke helpers, regression coverage and public API documentation; no runtime architecture changes.

**Tech Stack:** Existing Vue 3/TypeScript/Vitest and Node 22 scripts.

**Spec:** `docs/superpowers/specs/2026-11-13-public-kline-design.md`

## Global Constraints

- Current main; otools-stock write scope only; no branches/worktrees/commits/remote publication.
- Keep version 0.1.0, schema v1, default minute view, local holdings/alerts behavior unchanged.
- No API key/account/new runtime dependency or simulated prices.
- Verify A/HK/US day/week/month; standard tests offline, real endpoint checks opt-in.

## Review Focus

- HTTP 200 with provider error/empty history must fail the live check.
- HK unadjusted day/week/month fields remain supported and truthfully labelled.
- US venue suffix is for usfqkline history; minute remains bare ticker.
- Malformed OHLC dates/high/low must not inflate usable data counts.
- No official availability or redistribution licensing claim based merely on reachable endpoints.

### Task 1: Accurate K-line smoke and regression coverage

**Files:** Create `scripts/kline-smoke.mjs`, `tests/kline-smoke.test.mjs`; modify `scripts/smoke-market.mjs`, `tests/proxy.test.mjs`, `tests/market.test.ts`, `tests/chart.test.ts`.

**Interfaces:** `klineSmokeCases(): {label, symbol, period, path}[]` and `summarizeKline(payload,symbol,period): {field,points,first,last}`; current shared `marketTarget(path)` and `parseChart` unchanged.

- [x] Write smoke-helper tests and observe assertions fail on unimplemented helpers.
- [x] Implement matrix and usable-row validation, connect current opt-in script, add route/period/adjustment/chart-switch coverage.
- [x] Run complete offline tests, typecheck, and live smoke; require 9 real usable history responses.

### Task 2: API reference and verified deliverable

**Files:** Create `docs/PUBLIC_MARKET_API.md`; update `README.md`, `docs/VERIFICATION.md`; retain `artifacts/kline-*.txt` and refreshed `dist-pack/`.

- [x] Document direct public URLs/curl/periods/count/order, no key, qfq fallback, US venue and same-origin/host transport.
- [x] Link documentation and show where to switch daily/weekly/monthly K-lines in the UI.
- [x] Build final bundle, run production DOM + complete tests, typecheck, pack/verify and record results; no publish or visual QA claim.
