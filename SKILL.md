---
name: ship
description: Review, commit and push work with every step confirmed first. Checks for a collaborator's incoming commits before pushing so clashes surface early, works out what a change affects, keeps diagrams current and in the project's own colours, and writes commit messages in the user's own voice. `/ship docs` gives an older project a one-time docs makeover. Use when the user says ship, commit, push, asks to save work to GitHub, or wants an existing project's README and docs brought up to standard.
argument-hint: "[docs] to give an older project its one-time docs makeover; omit for the normal commit flow"
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

- A new top-level directory appeared, or one was removed or renamed, **and it contains source files**. A `docs/`, `.github/` or `.vscode/` directory changes no architecture, so check before treating it as structure:

  ```bash
  git status --short | grep '^??' | cut -c4- | while read -r p; do
    [ -d "$p" ] && echo "$p: $(git ls-files -o --exclude-standard "$p" | grep -cE '\.(ts|tsx|js|jsx|py|go|rs|java|kt|rb|php|cs|c|h|cpp|swift)$')"
  done
  ```

  A count of zero means it is not a structural change.
- A new module, package, route or entry point was added
- A dependency was added or dropped
- A database schema changed: `*.sql`, `schema.prisma`, a migrations directory, or a source file that defines tables, such as `CREATE TABLE` strings or ORM models. Find them with `git grep -lE "CREATE TABLE|models\.Model|__tablename__|@Entity|sqliteTable|pgTable|mysqlTable"`.
- Step 4 reported a change reaching across three or more modules
- An existing diagram in `README.md` or `docs/` no longer matches what is there
- `palette.mjs` lists a diagram as needing attention, because the project's colours changed since it was drawn. Nothing structural has to move for this one; see *Theme it from the project*.

It is not needed for a bug fix, a documentation edit, a config tweak, a dependency version bump, or a change confined to one file, unless that change touched the project's colours. Most commits are in this group, so most runs skip this step.

When step 4 built a graph, use it to answer the question rather than guessing:

```bash
$CRG architecture
```

**When a diagram is needed, write or update it rather than asking whether to.** Show the result before it is committed.

### Mermaid, always

Write every diagram as a Mermaid code block inside the markdown file. GitHub draws Mermaid natively, it diffs like text, and nobody needs anything installed to see it.

**Never commit an HTML diagram or a screenshot as the repository's diagram.** GitHub shows an HTML file as source code, and a screenshot goes stale without anyone noticing.

| What changed | Diagram | Where it goes |
|---|---|---|
| Folders, modules, routes | `flowchart` | `README.md` |
| A schema file | `erDiagram` | `docs/architecture.md` |
| A request or load path | `sequenceDiagram`, with `par` blocks for calls that run together | `docs/architecture.md` |
| A status that moves through stages | `stateDiagram-v2` | `docs/architecture.md` |

Update a diagram in place. Never add a second diagram of the same thing.

Keep diagrams narrow enough to read at README width. When one table has more than four children, put `direction LR` on the line after `erDiagram` so the children stack down the page instead of spreading off its side; Mermaid 10.9 and 11 both render it. GitHub draws each relationship label on a half-transparent chip that turns grey in whichever GitHub theme is opposite the diagram's surface, and no theme colour fixes it. So leave a label empty (`: ""`) when it would only repeat the key column the child table already lists. A verb that tells the reader something the key does not, like `owns` or `default for`, is worth its chip. A flowchart group holding a single node adds an empty frame, so write the group's name into the node's label instead.

### Theme it from the project

Grey default boxes are the fallback, never the goal. The colours come from the project itself, and they are **read fresh on every run**. Never copy colours out of an existing diagram: that diagram may be the very thing that is out of date.

`palette.mjs` sits in this skill's base directory and does the reading. It needs only Node, which every install of this skill already has, since `npx skills add` cannot run without it. Run it from the repository root on every `/ship`, whether or not anything structural changed:

```bash
node "<this skill's base directory>/palette.mjs"
```

It reads the stylesheet's `:root` and `@theme` variables, colours set in `tailwind.config.*`, then the web manifest. It converts `oklch()`, `hsl()` and bare HSL values to hex, since Mermaid's colour maths only understands hex and rgb. It passes over a near-black or near-white `--primary`, which would vanish against one of GitHub's two backgrounds, and takes the next saturated colour instead. It picks text colours that stay readable on whatever they sit on. It reads project files and never runs them. It prints:

- which files the colours came from
- a **palette fingerprint**: an eight-character code made from every colour the project defines
- the two lines every Mermaid block starts with, the `%%{init}%%` theme and a `%% palette <code>` stamp
- `classDef` lines for colouring nodes by role, and `rect` colours for sequence diagrams
- **every diagram in `README.md` and `docs/` that needs attention**, and what to do about each

The stamp is how changes get caught. Change any colour in the project, even a single chart colour, and the fingerprint changes, so every diagram still carrying the old stamp gets listed. A listed diagram is a reason to run this step even when nothing else changed. Re-colour it in place: swap its `%%{init}%%` line, its stamp and its colours, and leave its structure alone. A diagram listed as matching but unstamped needs only the stamp line added. When writing a new diagram, use the printed lines as they are.

When no colours turn up anywhere, read the logo or app icon, take its main colour and its background colour, and rerun with them: `palette.mjs --accent "#hex" --surface "#hex"`. With no logo either, use the neutral palette it prints and say so. If Node is somehow missing, do the same work by hand and keep text at a contrast ratio of at least 4.5 against whatever it sits on.

