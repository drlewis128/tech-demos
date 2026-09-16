---
name: project-planning
description: Use when a weekday X-bookmark tech demo is approved, before writing app code, scaffolding an apps/<slug>/ directory, or creating PLAN.md for a prototype in this monorepo.
---

# Project planning

Write `apps/<kebab-slug>/PLAN.md`, then implement **only** in that directory. Planning is the work; skipping it is a failed demo.

## Sequence

1. Confirm the pick is **approved**. If it is not, stop. Do not scaffold.
2. Choose a lowercase kebab-case slug. Create `apps/<kebab-slug>/` if needed.
3. Write `apps/<kebab-slug>/PLAN.md` with every section below.
4. Implement the app in `apps/<kebab-slug>/` only. Match the plan.
5. Open **one** PR. Attach **both** at least one screenshot **and** at least one video of the running app.

Do not run `bun init`, add `package.json`, or write app source until step 3 is done on disk.

## PLAN.md

Use this shape (same headings, fill in the prose):

```markdown
# <demo title>

## Tech
What the bookmark/tech is, in one short paragraph. Link the source if you have it.

## Demo angle
The one thing a viewer should see working. Not a product; a tight prototype.

## Scope
- In: concrete surfaces and behaviors this demo will include
- Out: anything adjacent that will not ship in this PR

## Stack
Runtime (Bun), framework/libs, and why they fit this angle. Keep the list short.

## Validation
How to run: `cd apps/<kebab-slug> && bun install && bun run dev`
What “done” looks like in the UI, plus the screenshot and video that must go on the PR.
```

## Implement only there

After the plan exists:

- `cd apps/<kebab-slug> && bun install && bun run dev` must work.
- Own `package.json` with a `dev` script. No new GitHub repo. No other apps.

## Red flags — stop

- Coding or `bun init` before `PLAN.md` exists
- A new repository “just for this demo”
- PR with only a screenshot, only a video, or neither
- Files outside `apps/<kebab-slug>/` for this demo
- Multiple PRs for one pick

**All of these mean: stop, write or fix `PLAN.md`, put the demo only under `apps/<kebab-slug>/`, attach screenshot and video on one PR.**
