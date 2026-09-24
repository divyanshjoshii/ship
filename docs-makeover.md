# /ship docs: the one-time makeover

For a project whose docs were never set up properly: a plain README, no diagrams, prose nobody edited. Run it once. After that, ordinary `/ship` keeps things current through its step 5.

It runs steps 1 and 2 of `SKILL.md` as usual, does the work below in place of looking at code changes, then shows everything (step 3), writes the message (step 7) and asks before pushing (step 8). **It commits nothing on its own.**

Do not wait for a step 5 trigger. The whole point of this mode is that those triggers never fired.

## 1. Take stock

Run the full `palette.mjs` (without `--quiet`). List what exists: `README.md`, everything under `docs/`, any logo or app icon, the manifests (`package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`), and any schema file. Read the README and every doc in full before changing any of them.

Build the code map, since this mode skips step 4:

```bash
node "<this skill's base directory>/code-map.mjs" map
```

When it prints a skip reason, draw from the directory tree instead.

## 2. Add the diagrams that belong

Read `diagrams.md` and add each diagram the project warrants and does not have:

- **Flowchart:** in the README, when the project has source code and the README has no diagram. Build it from the code map's communities and links, or from the real directory tree.
- **Database diagram:** when the project defines tables anywhere (the schema search in step 5 of `SKILL.md`) and no `erDiagram` appears anywhere in the docs. Put it in `docs/architecture.md` when that file exists, otherwise under a "Data model" heading in the README.
- **Sequence or state diagram:** only when the code has an obvious request path or status field worth showing. When unsure, leave it out.

Theme and stamp every diagram, new and old, with what `palette.mjs` prints.

## 3. Humanize the prose

Invoke the `humanizer` skill in file mode on `README.md`, the prose files in `docs/`, and any other markdown at the repository root written for people, such as a design write-up or a problem statement. Find them with `git ls-files '*.md'`. It changes prose only. Code blocks, commands, paths and link targets stay exactly as they are, and it must not add a claim, number or feature that was not already there.

Leave alone the files whose job is to be obeyed or kept as written: `CLAUDE.md`, `AGENTS.md`, `docs/standards.md`, `docs/changes.md` (append-only history), `docs/handoffs/`, `LICENSE`, anything under `.github/`, and prompt files or anything else written for a tool or model to read, such as `docs/IMAGE-PROMPTS.md`. Rewording a prompt changes what it produces. A file that opens with a tool's marker comment, such as `<!-- impeccable:product-schema 1 -->` in a `PRODUCT.md`, belongs to that tool. When a doc contradicts the code, humanize its wording only and tell the user; correcting it is their call.

## 4. Polish the README

Add only what traces back to the project itself:

- **A header:** the logo or app icon centred above the title, when one exists in the repository. Prefer PNG or SVG.
- **Badges:** one per major piece of the stack, read from the manifest with real versions, from `img.shields.io`, coloured with the palette: `color` is the accent, `labelColor` is whichever of the surface and text colours is darker, and `logoColor` is white.
- **Callouts:** turn an existing "Note:", "Warning:" or "Important:" line into a GitHub alert such as `> [!NOTE]`. Never write a new warning.

A new section is allowed only when every line in it traces to the code, the existing README or the commit history. Never invent a feature, a number or a claim.

## 5. Check, then hand over

Render every new or changed diagram on a light and a dark background, as `diagrams.md` describes. Then carry on with step 3 of `SKILL.md` and show the whole docs diff before anything is committed.

Running it again later only fixes what drifted. Never add a second header, a second row of badges or a second copy of a diagram. Never delete a file, including old HTML diagrams or screenshots: list them and ask.
