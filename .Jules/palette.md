## 2025-01-20 - Adding aria-label to icon-only buttons
**Learning:** Found several components where `×` character was used as a close or dismiss button, which is inaccessible to screen readers without an explicit label.
**Action:** Always verify icon-only buttons have descriptive aria-labels (e.g. 'Close', 'Dismiss Error', 'Deactivate') when creating or modifying them.

## 2026-05-01 - Keyboard Accessibility on Clickable Elements
**Learning:** Interactive non-button elements (like `div` headers used for expanding/collapsing sections) require keyboard support in addition to `onClick` handlers.
**Action:** Add `role="button"`, `tabIndex={0}`, and an `onKeyDown` listener that checks for 'Enter' and 'Space' keys to trigger the same action as the click event.

## 2026-05-05 - Custom switch elements
**Learning:** Found custom switch elements implemented with divs using `onClick` but missing correct roles and keyboard support.
**Action:** When creating or fixing custom switch elements, use `role="switch"`, `aria-checked`, `tabIndex={0}`, and an `onKeyDown` listener that checks for 'Enter' and 'Space' keys.

## 2026-05-19 - Adding aria-label to user-management list buttons
**Learning:** Discovered an icon-only button ('×') for deactivating a user that was missing an `aria-label`, reducing accessibility.
**Action:** Remember to explicitly add `aria-label` alongside `title` on icon-only action buttons.
