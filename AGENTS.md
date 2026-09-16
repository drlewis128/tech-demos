# Agent instructions

This repo is a **sticky monorepo**. Weekday X-bookmark tech demos land here as apps. Never create a new GitHub repository (or any other repo) for a demo.

## Model

Prefer **claude-fable-5** (Fable 5) for prototypes unless the owner names a different model.

## Allowed changes

Only add or update files under `apps/<kebab-slug>/` for the current demo.

- Slug: lowercase kebab-case from the pick (`apps/htmx-sse-chat/`, not `apps/HTMX SSE Chat/`).
- Do not add sibling apps, sample apps, or repo-wide tooling unless the owner asks.
- Root files (`README.md`, `AGENTS.md`, `package.json`, `skills/`, `tracking/`) are owner-owned. Leave them alone during a demo.

## Before any app code

1. Read `skills/project-planning/SKILL.md` and follow it.
2. After the pick is approved, write `apps/<kebab-slug>/PLAN.md` **before** implementing.
3. Implement only in that same `apps/<kebab-slug>/` directory.

`PLAN.md` must cover: tech, demo angle, scope, stack, validation. Do not start `bun` scaffolding until that file exists.

## App contract

Each app is self-contained. From `apps/<kebab-slug>/`:

```bash
bun install
bun run dev
```

Required:

- Its own `package.json` with a `dev` script.
- No dependency on other apps.
- Root workspaces already include `apps/*`; do not add a new workspace root.

## Pull request

Open **one** PR for the demo.

Attach **both**:

- at least one **screenshot** of the running app
- at least one **video** of the running app

A PR with only screenshots, only a video, or neither is incomplete. Do not merge or mark the work done until both are on the PR.

## Tracking

`tracking/seen-bookmarks.json` is the pick ledger (`proposed`, `built`, `skipped`). Demo agents do not edit it unless the owner says to record this pick.

## Do not

| Temptation | Instead |
|---|---|
| New repo / `gh repo create` | Add `apps/<kebab-slug>/` here |
| Code before `PLAN.md` | Write the plan, then implement |
| Extra apps or root refactors | Touch only the current app dir |
| Skip screenshot or video | Attach both on the single PR |
| Multiple PRs for one demo | One PR |
