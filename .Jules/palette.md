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

## 2026-05-20 - [Native Radio Inputs Inside Custom Labels]
**Learning:** When building custom radio selectors that wrap a native `<input type="radio">` inside a `<label>`, adding custom ARIA roles (`role="radio"`) and keyboard event handlers to the label is an accessibility anti-pattern. The correct approach is to remove `readOnly` attributes, group inputs with a `name` attribute, and rely on native browser behavior (e.g., arrow key navigation) by binding the state update to the input's `onChange` event.
**Action:** Use native `<input type="radio" name="groupName" onChange={...}>` within labels instead of trying to reinvent radio group keyboard interactions with custom `div` groups and `onClick` events.

## 2024-05-16 - Tooltips on disabled buttons
**Learning:** Found several disabled buttons where the reason for being disabled was not visually clear to the user (e.g. Export buttons without threats).
**Action:** When creating or modifying conditionally disabled buttons, consider adding a native `title` attribute or a tooltip to explain the disabled state (e.g., "No threats to export"). This improves context and reduces user friction.
## 2024-05-20 - [Tooltip Context on Disabled Buttons]
**Learning:** Buttons disabled because they lack prerequisites often cause confusion if not explained.
**Action:** Always add a descriptive `title` attribute to disabled buttons indicating what actions are needed to enable them.
## 2024-11-20 - Add confirmation for removing integrations
**Learning:** Found that a destructive action (removing an integration) in `SettingsView.tsx` lacked a confirmation prompt, while other similar actions in the app used `window.confirm`.
**Action:** When auditing views for UX consistency, verify that all buttons with destructive consequences (like "Delete" or "Remove") are protected by a confirmation dialog (e.g., `window.confirm`) to prevent accidental data loss.
