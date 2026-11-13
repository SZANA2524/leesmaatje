# Leesmaatje — echte app (Expo)

Kinderen lezen hardop voor uit hun eigen boek; mascotte Boekoe luistert mee, helpt en geeft complimenten.
Ouder maakt een foto van de bladzijde → tekst wordt OP HET TOESTEL gelezen (gratis, geen server, geen API-sleutel).

## Belangrijke keuzes (niet veranderen zonder overleg)
- **Geen betaalde diensten / geen API-sleutels.** Tekstherkenning: `expo-text-extractor` (Apple Vision / Google ML Kit, op het toestel).
- Spraakherkenning: `expo-speech-recognition` (lang `nl-NL`, continuous, interimResults).
- Boekoe's stem: `expo-audio`, opnames in `assets/audio/*.m4a`. Nooit een computerstem.
- De logica in `src/reader.js`, `src/aligner.js`, `src/ocrfix.js`, `src/clean.js` is gedeeld met de website en getest
  (`npm test` in de map met `tests/`). Pas die alleen aan met een test erbij.
- Regel uit echte iPhone-tests: **nooit geluid terwijl de microfoon luistert** — eerst `mic.abort()` en wachten op het
  `end`-event, dan Boekoe laten praten, dan pas weer `mic.start()`. Dit regelt `Reader.talk()`.

## Project opzetten op de Mac (eenmalig)
1. In deze map: `npx create-expo-app@latest . --template blank --yes` **alleen als er nog geen package.json met expo is**;
   anders: `npm install`.
   (Handiger: maak het project in een lege map en kopieer daarna `App.js`, `app.json`, `src/`, `assets/` hierheen.)
2. `npx expo install expo-speech-recognition expo-text-extractor expo-image-picker expo-audio react-native-svg`
3. `npx expo prebuild --platform ios --clean`
4. Draaien op de iPhone (kabel of zelfde wifi, iPhone ontgrendeld):
   - iPhone: Instellingen → Privacy en beveiliging → **Ontwikkelaarsmodus** aan (herstart).
   - `open ios/*.xcworkspace` → target **Leesmaatje** → *Signing & Capabilities* → Team: de eigen Apple ID (Personal Team).
   - Kies de iPhone bovenin en druk ▶︎ (of: `npx expo run:ios --device`).
   - Eerste keer op iPhone: Instellingen → Algemeen → VPN en apparaatbeheer → ontwikkelaar vertrouwen.
   - Met een gratis Personal Team werkt de app 7 dagen; daarna opnieuw ▶︎.
5. Op de iPhone moeten **Siri en Dicteren** aan staan (nodig voor Apple's spraakherkenning).

## Als de build faalt
- Versies: `npx expo install --fix`, daarna opnieuw `npx expo prebuild --platform ios --clean`.
- API van een bibliotheek veranderd? Kijk in `node_modules/<pakket>/README.md` en pas alleen `src/mic.js`,
  `src/voice.js` of `src/scan.js` aan (dat zijn de dunne laagjes om de bibliotheken).
- Pods: `cd ios && pod install`.

## Testen
- `npm test` (lees-motor en tekst-opschoning, zonder telefoon) — vereist `"test": "node --test tests/*.test.mjs"` in package.json.
- Op de iPhone: foto van een boekbladzijde maken → tekst moet kloppen → "Ik ga lezen" → voorlezen, een woord fout lezen,
  even stil zijn: Boekoe moet helpen, daarna verder luisteren.
- Fout als `Invalid regular expression ... \p{L}` (oude Hermes)? Vervang `\p{L}` door `[A-Za-zÀ-ÖØ-öø-ÿ]` en `\p{Lu}`/`\p{Ll}` door `[A-ZÀ-Ö]`/`[a-zß-ÿ]`.
