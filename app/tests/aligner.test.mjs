// Tests voor de meeluister-logica. Draaien met:  npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { alignText, normalize, syllables, align, tokenize, isAttempt, splitDigits } from "../src/aligner.js";

const TEXT = "Bas de beer zoekt zijn rode muts. Dan hoort hij een geluid in de tuin.";

test("alles goed gelezen", () => {
  const r = alignText(TEXT, "bas de beer zoekt zijn rode muts dan hoort hij een geluid in de tuin");
  assert.equal(r.pos, 15);
  assert.ok(r.statuses.every(s => s === "ok"));
});

test("halverwege: positie klopt", () => {
  const r = alignText(TEXT, "bas de beer zoekt");
  assert.equal(r.pos, 4);
  assert.equal(r.statuses[4], "pending");
});

test("leesfout wordt herkend en daarna verbeterd", () => {
  let r = alignText(TEXT, "bas de beer zoekt zijn rode muts dan hoort hij een gebied");
  assert.equal(r.pos, 11);
  assert.equal(r.statuses[11], "misread");
  assert.equal(r.misheard[11], normalize("gebied"));
  r = alignText(TEXT, "bas de beer zoekt zijn rode muts dan hoort hij een gebied geluid in");
  assert.equal(r.statuses[11], "fixed");
  assert.equal(r.pos, 13);
});

test("kleine herkenningsfout in kort woord telt als goed", () => {
  const r = alignText(TEXT, "bas te beer zoekt zijn rode muts");
  assert.equal(r.statuses[1], "ok");
  assert.equal(r.pos, 7);
});

test("weggelaten kort woordje telt als gelezen, geen fout", () => {
  const r = alignText(TEXT, "bas beer zoekt zijn rode muts");
  assert.equal(r.statuses[1], "ok");
  assert.equal(r.pos, 7);
});

test("overgeslagen woord", () => {
  const r = alignText(TEXT, "bas de beer zoekt zijn muts");
  assert.equal(r.statuses[5], "skipped");   // "rode" overgeslagen
  assert.equal(r.pos, 7);
});

test("tussenwoordjes zoals 'eh' worden genegeerd", () => {
  const r = alignText(TEXT, "bas eh de uhm beer");
  assert.equal(r.pos, 3);
  assert.ok(r.statuses.slice(0, 3).every(s => s === "ok"));
});

test("samengesteld woord dat in tweeën wordt herkend", () => {
  const r = alignText("Mijn bladzij-oren staan aan", "mijn bladzij oren staan aan");
  assert.equal(r.pos, 4);
});

test("lang woord met kleine herkenningsfout telt als goed", () => {
  const r = alignText("Bas klimt voorzichtig omhoog", "bas klimt voorzigtig omhoog");
  assert.equal(r.statuses[2], "ok");
});

test("cijfers en woorden zijn hetzelfde", () => {
  assert.equal(normalize("3"), normalize("drie"));
  assert.equal(normalize("Wijs!"), normalize("weis"));
});

test("lettergrepen", () => {
  assert.deepEqual(syllables("schutting"), ["schut", "ting"]);
  assert.deepEqual(syllables("voorzichtig", { voorzichtig: ["voor", "zich", "tig"] }), ["voor", "zich", "tig"]);
});

test("weer aanhaken na gemiste woorden (microfoon stond even uit)", () => {
  const r = alignText(TEXT, "bas de beer zoekt een geluid in de tuin");
  assert.equal(r.pos, 15);
  assert.equal(r.statuses[5], "skipped");   // "rode": gemist
  assert.equal(r.statuses[11], "ok");
});

test("geen sprong op één los toevallig woord", () => {
  const r = alignText(TEXT, "bas de beer zoekt tuin");
  assert.equal(r.pos, 4);
});

test("terug-lezen (zin opnieuw beginnen) is geen fout en verliest de plek niet", () => {
  const r = alignText(TEXT, "bas de beer zoekt zijn rode muts dan hoort hij dan hoort hij een geluid");
  assert.equal(r.pos, 12);
  assert.ok(!r.statuses.includes("misread"));
});

test("na een fout gewoon verder bij dat woord", () => {
  const r = alignText(TEXT, "bas de beer zoekt zijn rode muts dan hoort hij een gebied bas de beer geluid in de tuin");
  assert.equal(r.statuses[11], "fixed");
  assert.equal(r.pos, 15);
});

