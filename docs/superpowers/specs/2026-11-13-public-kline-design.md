# Public K-line interface verification

Date: 2026-11-13. Follow-up request: find a public interface that supports K-line charts. The user previously authorized direct execution of the recommended plan.

## Approach

Keep the already implemented Tencent public endpoints and native frontend charts. Alternatives: embed a third-party webpage (not an API; uncontrollable interaction/privacy) or change provider (unnecessary when all nine existing A/HK/US daily/weekly/monthly probes return usable OHLC histories). No paid service, key, account, or new runtime dependency.

Publicly reachable does not mean officially documented or licensed for redistribution. Record actual request URLs, observed payload shape, adjustment fallback and timestamp/source limitations. Use only primary endpoint responses as the wire contract; do not invent a published SLA.

## Scope

- Do not change default minute view, holdings, saved schema, alert behavior, or provider selection.
- Add public market API documentation with curl examples, symbol/venue rules, period/count/qfq parameters, OHLC order and CORS/host HTTP transport explanation.
- Expand opt-in `pnpm smoke:market` to A/HK/US day/week/month (9 histories), preserving quote/search/minute probes.
- Validate usable OHLC rows, volume, real dates and high/low consistency; do not equate HTTP 200 or array length with valid candles.
- Add offline provider route/normalization/component period-switch coverage. No network in standard unit tests.
- Run tests, typecheck, build, opt-in real endpoint checks, pack and verify; retain summary evidence. No screenshots/actual host claims.

## Constraints

Work on current main in otools-stock only; no worktree/branch, commits, push or publishing. Existing browser-unavailable limitation remains. No fallback prices. Source code and package version remain 0.1.0 (still local/unreleased).
