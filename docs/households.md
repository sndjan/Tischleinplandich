# Households

Design notes for planning together. Decisions agreed with the owner before
implementation; the code follows them.

## Model

- Every user has exactly one **personal household** (`households.personal_for`).
  It can never be shared, joined or left. Using the app alone means using it.
- Planning together happens in **shared households**, created separately and
  joined only through an invite link. Never listed or searchable anywhere.
- A user is in their personal household plus at most **2 shared** ones; a
  household has at most **10 members**.
- The **active household** is stored per account (`users.active_household_id`)
  and switched in the profile. Null or unknown falls back to the personal one.
- When a shared household is active, its name shows in the planner header so
  nobody plans into the wrong week by accident.
- A new shared household starts with an empty plan.

## Roles

- `owner` (the creator) and `member`, nothing else.
- Everyone edits the plan and (PR 2) the shopping list and pantry staples.
- Everyone can invite. Only the owner renames, removes members and deletes the
  household. Anyone but the owner of a personal household can leave.
- When the owner leaves or deletes their account, the longest-standing member
  becomes owner. A household without members is deleted.

## Recipes

- Libraries stay personal. In a shared household every member's recipes are
  visible to the others (the "Haushalt" tab), read-only and without the owner's
  star rating or the private import text (`recipe_sources`).
- A member's recipe is planned directly as their recipe, not copied. Editing,
  AI refine and sharing need a copy in your own library first ("Kopie speichern").
- When a recipe stops being available to a plan (its owner deletes it, leaves
  the household or deletes their account), its planned meals turn into meals
  without a recipe that keep the name and calories per portion. This applies to
  the personal household too, so deleting a recipe no longer empties past weeks.
- The "Haushalt" tab shows the user's own recipes together with the other
  members', so search and filters work across all of them, with chips to show
  only one person's. Under "Alle", copies with the same name and ingredients
  show once (the user's own, else the original). It is hidden while the
  personal household is active.

## Plan

- Shared per household and week, updated live (Supabase Realtime).
- Meals stay anonymous (no "added by").
- A shared household has a number of people (`default_servings`, null = the
  member count); new meals use it. Nutrition targets stay personal, and in a
  shared household the day summary counts one portion of each meal per person.

## Invites

- One link per household (`/einladen/<token>`), reusable, valid 7 days, with a
  reset that invalidates the old link. Joining needs no approval.
- Visitors without an account sign in first and come back to the link.
- Joining needs a display name; members only see each other's display names.

## No notifications

Nothing is pushed or mailed. Someone whose household was deleted, or who was
removed, lands back in their personal household and sees a short note the next
time they open the app.

## Shopping list (PR 2)

- Stored per household: marks per week (`shopping_marks`: checked, removed,
  excluded recipe), items (`shopping_items`: own items without a week, recipe
  extras per week) and the settings on `households`. Rows are only inserted
  and deleted, so concurrent changes resolve as last write wins per item.
- Realtime delete events reach every subscriber with only the primary key, so
  the tables use surrogate ids: item names never leave the household that way.
- Changes go through an outbox in the browser (`use-shopping-store.ts`): shown
  at once, sent in order, retried when back online. Errors the database answers
  with (e.g. a limit) drop that change with a note.
- A shared list never forgets checks of rows it doesn't show: another member's
  view may still be loading them.
- Each browser imports its old localStorage list once into the personal
  household (recent four weeks).
- Pantry staples belong to a household; a new shared household copies the
  creator's staples and list settings.

## Rollout

1. **PR 1:** households, membership, invites, active household, shared plan with
   Realtime, member recipes and the "Haushalt" tab, the recipe-to-label trigger.
2. **PR 2:** shopping list (checks, own items, removed items, excluded recipes,
   extras, hide basics, aisle order) and pantry staples move into the database
   per household, with Realtime, offline retries and a one-time import of each
   device's localStorage list into the personal household. A new shared
   household copies the creator's pantry staples.