test("bijna goed gelezen en gewoon doorlezen: geen fout", () => {
  const r = alignText(TEXT, "bas de beer zoekt zijn rode muts dan hoort hij een gebied in de tuin");
  assert.equal(r.statuses[11], "ok");
  assert.equal(r.pos, 15);
  assert.ok(!r.statuses.includes("misread"));
});

test("bijna goed lang woord telt meteen als goed", () => {
  const r = alignText("De vlinder vliegt voorzichtig verder", "de vlinder vliegt voorzichting verder");
  assert.equal(r.statuses[3], "ok");
  assert.equal(r.pos, 5);
});

test("bijna hele lang woord telt als goed", () => {
  const r = alignText("Pip ziet een prachtige bloem", "pip ziet een prachtig bloem");
  assert.equal(r.statuses[3], "ok");
  assert.equal(r.pos, 5);
});

test("hakkelen en halverwege stoppen telt NIET als goed", () => {
  const r = alignText(TEXT, "bas de beer zoekt zijn rode muts dan hoort hij een ge gel gelu");
  assert.equal(r.pos, 11);
  assert.notEqual(r.statuses[11], "ok");
});

test("na hulp: gehakt woord telt als goede poging", () => {
  const n = s => tokenize(s).map(normalize);
  assert.ok(isAttempt(n("g e l ui d"), normalize("geluid")));
  assert.ok(isAttempt(n("ge luid"), normalize("geluid")));
  assert.ok(isAttempt(n("gelijk"), normalize("geluid")));
  assert.ok(!isAttempt(n("tafel"), normalize("geluid")));
  assert.ok(isAttempt(n("tafel"), normalize("geluid"), 2));   // tweede hulp: altijd door
});

test("na hulp doorgaan: geforceerd woord en dan verder lezen", () => {
  const exp = tokenize(TEXT).map(normalize);
  const heard = tokenize("bas de beer zoekt zijn rode muts dan hoort hij een gebied g e l in de tuin").map(normalize);
  const r = align(exp, heard, undefined, new Set([11]));
  assert.equal(r.statuses[11], "fixed");
  assert.equal(r.pos, 15);
});

test("woord gemist (mic stond uit) en verder lezen: aanhaken op de dichtstbijzijnde plek, niet verderop", () => {
  const T = "Dan hoort hij een geluid in de tuin. De wind blaast de muts hoog in de boom!";
  const r = alignText(T, "dan hoort hij een in de tuin");
  assert.equal(r.statuses[4], "skipped");   // "geluid" gemist
  assert.equal(r.pos, 8);                   // na "tuin", niet aan het eind
  assert.equal(r.statuses[11], "pending");
});

test("woord dat al geteld is nog eens zeggen en doorlezen: geen sprong naar 'in de' verderop", () => {
  const T = "Dan hoort hij een geluid in de tuin. De wind blaast de muts hoog in de boom!";
  const exp = tokenize(T).map(normalize);
  const r = align(exp, tokenize("dan hoort hij een geluid in in de tuin de wind").map(normalize));
  assert.equal(r.pos, 10);
  assert.ok(!r.statuses.includes("skipped"));
});

test("geforceerd woord ('in') en dan 'in de tuin' lezen: gewoon verder", () => {
  const T = "Dan hoort hij een geluid in de tuin. De wind blaast de muts hoog in de boom!";
  const exp = tokenize(T).map(normalize);
  const r = align(exp, tokenize("dan hoort hij een in de tuin de wind").map(normalize), undefined, new Set([4, 5]));
  assert.equal(r.pos, 10);
  assert.ok(!r.statuses.includes("skipped"));
});

test("Safari verstaat 'must' voor 'muts': telt als goed", () => {
  const r = alignText("Daar ligt een boek, maar geen muts.", "daar ligt een boek maar geen must");
  assert.equal(r.statuses[6], "ok");
  assert.equal(r.pos, 7);
});

test("Safari schrijft 'drie, twee, een' als 321: telt gewoon als goed", () => {
  const r = alignText("Noor telt af: drie, twee, een. Ze sluit haar ogen.", "noor telt af 321 ze sluit haar ogen");
  assert.equal(r.pos, 10);
  assert.ok(!r.statuses.includes("skipped") && !r.statuses.includes("misread"));
  assert.deepEqual(splitDigits(["12", "321", "af", "7"]), ["12", "3", "2", "1", "af", "7"]);
});
