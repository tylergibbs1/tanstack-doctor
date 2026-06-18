# TanStack Doctor

A deterministic CLI scanner that audits a **TanStack Start** codebase against full-stack best practices — server functions, SSR/hydration, authentication, environment handling, and server/client file separation.

Think [`react-doctor`](https://github.com/millionco/react-doctor), but for the rules in the `tanstack-start-best-practices` skill. Zero runtime dependencies — runs on plain Node ≥18.

## Usage

```bash
# scan a folder (defaults to current dir)
node bin/cli.mjs src

# fail CI if anything HIGH or worse is found
node bin/cli.mjs . --fail-on HIGH

# machine-readable output for agents / CI
node bin/cli.mjs . --json > report.json

# run / skip specific rules
node bin/cli.mjs app --only sf-input-validation,env-secret-exposure
node bin/cli.mjs app --disable sf-prefer-server-fn

# see the catalog
node bin/cli.mjs --list-rules
```

Try it against the bundled fixtures:

```bash
npm run demo
```

## Options

| Flag | Description |
|------|-------------|
| `--json` | Emit JSON (summary + findings) instead of the pretty report. |
| `--fail-on <level>` | Exit code `1` if any finding is at/above `CRITICAL`\|`HIGH`\|`MEDIUM`\|`LOW`. Default: always exit `0`. |
| `--only <ids>` | Run only the comma-separated rule ids. |
| `--disable <ids>` | Skip the comma-separated rule ids. |
| `--list-rules` | Print the rule catalog and exit. |
| `-h`, `--help` | Show help. |

## Rules

| Rule | Priority | What it catches |
|------|----------|-----------------|
| `sf-input-validation` | CRITICAL | `createServerFn` that reads `data` with no `.validator()`/`.inputValidator()`. |
| `sf-weak-validator` | INFO | Passthrough validator `.validator((data) => data)` — a typed-only assertion (idiomatic in TanStack examples; advisory). |
| `sec-hardcoded-secret` | HIGH | A credential committed as a literal — Stripe/OpenAI/Anthropic/AWS/GitHub/Google/Slack keys or PEM private keys. |
| `api-input-validation` | MEDIUM | Server-route handler that writes `await request.json()` to the DB without a runtime schema check. |
| `mw-input-validation` | MEDIUM | Function middleware whose `.server()` reads `data` without a `.validator()`. |
| `env-secret-exposure` | HIGH | Non-public `process.env.SECRET` in client-reachable files; whole-`process.env` leaks. |
| `auth-token-storage` | HIGH | Auth tokens stored in `localStorage`/`sessionStorage` (XSS-readable). |
| `auth-cookie-security` | HIGH | `Set-Cookie` / `useSession()` cookies written without `HttpOnly`. |
| `file-separation` | MEDIUM | Client-reachable files importing a `*.server` module. |
| `ssr-hydration-safety` | MEDIUM | `Date.now()`, `Math.random()`, `new Date()`, `window.*`, `document.*` rendered directly in JSX. |
| `sf-method-selection` | MEDIUM | Server function that mutates data (`db.*.create/update/delete`) under the default GET method. |
| `sf-prefer-server-fn` | LOW | Manual `fetch('/api/…')` mutations instead of a server function. |
| `ssr-streaming` | INFO | Loader that `await Promise.all([...])` over 2+ queries — blocks SSR; consider streaming. |
| `ssr-prerender` | INFO | Static-looking route (`/about`, `/pricing`, …) fetching uncached data every request — consider prerender/ISR. |

`INFO` rules are heuristic advisories (a "did you consider…" nudge), not hard errors — they only fire inside route files (`createFileRoute`).

> The official docs say client code should read env via `import.meta.env.VITE_*` / `PUBLIC_*`, while `process.env` is server-only — which is exactly what `env-secret-exposure` enforces. Mutations should use POST (`sf-method-selection`), and `.validator()` should run a real runtime schema (`sf-weak-validator`).

Each rule maps to a doc in `.claude/skills/tanstack-start-best-practices/rules/<id>.md`, printed alongside every finding.

## Use in CI

Add the scanner to your TanStack Start app's pull-request checks. Copy
[`examples/github-action.yml`](examples/github-action.yml) into your repo at
`.github/workflows/tanstack-doctor.yml`:

```yaml
name: TanStack Doctor
on: pull_request
permissions:
  contents: read
  pull-requests: write          # required to post review comments
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      # 1. scan → JSON  2. post inline comments  3. fail the gate
      - run: npx --yes github:tylergibbs1/tanstack-doctor ./src --format json > findings.json || true
      - run: npx --yes --package github:tylergibbs1/tanstack-doctor tanstack-doctor-pr-review findings.json
        env: { GITHUB_TOKEN: '${{ secrets.GITHUB_TOKEN }}' }
      - run: npx --yes github:tylergibbs1/tanstack-doctor ./src --fail-on HIGH
```

Findings are posted as **inline review comments on the changed lines**, exactly
like react-doctor. The reviewer:

- comments only on lines that are part of the PR diff (GitHub rejects others);
- **reports only new findings** — it dedupes against its own prior comments via a
  hidden marker, so re-runs don't pile up duplicates;
- lists any findings outside the diff in a collapsible summary so nothing is lost.

The final step fails the PR when any `HIGH`-or-worse finding is present. Tune the
gate with `--fail-on CRITICAL|HIGH|MEDIUM|LOW`, or drop it to report without failing.
Prefer GitHub's native annotations instead of comments? Use `--format github`.

This repo's own CI (`.github/workflows/ci.yml`) runs `npm test` — a smoke suite
that asserts every rule fires on the fixtures and that clean code stays clean —
across Node 18/20/22.

## How it works

```
bin/cli.mjs          # arg parsing + orchestration + exit codes
src/walk.mjs         # recursive file discovery (skips node_modules, dist, .output, …)
src/source.mjs       # the engine: comment/string masking + line/column mapping
src/rules/*.mjs      # one self-contained rule per file
src/report.mjs       # pretty (ANSI) + JSON reporters
fixtures/            # intentionally-broken demo files
```

The core trick is in `src/source.mjs`: `maskSource()` blanks the **contents** of comments and string literals (preserving every byte offset and newline) so rules can run simple regexes without matching inside strings or comments. Template-literal `${ … }` interpolations stay visible as code, which is how the whole-`process.env` leak check works. Rules that genuinely need the string body (import specifiers, cookie values, fetch URLs) read raw source instead.

## Adding a rule

1. Create `src/rules/my-rule.mjs` exporting `{ id, title, priority, category, doc, check(file) }`.
2. `check(file)` returns an array of `{ line, column, message, fix }`.
   - `file.masked` / `file.maskedLines` — source with strings/comments blanked.
   - `file.source` / `file.lines` — raw source.
   - `file.posAt(index)` → `{ line, column }`; `file.isTsx`, `file.isServer`, `file.isClientReachable`.
3. Register it in `src/rules/index.mjs`.

## Limitations

This is a regex/heuristic scanner, not a type-aware one. It favors **precision over recall** — it would rather miss a violation than cry wolf — so it won't catch every variant (e.g. server functions assembled dynamically). For deeper analysis, pair it with `tsc`, ESLint, and the skill's rule docs.
