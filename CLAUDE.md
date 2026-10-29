# Tischleinplandich (Weekly Meal Planner)

German-language web app (PWA) for planning meals per week, with AI recipe import and an automatic shopping list. Public landing page at `/`, the app at `/meal-planner`.

## Stack

- Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Radix UI
- Supabase: Postgres with RLS, magic-link/OTP auth, Storage bucket `recipe-images` (files under `<user id>/`)
- TanStack Query with a localStorage persister (`src/lib/query-provider.tsx`)
- Claude API via `@anthropic-ai/sdk` for recipe import/refine (`src/lib/server/recipe-ai.ts`), Haiku with low effort, 30 requests per user per day
- Hosting: Vercel. Mails for the waitlist via Resend

## Layout

- `src/app/` routes; `src/app/api/` server routes (recipes, account deletion, waitlist)
- `src/components/meal-planner/` the app screens; `src/components/landing/` the landing page; `src/components/legal/` Impressum/Datenschutz layout
- `src/lib/` pure helpers (shopping list, scaling, prep time); `src/lib/server/` server-only code (`import "server-only"`)
- `src/lib/legal.ts` operator details for Impressum and Datenschutz
- `supabase/migrations/NNN_*.sql` numbered migrations; `src/types/database.ts` hand-written types matching them
- `.claude/skills/`: `/new-migration` (adding a migration) and `/release` (drafting "Was ist neu?" entries); `.claude/hooks/session-start.sh` installs dependencies in cloud sessions

## Commands

```bash
npm run dev        # local dev server
npm run lint       # ESLint (next/core-web-vitals)
npm run typecheck  # tsc --noEmit
npm test           # Vitest unit tests (src/**/*.test.ts)
npm run build      # production build
```

CI (`.github/workflows/ci.yml`) runs lint, typecheck, tests and build on every PR. Run all four before pushing.

## Conventions

- All UI text is German, informal ("du"). Code, comments and commit messages are English.
- Comments explain why, briefly, in full sentences; match the density of the surrounding code.
- Never edit an existing migration. Add the next number, make it idempotent (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`), schema-qualify with `public.`, enable RLS on new tables, and update `src/types/database.ts`.
- Features that need a new migration should keep working (with a hint) while the migration is missing, as the existing ones do.
- `SECURITY DEFINER` functions use `SET search_path = ''` and revoke access from `PUBLIC`/`anon` unless they are meant for it.
- Fetching user-supplied URLs on the server goes through `safeFetch` (`src/lib/server/safe-fetch.ts`), never plain `fetch`.
- Recipes loaded from the database go through `withSafeLinks` (`src/lib/safe-links.ts`) before `source_url` or `image_url` reach an `href`/`src`; other people's recipes can contain anything the API accepts.
- The service-role client (`src/lib/supabase/admin.ts`) is for server routes only and only where RLS can't express the action.
- When a change affects what data is processed or which service receives it, update `src/app/datenschutz/page.tsx` too.
- Add unit tests for new pure logic in `src/lib/`.
- User-facing changes get a `changelog` row (see README, "Was ist neu?").
