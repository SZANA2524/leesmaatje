/**
 * reader.js — de "lees-motor" van Boekoe, los van het scherm.
 *
 * Volgt waar het kind is in de tekst, beslist wanneer Boekoe helpt, verbetert of een compliment geeft.
 * Werkt met elke microfoon en elke manier van praten: die worden van buitenaf meegegeven.
 * Dezelfde regels als de website (getest op een echte iPhone, zie de BOEKOE-projectnotities).
 *
 *   const r = new Reader({ text, mic, say, onChange, onFinish });
 *   r.start();                         // Boekoe legt uit, daarna gaat de microfoon aan
 *   // de microfoon roept aan: r.micStarted(), r.heard(final, interim), r.speech(true/false), r.micEnded(), r.micError(code)
 */
import { align, normalize, tokenize, syllables, isAttempt, similarity, splitDigits } from "./aligner.js";

export const PATIENCE = {
  stuckAfter: 3500,         // niets gezegd: zo lang wachten voordat Boekoe helpt
  stuckAfterTry: 1500,      // wél geprobeerd (gehakkeld) en dan stil: sneller helpen
  stuckAfterMisread: 6000,  // na een verbetering: nog even de kans geven
  quietBeforeHelp: 1500,    // het kind moet ook echt even stil zijn
  misreadDelay: 900,        // eerst zelf laten verbeteren voordat Boekoe iets zegt
  misreadQuiet: 1300,       // en alleen als het kind even stil is
  sentencesPerCompliment: 4,
  complimentGap: 30000,
  moveOnSilent: 6000,       // na hulp helemaal niets meer gezegd: samen verder
  moveOnAfter: 9000,
  firstWord: 6000,          // het allereerste woord: rustig laten beginnen
  tick: 300,
};

export class Reader {
  /**
   * @param {object} o
   * @param {string} o.text
   * @param {object} [o.syllables]     bekende lettergrepen per woord
   * @param {{start:Function, abort:Function}} o.mic   abort() geeft een Promise die klaar is als de mic echt uit is
   * @param {(moment:string, opts?:object)=>Promise<void>} o.say   Boekoe laat iets horen/zien; klaar als ze uitgepraat is
   * @param {(state:object)=>void} [o.onChange]
   * @param {(stats:object)=>void} [o.onFinish]
   * @param {(msg:string)=>void} [o.log]
   * @param {object} [o.patience]      andere wachttijden (bijv. voor tests)
   */
  constructor(o) {
    this.o = o;
    this.P = { ...PATIENCE, ...(o.patience || {}) };
    this.words = tokenize(o.text).map(raw => ({ raw, clean: raw.toLowerCase().replace(/[^\p{L}]/gu, "") }));
    this.expected = this.words.map(w => normalize(w.raw));
    this.statuses = this.expected.map(() => "pending");
    this.pos = 0; this.reading = false; this.ready = false; this.talking = false; this.helping = false;
    this.helped = new Set(); this.forced = new Set(); this.together = new Set(); this.helps = {};
    this.stuckAt = -1; this.misreadAt = -1; this.streak = 0; this.tried = false; this.heardLen = 0; this.heardStr = "";
    this.finalLen = 0; this.helpMark = 0; this.lastHelpAt = 0; this.startedAt = 0;
    this.lastProgress = Date.now(); this.lastHeard = Date.now(); this.lastTalk = 0; this.micAliveAt = 0;
    this.speaking = false; this.speechAt = 0; this.timers = new Set(); this.flash = -1; this.lastSay = null;
    this.prevFinal = []; this.session = [];
  }
  log(m) { this.o.log && this.o.log(m); }
  emit() {
    this.o.onChange && this.o.onChange({
      words: this.words.map((w, i) => ({ raw: w.raw, status: this.statuses[i], helped: this.helped.has(i), now: i === this.pos && this.ready, flash: i === this.flash })),
      pos: this.pos, total: this.words.length, ready: this.ready, talking: this.talking, say: this.lastSay,
    });
  }
  later(fn, ms) { const t = setTimeout(() => { this.timers.delete(t); fn(); }, ms); this.timers.add(t); return t; }