Leave an HTML comment beside each diagram naming the files its colours came from, never the values, so the next run knows where to look.

**Make it readable in both GitHub themes.** GitHub renders the page light for some readers and dark for others, and the diagram cannot tell which. Put every piece of text on a surface the diagram paints itself: filled nodes, `edgeLabelBackground`, and `rect` blocks around sequence messages. Text left on the bare page disappears in one of the two modes.

### Check it renders

A Mermaid block with a syntax error shows on GitHub as a raw code box. When a browser tool is available, render each changed block once on a light background and once on a dark one before committing. When none is available, say plainly that the diagram has not been rendered.

Run the `humanizer` skill over any prose written around a diagram.

`/ship docs` runs the one-time makeover further down, which does not wait for these triggers.

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

## `/ship docs` — the one-time makeover

For a project whose docs were never set up properly: a plain README, no diagrams, prose nobody edited. Run it once. After that, ordinary `/ship` keeps things current through step 5.

It runs steps 1 and 2 as usual, does the work below in place of looking at code changes, then shows everything (step 3), writes the message (step 6) and asks before pushing (step 7). **It commits nothing on its own.**

Do not wait for a step 5 trigger. The whole point of this mode is that those triggers never fired.

### 1. Take stock

Run `palette.mjs`. List what exists: `README.md`, everything under `docs/`, any logo or app icon, the manifests (`package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`), and any schema file. Read the README and every doc in full before changing any of them.

Build the code map too, since this mode skips step 4. Resolve `$CRG`, run the source-file check, and when `.code-review-graph/` is missing, build it and gitignore `.mcp.json`, all exactly as step 4 says. Then run `$CRG update --brief`. Skip `impact`, since there is no change to measure. With no `$CRG`, draw from the directory tree instead.

### 2. Add the diagrams that belong

Using the table in step 5, add each diagram the project warrants and does not have. Draw only what the code shows: build the flowchart from `$CRG architecture` or the real directory tree, and the database diagram from the schema file itself. Never invent a component, a table or a relationship.

- **Flowchart:** in the README, when the project has source code and the README has no diagram
- **Database diagram:** when the project defines tables anywhere, by the same search step 5 uses, and no `erDiagram` appears anywhere in the docs. Put it in `docs/architecture.md` when that file exists, otherwise under a "Data model" heading in the README.
- **Sequence or state diagram:** only when the code has an obvious request path or status field worth showing. When unsure, leave it out.

Theme and stamp every diagram, new and old, with what `palette.mjs` prints.

### 3. Humanize the prose

Invoke the `humanizer` skill in file mode on `README.md` and the prose files in `docs/`. It changes prose only. Code blocks, commands, paths and link targets stay exactly as they are, and it must not add a claim, number or feature that was not already there.

Leave alone the files whose job is to be obeyed or kept as written: `CLAUDE.md`, `AGENTS.md`, `docs/standards.md`, `docs/changes.md` (append-only history), `docs/handoffs/`, `LICENSE`, anything under `.github/`, and prompt files or anything else written for a tool or model to read, such as `docs/IMAGE-PROMPTS.md`. Rewording a prompt changes what it produces.

### 4. Polish the README

Add only what traces back to the project itself:

- **A header:** the logo or app icon centred above the title, when one exists in the repository. Prefer PNG or SVG.
- **Badges:** one per major piece of the stack, read from the manifest with real versions, from `img.shields.io`, coloured with the palette: `color` is the accent, `labelColor` is whichever of the surface and text colours is darker, and `logoColor` is white.
- **Callouts:** turn an existing "Note:", "Warning:" or "Important:" line into a GitHub alert such as `> [!NOTE]`. Never write a new warning.

A new section is allowed only when every line in it traces to the code, the existing README or the commit history. Never invent a feature, a number or a claim.

### 5. Check, then hand over

Render every new or changed diagram on a light and a dark background, as step 5 describes. Then carry on with step 3 and show the whole docs diff before anything is committed.

Running it again later only fixes what drifted. Never add a second header, a second row of badges or a second copy of a diagram. Never delete a file, including old HTML diagrams or screenshots: list them and ask.

## When something is missing

Degrade quietly. A missing tool is not a problem to raise.

| Missing | Do |
|---|---|
| `code-review-graph` | Skip step 4 |
| `humanizer` | Write the message plainly and say so once |
| `gh` | Use plain `git`; only repository creation needs `gh` |
| A browser tool | Commit the diagram, and say it has not been rendered |
| Node | Work out the colours by hand, as step 5 describes. Rare, since installing this skill needs Node |

## What this skill never does

- Push without an explicit yes for that push
- Push to `upstream`
- Force-push without a typed confirmation
- Commit a file the user has not seen listed
- Edit, rebase or amend a collaborator's commits
- Create a pull request, issue or comment without being asked
- Change repository settings
- Commit an HTML file or a screenshot as the repository's diagram

## Delegate rather than reimplement

- Prose in the user's voice → `humanizer`
- Diagrams inside the repository → Mermaid, written inline, no skill needed
- Standalone diagrams for slides or sharing, outside the repository → `archify`
- What a change affects → `code-review-graph`
- An in-progress merge conflict → `resolving-merge-conflicts`
- A review of the code itself → `/security-review` or `/code-review`
