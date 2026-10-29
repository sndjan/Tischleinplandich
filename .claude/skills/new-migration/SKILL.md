---
name: new-migration
description: Add a Supabase migration to this repo the way the existing ones are written. Use whenever a change needs a new table, column, policy, function, trigger, index or storage setting, or when the user runs /new-migration.
argument-hint: "<what the migration should do>"
---

# New migration

Migrations are plain SQL files that the owner runs by hand in the Supabase SQL editor, in order. Production may run any of them late, so each must be safe to run twice and the app must cope while it is missing.

## 1. Pick the file

- List `supabase/migrations/` and take the next number: `NNN_short_snake_case.sql`, three digits, one above the highest existing file (after `019_…` comes `020_…`).
- Never edit an existing migration, not even a typo. Fix it in the new one.

## 2. Write the SQL

Start with one or two comment lines saying why the change exists, like the existing files. Then:

- Schema-qualify everything with `public.` (or `storage.` for buckets).
- Make every statement idempotent:
  - `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`
  - `DROP POLICY IF EXISTS` before each `CREATE POLICY`
  - `DROP CONSTRAINT IF EXISTS` before each `ADD CONSTRAINT`
  - `DROP TRIGGER IF EXISTS` before each `CREATE TRIGGER`
  - `CREATE OR REPLACE FUNCTION`
- New tables: `ALTER TABLE public.<t> ENABLE ROW LEVEL SECURITY;` and only the policies that are needed. When a table deliberately has no policy for an action (e.g. only the service role reads it), say so in a comment, as in `009_create_feedback.sql`.
- Policies use `TO authenticated` and `auth.uid()`; check ownership in `WITH CHECK` as well as `USING`.
- `SECURITY DEFINER` functions: `SET search_path = ''`, fully qualified names inside the body, and `REVOKE ALL ON FUNCTION … FROM PUBLIC, anon` (add `authenticated` too unless users call it directly). See `016_limit_user_content.sql`.
- New CHECK constraints on existing tables: clean up or keep old rows readable (`NOT VALID`) so the migration does not fail on production data.
- Foreign keys to `public.users(id)` choose `ON DELETE CASCADE` or `SET NULL` on purpose; account deletion (`src/app/api/account/route.ts`) relies on it.

## 3. Update the types

Edit `src/types/database.ts` by hand to match: `Row`, `Insert` and `Update` for tables, `Functions` for RPCs. Mark new fields with a short comment naming the migration, e.g. `// Own 1–5 star rating, null when not rated. Migration 012.`

## 4. Keep the app working without it

Until the owner runs the SQL, the new column, table or function does not exist. Code that uses it must fall back:

- A failed read returns an empty result or hides the feature (see `whats-new-screen.tsx`: `// Until migration 013 runs there is simply nothing new to show.`).
- A user action that needs it shows a German hint instead of an error, e.g. `„Teilen braucht noch ein kleines Datenbank-Update (supabase/migrations/011_recipe_sharing.sql).“` or `toast("… nach dem Datenbank-Update (Migration 011).")`.
- Missing functions surface as PostgREST `PGRST202` or Postgres `42883` (see `discover-recipes.tsx`, which also doesn't retry them), missing columns as `42703` (`isMissingColumnError` in `src/hooks/use-planner-data.ts`).

## 5. Document and check

- If the feature needs a setup step, add a short German section to `README.md` that names the migration file.
- If it changes what personal data is stored or who receives it, update `src/app/datenschutz/page.tsx`.
- If users will notice the change, add a `changelog` row (`/release` drafts it).
- Run `npm run lint`, `npm run typecheck`, `npm test` and `npm run build`.
- In the summary, tell the user to run the new file in the Supabase SQL editor and name it.
