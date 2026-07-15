// CD (computer-delivered) IELTS Reading test yaratish — Deno porti.
// Manba (aynan mantiq): ielts_bot/cd/{passage,questions,render}.py
// AI'siz: matn/DOCX'dan passage + savollar + javoblardan mustaqil CD HTML.

import { STYLES, APP_JS, LOGO_HTML, BASE_HTML } from "./cd_template.ts";

// ============================ modellar ============================

export interface Item { number: number; text: string; options: [string, string][]; }
export interface QuestionGroup {
  qtype: string; start: number; end: number; instructions: string;
  items: Item[]; options: [string, string][]; optionsTitle: string;
  body: string; title: string;
}
export interface Passage {
  title: string; subtitle: string; paragraphs: string[]; lettered: boolean;
  groups: QuestionGroup[]; answers: Record<number, string>; warnings: string[];
}
export interface Settings {
  revealMode: string; explanations: boolean; durationMin: number;
  brand: string; telegramUrl: string;
}
export interface ReadingTest {
  title: string; passages: Passage[]; settings: Settings;
  explanations: Record<number, string>;
}

const TYPE_TO_KIND: Record<string, string> = {
  note: "gap", sentence: "gap", summary: "gap", table: "gap",
  flowchart: "gap", shortanswer: "gap", diagram: "gap",
  tfng: "tfng", ynng: "ynng", mcq: "mcq", mcq_multi: "mcq_multi",
  headings: "matching", matching_info: "matching", matching_features: "matching",
};
const TYPE_LABELS: Record<string, string> = {
  note: "Note completion", sentence: "Sentence completion",
  summary: "Summary completion", table: "Table completion",
  flowchart: "Flow-chart completion", shortanswer: "Short answer",
  diagram: "Diagram label completion", tfng: "True / False / Not Given",
  ynng: "Yes / No / Not Given", mcq: "Multiple choice",
  mcq_multi: "Multiple choice (bir nechta)", headings: "Matching headings",
  matching_info: "Matching paragraph information", matching_features: "Matching features",
};
export function kindOf(g: QuestionGroup): string { return TYPE_TO_KIND[g.qtype] ?? "gap"; }
export function labelOf(g: QuestionGroup): string { return TYPE_LABELS[g.qtype] ?? g.qtype; }
export function numbersOf(g: QuestionGroup): number[] {
  const out: number[] = [];
  for (let n = g.start; n <= g.end; n++) out.push(n);
  return out;
}
function qStart(p: Passage): number {
  return p.groups.length ? Math.min(...p.groups.map((g) => g.start)) : 0;
}
function qEnd(p: Passage): number {
  return p.groups.length ? Math.max(...p.groups.map((g) => g.end)) : 0;
}
export function totalQuestions(t: ReadingTest): number {
  let n = 0;
  for (const p of t.passages) for (const g of p.groups) n += numbersOf(g).length;
  return n;
}
export function newSettings(): Settings {
  return { revealMode: "end", explanations: false, durationMin: 60, brand: "DREAM ZONE", telegramUrl: "" };
}

// ============================ passage ============================

const QUESTION_MARKERS =
  /^\s*(questions?\s+\d+\s*[-–—]\s*\d+|question\s+\d+|choose\s+the\s+correct|complete\s+the\s+(notes|summary|table|sentences|flow|diagram)|do\s+the\s+following\s+statements|which\s+(section|paragraph)|list\s+of\s+headings|write\s+(your\s+answers|no\s+more\s+than|one\s+word)|match\s+each|reading\s+passage\s+\d+\s+has)/i;
const HEADER_NOISE =
  /^\s*(reading\s+passage\s*\d*|part\s*\d+|passage\s*\d+|you\s+should\s+spend\s+about|read\s+the\s+(text|passage)|the\s+reading\s+passage\s+below)\b.*$/i;

// IELTS "ishchi yozuvlari" — asl passage emas
const BOILERPLATE =
  /^\s*(reading\s+passage\b|part\s+\d+\s*$|section\s+\d+\s*$|you\s+should\s+spend\b|.*\bbased\s+on\s+reading\s+passage\b|.*\bwhich\s+are\s+based\s+on\b|reading\s+passage\s+\d+\s+has\b|the\s+reading\s+passage\s+below\b|turn\s+over\b|page\s+\d+\b|\d{1,3}\s+of\s+\d{1,3}\s*$)/i;
// Harf-oralig'i: "R E A D I N G  P A S S A G E  2" -> "readingpassage2"
const BOILERPLATE_DESPACED = /^(readingpassage|passage|part|section)\d+$/;
const PAGENUM = /^\s*[-–—•·|]*\s*\d{1,3}\s*[-–—•·|]*\s*$/;
const URLISH = /(https?:\/\/|www\.\w|t\.me\/|@[A-Za-z0-9_]{3,})/i;

function isBoilerplateLine(s: string): boolean {
  if (BOILERPLATE.test(s) || PAGENUM.test(s)) return true;
  const despaced = s.replace(/[\s.:|·•–—-]+/g, "").toLowerCase();
  return despaced.length <= 22 && BOILERPLATE_DESPACED.test(despaced);
}

