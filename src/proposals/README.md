# Design proposals

Parallel Figma options live under `proposal-one/` and (later) `proposal-two/`. Each folder owns an app shell (`*App.tsx`) for that option.

- **Baseline:** open the dev server with no query string — `main.tsx` renders `App`.
- **Prototype toggle:** `?prototype=proposal-one` (or hash `#prototype=proposal-one`) renders the matching shell without replacing `main` on the default route. Proposal 3 uses `?prototype=proposal-three`.

Git branches `proposal-1`, `proposal-2`, and `proposal-3` track ongoing work per chat; shared domain and design tokens stay in `src/` root (`business.ts`, `styles.css`, `refinements.css`, shared components).

**Protected (ASM main only):** do not modify `App.tsx`, `CompaniesView.tsx`, `PermissionsPanel.tsx`, `ApprovalReviewModal.tsx`, or baseline layout CSS from a proposal branch except when ASM main merges a chosen design.
