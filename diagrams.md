# Diagrams

Read this when step 5 of `SKILL.md` decided a diagram is needed, or when `/ship docs` adds one. **Write or update the diagram rather than asking whether to**, and show the result before it is committed.

## Draw from the code

Take the structure from the code, never from memory. For folders, modules and routes:

```bash
node "<this skill's base directory>/code-map.mjs" map
```

It prints the named communities of the code and the strongest links between them. When it prints a skip reason, use the real directory tree instead. Draw a database diagram from the schema file itself. Never invent a component, a table or a relationship.

## Mermaid, always

Write every diagram as a Mermaid code block inside the markdown file. GitHub draws Mermaid natively, it diffs like text, and nobody needs anything installed to see it. The repository's diagram is always that Mermaid block: GitHub shows an HTML file as source code, and a screenshot goes stale without anyone noticing.

| What changed | Diagram | Where it goes |
|---|---|---|
| Folders, modules, routes | `flowchart` | `README.md` |
| A schema file | `erDiagram` | `docs/architecture.md` |
| A request or load path | `sequenceDiagram`, with `par` blocks for calls that run together | `docs/architecture.md` |
| A status that moves through stages | `stateDiagram-v2` | `docs/architecture.md` |

Update a diagram in place. Never add a second diagram of the same thing.

Keep diagrams narrow enough to read at README width. When one table has more than four children, put `direction LR` on the line after `erDiagram` so the children stack down the page instead of spreading off its side; Mermaid 10.9 and 11 both render it. GitHub draws each relationship label on a half-transparent chip that turns grey in whichever GitHub theme is opposite the diagram's surface, and no theme colour fixes it. So leave a label empty (`: ""`) when it would only repeat the key column the child table already lists. A verb that tells the reader something the key does not, like `owns` or `default for`, is worth its chip. A flowchart group holding a single node adds an empty frame, so write the group's name into the node's label instead.

## Theme it from the project

Grey default boxes are the fallback, never the goal. The colours come from the project itself, and they are **read fresh on every run**. Never copy colours out of an existing diagram: that diagram may be the very thing that is out of date.

Run the full palette from the repository root:

```bash
node "<this skill's base directory>/palette.mjs"
```

It reads the stylesheet's `:root` and `@theme` variables, colours set in `tailwind.config.*`, then the web manifest. It converts `oklch()`, `hsl()` and bare HSL values to hex, since Mermaid's colour maths only understands hex and rgb. It passes over a near-black or near-white `--primary`, which would vanish against one of GitHub's two backgrounds, and takes the next saturated colour instead. It picks text colours that stay readable on whatever they sit on. It reads project files and never runs them. It prints:

- which files the colours came from
- a **palette fingerprint**: an eight-character code made from every colour the project defines
- the two lines every Mermaid block starts with, the `%%{init}%%` theme and a `%% palette <code>` stamp
- `classDef` lines for colouring nodes by role, and `rect` colours for sequence diagrams
- **every diagram in `README.md` and `docs/` that needs attention**, and what to do about each

The stamp is how changes get caught. Change any colour in the project, even a single chart colour, and the fingerprint changes, so every diagram still carrying the old stamp gets listed. Re-colour a listed diagram in place: swap its `%%{init}%%` line, its stamp and its colours, and leave its structure alone. A diagram listed as matching but unstamped needs only the stamp line added. When writing a new diagram, use the printed lines as they are.

When no colours turn up anywhere, read the logo or app icon, take its main colour and its background colour, and rerun with them: `palette.mjs --accent "#hex" --surface "#hex"`. With no logo either, use the neutral palette it prints and say so. If Node is missing, do the same work by hand and keep text at a contrast ratio of at least 4.5 against whatever it sits on.

Leave an HTML comment beside each diagram naming the files its colours came from, never the values, so the next run knows where to look.

**Make it readable in both GitHub themes.** GitHub renders the page light for some readers and dark for others, and the diagram cannot tell which. Put every piece of text on a surface the diagram paints itself: filled nodes, `edgeLabelBackground`, and `rect` blocks around sequence messages. Text left on the bare page disappears in one of the two modes.

## Check it renders

A Mermaid block with a syntax error shows on GitHub as a raw code box. When a browser tool is available, render each changed block once on a light background and once on a dark one before committing. When none is available, say plainly that the diagram has not been rendered.

Run the `humanizer` skill over any prose written around a diagram.
