#!/usr/bin/env node
// Summarise code-review-graph for /ship, so its JSON (often 20-40 KB) never reaches the model.
//
// Run from anywhere inside the repository:
//   node code-map.mjs impact                  what uncommitted and staged changes affect (vs HEAD)
//   node code-map.mjs impact --base <ref>     what everything since <ref> affects, e.g. origin/main
//   node code-map.mjs map                     named communities and their strongest links, for a flowchart
//   add --build to allow a first build on a repository with more than 3000 source files
//
// Builds the graph on first use and refreshes it on every run. Prints at most about 25 lines.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const SOURCE = /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|rb|php|cs|c|h|cpp|swift)$/;
const BIG_REPO = 3000;
const slash = p => String(p).replaceAll("\\", "/");

function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, windowsHide: true });
  return { ok: r.status === 0, out: r.stdout || "" };
}

function say(line) { console.log(line); process.exit(0); }

// code-review-graph is often installed with `pip install --user`, which on Windows lands off PATH.
function resolveCrg(cwd) {
  const candidates = [["code-review-graph"], ["python", "-m", "code_review_graph"], ["python3", "-m", "code_review_graph"]];
  for (const [cmd, ...pre] of candidates) {
    if (run(cmd, [...pre, "--version"], cwd).ok) return (args) => run(cmd, [...pre, ...args], cwd);
  }
  return null;
}

function main() {
  const [mode = "impact", ...rest] = process.argv.slice(2);
  if (mode === "--help" || mode === "-h") { console.log("usage: node code-map.mjs impact [--base <ref>] | map  [--build]"); return; }
  const flag = name => { const i = rest.indexOf(name); return i >= 0 ? (rest[i + 1] ?? true) : null; };

  const top = run("git", ["rev-parse", "--show-toplevel"]);
  if (!top.ok) say(`${mode}: skipped, not inside a git repository`);
  const root = top.out.trim();

  const sources = run("git", ["ls-files"], root).out.split(/\r?\n/).filter(f => SOURCE.test(f)).length;
  if (sources === 0) say(`${mode}: skipped, no source files to graph`);

  const crg = resolveCrg(root);
  if (!crg) say(`${mode}: skipped, code-review-graph is not installed`);

  if (!existsSync(join(root, ".code-review-graph"))) {
    if (sources > BIG_REPO && !flag("--build")) {
      say(`${mode}: skipped, a first build of ${sources} source files is slow. Offer to run \`node code-map.mjs ${mode} --build\` later.`);
    }
    if (!crg(["build"]).ok) say(`${mode}: skipped, code-review-graph build failed`);
  } else {
    crg(["update", "--brief"]);
  }

  if (mode === "map") return printMap(crg);
  return printImpact(crg, root, typeof flag("--base") === "string" ? flag("--base") : "HEAD");
}

function parse(result, what) {
  try { return JSON.parse(result.out); } catch { say(`${what}: code-review-graph returned no readable result`); }
}

function printImpact(crg, root, base) {
  const j = parse(crg(["impact", "--base", base, "--max-results", "15"]), "impact");
  // code-review-graph also lists untracked logs and generated files; only source files count here.
  const changed = (j.changed_files || []).filter(f => SOURCE.test(f));
  if (changed.length === 0) say(`impact: no source changes against ${base}`);
  const prefix = slash(root).replace(/\/?$/, "/");
  const rel = f => slash(f).replace(prefix, "");
  const files = (j.impacted_files || []).map(rel);
  const direct = (j.changed_nodes || []).length;
  const total = j.total_impacted ?? (j.impacted_nodes || []).length;
  console.log(`impact: ${changed.length} changed source file(s), ${direct} symbol(s) changed, ${total} impacted within 2 hops, ${files.length}${j.truncated ? "+" : ""} other file(s) depend on them`);
  files.slice(0, 10).forEach(f => console.log(`  ${f}`));
  if (files.length > 10) console.log(`  (+${files.length - 10} more)`);
}

function printMap(crg) {
  const j = parse(crg(["architecture"]), "map");
  const communities = [...(j.communities || [])].sort((a, b) => b.size - a.size);
  const links = [...(j.cross_community_edges || [])].sort((a, b) => b.edge_count - a.edge_count);
  console.log(`map: ${communities.length} communities, ${j.cross_community_edges_total ?? links.length} links between them`);
  console.log("communities (largest first):");
  communities.slice(0, 12).forEach(c => console.log(`  ${c.name} (${c.size} symbols, ${c.dominant_language})`));
  if (communities.length > 12) console.log(`  (+${communities.length - 12} smaller)`);
  console.log("strongest links:");
  links.slice(0, 10).forEach(l => console.log(`  ${l.source_community} -> ${l.target_community} (${l.edge_count} ${String(l.top_kinds?.[0] || "edges").toLowerCase()})`));
  const warnings = j.warnings || [];
  if (warnings.length) console.log(`warnings: ${warnings.length}, first: ${warnings[0]}`);
}

main();
