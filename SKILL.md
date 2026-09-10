---
name: ship
description: Review, commit and push work with every step confirmed first. Checks for a collaborator's incoming commits before pushing so clashes surface early, works out what a change affects, refreshes diagrams when structure moves, and writes commit messages in the user's own voice. Use when the user says ship, commit, push, or asks to save work to GitHub.
argument-hint: "[docs] — omit for the full commit flow"
---

# Ship

Get work onto GitHub without surprises. Every action is shown before it happens, and nothing reaches GitHub without an explicit yes.

## The rule that overrides everything

**Never run `git push` without the user saying yes to that specific push, in this conversation, after seeing what will be pushed.**

Not implied by "ship". Not implied by an earlier yes. Not implied by the user seeming to be in a hurry. Ask every time.

`git push --force` and any change to `.github/workflows/` need more than a yes: state plainly what will be destroyed or altered, and ask the user to type the word `force` or `workflow` back. These are the two that cannot be undone from the terminal.

## Step 1 — Read the situation

Run these before saying anything:

```bash
git remote -v; git status --short --branch; git log --oneline -5
```

**Count the remotes.** This decides how pushing works:

| Remotes | Situation | Push to |
|---|---|---|
| One (`origin`) | Shared repo — the user can write to it directly | `origin` |
| Two (`origin` + `upstream`) | The user has a fork; `upstream` belongs to someone else | `origin`, **never** `upstream` |
| None | New project, no GitHub repo yet | Offer to create one — ask public or private, never assume |

With two remotes, pushing to `upstream` writes into another person's project without review. Do not do it, even if the user's token permits it. If the user asks for it directly, confirm what they are about to change and who owns it.

## Step 2 — Check for incoming work

Before anything else, find out whether someone else has pushed.

```bash
git fetch --quiet && git status --short --branch
```

If the branch is behind, **stop and say so before discussing commits**:

> Someone pushed 2 commits you don't have. One of them touched `books.js`, which you also changed.
> Want me to pull them in first?

Name the overlapping files. That is the part that predicts a painful merge, and it is why this check exists.

If the user wants to see what arrived, summarise the incoming commits. When their project has rules recorded (`CLAUDE.md`, `CONTRIBUTING.md`, `docs/standards.md`), it is fair to note where incoming work departs from them — a new dependency, a missing test. **Report it, never fix it.** Someone else's commits are theirs.

## Step 3 — Decide what goes in

Show what changed, grouped so it can be read at a glance: file, and what it appears to do.

Flag anything that looks unfinished — debug prints, commented-out blocks, a `.env`, a key, anything in a temp or scratch folder — and offer to leave it out. Then ask what to include.

Never stage a file the user has not seen listed.

## Step 4 — What does this change affect?

Only when `code-review-graph` is installed in this repository (`.code-review-graph/` exists):

```bash
code-review-graph impact
```

Report the blast radius in one line — which other files depend on what changed, and whether anything important sits downstream. Skip in silence when the tool is absent. Never suggest installing it mid-flow; that is a separate conversation.

## Step 5 — Diagrams, only when earned

Check whether the structure actually moved: new top-level directories, a new module, a dependency added or dropped.

If it did, and the repository has a diagram in `README.md` or `docs/architecture.md`, say so and offer to redraw it with the `archify` skill:

> You added a `search/` module. The diagram in the README doesn't show it. Redraw?

**Do not offer this on an ordinary commit.** A bug fix does not change the architecture, and a prompt every time trains the user to say no without reading.

`/ship docs` runs this step alone, for when the user wants documentation refreshed without committing code.

## Step 6 — Write the message

Draft a subject line under about 60 characters, in plain past-tense language describing what changed and why. Add a body only when the reason is not obvious from the subject.

Then run it through the `humanizer` skill. This applies to the commit message, and to any pull request description, README text or documentation prose produced in this flow. It does not apply to code.

Take the voice from `docs/standards.md` when the project has one.

**Show the message and let the user edit it before anything is committed.**

## Step 7 — Commit, then ask again

Commit only what was agreed. Then, separately:

> Push to `origin/main`? yes / no

Name the remote and the branch. "Push?" alone is not enough — the user should see where it is going.

After pushing, report what landed and where, with the branch name.

## When something is missing

Degrade quietly. A missing tool is not a problem to raise.

| Missing | Do |
|---|---|
| `code-review-graph` | Skip step 4 |
| `archify` | Skip step 5 |
| `humanizer` | Write the message plainly and say so once |
| `gh` | Use plain `git`; only repository creation needs `gh` |

## What this skill never does

- Push without an explicit yes for that push
- Push to `upstream`
- Force-push without a typed confirmation
- Commit a file the user has not seen listed
- Edit, rebase or amend a collaborator's commits
- Create a pull request, issue or comment without being asked
- Change repository settings

## Delegate rather than reimplement

- Prose in the user's voice → `humanizer`
- Diagrams → `archify`
- What a change affects → `code-review-graph`
- An in-progress merge conflict → `resolving-merge-conflicts`
- A review of the code itself → `/security-review` or `/code-review`