// IELTS ishchi yozuvlari, bet raqami, kolontitul va URL'larni olib tashlaydi.
export function stripBoilerplate(text: string): [string, string[]] {
  const lines = text.split("\n");
  const counts: Record<string, number> = {};
  for (const ln of lines) { const s = ln.trim(); if (s) counts[s] = (counts[s] || 0) + 1; }

  const out: string[] = [];
  const warnings: string[] = [];
  for (const ln of lines) {
    const s = ln.trim();
    if (!s) { out.push(""); continue; }
    if (isBoilerplateLine(s)) continue;
    if (URLISH.test(s)) { if (!warnings.includes("junk")) warnings.push("junk"); continue; }
    if ((counts[s] || 0) >= 2 && s.length < 60 && !/[.!?:;"]$/.test(s)) continue;
    out.push(ln);
  }
  const intermediate = out.join("\n").replace(/\n{3,}/g, "\n\n").trim();

  // Blok darajasida — kontentdan keyingi qisqa bir qatorli furnitura
  const blocks = intermediate.split(/\n\s*\n/);
  const kept: string[] = [];
  let seenReal = false;
  for (const blk of blocks) {
    const b = blk.trim();
    if (!b) continue;
    const isReal = b.length > 60 || /[.!?"”]$/.test(b.trimEnd());
    const isLetter = /^[A-M]([.\)]|\s|$)/.test(b);
    if (seenReal && !isReal && b.length < 50 && b.indexOf("\n") === -1 && !isLetter) continue;
    kept.push(b);
    if (isReal) seenReal = true;
  }
  return [kept.join("\n\n").trim(), warnings];
}

export function splitPassageAndQuestions(text: string): [string, string] {
  text = stripBoilerplate(text)[0];   // ishchi yozuvlar cut'ni chalg'itmasin
  const lines = text.split("\n");
  let cut = -1;
  for (let i = 0; i < lines.length; i++) {
    if (QUESTION_MARKERS.test(lines[i])) {
      if (i < 2) continue;
      cut = i; break;
    }
  }
  if (cut < 0) return [text.trim(), ""];
  return [lines.slice(0, cut).join("\n").trim(), lines.slice(cut).join("\n").trim()];
}

export function parsePassage(text: string, index = 1): Passage {
  const [clean, warnings] = stripBoilerplate(text.trim());
  text = clean;
  let lines = text.split("\n");
  while (lines.length && (!lines[0].trim() || HEADER_NOISE.test(lines[0]))) lines.shift();

  let title = "", subtitle = "";
  if (lines.length) {
    const first = lines[0].trim();
    if (looksLikeTitle(first)) {
      title = first; lines.shift();
      if (lines.length) {
        const nxt = lines[0].trim();
        if (nxt && looksLikeSubtitle(nxt)) { subtitle = nxt; lines.shift(); }
      }
    }
  }
  const body = lines.join("\n").trim();
  const [paragraphs, lettered] = splitParagraphs(body);
  if (paragraphs.join("").length < 150 && !warnings.includes("short")) warnings.push("short");
  return { title, subtitle, paragraphs, lettered, groups: [], answers: {}, warnings };
}

function looksLikeTitle(line: string): boolean {
  if (!line || line.length > 90) return false;
  if (/[.,:;]$/.test(line)) return false;
  // Ishchi yozuvni sarlavha deb olmaymiz (himoya to'ri)
  if (isBoilerplateLine(line) || /reading\s+passage|you\s+should\s+spend|questions?\s+\d/i.test(line)) return false;
  return line.split(/\s+/).length <= 12;
}
function looksLikeSubtitle(line: string): boolean {
  if (!line || line.length > 160) return false;
  if (/^[A-M][.\)]?\s+/.test(line)) return false; // lettered marker — subtitle emas
  return (line.split(".").length - 1) <= 1 && line.split(/\s+/).length <= 24;
}
function splitParagraphs(body: string): [string[], boolean] {
  // 1) Lettered paragraflar (A, B, C ...) — bo'sh qator bo'lsa ham, bo'lmasa ham
  const lettered = tryLetteredSplit(body);
  if (lettered) return [lettered, true];
  // 2) Bo'sh qator bilan ajratilgan bloklar (ichki qattiq o'ralishni yoyamiz)
  const blocks = body.split(/\n\s*\n/).map((b) => b.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean);
  if (blocks.length >= 2) return [blocks, false];
  // 3) Bo'sh qatorsiz, qattiq o'ralgan yagona blok — yoyib, mazmunli paragraflarga bo'lamiz
  const flat = body.replace(/\s+/g, " ").trim();
  return [chunkParagraphs(flat), false];
}

// Ketma-ket A, B, C... markerlari bo'yicha paragraflarga bo'ladi (>=3 marker bo'lsa).
function tryLetteredSplit(body: string): string[] | null {
  const lines = body.split("\n");
  const paras: string[] = [];
  let cur = "", count = 0, expected = "A";
  for (const raw of lines) {
    const s = raw.trim();
    if (!s) continue;
    const m = s.match(/^([A-M])[.\)]?\s+(.+)/);
    if (m && m[1] === expected) {
      if (cur) paras.push(cur.trim());
      cur = m[2]; count++;
      expected = String.fromCharCode(expected.charCodeAt(0) + 1);
    } else {
      cur = cur ? cur + " " + s : s;
    }
  }
  if (cur) paras.push(cur.trim());
  return count >= 3 ? paras : null;
}

