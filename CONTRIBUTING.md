# Contributing

## Philosophy: precision over recall

tanstack-doctor is a **precision-first** scanner. It would rather miss a real
issue than flag a false positive, because a linter that cries wolf gets muted.
Every rule has been hardened against **~50 real TanStack Start repos** (the
TanStack showcase, popular starters, and production apps). New rules must clear
the same bar: scan the corpus and confirm zero false positives before shipping.

## Invariants learned from real repos

These are mistakes the scanner made on real code and must never make again. Each
has a regression guard in `test/clean/` or `fixtures/`.

1. **Bound every forward search.** Regexes that scan "the rest of the file" mis-
   attribute a later construct's tokens. Anchor param parses to the current
   handler (`^\.handler\(`), and paren-match handler bodies. (rebar, petit-meme)

2. **Tolerate TypeScript.** Handler signatures have return-type annotations:
   `({ context }): Promise<X> =>`. Param parsing must look past them. JSX
   detection must not treat generics (`useState<string[]>`) as tags. (rebar, rybbit)

3. **`process.env.SECRET` in client code is `undefined` in Vite — not a leak.**
   The real leak is a *public-prefixed* secret (`VITE_*_SECRET`), which Vite
   inlines into the bundle. Flag that, not bare `process.env`. (start-zero-auth,
   the whole env redesign; true positive caught: vibe-any-tanstack's
   `NEXT_PUBLIC_OPENAI_API_KEY`)

4. **The leak risk lives in components, not modules.** A `.ts` module reading a
   secret or importing `.server` is server-to-server. Only `.tsx`/`.jsx`
   components ship to the browser. Scope `env-secret-exposure` and
   `file-separation` to components. (rebar's 15 api-route imports)

5. **Know the server-only conventions.** `convex/`, `drizzle/`, `prisma/`,
   `db/`, `server/`, `*.server.ts` never reach the client. Next.js App Router
   `page.tsx`/`layout.tsx` (no `"use client"`) are Server Components. (lawn,
   usefeatul)

6. **Don't over-match on broad words.** `"session"`/`"auth"` match analytics
   sessions and UI state that legitimately live in web storage. Key on high-
   confidence credential terms (`token`/`jwt`/`secret`/`apikey`). (Databuddy)

7. **Event handlers and template interpolations aren't render.**
   `onClick={() => window...}` and `` `${Date.now()}` `` are not hydration
   risks. The copyright `{new Date().getFullYear()}` is stable. (tanstarter,
   rybbit, cleanplate)

8. **Test code is out of scope.** `*.test.*`, `*.spec.*`, and
   `__tests__/__mocks__/__fixtures__/e2e/cypress` dirs do things app code
   shouldn't. Skip them. (openpolicy, Databuddy)

## Adding a rule

1. Create `src/rules/<id>.mjs` exporting `{ id, title, priority, category, doc, check(file) }`.
2. `check(file)` returns `[{ line, column, message, fix }]`.
   - `file.masked` / `file.maskedLines` — strings/comments blanked (for code tokens).
   - `file.source` / `file.lines` — raw (for string literals: imports, cookies, URLs).
   - `file.posAt(index)`, `file.isTsx`, `file.isServer`, `file.isClientReachable`.
3. Register in `src/rules/index.mjs`.
4. Add a positive fixture (`fixtures/`) **and** a negative guard (`test/clean/`).
5. Run `npm test`, then scan the real-repo corpus and confirm no new false positives.
