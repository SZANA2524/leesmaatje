/**
 * mic.js — de microfoon/spraakherkenning van het toestel (expo-speech-recognition:
 * Apple's SFSpeechRecognizer op iPhone, Google op Android), aangesloten op de lees-motor.
 */
import { ExpoSpeechRecognitionModule } from "expo-speech-recognition";

export async function askMicPermission() {
  const r = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
  return r.granted;
}

/** @param {() => import("./reader").Reader|null} getReader */
export function createMic(getReader, log = () => {}) {
  let on = false, endWait = null;
  const R = () => getReader();
  const subs = [
    ExpoSpeechRecognitionModule.addListener("start", () => { log("mic: aan"); R()?.micStarted(); }),
    ExpoSpeechRecognitionModule.addListener("result", e => { const t = e.results?.[0]?.transcript || ""; R()?.heardSession(t, !!e.isFinal); }),
    ExpoSpeechRecognitionModule.addListener("speechstart", () => R()?.speech(true)),
    ExpoSpeechRecognitionModule.addListener("speechend", () => R()?.speech(false)),
    ExpoSpeechRecognitionModule.addListener("error", e => { log("mic-fout: " + e.error); R()?.micError(e.error); }),
    ExpoSpeechRecognitionModule.addListener("end", () => {
      on = false; log("mic: uit");
      const w = endWait; endWait = null;
      R()?.micEnded();
      if (w) w();
    }),
  ];
  return {
    start() {
      if (on) return; on = true;
      ExpoSpeechRecognitionModule.start({
        lang: "nl-NL", interimResults: true, continuous: true, addsPunctuation: false,
        iosTaskHint: "dictation",
        // spelen en opnemen in één sessie, geluid via de gewone luidspreker
        iosCategory: { category: "playAndRecord", categoryOptions: ["defaultToSpeaker", "allowBluetooth"], mode: "measurement" },
      });
    },
    /** Microfoon uit en wachten tot hij echt uit is. */
    abort() {
      if (!on) return Promise.resolve();
      return new Promise(res => {
        endWait = res;
        try { ExpoSpeechRecognitionModule.abort(); } catch (e) { endWait = null; on = false; res(); }
        setTimeout(() => { if (endWait === res) { endWait = null; on = false; res(); } }, 1500);
      });
    },
    remove() { subs.forEach(s => s.remove()); },
  };
}
