# Access & Security Manager

React and TypeScript implementation of the [Manage User Figma frame](https://www.figma.com/design/ez8f0DFwJwbAVxi52I0H8J/Access-Management-Folio-Projects?node-id=1-69026&m=dev).

## Proposal 3 preview

On the `proposal-3` branch the dev server opens the three-column Access and Security Manager (person, company, then that company’s accounts and entitlements). Use a port other than 4321 if another proposal is already running there.

```sh
npm run dev -- --host 127.0.0.1 --port 4473 --strictPort
```

Open http://127.0.0.1:4473/. `?prototype=baseline` shows the original user table.

## Run locally

```sh
npm install
npm run dev
```

Open the URL printed by Vite (normally http://127.0.0.1:5173).

```sh
npm run build
npm run preview
```

## Implemented behavior

- Search users by name, email, role, or job.
- Filter by role, status, or pending approval.
- Open the Figma permissions panel by selecting any user. Switch users, scroll permissions and accounts, or close the panel to restore the full list.
- Edit demo user details, delete users, add users, approve requests, remove access, and request access again.
- Persist demo users in browser localStorage. Clear the `asm-demo-users-v1` storage key to restore the coffee-business demo users. Per-user permissions are saved under `asm-permissions-v1-<user-id>`.
- Opening, switching, and closing permissions preserves row and toolbar positions; row hover uses a subtle fill.
- Permissions panels start aligned with the table header below Search, then stick 32px from the viewport top as the page scrolls. The bottom margin remains 32px, and panel content scrolls independently. Table headers stick at the same top position.
- Responsive mobile layout and keyboard-accessible dialogs.

The original users, portraits, logo, icons, colors, typography, and desktop dimensions come from the selected Figma frames. The permissions view follows node `1:69181`; names, avatars, and roles reflect the selected user. The inline Edit mode changes permissions, authentication, account access, role, job title, and daily limits; Save persists changes per user and Cancel discards the draft. Read-only limits have no border. Assets and fonts are stored locally. The Companies tab follows node `1:68958`, with grouped company memberships and the same editable user permissions. The same users and portraits appear in both tabs, organized once each into four stable demo groups. The demo uses Bean & Branch Coffee with Head office, Downtown, Riverside, and Roastery groups. Six of the thirteen initial users have portraits; the others show initials, consistently across lists and panels. The default Companies table spans the full content width with Company, Name, Role, and Status columns. Permissions overlay the right side while company and user positions stay fixed. Company labels stay visible at group starts and repeat on hover or keyboard focus. Selecting a continuation row hides its repeated company label, keeps the subtle row highlight and arrow, and switches the permissions panel without moving any rows. Banking navigation and account controls provide preview information; this app has no banking backend or authentication.

## Verification

With the dev server running:

```sh
npm test
```

The Playwright script checks layout coordinates, asset loading, search, filters, empty states, user creation and approval, access removal, duplicate-email validation, persistence, dialog dismissal, and mobile overflow. It creates desktop and mobile screenshots in `verification/`.

On macOS, tests use installed Google Chrome. On other platforms, run `npx playwright install chromium` first. Set `PREVIEW_URL` to test another local port.

## Visual refinement reference

[Figma node 56:9060](https://www.figma.com/design/ez8f0DFwJwbAVxi52I0H8J/Access-Management-Folio-Projects?node-id=56-9060&m=dev) informs spacing and hierarchy while retaining the Chase layout, colors, and Open Sans. The adaptations live in `src/refinements.css`.

- Primary content: 15px text / 24px line height; supporting details: 13px / 20px; labels: 12px / 20px.
- Section padding and group separation: 24px. Related-item gaps: 8–12px.
- Filters: 32px tall with 12px horizontal padding and 8px corners. Action buttons use 8px corners.
- Roles use quiet, compact labels; status colors retain their meaning.
- Hover uses a subtle fill; selected state is stronger. Hover timing is an implementation choice because the static reference does not establish animation behavior.
- The original table and toolbar dimensions stay stable when the permissions panel opens, changes users, or closes.

The Users/Companies control adapts only the shared selection-background spring interaction from [useLayouts pricing-card](https://uselayouts.com/docs/components/pricing-card), using Motion (stiffness 300, damping 30, mass 0.8). Existing Chase styling stays in place; reduced-motion preferences disable the transition. Arrow keys, Home, and End switch tabs.

Manage sits above a compact 36px Users/Companies control with 4px inset padding and 12px outer corners. Headers use a white fill with 8px corners. On desktop, the selected row connects to the permissions panel with square right corners; the panel has rounded corners at both ends.

## Coffee-business roles

Selectable roles cover Owner, Business partner, CFO, Operations manager, Store manager, Assistant store manager, Shift supervisor, Barista, Accountant, Bookkeeper, Accounts payable, Payroll specialist, and Inventory coordinator. Role descriptions explain responsibilities; changing the role does not silently change the permission checkboxes.

The demo role catalog is informed by [SBA small-business management](https://www.sba.gov/counseling/manage-your-business/), [Starbucks coffeehouse roles](https://careers.starbucks.com/discover-opportunities/coffeehouses/), and [Intuit accounts-payable workflows](https://quickbooks.intuit.com/global/accounts-payable/). These are illustrative business roles, not official Chase access profiles.

Delete uses a Chase-styled confirmation with a blurred backdrop, and deletes that user's saved demo permissions. Verification also covers inline edits, cancel, limits, role dropdowns, MFA/tokens, shared persistence, initials, fixed panel scrolling, and delete confirmation.
