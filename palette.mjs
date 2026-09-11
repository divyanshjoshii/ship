#!/usr/bin/env node
// Build a Mermaid theme from a project's own colours, and list diagrams that need attention.
//
// Run from the repository root:
//   node palette.mjs
//   node palette.mjs --accent "#7c3aed" --surface "#ffffff"    (colours read off a logo)
//
// Reads CSS custom properties in :root and @theme blocks, colours in tailwind.config.*, then the
// web manifest. Understands hex, rgb(), hsl(), oklch() and shadcn-style bare HSL triples.
// Needs nothing but Node. It reads project files and never runs them.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const PAGES = ["#FFFFFF", "#0D1117"]; // GitHub's light and dark page backgrounds
const SURFACE_KEYS = ["primaryColor", "actorBkg"];
const ACCENT_KEYS = ["primaryBorderColor", "lineColor", "actorBorder", "signalColor"];
const NEUTRAL = { accent: "#4F46E5", surface: "#FFFFFF" };
const slash = p => p.replaceAll("\\", "/");

// ---------- files ----------

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.name === "node_modules" || e.name === ".git" ? [] :
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]);
}

function projectFiles() {
  let names;
  try {
    names = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"],
      { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).split(/\r?\n/);
  } catch {
    names = walk(".");
  }
  return names.map(slash).filter(n => n && !n.includes("node_modules") && existsSync(n) && statSync(n).isFile());
}

// ---------- colour maths ----------

const clamp = x => Math.max(0, Math.min(1, x));
const fromUnit = rgb => "#" + rgb.map(c => Math.round(clamp(c) * 255).toString(16).padStart(2, "0")).join("").toUpperCase();
const channels = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));

function hslToRgb(h, s, l) {
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const t = x => {
    x = ((x % 1) + 1) % 1;
    return x < 1 / 6 ? p + (q - p) * 6 * x : x < 1 / 2 ? q : x < 2 / 3 ? p + (q - p) * (2 / 3 - x) * 6 : p;
  };
  return [t(h + 1 / 3), t(h), t(h - 1 / 3)];
}

function rgbToHsl([r, g, b]) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

function toHex(value, vars = null, depth = 0) {
  const v = String(value ?? "").trim().replace(/;$/, "").trim();
  if (!v) return null;
  const ref = v.match(/^var\(\s*(--[\w-]+)\s*(?:,[^)]*)?\)$/);
  if (ref) return vars && depth < 5 ? toHex(vars[ref[1]], vars, depth + 1) : null;
  const hex = v.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})(?:[0-9a-fA-F]{2})?$/);
  if (hex) return "#" + (hex[1].length === 3 ? [...hex[1]].map(c => c + c).join("") : hex[1]).toUpperCase();
  const nums = v.match(/-?[\d.]+%?/g) || [];
  const frac = (n, scale) => (n.endsWith("%") ? parseFloat(n) / 100 : parseFloat(n) / scale);
  let rgb;
  if (v.startsWith("oklch")) {
    if (nums.length < 3) return null;
    const L = frac(nums[0], 1), C = parseFloat(nums[1]), H = (parseFloat(nums[2]) * Math.PI) / 180;
    const a = C * Math.cos(H), b = C * Math.sin(H);
    const [l, m, s] = [[0.3963377774, 0.2158037573], [-0.1055613458, -0.0638541728], [-0.0894841775, -1.291485548]]
      .map(([x, y]) => (L + x * a + y * b) ** 3);
    rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
           -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
           -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s]
      .map(c => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055));
  } else if (v.startsWith("hsl") || (nums.length >= 3 && nums[1].endsWith("%") && nums[2].endsWith("%"))) {
    if (nums.length < 3) return null;
    rgb = hslToRgb(parseFloat(nums[0]) / 360, frac(nums[1], 100), frac(nums[2], 100));
  } else if (v.startsWith("rgb")) {
    if (nums.length < 3) return null;
    rgb = nums.slice(0, 3).map(n => frac(n, 255));
  } else {
    return null;
  }
  return rgb.some(Number.isNaN) ? null : fromUnit(rgb);
}