// Yoyilgan matnni ~450+ belgidan iborat mazmunli paragraflarga bo'ladi (gap chegarasida).
function chunkParagraphs(flat: string): string[] {
  const sentences = flat.match(/[^.!?]*[.!?]+["')\]]*\s*|[^.!?]+$/g) || [flat];
  const paras: string[] = [];
  let cur = "";
  for (const s of sentences) {
    cur += s;
    if (cur.trim().length >= 450) { paras.push(cur.trim()); cur = ""; }
  }
  if (cur.trim()) paras.push(cur.trim());
  return paras.length ? paras : [flat];
}

// ============================ savollar ============================

const RAW_ALIASES: Record<string, string> = {
  note: "note", notes: "note", summary: "summary", sentence: "sentence",
  sentences: "sentence", table: "table", flow: "flowchart", flowchart: "flowchart",
  short: "shortanswer", shortanswer: "shortanswer", saq: "shortanswer",
  diagram: "diagram", label: "diagram", tfng: "tfng", tf: "tfng",
  truefalse: "tfng", identifying: "tfng", ynng: "ynng", yn: "ynng", yesno: "ynng",
  mcq: "mcq", choice: "mcq", multiplechoice: "mcq", mc: "mcq",
  mcq2: "mcq_multi", mcqmulti: "mcq_multi", multi: "mcq_multi",
  choosetwo: "mcq_multi", headings: "headings", heading: "headings",
  matchinginfo: "matching_info", matchinfo: "matching_info", paragraph: "matching_info",
  whichparagraph: "matching_info", whichsection: "matching_info", info: "matching_info",
  match: "matching_features", matching: "matching_features", features: "matching_features",
  people: "matching_features", matchingfeatures: "matching_features",
};
const GAP_KINDS = new Set(["note", "summary", "sentence", "table", "flowchart", "shortanswer", "diagram"]);

const BLOCK_RE = /^\s*\[\s*([a-zA-Z_\-]+)\s*\]\s*(?:(\d+)\s*[-–—]\s*(\d+))?\s*(?:\|\s*(.+))?\s*$/;
const BLOCK_HINT = /^\s*\[[a-zA-Z_\-]+\]/m;
const NUM_LINE = /^\s*(\d{1,3})\s*[.\):]?\s+(.*)$/;
const OPT_LINE = /^\s*([A-Z])\s*[.\)]\s+(.+)$/;
const OPT_LINE_LOOSE = /^\s*([A-Z])\s+(\S.*)$/;
const ROMAN_LINE = /^\s*(x{0,3}(?:ix|iv|v?i{0,3}))\s*[.\)]?\s+(.+)$/i;
const QUESTIONS_HDR = /questions?\s+(\d+)\s*(?:[-–—]|and|&|,)\s*(\d+)/i;
const INSTRUCTION_RE = /^\s*(complete|choose|write|do the following|match|label|answer|which|the (text|passage|reading)|look at|reading passage|list of headings|nb\b|classify|select)/i;
const GAP_UNDERSCORE = /_{2,}/g;
const GAP_DOTS = /\.{4,}/g;
const GAP_EXPLICIT = /\{\s*(\d{1,3})\s*\}/g;

function normType(raw: string): string {
  return (raw || "").trim().toLowerCase().replace(/[-_]/g, "");
}

export function parseQuestions(text: string, paraCount = 0): QuestionGroup[] {
  text = (text || "").trim();
  if (!text) return [];
  if (BLOCK_HINT.test(text)) {
    const groups = parseBlocks(text, paraCount);
    if (groups.length) return groups;
  }
  return autoDetect(text, paraCount);
}

function parseBlocks(text: string, paraCount: number): QuestionGroup[] {
  const lines = text.split("\n");
  const blocks: { qtype: string; start: number | null; end: number | null; opts: string; body: string[] }[] = [];
  let cur: typeof blocks[number] | null = null;
  for (const line of lines) {
    const m = line.match(BLOCK_RE);
    if (m) {
      const qtype = RAW_ALIASES[normType(m[1])];
      if (!qtype) { if (cur) cur.body.push(line); continue; }
      cur = { qtype, start: m[2] ? Number(m[2]) : null, end: m[3] ? Number(m[3]) : null, opts: (m[4] || "").trim(), body: [] };
      blocks.push(cur);
    } else if (cur) cur.body.push(line);
  }
  const out: QuestionGroup[] = [];
  for (const b of blocks) {
    const g = buildGroup(b.qtype, b.start, b.end, b.opts, b.body, paraCount);
    if (g) out.push(g);
  }
  return out;
}

