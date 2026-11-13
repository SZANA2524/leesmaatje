/**
 * scan.js — foto van de bladzijde → tekst. Helemaal op het toestel en gratis:
 * Apple Vision (iPhone) of Google ML Kit (Android) via expo-text-extractor.
 * Daarna opschonen (afgebroken woorden, paginanummers) en letterfoutjes herstellen met de woordenlijst.
 */
import * as ImagePicker from "expo-image-picker";
import { extractTextFromImage, isSupported } from "expo-text-extractor";
import { cleanOcr } from "./clean";
import { setWords, fixText } from "./ocrfix";
import WORDS from "./words-nl";

let wordsReady = false;
export function prepareWords() { if (!wordsReady) { setWords(WORDS.split("\n")); wordsReady = true; } }

/** Tekst uit regels van de herkenner → nette leestekst. (Los, zodat we het kunnen testen.) */
export function linesToText(lines) {
  prepareWords();
  const text = cleanOcr(lines.flatMap(t => String(t).split("\n")).map(text => ({ text })));
  return fixText(text);
}

/**
 * @param {"camera"|"library"} from
 * @returns {Promise<{text:string, uri:string, changes:Array}|null>}  null = geannuleerd
 */
export async function photoToText(from = "camera") {
  if (from === "camera") {
    const p = await ImagePicker.requestCameraPermissionsAsync();
    if (!p.granted) throw { code: "camera" };
  }
  const res = from === "camera"
    ? await ImagePicker.launchCameraAsync({ quality: 1 })
    : await ImagePicker.launchImageLibraryAsync({ quality: 1, mediaTypes: ["images"] });
  if (res.canceled || !res.assets?.length) return null;
  const uri = res.assets[0].uri;
  if (!isSupported) throw { code: "unsupported" };
  const lines = await extractTextFromImage(uri);
  const r = linesToText(Array.isArray(lines) ? lines : [String(lines || "")]);
  if (r.text.split(" ").filter(Boolean).length < 3) throw { code: "no_text" };
  return { text: r.text, uri, changes: r.changes };
}
