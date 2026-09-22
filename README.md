# Equipment Reservation - Solution

Take-home assessment: fix reservation availability, implement Create Reservation end-to-end, and (bonus) Edit Reservation.

## Setup

Requirements: Node.js 22, pnpm.

```bash
pnpm install
pnpm db:setup   # generates Prisma client, applies schema, seeds SQLite
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). No environment variables or external services needed. Run `pnpm db:seed` anytime to reset the data back to the seed.

## Assumptions

- No auth in this app, so no logged-in user concept. `locationId` always comes from a dropdown, never inferred. No multi-tenancy either; each location's inventory is independent, scoped by `locationId` in every query.
- `DRAFT` reservations can request any quantity, even more than exists. They're placeholders, not commitments, so they never touch availability. Only `CONFIRMED` reservations get checked.
- `startAt` can't be in the past or more than a year out. Not in the PDF, added this myself so nothing books decades ahead.
- Assuming low traffic and a small catalog (few locations, a handful of equipment each). A few decisions below trade scale for simplicity because of that, and I call those out below instead of hiding them.

## Technical decisions

- **Overlap fix (Ticket 1).** Bug was `lte`/`gte` on the overlap check, so a reservation ending at 12:00 conflicted with one starting at 12:00. Changed to strict `lt`/`gt` to match `[start, end)`.
- **Atomic writes.** Availability check and the write happen inside the same `prisma.$transaction`, so they see the same snapshot. No separate check-then-write step that could go stale.
- **No N+1.** A reservation can have several equipment items. Availability for all of them resolves in 2 queries total (`equipmentId IN (...)`), not one query per item.
- **Two-layer availability check.** Client side while typing (just a preview, debounced 400ms) and server side inside the transaction before commit (the real gate). Quantity must also be a positive integer, checked with Zod on both sides.
- **Edit reuses Create.** Considered a HOC for the edit case, skipped it, it's really the same form with one optional `reservation` prop. When present: pre-fills the form, submits with `PUT`, and passes `excludeReservationId` to the availability check so editing your own reservation doesn't count against itself.
- **Live availability preview.** Equipment dropdown shows real remaining quantity for the selected dates (not just the total), so the user isn't guessing. The server still re-validates independently on submit.
- **Date/time input.** Used `@mui/x-date-pickers` free tier instead of the native `datetime-local` input, mainly for a consistent 24h format (native input's AM/PM display depends on OS locale).

## Trade-offs / incomplete work

- No success toast after create/save. Tried a Snackbar a few times, it kept fighting the MUI Dialog's focus handling. Not worth more time given what's actually being graded, so the form just redirects.
- Locations and equipment load together in one call, no caching. Fine at this scale; locations barely change and equipment could grow, so they'd split at scale.
- Equipment list in the reservations table is one comma-separated string ("2x Generator, 1x Saw"). Reads fine now, wouldn't scale visually with many items.
- Known MUI console warning: closing the date picker can trigger a benign `aria-hidden` focus warning from `Dialog`. Doesn't break anything, worth a look before real production use.
- Status chip (Draft/Confirmed) passes contrast (~5:1, above the 4.5:1 AA minimum) but relies on color plus text only, no icon.
- Accessibility was built with intent (labels, `aria-label`, `aria-live`, keyboard-operable MUI components, contrast checked) but not verified with an actual screen reader.
- API errors use a consistent `{ error, code }` shape with matching HTTP status, not a formal spec like RFC 7807. Fine here, would formalize with external consumers.
- No unit tests or CI, per the assessment's instructions (not required). Tested manually in the browser instead, covering the happy path plus edge cases: over-booking, editing without self-conflict, boundary times, invalid inputs.

## Production considerations

- **Concurrent confirmations.** Check + write in one transaction means two people racing for the last unit can't both succeed. SQLite serializes at the file level; on Postgres this would be `SELECT ... FOR UPDATE` or serializable isolation on the same rows.
- **Higher traffic.** Already indexed on `(locationId, status, startAt, endAt)` and batched to avoid N+1. If one location/period gets hot, next step is a maintained aggregate (reserved quantity per equipment per time bucket) instead of summing rows on every read.
- **Catalog at scale.** Today everything loads at once. At thousands of equipment types, locations get cached and equipment becomes a searchable, paginated `Autocomplete` loaded on demand.
