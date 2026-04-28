## 2024-04-28 - Missing ARIA Labels on Icon Buttons
**Learning:** Found a systemic pattern where icon-only buttons (like `×` close buttons or emojis like `🗑` and `🔗`) lacked `aria-label`s, rendering them inaccessible to screen readers.
**Action:** Applied a script to bulk-add `aria-label` based on visual context or existing `title` tags across views and components. I will continue to enforce checking icon-only buttons for missing ARIA properties.
