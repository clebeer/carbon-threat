## 2025-01-20 - Adding aria-label to icon-only buttons
**Learning:** Found several components where `×` character was used as a close or dismiss button, which is inaccessible to screen readers without an explicit label.
**Action:** Always verify icon-only buttons have descriptive aria-labels (e.g. 'Close', 'Dismiss Error', 'Deactivate') when creating or modifying them.
