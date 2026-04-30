## 2025-01-20 - Adding aria-label to icon-only buttons
**Learning:** Found several components where `×` character was used as a close or dismiss button, which is inaccessible to screen readers without an explicit label.
**Action:** Always verify icon-only buttons have descriptive aria-labels (e.g. 'Close', 'Dismiss Error', 'Deactivate') when creating or modifying them.
## 2024-03-21 - Added Keyboard Accessibility to Expandable Header
**Learning:** Found a `div` used as an expandable header in `src/components/ThreatCard.tsx` without proper keyboard support.
**Action:** Add `role="button"`, `tabIndex={0}`, `onKeyDown` with Enter/Space handling, and `aria-expanded={expanded}` to make interactive divs keyboard accessible.
