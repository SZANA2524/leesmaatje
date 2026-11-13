/**
 * aligner.js — vergelijkt wat het kind zegt met de tekst op de bladzijde.
 *
 * De spraakherkenning geeft losse woorden terug ("bas de beer zoekt zijn rode muts").
 * Wij leggen die woorden naast de verwachte tekst en bepalen per woord:
 *   - "ok"       goed gelezen
 *   - "misread"  er werd iets gezegd dat erop lijkt, maar niet klopt (bijv. "hoopt" i.p.v. "hoort")
 *   - "fixed"    eerst fout gelezen, daarna alsnog goed
 *   - "skipped"  overgeslagen (het kind las het woord erna)
 *   - "pending"  nog niet aan de beurt
 *
 * Het vergelijken gebeurt telkens opnieuw over alles wat er tot nu toe gehoord is.
 * Daardoor maakt het niet uit dat de spraakherkenning tussendoor van gedachten verandert.
 * Dit bestand heeft geen browser nodig en wordt getest met `npm test`.
 */

const NUMBERS = { 0:"nul",1:"een",2:"twee",3:"drie",4:"vier",5:"vijf",6:"zes",7:"zeven",8:"acht",9:"negen",10:"tien",
  11:"elf",12:"twaalf",13:"dertien",14:"veertien",15:"vijftien",16:"zestien",17:"zeventien",18:"achttien",19:"negentien",20:"twintig" };

/**
 * Safari schrijft opgelezen getallen soms als cijfers aan elkaar: "drie, twee, een" wordt "321".
 * Getallen boven de 20 die we niet als woord kennen splitsen we daarom in losse cijfers.
 */
export function splitDigits(tokens) {
  return tokens.flatMap(t => {
    const d = String(t).replace(/[^0-9]/g, "");
    return /^\d{2,6}$/.test(d) && d === String(t).replace(/[.,!?:;]/g, "") && !NUMBERS[+d] ? [...d] : [t];
  });
}

/** Maak een woord vergelijkbaar: kleine letters, geen leestekens of accenten, een paar Nederlandse klanken gelijkgetrokken. */
export function normalize(word) {
  let w = String(word).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  w = w.replace(/[^a-z0-9]/g, "");
  if (/^\d+$/.test(w) && NUMBERS[+w]) w = NUMBERS[+w];
  return w
    .replace(/ij/g, "y").replace(/ei/g, "y")      // ij en ei klinken hetzelfde
    .replace(/au/g, "ou")                          // au en ou klinken hetzelfde
    .replace(/(d|dt)$/, "t");                      // eind-d klinkt als t
}

/** Splits een tekst in woorden (leestekens blijven bij het woord voor de weergave). */
export function tokenize(text) {
  return String(text).split(/\s+/).filter(Boolean);
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Hoe erg lijken twee (al genormaliseerde) woorden op elkaar: 0 = niet, 1 = gelijk. */
export function similarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
}

export const THRESHOLDS = {
  match: 0.7,      // vanaf hier telt een lang woord als goed gelezen (bijna goed = goed)
  skip: 0.85,      // zo zeker moeten we zijn voordat we zeggen dat een woord is overgeslagen
  maxJump: 12,     // hoe ver we maximaal vooruit mogen springen om weer aan te haken
  lookBack: 25,    // terug-lezen tot zoveel woorden terug geldt niet als fout
  misread: 0.4,    // hierboven (maar onder match) is het een leesfout; daaronder negeren we het (bijv. "eh")
};

/** Telt dit als goed gelezen?
 *  We zijn bewust mild: de spraakherkenning verstaat kinderstemmen niet perfect,
 *  en een onterechte "fout" is voor een kind veel vervelender dan een gemiste.
 *  Korte woorden (t/m 5 letters) mogen één letter verschillen, langere iets meer. */
// Twee letters omgedraaid ("must" voor "muts") is een verspreking of een foutje van de herkenning: telt als goed
function swapped(a, b) {
  if (a.length !== b.length || a.length < 3) return false;
  const d = [...a].map((c, i) => c !== b[i] ? i : -1).filter(i => i >= 0);
  return d.length === 2 && d[1] === d[0] + 1 && a[d[0]] === b[d[1]] && a[d[1]] === b[d[0]];
}
export function matches(h, exp, t = THRESHOLDS) {
  if (h === exp || swapped(h, exp)) return true;
  if (exp.length <= 5) return h.length >= 2 && levenshtein(h, exp) <= 1;
  return similarity(h, exp) >= t.match;
}

/** Korte woordjes ("de", "een", "in") laat de herkenning vaak weg. Die tellen we dan gewoon als gelezen. */
const isSmall = w => w.length <= 3;

/**
 * Leg de gehoorde woorden naast de verwachte woorden.
 * @param {string[]} expected  verwachte woorden (genormaliseerd)
 * @param {string[]} heard     gehoorde woorden (genormaliseerd), in volgorde
 * @returns {{pos:number, statuses:string[], misheard:(string|null)[]}}
 *   pos = index van het woord dat nu aan de beurt is
 */
