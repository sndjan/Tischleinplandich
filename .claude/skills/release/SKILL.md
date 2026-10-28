---
name: release
description: Draft the "Was ist neu?" entries (rows in the Supabase `changelog` table) for everything users would notice since the last release. Use when the user runs /release or asks what to put in the changelog.
argument-hint: "[since: tag, date or commit]"
---

# Release notes for "Was ist neu?"

The app shows the `changelog` table in Profil → „Was ist neu?“ (migration `013_create_changelog.sql`). Users have no write access, so rows are added in the Supabase SQL editor, or through the Supabase connector when it is authorized. This skill drafts them; the owner decides.

## 1. Find what changed

- Starting point: the argument if given, else the newest `v*` tag (`git describe --tags --abbrev=0 --match 'v*'`), else ask the user for a date.
- `git fetch origin main`, then `git log --first-parent --format='%h %ad %s' --date=short <start>..origin/main`.
- Open the PRs behind those merges (GitHub tools) to see what each one actually changed for users.
- If the Supabase connector is available, read the latest rows first (`SELECT released_on, title FROM public.changelog ORDER BY released_on DESC, created_at DESC LIMIT 20`) so nothing is announced twice.

## 2. Keep only what users notice

Leave out dependency bumps, CI, refactors, tests, docs and internal tooling. Security fixes go in only when users see a difference (e.g. a new limit or an error message). Several PRs about one feature become one entry.

## 3. Write the entries

German, informal ("du"), written for people who cook, not for developers:

- `title`: short, says what you can do now, at most about 6 words. „Rezepte bewerten“, not „Rating-Feature implementiert“.
- `description`: one sentence on what changed and where to find it. „Tippe in der Rezeptansicht auf die Sterne; die Rezeptliste sortiert jetzt auch nach Bewertung.“
- No technical terms (Migration, API, Bug), no PR numbers, no emojis.
- If an entry depends on a migration the owner has not run yet, say so to the owner (not in the entry).

## 4. Hand it over

Show the entries as one SQL block, newest feature first, ready for the Supabase SQL editor:

```sql
INSERT INTO public.changelog (title, description) VALUES
  ('Kurzer Titel', 'Ein Satz, was sich ändert.'),
  ('Noch ein Titel', 'Ein Satz, was sich ändert.');
```

`released_on` defaults to today; set it only when back-dating. Insert the rows yourself only when the user explicitly says so and the Supabase connector is available; they appear for every user right away.