function buildGroup(qtype: string, start: number | null, end: number | null,
  optsStr: string, bodyLines: string[], paraCount: number): QuestionGroup | null {
  const [instructions, rest] = splitInstructions(bodyLines);
  if (start === null || end === null) {
    const hdr = instructions.match(QUESTIONS_HDR);
    if (hdr) { start = Number(hdr[1]); end = Number(hdr[2]); }
  }
  if (GAP_KINDS.has(qtype)) return buildGap(qtype, start, end, instructions, rest);
  if (qtype === "tfng" || qtype === "ynng") return buildStatements(qtype, start, end, instructions, rest);
  if (qtype === "mcq") return buildMcq(qtype, start, end, instructions, rest);
  if (qtype === "mcq_multi") return buildMcqMulti(qtype, start, end, instructions, rest, optsStr);
  if (qtype === "headings") return buildHeadings(qtype, start, end, instructions, rest);
  if (qtype === "matching_info" || qtype === "matching_features")
    return buildMatching(qtype, start, end, instructions, rest, optsStr, paraCount);
  return null;
}

function mkGroup(p: Partial<QuestionGroup>): QuestionGroup {
  return {
    qtype: p.qtype!, start: p.start!, end: p.end!, instructions: p.instructions || "",
    items: p.items || [], options: p.options || [], optionsTitle: p.optionsTitle || "",
    body: p.body || "", title: p.title || "",
  };
}

function splitInstructions(bodyLines: string[]): [string, string[]] {
  const instr: string[] = [];
  let i = 0;
  for (; i < bodyLines.length; i++) {
    const s = bodyLines[i].trim();
    if (!s) { if (instr.length) { i++; break; } continue; }
    if (NUM_LINE.test(s) || OPT_LINE.test(s) || ROMAN_LINE.test(s)) break;
    if (INSTRUCTION_RE.test(s) || QUESTIONS_HDR.test(s) || !instr.length) instr.push(s);
    else break;
  }
  return [instr.join(" ").trim(), bodyLines.slice(i)];
}

// ---- gap ----
function hasGap(line: string): boolean {
  return /_{2,}/.test(line) || /\.{4,}/.test(line) || /\{\s*\d{1,3}\s*\}/.test(line);
}
function buildGap(qtype: string, start: number | null, end: number | null,
  instructions: string, bodyLines: string[]): QuestionGroup {
  let lines = bodyLines.slice();
  let title = "";
  if (lines.length && lines[0].trim() && !hasGap(lines[0]) &&
      lines[0].split(/\s+/).length <= 8 && !/^[-•*|]/.test(lines[0].trim())) {
    title = lines[0].trim(); lines = lines.slice(1);
  }
  const body = lines.join("\n").trim();
  const [normalized, numbers] = normalizeGaps(body, start);
  if (start === null && numbers.length) start = Math.min(...numbers);
  if (end === null && numbers.length) end = Math.max(...numbers);
  start = start ?? (numbers.length ? Math.min(...numbers) : 1);
  end = end ?? (numbers.length ? Math.max(...numbers) : start);
  const g = mkGroup({ qtype, start, end, instructions, body: normalized, title });
  g.items = numbers.map((n) => ({ number: n, text: "", options: [] }));
  return g;
}
function normalizeGaps(body: string, start: number | null): [string, number[]] {
  const numbers: number[] = [];
  body = body.replace(GAP_EXPLICIT, (_m, d) => { const n = Number(d); numbers.push(n); return `{{Q${n}}}`; });
  let counter = numbers.length ? Math.max(...numbers) + 1 : (start ?? 1);
  const seq = () => { const n = counter++; numbers.push(n); return `{{Q${n}}}`; };
  body = body.replace(GAP_UNDERSCORE, seq).replace(GAP_DOTS, seq);
  const uniq = [...new Set(numbers)].sort((a, b) => a - b);
  return [body, uniq];
}

// ---- statements ----
function collectNumbered(bodyLines: string[]): Item[] {
  const items: Item[] = [];
  for (const line of bodyLines) {
    const s = line.trim();
    if (!s) continue;
    const m = s.match(NUM_LINE);
    if (m) items.push({ number: Number(m[1]), text: m[2].trim(), options: [] });
    else if (items.length) items[items.length - 1].text = (items[items.length - 1].text + " " + s).trim();
  }
  return items;
}
function buildStatements(qtype: string, start: number | null, end: number | null,
  instructions: string, bodyLines: string[]): QuestionGroup | null {
  const items = collectNumbered(bodyLines);
  if (!items.length) return null;
  return mkGroup({ qtype, start: start ?? items[0].number, end: end ?? items[items.length - 1].number, instructions, items });
}

