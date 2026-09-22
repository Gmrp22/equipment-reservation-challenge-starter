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
- The app assumes low traffic and a small catalog (few locations, a handful of equipment types each). Several decisions below trade scalability for simplicity on that basis, and are called out explicitly rather than silently assumed.

## Technical decisions

- **Overlap fix (Ticket 1):** the original query used `lte`/`gte` (inclusive) for the overlap check, so a reservation ending exactly when another begins was incorrectly flagged as a conflict. Changed to strict `lt`/`gt`, matching the `[start, end)` semantics the PDF specifies.
- **Atomic writes:** `createReservation`/`updateReservation` wrap validation *and* the write in one `prisma.$transaction`. Availability is re-checked with the same transaction client right before writing, so the check and the write see a consistent snapshot — no separate "check now, hope nothing changed" step.
- **Availability is checked in two places, on purpose:** once client-side while the user is filling the form (a live preview, not authoritative), and once server-side inside the transaction right before commit (the real gate). The client check exists purely for UX; the server never trusts it.
- **Batched availability, no N+1:** a reservation can have several equipment items. Instead of querying availability once per item, `getAvailableQuantitiesByEquipment` resolves all items in 2 queries total (`equipmentId IN (...)`), regardless of how many items the reservation has. This applies to both the live preview and the server-side check.
- **Edit reuses Create, not a duplicate form or a HOC:** considered wrapping the form in a higher-order component for the edit case; rejected it as unnecessary indirection for what's really "the same component, one optional prop." `CreateReservationForm` takes an optional `reservation` prop — when present, it pre-fills the form, calls `PUT` instead of `POST`, and the availability check passes `excludeReservationId` so a reservation being edited doesn't conflict with itself.
- **Live availability preview shows a real number, not just "disabled":** an earlier version just disabled equipment with no capacity left, but gave no reason why — confusing on its own. The dropdown now shows the actual remaining quantity for the selected dates (e.g. "Generator (2 available)"), debounced 400ms with in-flight requests cancelled, so it doesn't fire on every keystroke.
- **Locations fetched directly from Prisma, no API route:** the new-reservation page is a Server Component, so it calls `listLocationsWithEquipment()` directly — no need to round-trip through an API just to read data the page itself will render. Locations and equipment are fetched together for simplicity; see Trade-offs for why that's a shortcut, not the ideal split.
- **Date/time input:** used `@mui/x-date-pickers` (free tier, not the paid MUI X components) instead of the native `datetime-local` input, mainly to get a consistent 24h format — the native input's AM/PM-vs-24h display depends on the browser/OS locale, which was confusing during testing.
- **Server files kept to one-per-concern, not over-split:** `reservation-mutations.ts` holds `createReservation`, `updateReservation`, and their shared validation together, rather than three separate files. For this project's size, three tiny files added navigation overhead without a real benefit — the line was judgment, not a hard rule.

## Trade-offs / incomplete work

- **No success toast/snackbar.** Tried a Snackbar for "reservation created"/"note saved" a few times and it kept fighting the MUI Dialog's focus/state. Not worth more time against this project's actual grading criteria, so the form just redirects after submit. The one UX gap this leaves: submission is fast enough that the redirect can feel abrupt, with no visible confirmation that anything happened.
- **API errors aren't a formal standard.** Error responses are `{ error, code }` with a matching HTTP status, which is consistent across endpoints but isn't a spec like RFC 7807 (Problem Details). Fine at this scope; would standardize if the API surface grew or had external consumers.
- **Locations and equipment are fetched together, not cached separately.** Locations change rarely and could reasonably be cached; equipment can be larger and more dynamic. Fetching both in one call is a simplification that holds at this scale (2 locations, few equipment types) but isn't the ideal long-term split — see Production considerations.
- **Equipment quantity column ("2x Generator, 1x Saw") in the list table** is a single comma-separated string. Fine at this scale, doesn't scale well visually with many items — a small nested table or chip list would read better.
- **Known MUI console warning:** closing the date picker dialog can trigger a benign `aria-hidden`/focus-retention warning from MUI's `Dialog` — a known interaction between MUI and how focus is returned on close. Doesn't block functionality, but it's a real accessibility smell worth revisiting given the note below.
- **Status chip (Draft/Confirmed) relies on color plus text**, which passes WCAG contrast (verified: ~5:1 for the confirmed chip, well above the 4.5:1 AA minimum), but an icon would make the distinction faster to scan and more robust for color-blind users.
- **Accessibility was reasoned through (labels, `aria-label`, `aria-live`, keyboard-operable MUI components, contrast checked), but not verified end-to-end with an actual screen reader** (VoiceOver/NVDA). That's the honest gap between "should work by convention" and "confirmed working."
- Manual testing covered the happy path and the conflict path (over-booking a confirmed reservation, editing without self-conflict) in the browser; no automated tests, per the assessment's instructions.

## Production considerations

- **Concurrent confirmations:** the availability check and the write happen inside the same `prisma.$transaction`, so two confirmations racing for the last unit of equipment can't both read "available" and both succeed. SQLite serializes writes at the file level; on Postgres, the equivalent would be `SELECT ... FOR UPDATE` on the relevant rows, or a serializable isolation level, to get the same guarantee under real concurrency.
- **Higher traffic / more data:** the availability query already uses an index on `(locationId, status, startAt, endAt)` and batches by equipment to avoid N+1. If a single location/period combination gets hot (many overlapping reservations), the next step would be a maintained aggregate (reserved quantity per equipment per time bucket) updated on write, instead of summing rows on every read — trading write complexity for O(1) reads.
- **Locations/equipment catalog at scale:** today everything loads in one call on page render. With a large catalog this splits into two things: locations cached (they rarely change), and equipment loaded on demand per location via a searchable, paginated `Autocomplete` backed by an API endpoint — not the whole catalog fetched up front.