export function align(expected, heard, t = THRESHOLDS, forced = null) {
  const statuses = expected.map(() => "pending");
  const misheard = expected.map(() => null);
  let p = 0;
  const skipForced = () => { while (forced && p < expected.length && forced.has(p)) { statuses[p] = "fixed"; p++; } };
  skipForced();
  for (let k = 0; k < heard.length && p < expected.length; k++, skipForced()) {
    const h = heard[k];
    if (!h) continue;
    const exp = expected[p];

    // 1. Goed gelezen?
    if (matches(h, exp, t)) {
      statuses[p] = statuses[p] === "misread" ? "fixed" : "ok";
      p++;
      continue;
    }
    // 2. Herkenning splitste één woord in tweeën ("bladzij" + "oren" voor "bladzijoren")?
    const joined = h + (heard[k + 1] || "");
    if (heard[k + 1] && matches(joined, exp, t)) {
      statuses[p] = statuses[p] === "misread" ? "fixed" : "ok";
      p++; k++;
      continue;
    }
    // 3a. Woord bijna goed gelezen en het kind leest gewoon door? Dan telt het als goed: niet verbeteren.
    if (statuses[p] === "misread" && p + 1 < expected.length && matches(h, expected[p + 1], t)) {
      statuses[p] = "ok";
      statuses[p + 1] = "ok";
      p += 2;
      continue;
    }
    // 3. Woord overgeslagen? (kind leest het volgende woord, en dat is duidelijk)
    if (p + 1 < expected.length && h.length >= 3 && matches(h, expected[p + 1], t) && similarity(h, expected[p + 1]) >= t.skip) {
      statuses[p] = statuses[p] === "misread" ? "misread" : (isSmall(expected[p]) ? "ok" : "skipped");
      statuses[p + 1] = "ok";
      p += 2;
      continue;
    }
    // 3b. Herhaalt het kind het vorige woord (of het woord ervoor)? Geen sprong, gewoon negeren.
    if ((p >= 1 && matches(h, expected[p - 1], t)) || (p >= 2 && matches(h, expected[p - 2], t))) continue;
    // 4. Verder weg weer aangehaakt? Bijvoorbeeld omdat de microfoon even uit stond terwijl Boekoe praatte.
    //    Alleen als twee gehoorde woorden achter elkaar precies kloppen, om vergissingen te voorkomen.
    let jumped = false;
    for (let j = 1; j <= t.maxJump && p + j + 1 < expected.length + 1; j++) {   // dichtstbijzijnde plek eerst
      const a = expected[p + j], b = expected[p + j + 1];
      // Twee korte woordjes ("in de") komen vaak vaker voor: dan ook het derde woord laten kloppen
      const c = expected[p + j + 2], needThird = isSmall(a || "") && isSmall(b || "");
      if (a && b && matches(h, a, t) && heard[k + 1] && matches(heard[k + 1], b, t)
          && (!needThird || (c && heard[k + 2] && matches(heard[k + 2], c, t)))) {
        for (let x = p; x < p + j; x++) if (statuses[x] === "pending") statuses[x] = isSmall(expected[x]) ? "ok" : "skipped";
        statuses[p + j] = "ok"; statuses[p + j + 1] = "ok";
        if (needThird) { statuses[p + j + 2] = "ok"; p += j + 3; k += 2; } else { p += j + 2; k++; }
        jumped = true;
        break;
      }
    }
    if (jumped) continue;
    // 5. Leest het kind een stukje terug (bijv. de zin opnieuw)? Dat is geen fout: negeren.
    let back = false;
    for (let x = Math.max(0, p - t.lookBack); x < p; x++) if (matches(h, expected[x], t)) { back = true; break; }
    if (back) continue;
    // 6. Lijkt erop maar klopt niet: leesfout. We blijven op dit woord wachten.
    if (h.length >= 3 && similarity(h, exp) >= t.misread) {
      statuses[p] = "misread";
      misheard[p] = h;
      continue;
    }
    // 7. Anders: ruis of een tussenwoordje ("eh", "uhm") — negeren.
  }
  return { pos: p, statuses, misheard };
}

/**
 * Nadat Boekoe bij een woord geholpen heeft: is wat het kind daarna zei een goede poging?
 * Kinderen hakken het woord vaak eerst ("g e l ui t") en plakken het dan ("geluit").
 * Na hulp zijn we extra mild: een kind moet nooit vast blijven zitten op één woord.
 * @param {string[]} fresh  genormaliseerde woorden die na de hulp gehoord zijn
 * @param {string} exp      het verwachte woord (genormaliseerd)
 * @param {number} helps    hoe vaak Boekoe al geholpen heeft bij dit woord
 */
export function isAttempt(fresh, exp, helps = 1) {
  const f = fresh.filter(Boolean);
  if (!f.length) return false;
  if (helps >= 2) return true;                                         // tweede keer geholpen: elke poging is goed
  if (f.some(w => w.length >= 2 && similarity(w, exp) >= 0.5)) return true;   // het woord (bijna) gezegd
  for (let k = 2; k <= f.length; k++) {                                // gehakt: losse stukjes samen
    const joined = f.slice(-k).join("");
    if (similarity(joined, exp) >= 0.6) return true;
  }
  const all = f.join("");
  return f.length >= 2 && all[0] === exp[0] && similarity(all, exp) >= 0.4;  // begint goed en lijkt erop
}

/** Handig: van gewone tekst naar gealigneerde status, voor tests en debuggen. */
export function alignText(expectedText, heardText) {
  return align(tokenize(expectedText).map(normalize), splitDigits(tokenize(heardText)).map(normalize));
}

/** Simpele lettergrepen-splitsing voor de "in stukjes"-hulp (benadering). */
export function syllables(word, known = {}) {
  const w = String(word).toLowerCase().replace(/[^\p{L}]/gu, "");
  if (known[w]) return known[w];
  if (w.length <= 5) return [w];
  const parts = w.match(/[^aeiouy]*[aeiouy]+(?:[^aeiouy](?=[^aeiouy]))?/gi) || [w];
  const joined = parts.join("");
  if (joined.length < w.length) parts[parts.length - 1] += w.slice(joined.length);
  return parts;
}