const mix = (a, b, t) => "#" + channels(a).map((x, i) => Math.round(x * t + channels(b)[i] * (1 - t))
  .toString(16).padStart(2, "0")).join("").toUpperCase();

function luminance(h) {
  const c = channels(h).map(x => x / 255).map(x => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const saturation = h => rgbToHsl(channels(h).map(x => x / 255))[1];
const readableOn = (bg, preferred) =>
  preferred && contrast(preferred, bg) >= 4.5 ? preferred
    : ["#FFFFFF", "#0B0B0B"].sort((x, y) => contrast(y, bg) - contrast(x, bg))[0];
const distinct = (a, b) => channels(a).reduce((sum, x, i) => sum + Math.abs(x - channels(b)[i]), 0) > 90;

// ---------- reading the project ----------

// :root wins, then @theme, then any other block such as .dark. Every declaration is also kept
// separately, so the fingerprint covers colours that the merge hides, like .dark overrides.
function cssVariables(paths) {
  const tiers = [{}, {}, {}], every = [], sources = [];
  for (const p of paths) {
    const text = readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    let hit = false;
    for (const [, selector, body] of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const tier = selector.includes(":root") ? 0 : selector.includes("@theme") ? 1 : 2;
      for (const [, raw, value] of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+)/g)) {
        const name = raw.replace(/^--color-/, "--"), val = value.trim();
        if (new RegExp(`^var\\(\\s*${name}\\s*\\)$`).test(val)) continue; // @theme's --color-x: var(--x)
        if (!(name in tiers[tier])) tiers[tier][name] = val;
        every.push([`${selector.trim()} ${name}`, val]);
        hit = true;
      }
    }
    if (hit) sources.push(p);
  }
  return { vars: { ...tiers[2], ...tiers[1], ...tiers[0] }, every, sources };
}

