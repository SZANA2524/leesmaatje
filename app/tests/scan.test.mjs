import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cleanOcr } from "../src/clean.js";
import { setWords, fixText } from "../src/ocrfix.js";
import WORDS from "../src/words-nl.js";
setWords(WORDS.split("\n"));
// zoals Apple Vision regels teruggeeft: per regel, met afbreking, paginanummer en letterfoutjes (echte scan blz. 69)
const VISION = ["Juf Josje is al vroeg op school. Een beetje nerveus legt ze de niet-", "nagekeken schrifijes op de tafels van de kinderen. Ze gaan natuurlijk",
  "vragen waarom het nier nagekeken is. Het is niet mocilijk om dan over", "een of andere redding van de afgelopen weck te vertellen. Juf Josje vertelt",
  "niet altijd wat ze's avonds of in het weekend als Superjuffie gedaan", "heeft. Dus ze kan makkelijk het verhaal van de ezels vertellen, die totaal",
  "uitgedroogd in cen weitje stonden.", "69"];
test("foto-regels → nette tekst die precies klopt met het boek", () => {
  const t = fixText(cleanOcr(VISION.map(text => ({ text })))).text;
  assert.ok(readFileSync(new URL("./blz69_truth.txt", import.meta.url), "utf8").startsWith(t), t);
});