// ---- mcq ----
function collectMcqItems(bodyLines: string[]): Item[] {
  const items: Item[] = [];
  let cur: Item | null = null;
  for (const line of bodyLines) {
    const s = line.trim();
    if (!s) continue;
    const mnum = s.match(NUM_LINE);
    const mopt = s.match(OPT_LINE) || s.match(OPT_LINE_LOOSE);
    if (mnum && !(mopt && cur && cur.options.length < 2)) {
      cur = { number: Number(mnum[1]), text: mnum[2].trim(), options: [] };
      items.push(cur);
    } else if (mopt && cur) {
      cur.options.push([mopt[1].toUpperCase(), mopt[2].trim()]);
    } else if (cur && !cur.options.length) cur.text = (cur.text + " " + s).trim();
  }
  return items.filter((it) => it.options.length);
}
function buildMcq(qtype: string, start: number | null, end: number | null,
  instructions: string, bodyLines: string[]): QuestionGroup | null {
  const items = collectMcqItems(bodyLines);
  if (!items.length) return null;
  return mkGroup({ qtype, start: start ?? items[0].number, end: end ?? items[items.length - 1].number, instructions, items });
}
function buildMcqMulti(qtype: string, start: number | null, end: number | null,
  instructions: string, bodyLines: string[], _optsStr: string): QuestionGroup | null {
  const options = collectOptions(bodyLines);
  if (!options.length) return null;
  const stem = bodyLines.map((l) => l.trim()).filter((s) => s && !OPT_LINE.test(s) && !OPT_LINE_LOOSE.test(s)).join(" ").trim();
  start = start ?? 1; end = end ?? start;
  const g = mkGroup({ qtype, start, end, instructions: (instructions + " " + stem).trim(), options });
  g.items = numbersOf(g).map((n) => ({ number: n, text: "", options: [] }));
  return g;
}

// ---- headings ----
function buildHeadings(qtype: string, start: number | null, end: number | null,
  instructions: string, bodyLines: string[]): QuestionGroup | null {
  const headings: [string, string][] = [];
  const items: Item[] = [];
  for (const line of bodyLines) {
    const s = line.trim();
    if (!s) continue;
    if (/^list of headings/i.test(s)) continue;
    const rm = s.match(ROMAN_LINE);
    const nm = s.match(NUM_LINE);
    if (nm) items.push({ number: Number(nm[1]), text: nm[2].trim(), options: [] });
    else if (rm) headings.push([rm[1].toLowerCase(), rm[2].trim()]);
  }
  if (!items.length) return null;
  return mkGroup({ qtype, start: start ?? items[0].number, end: end ?? items[items.length - 1].number,
    instructions, items, options: headings, optionsTitle: "List of Headings" });
}

// ---- matching ----
function collectOptions(bodyLines: string[]): [string, string][] {
  const opts: [string, string][] = [];
  for (const line of bodyLines) {
    const s = line.trim();
    const m = s.match(OPT_LINE) || s.match(OPT_LINE_LOOSE);
    if (m) opts.push([m[1].toUpperCase(), m[2].trim()]);
  }
  return opts;
}
function looksLikeOption(line: string): boolean {
  const s = line.trim();
  return OPT_LINE.test(s) || OPT_LINE_LOOSE.test(s);
}
function optionsFromSpec(spec: string, paraCount: number): [string, string][] {
  spec = (spec || "").trim();
  const m = spec.match(/^([A-Z])\s*[-–—]\s*([A-Z])$/i);
  if (m) {
    const lo = m[1].toUpperCase().charCodeAt(0), hi = m[2].toUpperCase().charCodeAt(0);
    const out: [string, string][] = [];
    for (let c = lo; c <= hi; c++) out.push([String.fromCharCode(c), ""]);
    return out;
  }
  if (spec) {
    const letters = spec.split(/[,\s]+/).map((x) => x.trim().toUpperCase()).filter((x) => x.length === 1 && /[A-Z]/.test(x));
    if (letters.length) return letters.map((x) => [x, ""] as [string, string]);
  }
  const n = paraCount ? Math.min(paraCount, 13) : 7;
  const out: [string, string][] = [];
  for (let i = 0; i < n; i++) out.push([String.fromCharCode(65 + i), ""]);
  return out;
}
function buildMatching(qtype: string, start: number | null, end: number | null,
  instructions: string, bodyLines: string[], optsStr: string, paraCount: number): QuestionGroup | null {
  let options = collectOptions(bodyLines);
  const items = collectNumbered(bodyLines.filter((ln) => !(OPT_LINE.test(ln.trim()) || looksLikeOption(ln))));
  if (!options.length) options = optionsFromSpec(optsStr, paraCount);
  if (!items.length) return null;
  const title = qtype === "matching_features" ? "People" : "";
  return mkGroup({ qtype, start: start ?? items[0].number, end: end ?? items[items.length - 1].number,
    instructions, items, options, optionsTitle: title });
}

