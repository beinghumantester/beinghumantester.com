# Diagnosing health-scan findings — beinghumantester.com

This skill applies whenever you're investigating a finding from an
automated health-scan Issue (label: `health-scan`) on this repo. It
exists because every rule below was learned the hard way, on a real
bug, in a real session — not derived from general best practice.

## 1. Trace the real render/import chain. Never guess a file from its name alone.

A finding's fix is not always where it "sounds like" it should be.

**What happened when this rule was skipped:** a missing `<main>` landmark
was assumed to belong in one of the layout files (`BaseLayout.astro` or
`BaseListing.astro`) because those are the obvious, top-level candidates.
The real bug was one level deeper, in a **component** those layouts
render (`RightMain.astro`), which used a plain `<div>` where `<main>`
should have been. Guessing by folder name (`layouts/` vs `components/`)
would have missed it entirely.

**Do this instead:** start from the actual page file, follow every
`import` it makes, and keep going until you reach the literal HTML/JSX
that renders the affected element. Don't stop at the first plausible
file — confirm it by reading the code, not by the filename.

## 2. If a violation repeats identically across multiple pages, look for ONE shared cause before proposing multiple fixes.

**What happened when this rule was followed correctly:** the same two
violations (`landmark-one-main`, `region`) appeared on 5 different
pages, with identical descriptions each time. That pattern meant one
shared component was responsible for all 5 — not five separate bugs.
Confirming this saved proposing (and someone reviewing) 5 near-identical
fixes instead of 1.

**Do this instead:** before writing a fix, check whether every affected
page shares a common layout/component. If they do, verify the fix
target is that shared file, not each page individually.

## 3. Never trust a plausible-sounding root cause without checking it against the actual data first.

**What happened when this rule was skipped:** a color-contrast violation
was initially assumed to come from `.pagination-inactive` (a CSS class
with visibly low opacity). This was wrong, and provably so: the
violation's own node count (17, 24, 15 on different pages) could never
be produced by a once-per-page pagination control. The real cause
(`.tag`, rendered once per tag per listing card) was only found by
actually checking the numbers against the hypothesis — something that
should have been done *before* proposing the fix, not after it failed.

**Do this instead:** if a scan result includes `computed_data` (fgColor,
bgColor, contrastRatio) or `nodes_affected` counts, use them to check
your hypothesis before proposing a fix. A theory that doesn't match the
actual numbers is wrong, no matter how plausible it sounds.

## 4. For any color/contrast claim, compute the real WCAG ratio. Don't eyeball it.

A "the accent color looks fine to me" judgment is not evidence. WCAG AA
requires ≥4.5:1 for normal text. If a fix changes a color, calculate the
new ratio against the actual background before proposing it — don't
guess whether a change is "probably enough."

## 5. State what you actually checked, and your confidence, in every proposal.

A proposal should say which files were read, what the violation's own
computed data showed, and whether the fix was verified (e.g. contrast
ratio recalculated, or checked against sibling files for conflicts) —
not just "here's a fix, seems right."

## 6. The context bundler's file suggestions are a starting point, not a diagnosis.

`likely_relevant_files` in a health-scan Issue comes from a plain CSS-
selector text search — it has no understanding of the actual render
tree. It correctly found the right file for the color-contrast case
above, but it cannot confirm causation, and it won't catch a bug that
doesn't literally contain the selector text (e.g. a shared component
with no visible CSS reference to the failing element). Treat its
suggestions as "check here first," not "this is confirmed the cause."