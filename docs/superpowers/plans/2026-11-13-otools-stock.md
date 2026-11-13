# OTools Stock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. User selected direct inline execution; use no implementer agents. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Build an independent panel-first OTools stock workbench with real quotes, watchlists, alerts, and private portfolio accounting.

**Architecture:** Vue/TypeScript frontend with pure typed domain modules, injected persistence/HTTP/provider boundaries, and a no-overlap refresh scheduler. Use the official SDK snapshot for existing host HTTP/storage/file capabilities; local preview has a fixed-target loopback proxy. No native binaries.

**Tech Stack:** Vue 3.5.27, TypeScript 5.9.3, Vite 6.4.1, Vitest 3.2.4, jsdom 26.1.0, OTools SDK, Node 22+, pnpm.

**Spec:** `otools-stock/docs/SPEC.md`

## Global Constraints

- `packid/uuid: otools-stock`, `version: 0.1.0`, `openMode: panel`, `devUrl: http://127.0.0.1:6552`.
- Work directly on main. No branch/worktree, auto commit/push/publish, host edits, credentials, or fake market prices.
- Local-only portfolio data. CNY/HKD/USD separated. Unknown prices stay unknown.
- 15s default refresh, 5/10/15/30/60s settings, no overlapping refresh.
- A quote alert age <=5 minutes; HK/US <=30 minutes; not future or duplicate quotes.
- Backup <=2MiB; records validated atomically. Quotes/caches clearly labelled.

## Review Focus

- Corrupt/denied storage must not reset or silently overwrite the user's trades.
- Same-day partial/full sales and edits must preserve costs, reject overselling, and include fees.
- Concurrent quote/chart/search completion must not replace a newer selection or duplicate a refresh/alert.
- GB18030, missing quote fields, stopped stocks, and foreign volume units must not become misleading zeros.
- Narrow panel, dialog focus, malicious backup strings, and CSV formula prefixes must remain usable/safe.

---

### Task 1: Typed plugin skeleton, symbols, portfolio, and snapshot validation

**Files:** `package.json`, `pnpm-workspace.yaml`, `plugin.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/domain/{types,symbols,portfolio,snapshot,format}.ts`, `tests/{symbols,portfolio,snapshot}.test.ts`, `vendor/otools-plugin-sdk/`.

**Interfaces:** Produce `Instrument`, `Quote`, `Trade`, `AppData`, `AlertRule`; `normalizeSymbol(input): string|null`; `buildPortfolio(trades,instruments,quotes): Portfolio`; `validateSnapshot(value): AppData`; `createDefaultData(): AppData`.

- [x] Write behavioral tests for bare/prefixed/foreign codes, fee-adjusted buys/sales, same-day cash flow, complete sale rounding, mixed currencies, missing prices, dates, invalid references/import limits.
- [x] Run tests and observe RED; implement the minimum pure modules; run the whole suite GREEN.
- [x] Pin toolkit and copy official SDK with provenance; no host-linked paths in package dependencies.

### Task 2: Market transport, provider, allowlisted preview proxy, and scheduler

**Files:** `src/services/{http,market,poller}.ts`, `scripts/{market-proxy,serve-dist}.mjs`, `tests/{market,http,poller,proxy}.test.ts`.

**Interfaces:** Consume domain types/symbols. Produce `MarketProvider { quotes(instruments,signal): Promise<Quote[]>; search(query,signal): Promise<Instrument[]>; chart(instrument,period,signal): Promise<ChartData> }`; `createPoller(...)`; abortable `requestText(path,signal,encoding)`.

- [x] Capture compact public-provider fixtures and write RED parsing/encoding/units/missing-data/unsupported-code tests. Never eval returned strings.
- [x] Write RED proxy allowlist and scheduler no-overlap/retry/stop tests; implement fixed URL builders, local middleware, host HTTP invocation, bounded reads, cancellation and provider normalization.
- [x] Verify real A/HK/US endpoints with a compact smoke command; document incomplete/limited histories honestly.
- [x] Run full GREEN suite.

### Task 3: Alerts, durable application state, and platform integrations

**Files:** `src/domain/alerts.ts`, `src/services/{persistence,platform}.ts`, `src/composables/useStockDesk.ts`, `tests/{alerts,persistence,desk}.test.ts`.

**Interfaces:** Consume prior tasks. Produce `createStockDesk({provider,persistence,now})`, atomic CRUD/import/export, serial persistence, computed currency portfolios, and refresh/notification logs.

- [x] Write RED tests for cooldown/rearm, stale/future/duplicate quotes, storage corruption/failure, serial latest-state saves, imported oversell, delete/edit invariants, watchlist removal preserving trades, cache status.
- [x] Implement durable state without silent fallback after storage errors; alerts run only on successfully fetched fresh quotes; no backup mutation until explicit confirmation.
- [x] Implement platform picker/download/notification paths and safe CSV export, test formula escaping.
- [x] Run full GREEN suite and typecheck.

### Task 4: Responsive panel workbench and interactive dialogs/charts

**Files:** `src/{main,App}.ts/.vue`, `src/style.css`, `src/components/{Icon,StockSearch,StockChart,StockDetail,WatchlistView,PortfolioView,AlertsView,SettingsView,BaseDialog,TradeDialog,AlertDialog}.vue`, `tests/{chart,app}.test.ts`.

**Interfaces:** Consume desk instance; child UI emits typed CRUD actions. Produce working wide/narrow panel pages with real-data/unknown-data/error states and fully functional forms.

- [x] Write RED rendering and interaction tests for navigation/add stock/trade validation/alerts/settings/dialog focus/stale responses, then implement components.
- [x] SVG minute/candle+volume charts with MA5/10/20, hover details, time labels; plot real data only and cancel stale requests.
- [x] Provide Chinese copy, dark/light theme, red/green convention, sortable grouped watchlist, per-currency holdings/ledger, alert log, validated import confirmation.
- [x] Run full GREEN suite, typecheck and production build.

### Task 5: Independent packaging, real-browser verification, and delivery docs

**Files:** `scripts/{build-web,pack-plugin,verify-plugin,publish-market}.mjs`, `tests/packaging.test.mjs`, `README.md`, `logo.svg`, `.gitignore`, `docs/VERIFICATION.md`, `artifacts/`.

**Interfaces:** Consume production `dist/` and manifest. Produce sanitized `dist-pack/otools-stock-0.1.0.oplg`, metadata and SHA256SUMS.

- [x] Write packaging RED tests for panel mode, source/production manifest agreement and development-only flag removal; adapt existing local packaging scripts.
- [x] Run full tests, typecheck, build, pack and verify; inspect output includes entry/assets/logo with valid CRC/SHA256 and no devUrl/native binaries.
- [ ] Test real app in available Browser at loopback 6552; inspect wide/narrow layout and core user flows, retain screenshots. **Blocked: official Browser runtime has no connected browsers; recorded in docs/VERIFICATION.md. Production DOM + real endpoint checks passed, not visual QA.**
- [x] If skill-authorized reviewer is available, request one bounded read-only final review in parallel with final browser/build verification; integrate important findings using regression tests.
- [x] Document remaining data-source/runtime limitations; report artifact location without claiming remote publication or host installation.
