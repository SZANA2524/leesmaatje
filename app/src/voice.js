/**
 * voice.js — Boekoe praat: kiest een zinnetje bij een moment en speelt zijn stem af (expo-audio).
 * Geen geluidsbestand? Dan alleen de tekst. Nooit een computerstem.
 */
import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import LINES from "./lines.json";
import { AUDIO } from "./audioMap";

const MOMENTS = Object.fromEntries(LINES.moments.map(m => [m.id, m]));
const lastPicked = {};
let vars = {};
export const setVars = v => { vars = { ...vars, ...v }; };
const fill = t => t.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");

export function pickLine(moment) {
  const m = MOMENTS[moment]; if (!m) return null;
  let pool = m.lines.filter(l => l.file); if (!pool.length) pool = m.lines;
  if (pool.length > 1) pool = pool.filter(l => l.id !== lastPicked[moment]);
  const line = pool[Math.floor(Math.random() * pool.length)];
  lastPicked[moment] = line.id;
  return line;
}

export async function initAudio() {
  try { await setAudioModeAsync({ playsInSilentMode: true }); } catch (e) {}   // ook hoorbaar met de stil-schakelaar aan
}

let player = null;
/** @returns {{text:string, emotion:string, done:Promise<void>}} */
export function speak(moment, { extra, silent } = {}) {
  const line = pickLine(moment);
  if (!line) return { text: "", emotion: "blij", done: Promise.resolve() };
  const text = fill(line.text) + (extra ? " " + extra : "");
  const file = line.file && line.file.replace(/\.webm$/, ".m4a");
  if (silent || !file || !AUDIO[file]) return { text, emotion: line.emotion, done: new Promise(r => setTimeout(r, 800 + text.length * 40)) };
  const done = new Promise(resolve => {
    try {
      if (player) { try { player.remove(); } catch (e) {} }
      player = createAudioPlayer(AUDIO[file]);
      let finished = false;
      const end = () => { if (finished) return; finished = true; sub && sub.remove(); resolve(); };
      const sub = player.addListener("playbackStatusUpdate", s => { if (s.didJustFinish) end(); });
      player.play();
      setTimeout(end, 15000);                     // vangnet
    } catch (e) { resolve(); }
  });
  return { text, emotion: line.emotion, done };
}
export function stopVoice() { try { player && player.pause(); } catch (e) {} }
