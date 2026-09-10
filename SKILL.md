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

Runs whenever code-review-graph is on the machine. **Do not ask the user whether to use it.**

**Resolve the command first. Do not assume it is on PATH** — a `pip install --user` on Windows puts it in a scripts directory that usually is not:

```bash
CRG="code-review-graph"; command -v code-review-graph >/dev/null 2>&1 || CRG="python -m code_review_graph"
$CRG --version >/dev/null 2>&1 || CRG=""
```

An empty `$CRG` means it is genuinely absent: skip step 4 in silence. Never conclude it is missing from a bare `command -v` failure.

**First, check the repository has source code to graph.** It parses code, not prose, so a docs-only or config-only repository produces an empty graph and the whole step is wasted:

```bash
git ls-files | grep -cE '\.(ts|tsx|js|jsx|py|go|rs|java|kt|rb|php|cs|c|h|cpp|swift)$'
```

A count of zero means skip step 4 entirely and do not build.

**If `.code-review-graph/` is missing, build it now.** Say what you are doing, then run it. Once per repository.

```bash
$CRG install --platform claude-code --no-hooks --no-skills --no-instructions -y
$CRG build
```

**Then gitignore what it wrote.** `install` adds `.code-review-graph/` on its own but leaves `.mcp.json`, which holds absolute paths to this machine and must never be committed:

```bash
grep -qxF '.mcp.json' .gitignore 2>/dev/null || echo '.mcp.json' >> .gitignore
```

If the build reports zero nodes anyway, say so once, skip the impact call, and do not rebuild on later runs.

`--no-instructions` matters: without it the tool writes into `CLAUDE.md`, which belongs to the project's own rules. `--no-skills` keeps it from adding to the skill listing.

Skip the build and say so when the repository is very large (roughly 3000+ source files) or the user is mid-task and waiting; offer to build it later instead. A first build on a big repository is slow, and stalling a commit for it is worse than going without.

Then, every run:

```bash
$CRG update --brief
$CRG impact
```

`update --brief` re-parses only what changed, so the graph reflects this commit rather than the state at build time.

`impact` returns verbose JSON, one object per edge. **Summarise it; never paste it into the conversation.** Dumping the raw output floods the context the tool exists to protect.

Report the blast radius in one line: how many nodes are impacted, which other files depend on what changed, and whether anything important sits downstream.

If the command is genuinely absent, skip in silence and do not suggest installing it mid-flow.

## Step 5 — Diagrams, only when earned

**Decide this yourself. Do not ask the user whether a diagram is needed.**

A diagram is needed when any one of these is true:

- A new top-level directory appeared, or one was removed or renamed
- A new module, package or entry point was added
- A dependency was added or dropped
- Step 4 reported a change reaching across three or more modules
- A diagram already exists in `README.md` or `docs/architecture.md` and no longer matches what is there

It is not needed for a bug fix, a documentation edit, a config tweak, a dependency version bump, or a change confined to one file. Most commits are in this group, so most runs skip this step.

When step 4 built a graph, use it to answer the question rather than guessing:

```bash
$CRG architecture
```

**When a diagram is needed, generate it rather than asking whether to.** Show the result before it is committed. Two cases:

- The repository already has a diagram in `README.md` or `docs/architecture.md`. Redraw it so it matches reality.
- It has no diagram at all and structure moved. Create one and put it in the README.

Do not run this on an ordinary commit. A bug fix does not change the architecture, and generating a diagram every time is slow and trains the user to ignore it.

**Pick the right tool for the picture.** A small flow diagram inside a README is usually a mermaid block: GitHub renders mermaid natively, so nobody needs anything installed to see it. Invoke the `archify` skill when the diagram is a real architecture, dataflow, sequence or lifecycle picture that earns the validation and the export formats. Say which you chose and why.

`/ship docs` runs this step alone, for when the user wants documentation refreshed without committing code.

## Step 6 — Write the message

Draft a subject line under about 60 characters, in plain past-tense language describing what changed and why. Add a body only when the reason is not obvious from the subject.

**Now invoke the `humanizer` skill with the Skill tool. Actually call it.**

Writing carefully by hand and describing the result as humanized is the failure mode this step exists to prevent, and it is easy to do without noticing. A hand-written pass reliably leaves dashes used as connectors, a closing line that repeats the sentence before it, and passive openers. Those are exactly what the skill is looking for.

Do not report that the humanizer ran unless you invoked it.

It applies to the commit message, and to any pull request description, README text or documentation prose produced in this flow. It does not apply to code, file paths, commands or link targets.

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
| `archify` | Use a mermaid block for step 5 instead |
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