// ---- auto-detect ----
function autoDetect(text: string, paraCount: number): QuestionGroup[] {
  const lines = text.split("\n");
  const idxs: number[] = [];
  for (let i = 0; i < lines.length; i++) if (QUESTIONS_HDR.test(lines[i])) idxs.push(i);
  if (!idxs.length) {
    const g = autoOne(text, null, null, paraCount);
    return g ? [g] : [];
  }
  idxs.push(lines.length);
  const groups: QuestionGroup[] = [];
  for (let k = 0; k < idxs.length - 1; k++) {
    const chunk = lines.slice(idxs[k], idxs[k + 1]).join("\n").trim();
    const hdr = chunk.match(QUESTIONS_HDR);
    const g = autoOne(chunk, hdr ? Number(hdr[1]) : null, hdr ? Number(hdr[2]) : null, paraCount);
    if (g) groups.push(g);
  }
  return groups;
}
function autoOne(chunk: string, start: number | null, end: number | null, paraCount: number): QuestionGroup | null {
  const low = chunk.toLowerCase();
  let qtype: string;
  if (low.includes("true") && low.includes("false") && low.includes("not given")) qtype = "tfng";
  else if (low.includes("yes") && low.includes("no") && low.includes("not given")) qtype = "ynng";
  else if (low.includes("list of headings")) qtype = "headings";
  else if (/which (section|paragraph)/.test(low)) qtype = "matching_info";
  else if (/match each|list of (people|researchers|names)/.test(low)) qtype = "matching_features";
  else if (/choose (two|three|2|3)/.test(low)) qtype = "mcq_multi";
  else if (low.includes("choose the correct letter") || /^\s*[A-D]\)/m.test(chunk)) qtype = "mcq";
  else if (low.includes("complete the notes")) qtype = "note";
  else if (low.includes("complete the summary")) qtype = "summary";
  else if (low.includes("complete the table")) qtype = "table";
  else if (low.includes("complete the flow")) qtype = "flowchart";
  else if (low.includes("label the diagram")) qtype = "diagram";
  else if (/answer the questions|no more than/.test(low) && !hasGap(chunk)) qtype = "shortanswer";
  else if (low.includes("complete the sentences")) qtype = "sentence";
  else if (hasGap(chunk)) qtype = "note";
  else qtype = "sentence";
  // buildGroup o'zi yo'riqnomani ajratadi — oldindan split qilmaymiz
  // (aks holda birinchi variant/element yo'qoladi).
  return buildGroup(qtype, start, end, "", chunk.split("\n"), paraCount);
}

// ============================ render ============================

const TF_CANON: Record<string, string> = {
  t: "TRUE", true: "TRUE", f: "FALSE", false: "FALSE",
  ng: "NOT GIVEN", notgiven: "NOT GIVEN", "not given": "NOT GIVEN",
  y: "YES", yes: "YES", n: "NO", no: "NO",
};
const TFNG_OPTS = ["TRUE", "FALSE", "NOT GIVEN"];
const YNNG_OPTS = ["YES", "NO", "NOT GIVEN"];

function esc(s: string): string {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" } as Record<string, string>)[c]);
}
function expandOptionals(answer: string): string[] {
  const segments = answer.split(/(\([^)]*\))/);
  let combos = [""];
  for (const seg of segments) {
    const choices = (seg.startsWith("(") && seg.endsWith(")")) ? [seg.slice(1, -1), ""] : [seg];
    const next: string[] = [];
    for (const c of combos) for (const ch of choices) next.push(c + ch);
    combos = next;
  }
  return combos;
}

export function renderTest(test: ReadingTest): string {
  const passagesHtml: string[] = [], partHeaders: string[] = [], questionSets: string[] = [], partTabs: string[] = [];
  test.passages.forEach((p, i) => {
    const idx = i + 1, first = idx === 1;
    passagesHtml.push(renderPassage(p, idx, !first));
    partHeaders.push(renderPartHeader(p, idx, !first));
    questionSets.push(renderQuestionSet(p, idx, !first));
    partTabs.push(`<div class="part-tab${first ? " active" : ""}" data-part="${idx}">Part ${idx}</div>`);
  });
  const data = buildData(test);
  let telegram = "";
  if (test.settings.telegramUrl) {
    telegram = `<a href="${esc(test.settings.telegramUrl)}" target="_blank" class="telegram-link">${esc(test.settings.brand)}</a>`;
  }
  const repl: Record<string, string> = {
    "{{TITLE}}": esc(test.title), "{{BRAND}}": esc(test.settings.brand),
    "{{LOGO}}": LOGO_HTML || '<span class="brand-logo" style="font-size:22px">🎓</span>',
    "{{TELEGRAM_LINK}}": telegram, "{{TOTAL}}": String(totalQuestions(test)),
    "{{PART_TABS}}": partTabs.join("\n"), "{{PART_HEADERS}}": partHeaders.join("\n"),
    "{{PASSAGES}}": passagesHtml.join("\n"), "{{QUESTION_SETS}}": questionSets.join("\n"),
    "{{DATA_JSON}}": JSON.stringify(data), "{{STYLES}}": STYLES,
    "{{APP_JS}}": APP_JS.replace(/<\/script/g, "<\\/script"),
  };
  let out = BASE_HTML;
  for (const [k, v] of Object.entries(repl)) out = out.split(k).join(v);
  return out;
}

