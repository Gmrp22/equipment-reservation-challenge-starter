# Equipment Reservation — Solution

Take-home assessment: fix reservation availability, implement Create Reservation end-to-end, and (bonus) Edit Reservation.

## Setup

Requirements: Node.js 22, pnpm.

```bash
pnpm install
pnpm db:setup   # generates Prisma client, applies schema, seeds SQLite
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). No environment variables or external services are required.

To reset the database to the original seed data at any point: `pnpm db:seed`.

## Assumptions

- No authentication exists, so there is no concept of "logged-in user." `locationId` always comes from an explicit dropdown selection, never inferred.
- A `DRAFT` reservation can request any quantity, including more than physically exists — it is a placeholder, not a commitment, so it never touches availability. Only `CONFIRMED` reservations are checked and blocked.
- A reservation's `startAt` cannot be in the past, and cannot be more than one year in the future. This isn't in the PDF; it's a sanity rule I added because nothing else prevented booking decades ahead.
- The starter app assumes low traffic and few locations/equipment types (a handful per location). Several implementation choices below trade scalability for simplicity on that basis, and are called out as such.

## Technical decisions

- **Overlap fix (Ticket 1):** the original query used `lte`/`gte` (inclusive) for the overlap check, so a reservation ending exactly when another begins was incorrectly flagged as a conflict. Changed to strict `lt`/`gt`, matching the `[start, end)` semantics the PDF specifies.
- **Atomic writes:** `createReservation`/`updateReservation` wrap validation *and* the write in one `prisma.$transaction`. Availability is re-checked with the same transaction client right before writing, so the check and the write see a consistent snapshot — no separate "check now, hope nothing changed" step.
- **Batched availability, no N+1:** a reservation can have several equipment items. Instead of querying availability once per item, `getAvailableQuantitiesByEquipment` resolves all items in 2 queries total (`equipmentId IN (...)`), regardless of how many items the reservation has.
- **Edit reuses Create, not a duplicate form:** `CreateReservationForm` takes an optional `reservation` prop. When present, it pre-fills the form, calls `PUT` instead of `POST`, and the availability check passes `excludeReservationId` so a reservation being edited doesn't conflict with itself.
- **Live availability preview:** the create/edit form calls `GET /api/availability` (debounced 400ms, cancels in-flight requests) so the equipment dropdown shows real remaining quantity for the selected dates, not just the total. The server re-validates independently on submit regardless of what the preview showed.
- **Locations fetched directly from Prisma, no API route:** the new-reservation page is a Server Component, so it calls `listLocationsWithEquipment()` directly — no need to round-trip through an API just to read data the page itself will render.
- **Date/time input:** used `@mui/x-date-pickers` (free tier, not the paid MUI X components) instead of the native `datetime-local` input, mainly to get a consistent 24h format — the native input's AM/PM-vs-24h display depends on the browser/OS locale, which was confusing during testing.

## Trade-offs / incomplete work

- **No success toast/snackbar.** I tried a Snackbar for "reservation created"/"note saved" a few times and it kept fighting the MUI Dialog focus/state — that's not worth this project's remaining time, so the form just redirects. This is the one polish item I'd revisit first with more time.
- **Equipment quantity column ("2x Generator, 1x Saw") in the list table** is a single comma-separated string. It's fine at this scale but doesn't scale well visually with many items — a small nested table or chip list would read better.
- **Locations/equipment are loaded in full on every page load.** Fine for 2 locations and a handful of equipment types each. With a large catalog, this should move to a searchable `Autocomplete` with server-side pagination instead of loading everything up front.
- **Known MUI console warning:** closing the date picker dialog can trigger a benign `aria-hidden`/focus-retention warning from MUI's `Dialog` — a known interaction between MUI and how focus is returned on close. It doesn't block functionality, but it's a real accessibility smell worth revisiting.
- **Status chip (Draft/Confirmed) relies on color plus text**, which is fine (color isn't the *only* signal), but an icon would make the distinction faster to scan and more robust for color-blind users.
- Manual testing covered the happy path and the conflict path (over-booking a confirmed reservation, editing without self-conflict) in the browser; no automated tests, per the assessment's instructions.

## Production considerations

- **Concurrent confirmations:** the availability check and the write happen inside the same `prisma.$transaction`, so two confirmations racing for the last unit of equipment can't both read "available" and both succeed. SQLite serializes writes at the file level; on Postgres, the equivalent would be `SELECT ... FOR UPDATE` on the relevant rows, or a serializable isolation level, to get the same guarantee under real concurrency.
- **Higher traffic / more data:** the availability query already uses an index on `(locationId, status, startAt, endAt)` and batches by equipment to avoid N+1. If a single location/period combination gets hot (many overlapping reservations), the next step would be a maintained aggregate (reserved quantity per equipment per time bucket) updated on write, instead of summing rows on every read — trading write complexity for O(1) reads.
- **Locations/equipment catalog at scale:** today everything loads on page render. At thousands of equipment types, that becomes a searchable, paginated `Autocomplete` backed by an API endpoint, loaded on demand as the user types.
