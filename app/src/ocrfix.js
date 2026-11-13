/**
 * ocrfix.js — herstelt typische letterfoutjes van tekstherkenning ("mocilijk" -> "moeilijk").
 *
 * Tekst scannen op de iPhone leest kleine, sierlijke boekletters soms net verkeerd:
 * e wordt c, t wordt r of i, enzovoort. Met een lijst van veelgebruikte Nederlandse woorden
 * (data/nl-woorden.txt, gesorteerd van vaak naar minder vaak) zoeken we het echte woord dat het
 * best past. Woorden die we niet kennen (zoals namen) laten we met rust.
 *
 * Woordenlijst: FrequencyWords (Hermit Dave, MIT-licentie), gebaseerd op OpenSubtitles.
 */

// Letters die tekstherkenning vaak door elkaar haalt (van -> naar)
const SWAPS = [
  ["c", "e"], ["e", "c"], ["r", "t"], ["t", "r"], ["i", "t"], ["t", "i"], ["f", "t"], ["t", "f"],
  ["l", "i"], ["i", "l"], ["n", "u"], ["u", "n"], ["h", "b"], ["b", "h"], ["rn", "m"], ["m", "rn"],
  ["cl", "d"], ["d", "cl"], ["vv", "w"], ["o", "e"], ["e", "o"], ["a", "e"], ["s", "e"], ["ii", "ü"],
  ["1", "l"], ["0", "o"], ["ij", "y"], ["y", "ij"],
];

let RANK = null;   // woord -> plek in de lijst (0 = meest gebruikt)

export async function loadWords(url = "data/nl-woorden.txt") {
  if (RANK) return RANK;
  const txt = await fetch(url).then(r => r.ok ? r.text() : Promise.reject(new Error("geen woordenlijst")));
  return setWords(txt.split("\n"));
}
export function setWords(list) {
  RANK = new Map();
  list.forEach((w, i) => { w = w.trim(); if (w && !RANK.has(w)) RANK.set(w, i); });
  return RANK;
}
const rank = w => (RANK && RANK.has(w) ? RANK.get(w) : Infinity);

/** Alle varianten met één of twee van de bekende verwisselingen. */
function swapVariants(w) {
  const one = new Set();
  for (const [a, b] of SWAPS) {
    let i = w.indexOf(a);
    while (i >= 0) { one.add(w.slice(0, i) + b + w.slice(i + a.length)); i = w.indexOf(a, i + 1); }
  }
  const two = new Set();
  if (w.length >= 5) for (const v of one) for (const [a, b] of SWAPS) {
    let i = v.indexOf(a);
    while (i >= 0) { two.add(v.slice(0, i) + b + v.slice(i + a.length)); i = v.indexOf(a, i + 1); }
  }
  return { one: [...one], two: [...two] };
}
/** Eén letter weg, erbij of anders (voor woorden die we helemaal niet kennen). */
function edits1(w) {
  const L = "abcdefghijklmnopqrstuvwxyzëéïöü", out = new Set();
  for (let i = 0; i <= w.length; i++) {
    if (i < w.length) out.add(w.slice(0, i) + w.slice(i + 1));
    for (const c of L) { out.add(w.slice(0, i) + c + w.slice(i)); if (i < w.length) out.add(w.slice(0, i) + c + w.slice(i + 1)); }
  }
  out.delete(w); return [...out];
}
const best = list => list.reduce((b, v) => (rank(v) < rank(b) ? v : b), null);

/** Herstel één woord (alleen de letters; hoofdletters blijven behouden). */
export function fixWord(word) {
  if (!RANK) return word;
  const m = word.match(/^([^\p{L}]*)([\p{L}]+(?:-[\p{L}]+)*)([^\p{L}]*)$/u);
  if (!m) return word;
  const [, pre, core, post] = m;
  if (core.includes("-")) {
    // Afgebroken woord ("verdwij-ning") of echt streepjeswoord ("niet-nagekeken")? De woordenlijst beslist.
    const parts = core.split("-"), joined = parts.join("");
    if (rank(joined.toLowerCase()) < Infinity) return pre + joined + post;
    const fixedJoined = fixCore(joined);
    if (fixedJoined.toLowerCase() !== joined.toLowerCase() && parts.some(p => rank(p.toLowerCase()) === Infinity)) return pre + fixedJoined + post;
    return pre + parts.map(p => fixCore(p)).join("-") + post;
  }
  return pre + fixCore(core) + post;
}
function fixCore(core) {
  const lw = core.toLowerCase();
  if (lw.length < 3) return core;
  const r = rank(lw);
  const { one, two } = swapVariants(lw);
  let pick = null;
  if (r === Infinity) {
    // Onbekend woord: eerst de bekende verwisselingen, dan (lange woorden) één letter verschil
    pick = best(one.filter(v => rank(v) < Infinity)) || best(two.filter(v => rank(v) < 150000));
    if (!pick && lw.length >= 6) pick = best(edits1(lw).filter(v => rank(v) < 60000));
  } else {
    // Bestaand maar zeldzaam woord ("nier") dat met één verwisseling een heel gewoon woord wordt ("niet")
    const c = best(one.filter(v => rank(v) < 400));
    if (c && rank(c) * 300 < r) pick = c;
  }
  if (!pick) return core;
  if (core === core.toUpperCase() && core.length > 1) return pick.toUpperCase();
  if (core[0] === core[0].toUpperCase()) return pick[0].toUpperCase() + pick.slice(1);
  return pick;
}

/** Herstel een hele tekst. Geeft ook terug wat er veranderd is (handig om te testen en te tonen). */
export function fixText(text) {
  const changes = [];
  let out = String(text)
    // "ze's avonds" -> "ze 's avonds"
    .replace(/(\p{L})['’]s\s+(avonds|morgens|ochtends|middags|nachts|zomers|winters)/gu, (all, a, b) => { changes.push([all, `${a} 's ${b}`]); return `${a} 's ${b}`; });
  out = out.split(/(\s+)/).map(tok => {
    if (/^\s+$/.test(tok) || !tok) return tok;
    const f = fixWord(tok);
    if (f !== tok) changes.push([tok, f]);
    return f;
  }).join("");
  return { text: out, changes };
}