function renderPassage(p: Passage, idx: number, hidden: boolean): string {
  const cls = "reading-passage" + (hidden ? " hidden" : "");
  const parts = [`<div id="passage-text-${idx}" class="${cls}">`];
  if (p.title) parts.push(`<h4 class="text-center">${esc(p.title)}</h4>`);
  if (p.subtitle) parts.push(`<p class="text-center" style="font-style:italic;margin-bottom:20px;">${esc(p.subtitle)}</p>`);
  p.paragraphs.forEach((para, i) => {
    const letter = p.lettered ? `<strong>${String.fromCharCode(65 + i)}</strong>&nbsp;&nbsp;` : "";
    parts.push(`<p>${letter}${esc(para)}</p>`);
  });
  parts.push("</div>");
  return parts.join("\n");
}
function renderPartHeader(p: Passage, idx: number, hidden: boolean): string {
  const cls = "part-header" + (hidden ? " hidden" : "");
  const rng = qStart(p) ? `${qStart(p)}-${qEnd(p)}` : "";
  return `<div id="part-header-${idx}" class="${cls}"><p><strong>Part ${idx}</strong></p><p>Read the text and answer questions ${rng}.</p></div>`;
}
function renderQuestionSet(p: Passage, idx: number, hidden: boolean): string {
  const cls = "question-set" + (hidden ? " hidden" : "");
  const inner = [`<div id="questions-${idx}" class="${cls}">`, '<div class="questions-container">'];
  for (const g of p.groups) inner.push(renderGroup(g, p));
  inner.push("</div></div>");
  return inner.join("\n");
}
function renderGroup(g: QuestionGroup, p: Passage): string {
  const prompt = promptHtml(g);
  const kind = kindOf(g);
  if (kind === "gap") {
    const body = renderGapBody(g);
    const title = g.title ? `<h4 class="text-center" style="font-weight:bold;margin:12px 0;">${esc(g.title)}</h4>` : "";
    return `<div class="question" data-q-start="${g.start}" data-q-end="${g.end}">${prompt}<div class="notes-content">${title}${body}</div></div>`;
  }
  if (kind === "tfng" || kind === "ynng") return renderStatements(g, prompt);
  if (kind === "mcq") return renderMcq(g, prompt);
  if (kind === "mcq_multi") return renderMcqMulti(g, prompt);
  if (kind === "matching") return renderMatching(g, prompt, p);
  return "";
}
function promptHtml(g: QuestionGroup): string {
  const hdr = `Questions ${g.start}-${g.end}`;
  const instr = g.instructions ? esc(g.instructions) : "";
  let extra = "";
  const kind = kindOf(g);
  if (kind === "tfng" || kind === "ynng") {
    const [a, b] = kind === "tfng" ? ["TRUE", "FALSE"] : ["YES", "NO"];
    extra = `<ul style="list-style:none;padding-left:0;"><li><strong>${a}</strong> — agar fikr matnga mos kelsa</li><li><strong>${b}</strong> — agar fikr matnga zid kelsa</li><li><strong>NOT GIVEN</strong> — agar bu haqda ma'lumot bo'lmasa</li></ul>`;
  }
  return `<div class="question-prompt"><p><strong>${hdr}</strong></p><p>${instr}</p>${extra}</div>`;
}

const TOKEN_RE = /\{\{Q(\d+)\}\}/g;
function injectInputs(s: string): string {
  return esc(s).replace(TOKEN_RE, (_m, n) => `<input type="text" class="answer-input gap-input" id="q${n}" placeholder="${n}">`);
}
function renderGapBody(g: QuestionGroup): string {
  const body = g.body || "";
  if (g.qtype === "table" && body.split("\n").some((ln) => ln.includes("|"))) return renderTable(body);
  const lines = body.split("\n");
  const out: string[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) { out.push('<ul style="list-style:disc;margin-left:40px;">' + bullets.map((b) => `<li>${b}</li>`).join("") + "</ul>"); bullets = []; }
  };
  for (const raw of lines) {
    const s = raw.trim();
    if (!s) { flush(); continue; }
    const content = injectInputs(s);
    if (/^[-•*]/.test(s)) bullets.push(injectInputs(s.replace(/^[-•*\s]+/, "").trim()));
    else if (!TOKEN_RE.test(s) && s.split(/\s+/).length <= 8 && !s.endsWith(":") && s.length < 60 && /^[A-Z]/.test(s)) {
      flush(); out.push(`<h5 style="font-weight:bold;margin-top:12px;">${content}</h5>`);
    } else { flush(); out.push(`<p style="line-height:2.2;">${content}</p>`); }
    TOKEN_RE.lastIndex = 0;
  }
  flush();
  return out.join("\n");
}
function renderTable(body: string): string {
  const rows = body.split("\n").filter((ln) => ln.trim());
  const out = ['<table class="cd-table">'];
  rows.forEach((ln, i) => {
    const cells = ln.split("|").map((c) => c.trim());
    const tag = i === 0 ? "th" : "td";
    out.push("<tr>" + cells.map((c) => `<${tag}>${injectInputs(c)}</${tag}>`).join("") + "</tr>");
  });
  out.push("</table>");
  return out.join("\n");
}

