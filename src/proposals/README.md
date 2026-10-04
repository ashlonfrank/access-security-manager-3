# Design proposals

Parallel Figma options live under `proposal-one/` and (later) `proposal-two/`. Each folder owns an app shell (`*App.tsx`) for that option.

- **Proposal 3 (this branch):** the dev server opens the three-column split view with no query string. `?prototype=proposal-three` does the same. `?prototype=baseline` shows the original table, and `?prototype=proposal-one` shows proposal 1.
- **Prototype toggle:** `?prototype=proposal-one` (or hash `#prototype=proposal-one`) renders the matching shell. Proposal 3 uses `?prototype=proposal-three`.

Git branches `proposal-1`, `proposal-2`, and `proposal-3` track ongoing work per chat; shared domain and design tokens stay in `src/` root (`business.ts`, `styles.css`, `refinements.css`, shared components).

**Protected (ASM main only):** do not modify `App.tsx`, `CompaniesView.tsx`, `PermissionsPanel.tsx`, `ApprovalReviewModal.tsx`, or baseline layout CSS from a proposal branch except when ASM main merges a chosen design.
