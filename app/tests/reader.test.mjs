import { test } from "node:test";
import assert from "node:assert/strict";
import { Reader } from "../src/reader.js";

const sleep = ms => new Promise(r => setTimeout(r, ms));
const FAST = { stuckAfter: 900, stuckAfterTry: 500, stuckAfterMisread: 1500, quietBeforeHelp: 400, misreadDelay: 250,
  misreadQuiet: 350, moveOnSilent: 1500, moveOnAfter: 2500, firstWord: 1500, tick: 50, complimentGap: 999999 };
const TEXT = "Bas de beer zoekt zijn rode muts. Hij kijkt onder het bed. Dan hoort hij een geluid in de tuin.";

// Nagebootste microfoon zoals expo-speech-recognition: per luisterbeurt een groeiende tekst
function setup() {
  const log = [], said = [];
  let on = false, transcript = "";
  const mic = {
    start() { if (on) return; on = true; transcript = ""; log.push("mic aan"); setTimeout(() => r.micStarted(), 20); },
    abort() { const was = on; on = false; if (was) { log.push("mic uit"); r.micEnded(); } return sleep(30); },
  };
  const say = async (m, o) => { said.push(m + (o && o.extra ? ` [${o.extra}]` : "")); await sleep(120); };
  let done = null;
  const r = new Reader({ text: TEXT, mic, say, patience: FAST, onFinish: s => done = s, log: m => log.push(m) });
  const kid = async (words, gap = 60) => { for (const w of words.split(" ")) { await sleep(gap); if (!on) { log.push(`(mic uit: "${w}" gemist)`); continue; }
      transcript = (transcript + " " + w).trim(); r.speech(true); r.heardSession(transcript, false); } };
  return { r, said, log, kid, get done() { return done; } };
}
const until = async (fn, ms = 6000) => { const t = Date.now(); while (!fn() && Date.now() - t < ms) await sleep(30); return fn(); };

test("goed voorlezen: geen hulp, eindstand 100%", async () => {
  const s = setup(); s.r.start(); await until(() => s.r.ready);
  await s.kid("Bas de beer zoekt zijn rode muts"); await sleep(200); await s.kid("Hij kijkt onder het bed"); await sleep(200);
  await s.kid("Dan hoort hij een geluid in de tuin");
  assert.ok(await until(() => s.done)); assert.equal(s.done.acc, 100);
  assert.deepEqual(s.said, ["instr_read"]);
});

test("fout woord: Boekoe verbetert alleen dat woord, kind leest het goed, compliment, verder", async () => {
  const s = setup(); s.r.start(); await until(() => s.r.ready);
  await s.kid("Bas de beer zoekt zijn rode muts Hij kijkt onder het bed Dan hoort hij een gebied");
  assert.ok(await until(() => s.said.some(x => x.startsWith("misread"))), "verbetering");
  await until(() => !s.r.talking); await sleep(100);
  await s.kid("geluid"); assert.ok(await until(() => s.said.some(x => x === "gotit" || x === "compliment")), "compliment");
  await until(() => !s.r.talking); await sleep(100);
  await s.kid("in de tuin");
  assert.ok(await until(() => s.done), "klaar");
  assert.ok(s.said.find(x => x.startsWith("misread")).includes("geluid"));
});

test("stilte bij een woord: hulp in stukjes, kind leest het, verder tot het eind", async () => {
  const s = setup(); s.r.start(); await until(() => s.r.ready);
  await s.kid("Bas de beer zoekt zijn rode muts Hij kijkt onder het bed Dan hoort hij een");
  assert.ok(await until(() => s.said.some(x => x.startsWith("stuck"))), "hulp");
  assert.match(s.said.find(x => x.startsWith("stuck")), /ge · luid/);
  await until(() => !s.r.talking); await sleep(100);
  await s.kid("geluid in de tuin");
  assert.ok(await until(() => s.done), "klaar");
});

test("bijna goed en doorlezen: geen verbetering", async () => {
  const s = setup(); s.r.start(); await until(() => s.r.ready);
  await s.kid("Bas de beer zoek zijn rooie muts Hij kijk onder het bed Dan hoort hij een geluid in de tuin");
  assert.ok(await until(() => s.done));
  assert.ok(!s.said.some(x => x.startsWith("misread") || x.startsWith("stuck")), s.said.join(","));
});

test("helemaal stil na hulp: samen verder (nooit vastzitten)", async () => {
  const s = setup(); s.r.start(); await until(() => s.r.ready);
  await s.kid("Bas de beer zoekt zijn rode muts Hij kijkt onder het bed Dan hoort hij een");
  await until(() => s.said.some(x => x.startsWith("stuck")));
  assert.ok(await until(() => s.r.pos > 12, 8000), "door naar volgende woord");
  await s.kid("in de tuin"); assert.ok(await until(() => s.done));
  assert.ok(!s.said.includes("gotit"), "geen compliment voor overgeslagen woord");
});

test("microfoon staat nooit aan terwijl Boekoe praat", async () => {
  const s = setup(); let overlap = false;
  const say0 = s.r.o.say; s.r.o.say = async (m, o) => { if (s.log.at(-1) === "mic aan") overlap = true; return say0(m, o); };
  s.r.start(); await until(() => s.r.ready);
  await s.kid("Bas de beer zoekt zijn rode muts Hij kijkt onder het bed Dan hoort hij een gebied");
  await until(() => s.said.some(x => x.startsWith("misread")));
  assert.equal(overlap, false);
  await s.r.stop();
});
