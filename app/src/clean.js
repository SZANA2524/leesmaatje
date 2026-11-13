/** clean.js — herkende regels opschonen tot leesbare tekst (zelfde als de website). */
export function cleanOcr(lines, { strict = false } = {}) {
  const keep = [];
  for (const l of lines || []) {
    const t = String(l.text || "").replace(/\s+/g, " ").trim();
    if (!t) continue;
    const letters = (t.match(/\p{L}/gu) || []).length, chars = t.replace(/\s/g, "").length;
    if (letters < 1) continue;                                       // alleen een paginanummer of streepjes
    // Alleen bij de gratis foto-herkenner (strict): rommel en onzekere stukjes eruit. Niet bij gescande/geplakte tekst:
    // die is betrouwbaar, en korte regels als "'Ja!'" moeten blijven.
    if (strict && (letters < 2 || letters / chars < 0.6 || (l.confidence ?? 100) < 45)) continue;
    keep.push(t);
  }
  let text = keep.join("\n")
    .replace(/(\p{L})[-\u2010\u00AD]\n(\p{Ll})/gu, "$1-$2")           // afgebroken aan regeleinde: streepje houden; ocrfix.js beslist of het weg mag
    .replace(/\n/g, " ")
    .replace(/[|_~^`<>{}\[\]\\=*#@]/g, "")
    .replace(/\s+([.,!?;:])/g, "$1")
    .replace(/\s+/g, " ").trim();
  text = text.split(" ").filter(w => /\p{L}|\d/u.test(w)).join(" ");
  if (text.length > 3000) {                                         // te lang: netjes na een hele zin afknippen
    const cut = text.slice(0, 3000), end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
    text = end > 1000 ? cut.slice(0, end + 1) : cut.slice(0, cut.lastIndexOf(" "));
  }
  return text;
}