// Tailwind 3 keeps colours in the config. Only the top-level keys of each `colors: {...}` object
// count, so a nested primary: { foreground: "#fff" } is never mistaken for the page's text colour.
function colourEntries(text) {
  const entries = {};
  for (const start of text.matchAll(/colors\s*:\s*\{/g)) {
    let depth = 1, flat = "", nestedFrom = -1, i = start.index + start[0].length;
    for (; i < text.length && depth > 0; i++) {
      const ch = text[i];
      if (ch === "{") {
        if (depth === 1) { nestedFrom = i + 1; flat += "{}"; }
        depth++;
      } else if (ch === "}") {
        depth--;
        if (depth === 1 && nestedFrom >= 0) {
          const key = flat.match(/['"]?([\w-]+)['"]?\s*:\s*\{\}$/)?.[1];
          if (key && !(key in entries)) entries[key] = { nested: text.slice(nestedFrom, i) };
          nestedFrom = -1;
        }
      } else if (depth === 1) {
        flat += ch;
      }
    }
    for (const [, key, value] of flat.matchAll(/['"]?([\w-]+)['"]?\s*:\s*['"]([^'"]+)['"]/g)) {
      if (!(key in entries)) entries[key] = { value };
    }
  }
  return entries;
}

// primary: "#hex", primary: { DEFAULT: "#hex" }, brand: { 500: "#hex" }
function tailwindColours(paths) {
  const vars = {}, sources = [];
  for (const p of paths.filter(p => /(^|\/)tailwind\.config\.(js|cjs|mjs|ts)$/.test(p))) {
    const text = readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    const entries = colourEntries(text);
    for (const key of ["primary", "brand", "secondary", "background", "foreground", "card", "ring", "destructive"]) {
      const e = entries[key];
      const value = e?.value ?? (e?.nested && (e.nested.match(/DEFAULT['"]?\s*:\s*['"]([^'"]+)['"]/) ||
        e.nested.match(/['"]?(?:600|500)['"]?\s*:\s*['"]([^'"]+)['"]/) || [])[1]);
      if (value && !(`--${key}` in vars)) vars[`--${key}`] = value;
    }
    if (Object.keys(vars).length) sources.push(p);
  }
  return { vars, sources };
}

function manifestColours(paths) {
  const found = {}, sources = new Set();
  for (const p of paths.filter(p => /manifest\.(json|webmanifest|ts|js)$/.test(p))) {
    const text = readFileSync(p, "utf8");
    for (const key of ["theme_color", "background_color"]) {
      const m = text.match(new RegExp(`${key}['"]?\\s*:\\s*['"]([^'"]+)['"]`));
      if (m && !(key in found)) { found[key] = m[1]; sources.add(p); }
    }
  }
  return { found, sources: [...sources].sort() };
}

// ---------- building the theme ----------

function build(args) {
  const paths = projectFiles();
  const css = cssVariables(paths.filter(p => p.endsWith(".css")));
  const tw = tailwindColours(paths);
  const manifest = manifestColours(paths);
  const vars = { ...tw.vars, ...css.vars }; // the stylesheet wins over the config
  const get = name => toHex(vars[name], vars);
  const visible = c => PAGES.every(page => contrast(c, page) >= 1.8);

  const candidates = [toHex(args.accent),
    ...["--primary", "--ring", "--brand", "--chart-1", "--chart-2", "--chart-3", "--secondary"].map(get),
    toHex(manifest.found.theme_color)].filter(Boolean);
  let accent = candidates.find(c => visible(c) && saturation(c) >= 0.25) || candidates.find(visible) || null;
  let surface = toHex(args.surface) || get("--card") || get("--background") || toHex(manifest.found.background_color);
  const neutral = !(accent || surface);
  accent ||= NEUTRAL.accent;
  surface ||= NEUTRAL.surface;
  const text = readableOn(surface, get("--foreground"));

  const roles = [accent];
  for (const name of ["--brand", "--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5", "--secondary", "--destructive"]) {
    const c = get(name);
    if (c && saturation(c) >= 0.25 && contrast(c, surface) >= 1.8 && roles.every(r => distinct(c, r))) roles.push(c);
  }
  let [hue, sat, lum] = rgbToHsl(channels(accent).map(x => x / 255));
  const darkSurface = luminance(surface) < 0.2;
  while (roles.length < 5) { // too few distinct colours: rotate the accent's hue
    hue = (hue + 0.2) % 1;
    let c = fromUnit(hslToRgb(hue, sat, lum));
    if (contrast(c, surface) < 3) c = fromUnit(hslToRgb(hue, sat, darkSurface ? Math.max(lum, 0.62) : Math.min(lum, 0.42)));
    roles.push(c);
  }
  roles.length = 5;

  // Every colour the project defines, in every block, plus any override. Change one, the code changes.
  const colours = [
    ...css.every.map(([k, v]) => [`css ${k}`, toHex(v, vars)]),
    ...Object.entries(tw.vars).map(([k, v]) => [`tailwind ${k}`, toHex(v, vars)]),
    ...Object.entries(manifest.found).map(([k, v]) => [`manifest ${k}`, toHex(v)]),
    ["override accent", toHex(args.accent)], ["override surface", toHex(args.surface)],
  ].filter(([, h]) => h).sort(([a], [b]) => a.localeCompare(b));
  const fingerprint = createHash("sha1").update(JSON.stringify(colours)).digest("hex").slice(0, 8);

  const muted = mix(text, surface, 0.45), note = mix(accent, surface, 0.15), row = mix(text, surface, 0.06);
  const theme = {
    background: surface, primaryColor: surface, primaryTextColor: text, primaryBorderColor: accent,
    lineColor: accent, secondaryColor: mix(accent, surface, 0.12), tertiaryColor: surface,
    textColor: text, edgeLabelBackground: surface, clusterBkg: surface,
    clusterBorder: mix(text, surface, 0.2), titleColor: text,
    rowOdd: surface, rowEven: row, attributeBackgroundColorOdd: surface, attributeBackgroundColorEven: row,
    actorBkg: surface, actorBorder: accent, actorTextColor: text, actorLineColor: muted,
    signalColor: accent, signalTextColor: text, labelBoxBkgColor: surface,
    labelBoxBorderColor: accent, labelTextColor: text, loopTextColor: text,
    noteBkgColor: note, noteTextColor: readableOn(note, text), noteBorderColor: accent,
    activationBkgColor: accent, activationBorderColor: accent,
  };
  return {
    sources: [...css.sources, ...tw.sources, ...manifest.sources], neutral, fingerprint,
    accent, surface, text, roles, theme,
  };
}

// ---------- checking existing diagrams ----------

function review(pal) {
  const docs = ["README.md", ...(existsSync("docs") && statSync("docs").isDirectory()
    ? walk("docs").map(slash).filter(p => p.endsWith(".md")).sort() : [])];
  const report = [];
  for (const p of docs.filter(d => existsSync(d))) {
    const blocks = [...readFileSync(p, "utf8").matchAll(/```mermaid\r?\n([\s\S]*?)```/g)].map(m => m[1]);
    blocks.forEach((block, i) => {
      const where = `${p} diagram ${i + 1}`;
      const stamp = block.match(/%%\s*palette\s+([0-9a-f]{8})/);
      if (stamp) {
        if (stamp[1] !== pal.fingerprint) report.push(`${where}: colours changed since it was drawn (palette ${stamp[1]}, now ${pal.fingerprint}). Re-colour it.`);
        return;
      }
      const init = block.match(/%%\{\s*init:\s*(\{.*\})\s*\}%%/);
      if (!init) { report.push(`${where}: no theme, so it renders in default grey. Theme it.`); return; }
      let tv;
      try { tv = JSON.parse(init[1]).themeVariables || {}; } catch { report.push(`${where}: its theme line is not valid JSON. Replace it.`); return; }
      const oldSurface = SURFACE_KEYS.map(k => tv[k]).find(Boolean);
      const oldAccent = ACCENT_KEYS.map(k => tv[k]).find(Boolean);
      const wrong = [["surface", oldSurface, pal.surface], ["accent", oldAccent, pal.accent]]
        .filter(([, old, now]) => old && old.toUpperCase() !== now);
      report.push(wrong.length
        ? `${where}: ${wrong.map(([l, o, n]) => `${l} is ${o}, should be ${n}`).join("; ")}. Re-colour it.`
        : `${where}: colours match but it has no stamp. Add the stamp line only.`);
    });
  }
  return report;
}

// ---------- output ----------

function main() {
  const args = {};
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a === "--help" || a === "-h") { console.log(readFileSync(new URL(import.meta.url), "utf8").split("\n").slice(1, 10).join("\n")); return; }
    if (a === "--accent" || a === "--surface") args[a.slice(2)] = process.argv[++i];
  }
  const pal = build(args);
  const rgb = h => `rgb(${channels(h).join(", ")})`;
  const out = [];
  out.push(`Colours from: ${pal.sources.join(", ") || "nothing found"}`);
  if (pal.neutral) {
    out.push("  No colours in the stylesheet, Tailwind config or manifest. Read the logo and rerun with");
    out.push("  --accent and --surface, or use this neutral palette and say so.");
  }
  out.push(`Fingerprint: palette ${pal.fingerprint}`);
  out.push(`surface ${pal.surface}   text ${pal.text} (${contrast(pal.text, pal.surface).toFixed(1)}:1)   accent ${pal.accent}`);
  out.push(`roles   ${pal.roles.join("  ")}`);
  out.push("", "First two lines of every mermaid block:");
  out.push(`%%{init: ${JSON.stringify({ theme: "base", themeVariables: pal.theme })}}%%`);
  out.push(`%% palette ${pal.fingerprint}`);
  out.push("", "classDef lines, one per role:");
  pal.roles.forEach((r, i) => {
    const fill = mix(r, pal.surface, 0.16);
    out.push(`    classDef role${i + 1} fill:${fill},stroke:${r},color:${readableOn(fill, pal.text)}`);
  });
  out.push("", "rect colours for sequence diagrams:", `    rect ${rgb(pal.surface)}    (plain)`);
  pal.roles.slice(1, 4).forEach(r => out.push(`    rect ${rgb(mix(r, pal.surface, 0.14))}`));
  const report = review(pal);
  out.push("", "Diagrams that need attention:", ...(report.length ? report.map(l => "  " + l) : ["  none, every diagram is current"]));
  console.log(out.join("\n"));
}

main();