  /* ---------------- starten en stoppen ---------------- */
  async start() {
    this.reading = true; this.emit();
    await this.talk("instr_read");                 // eerst de uitleg, dan pas de microfoon (en "Lees maar!")
    if (!this.reading) return;
    this.ready = true; this.lastProgress = this.lastHeard = Date.now(); this.emit();
    this.ticker = setInterval(() => this.checkStuck(), this.P.tick);
  }
  async stop() {
    if (!this.reading) return;
    this.reading = false; this.ready = false;
    clearInterval(this.ticker); this.timers.forEach(clearTimeout); this.timers.clear();
    try { await this.o.mic.abort(); } catch (e) {}
    this.emit();
  }
  async finish() {
    if (!this.reading) return;
    await this.stop();
    const st = this.statuses;
    const read = st.filter(s => s === "ok" || s === "fixed").length;
    const done = Math.max(st.filter(s => s !== "pending" && s !== "skipped").length, 1);
    const minutes = this.startedAt ? (Date.now() - this.startedAt) / 60000 : 0;
    const stats = {
      wpm: minutes > 0.05 ? Math.round(read / minutes) : 0,
      acc: Math.min(100, Math.round(st.filter((s, i) => s === "ok" && !this.helped.has(i)).length / done * 100)),
      practice: [...new Set([...this.helped].map(i => this.words[i] && this.words[i].clean).filter(Boolean))].slice(0, 8),
    };
    this.o.onFinish && this.o.onFinish(stats);
  }

  /** Boekoe laat iets horen: eerst de microfoon helemaal uit, dan praten, dan weer luisteren. */
  async talk(moment, opts = {}) {
    this.talking = true; this.emit();
    try { await this.o.mic.abort(); } catch (e) {}
    this.lastSay = { moment, ...opts };
    try { await this.o.say(moment, opts); } catch (e) {}
    this.talking = false; this.lastTalk = Date.now();
    if (this.reading) { this.o.mic.start(); this.lastProgress = Math.max(this.lastProgress, Date.now()); }
    this.emit();
  }

  /* ---------------- berichten van de microfoon ---------------- */
  micStarted() { this.micAliveAt = Date.now(); this.speaking = false; this.lastProgress = Math.max(this.lastProgress, Date.now());
    if (this.helped.has(this.pos) && !this.forced.has(this.pos)) { this.flash = this.pos; this.emit(); this.later(() => { this.flash = -1; this.emit(); }, 1500); } }
  speech(on) { this.speaking = !!on; this.speechAt = Date.now(); this.lastHeard = Date.now(); }
  /** Alles wat deze luisterbeurt tot nu toe gehoord is (zoals de spraakherkenning het doorgeeft). */
  heardSession(transcript, isFinal) {
    this.session = tokenize(transcript || "");
    if (isFinal) { this.prevFinal = [...this.prevFinal, ...this.session]; this.session = []; }
    this.heard(this.prevFinal, this.session);
  }
  micEnded() {   // luisterbeurt voorbij: wat nog voorlopig was, telt mee
    if (this.session.length) { this.prevFinal = [...this.prevFinal, ...this.session]; this.session = []; }
    if (this.reading && this.ready && !this.talking && !this.helping) this.later(() => { if (this.reading && !this.talking && !this.helping) this.o.mic.start(); }, 250);
  }
  micError(code) { this.log("mic-fout: " + code); }

  /* ---------------- het hart: wat is er gehoord? ---------------- */
  heard(finalWords, interimWords) {
    if (!this.reading) return;
    finalWords = splitDigits(finalWords); interimWords = splitDigits(interimWords);
    const heardRaw = [...finalWords, ...interimWords], heardStr = heardRaw.join(" ");
    if (heardStr !== this.heardStr) { this.lastHeard = Date.now(); this.heardStr = heardStr; }
    this.finalLen = finalWords.length;
    const cur = this.pos;
    if (this.helped.has(cur) && !this.forced.has(cur)
        && isAttempt(heardRaw.slice(this.helpMark).map(normalize), this.expected[cur], this.helps[cur] || 1)) this.forced.add(cur);
    const live = align(this.expected, heardRaw.map(normalize), undefined, this.forced);
    const before = this.statuses; this.statuses = live.statuses;
    live.statuses.forEach((s, i) => {
      if (s === before[i]) return;
      if (s === "ok" || s === "fixed") {
        if (!this.startedAt) this.startedAt = Date.now();
        if (this.helped.has(i) && !this.together.has(i)) this.praise();
        else if (/[.!?]$/.test(this.words[i].raw) && ++this.streak >= this.P.sentencesPerCompliment && i < this.words.length - 1
                 && Date.now() - this.lastTalk > this.P.complimentGap) { this.streak = 0; this.lastSay = { moment: "compliment", silent: true }; }
      } else if (s === "misread" && this.misreadAt !== i) {
        this.misreadAt = i; this.scheduleMisread(i);
      }
    });
    const pos = live.pos;
    if (pos !== this.pos) { this.log(`wijzer ${this.pos}->${pos}`); this.pos = pos; this.lastProgress = Date.now(); this.tried = false; }
    else if (heardRaw.length > this.heardLen && this.ready) {
      const lastW = normalize(heardRaw[heardRaw.length - 1] || ""), target = this.expected[pos] || "";
      const reread = this.expected.slice(Math.max(0, pos - 4), pos).some(e => e === lastW || e.includes(lastW) || similarity(e, lastW) >= 0.7);
      if (!reread && lastW.length >= 2 && (lastW[0] === target[0] || similarity(lastW, target) >= 0.4)) this.tried = true;
    }
    this.heardLen = heardRaw.length;
    this.emit();
    if (pos >= this.words.length) this.finish();
  }

