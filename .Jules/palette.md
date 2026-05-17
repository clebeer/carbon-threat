## 2025-01-20 - Adding aria-label to icon-only buttons
**Learning:** Found several components where `×` character was used as a close or dismiss button, which is inaccessible to screen readers without an explicit label.
**Action:** Always verify icon-only buttons have descriptive aria-labels (e.g. 'Close', 'Dismiss Error', 'Deactivate') when creating or modifying them.

## 2026-05-01 - Keyboard Accessibility on Clickable Elements
**Learning:** Interactive non-button elements (like `div` headers used for expanding/collapsing sections) require keyboard support in addition to `onClick` handlers.
**Action:** Add `role="button"`, `tabIndex={0}`, and an `onKeyDown` listener that checks for 'Enter' and 'Space' keys to trigger the same action as the click event.

## 2026-05-05 - Custom switch elements
**Learning:** Found custom switch elements implemented with divs using `onClick` but missing correct roles and keyboard support.
**Action:** When creating or fixing custom switch elements, use `role="switch"`, `aria-checked`, `tabIndex={0}`, and an `onKeyDown` listener that checks for 'Enter' and 'Space' keys.

## 2024-05-08 - [Applying Standard Tab and Expand/Collapse Accessibility to Custom Components]
**Learning:** Many interactive flex-based components in the project, such as `ThreatCard.tsx`, visually act like standard UI patterns (collapsible accordions and tabbed interfaces) but lack the necessary HTML elements and ARIA attributes for screen readers and keyboard users to interpret their states effectively.
**Action:** When implementing or modifying custom visual accordion groups and tab groups, always pair `aria-expanded` and `aria-controls` for expand/collapse states (and hide decorative carets with `aria-hidden="true"`), and utilize the standard ARIA tablist pattern (`role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`, `role="tabpanel"`, `aria-labelledby`) to ensure standard accessibility compliance across the application.
## 2026-05-17 - [Improving semantic button-based radio groups]
**Learning:** When building custom single-select button grids that function as selectors, standard `<button>` tags without specific roles are ambiguous to screen readers. Adding `role="radiogroup"` to the container and `role="radio"` along with `aria-checked` to the buttons creates a much more accessible and semantic experience.
**Action:** Always verify custom selector grids have proper `radiogroup` and `radio` ARIA roles instead of just relying on visual active states.