function renderStatements(g: QuestionGroup, prompt: string): string {
  const opts = kindOf(g) === "tfng" ? TFNG_OPTS : YNNG_OPTS;
  const parts = [`<div class="question" data-q-start="${g.start}" data-q-end="${g.end}">`, prompt];
  for (const it of g.items) {
    const radios = opts.map((o) => `<label class="tf-option"><input type="radio" name="q${it.number}" value="${o}"> ${o}</label>`).join("");
    parts.push(`<div class="tf-question" data-qgroup="q${it.number}" data-q-start="${it.number}" data-q-end="${it.number}"><div class="tf-question-line"><span class="tf-question-number">${it.number}</span><span class="tf-question-text">${esc(it.text)}</span></div><div class="tf-options">${radios}</div></div>`);
  }
  parts.push("</div>");
  return parts.join("\n");
}
function renderMcq(g: QuestionGroup, prompt: string): string {
  const parts = [`<div class="question" data-q-start="${g.start}" data-q-end="${g.end}">`, prompt];
  for (const it of g.items) {
    const opts = it.options.map(([letter, text]) =>
      `<div class="multi-choice-option"><label><input type="radio" name="q${it.number}" value="${letter}"> <strong>${letter}</strong>&nbsp;${esc(text)}</label></div>`).join("");
    parts.push(`<div class="multi-choice-question" data-qgroup="q${it.number}" data-q-start="${it.number}" data-q-end="${it.number}"><div class="question-prompt"><p><strong>${it.number}</strong>&nbsp;${esc(it.text)}</p></div>${opts}</div>`);
  }
  parts.push("</div>");
  return parts.join("\n");
}
function renderMcqMulti(g: QuestionGroup, prompt: string): string {
  const n = g.end - g.start + 1;
  const word = ({ 2: "TWO", 3: "THREE", 4: "FOUR" } as Record<number, string>)[n] || String(n);
  const boxes = g.options.map(([letter, text]) =>
    `<div class="multi-choice-option"><label><input type="checkbox" name="qm${g.start}" value="${letter}"> <strong>${letter}</strong>&nbsp;${esc(text)}</label></div>`).join("");
  return `<div class="question" data-q-start="${g.start}" data-q-end="${g.end}">${prompt}<p><em>Choose ${word} letters.</em></p><div class="multi-choice-question">${boxes}</div></div>`;
}
function renderMatching(g: QuestionGroup, prompt: string, p: Passage): string {
  let options = g.options;
  if (!options.length) {
    const count = p.paragraphs.length || 7;
    options = [];
    for (let i = 0; i < count; i++) options.push([String.fromCharCode(65 + i), ""]);
  }
  let bank = "";
  if (options.some(([, txt]) => txt)) {
    const title = g.optionsTitle ? esc(g.optionsTitle) : "Options";
    const rows = options.map(([letter, txt]) => `<li><strong>${esc(letter)}</strong>&nbsp;${esc(txt)}</li>`).join("");
    bank = `<div class="heading-bank"><p><strong>${title}</strong></p><ul class="opt-list">${rows}</ul></div>`;
  }
  const rowsHtml = g.items.map((it) => {
    const opts = '<option value="">Select</option>' + options.map(([letter]) => `<option value="${letter}">${letter}</option>`).join("");
    return `<div class="matching-form-row"><span class="matching-form-label"><strong>${it.number}.</strong> ${esc(it.text)}</span><select class="answer-input" id="q${it.number}">${opts}</select></div>`;
  }).join("");
  return `<div class="question" data-q-start="${g.start}" data-q-end="${g.end}">${prompt}${bank}<div class="matching-form-container">${rowsHtml}</div></div>`;
}

function groupFor(p: Passage, q: number): QuestionGroup | null {
  for (const g of p.groups) if (g.start <= q && q <= g.end) return g;
  return null;
}
function answerValue(ans: string, kind: string): string | string[] {
  ans = String(ans).trim();
  if (kind === "tfng" || kind === "ynng") return TF_CANON[ans.toLowerCase()] ?? ans.toUpperCase();
  if (kind === "mcq" || kind === "matching" || kind === "mcq_multi") return ans.toUpperCase();
  const variants: string[] = [];
  for (const alt of ans.split("/")) {
    const a = alt.trim();
    if (!a) continue;
    for (const exp of expandOptionals(a)) {
      const e = exp.replace(/\s+/g, " ").trim();
      if (e) variants.push(e);
    }
  }
  if (!variants.length) variants.push(ans);
  return variants.length > 1 ? variants : variants[0];
}
function buildData(test: ReadingTest) {
  const answers: Record<string, string | string[]> = {};
  const groups: { kind: string; start: number; end: number }[] = [];
  for (const p of test.passages) {
    for (const g of p.groups) groups.push({ kind: kindOf(g), start: g.start, end: g.end });
    for (const [q, ans] of Object.entries(p.answers)) {
      const g = groupFor(p, Number(q));
      answers[q] = answerValue(ans as string, g ? kindOf(g) : "gap");
    }
  }
  const parts = test.passages.map((p) => [qStart(p), qEnd(p)]);
  const expl: Record<string, string> = {};
  for (const [k, v] of Object.entries(test.explanations)) expl[k] = v;
  return {
    answers, groups, parts,
    settings: { revealMode: test.settings.revealMode === "instant" ? "instant" : "end", explanations: test.settings.explanations, duration: test.settings.durationMin },
    explanations: expl,
  };
}