  scheduleMisread(i) {
    const check = () => {
      if (!this.reading || this.statuses[i] !== "misread" || this.pos !== i || this.helping) return;
      if (this.talking || this.kidSpeaking() || Date.now() - this.lastHeard < this.P.misreadQuiet) { this.later(check, 300); return; }
      this.helpAfterMic(i, () => this.statuses[i] === "misread", () => {
        this.markHelp(i); this.streak = 0;
        this.talk("misread", { extra: `👉 „${this.words[i].clean}” (alleen dit woord)`, mood: "fixit" });
      });
    };
    this.later(check, this.P.misreadDelay);
  }
  praise() {
    this.later(() => { if (this.reading && !this.talking) this.talk(Math.random() < 0.5 ? "gotit" : "compliment", { mood: "good" }); }, 250);
  }
  markHelp(i) { this.helped.add(i); this.helps[i] = (this.helps[i] || 0) + 1; this.helpMark = this.finalLen; this.lastHelpAt = Date.now(); }
  // "Er wordt gesproken" telt maar even: sommige toestellen melden het maar één keer per luisterbeurt
  kidSpeaking() { return this.speaking && Date.now() - this.speechAt < 1500; }

  /** Eerst de microfoon uit (laatste woorden komen dan nog binnen); is hulp dan nog nodig? */
  async helpAfterMic(i, stillNeeded, doHelp) {
    if (this.helping) return;
    this.helping = true;
    this.log(`check hulp bij ${this.words[i].raw}`);
    try { await this.o.mic.abort(); } catch (e) {}
    this.helping = false;
    if (!this.reading) return;
    if (this.pos !== i || !stillNeeded()) { this.lastProgress = Date.now(); if (!this.talking) this.o.mic.start(); return; }
    doHelp();
  }

  checkStuck() {
    if (!this.reading || !this.ready || this.talking || this.helping || this.kidSpeaking()) { this.lastProgress = Math.max(this.lastProgress, Date.now() - this.P.tick); return; }
    const i = this.pos; if (i >= this.words.length) return;
    const P = this.P, now = Date.now();
    if (this.helped.has(i) && this.lastHeard < this.lastHelpAt) {      // geholpen, daarna niets meer gezegd
      if (now - Math.max(this.lastHelpAt, this.micAliveAt) > P.moveOnSilent) this.moveOn(i);
      return;
    }
    if (this.stuckAt === i) { if (now - this.lastHelpAt > P.moveOnAfter && now - this.lastHeard > P.quietBeforeHelp) this.moveOn(i); return; }
    let wait = this.statuses[i] === "misread" ? P.stuckAfterMisread : this.tried ? P.stuckAfterTry : P.stuckAfter;
    if (i === 0 && !this.startedAt) wait = Math.max(wait, P.firstWord);
    if (now - this.lastProgress > wait && now - this.lastHeard > P.quietBeforeHelp) {
      this.helpAfterMic(i, () => true, () => {
        this.stuckAt = i; this.markHelp(i); this.streak = 0;
        const w = this.words[i], parts = syllables(w.clean, this.o.syllables || {}).join(" · ");
        this.talk("stuck", { extra: /^\p{Lu}/u.test(w.raw) ? parts.charAt(0).toUpperCase() + parts.slice(1) : parts, mood: "tip" });
      });
    }
  }
  moveOn(i) {
    this.log(`samen verder bij ${this.words[i].raw}`);
    this.together.add(i); this.forced.add(i);
    this.heard(this.prevFinal, this.session);
  }
}
