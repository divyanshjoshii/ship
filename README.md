# ship

A Claude Code skill for getting work onto GitHub without surprises.

Every step is shown before it happens, and nothing reaches GitHub until you say yes to that specific push.

## Why

Two things go wrong when an agent has access to your repo.

The first is that it pushes something you hadn't finished reading. The second is quieter: you and whoever you're working with both edit the same file, they cloned before your last push, and nobody finds out until the merge is already a mess.

This skill handles both. It shows you the diff before staging, names the files a collaborator has touched before you push over them, and asks separately for the commit and the push.

## What it does

When you type `/ship`, it works through seven steps:

1. Reads your remotes to work out whether you're on a shared repo or a fork
2. Fetches, and tells you if someone has pushed commits you don't have yet
3. Shows what changed, flagging anything that looks unfinished
4. Reports what your change affects, if the repo has a dependency graph built
5. Offers to redraw diagrams, but only when you actually added structure
6. Drafts a commit message in your own voice and lets you edit it
7. Asks before pushing, naming the exact remote and branch

`/ship docs` runs step 5 alone, for refreshing documentation without committing code.

## What it won't do

- Push without a yes for that specific push
- Push to `upstream` — a fork's original belongs to someone else
- Force-push or edit a workflow without a typed confirmation
- Commit a file you haven't seen listed
- Rewrite a collaborator's commits
- Open a pull request or issue unless asked
- Change repository settings

## Install

```bash
npx skills add divyanshjoshii/ship -g
```

The `-g` makes it available in every project, including ones you haven't created yet.

## Optional companions

`ship` works on its own. These make it better where they're present, and it skips them silently where they aren't:

| Tool | Adds |
|---|---|
| [code-review-graph](https://github.com/tirth8205/code-review-graph) | Step 4 — what your change actually affects |
| [archify](https://github.com/tt-a1i/archify) | Step 5 — diagram regeneration |
| [humanizer](https://github.com/blader/humanizer) | Step 6 — commit messages that read like you wrote them |

It won't prompt you to install any of these mid-commit. That's a separate decision.

## Requirements

Git, and Claude Code. `gh` is only needed if you want it to create a repository for you.

## Licence

MIT
