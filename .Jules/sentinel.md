## 2026-06-10 - Sentinel: ReDoS in slugify
**Vulnerability:** Regular expression `/^-+|-+$/g` contains overlapping alternating repetition which causes catastrophic backtracking on inputs with many dashes.
**Learning:** Avoid `|` in repeating regex where both sides can match the same sequence.
**Prevention:** Use two separate replacements `replace(/^-+/, "")` and `replace(/-+$/, "")` instead of a combined `|` pattern.
