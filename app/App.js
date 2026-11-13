/**
 * Leesmaatje — de echte app (Expo).
 * Ouder maakt een foto van de bladzijde → Boekoe leest de tekst (op het toestel, gratis) → kind leest voor, Boekoe luistert mee.
 *
 * De slimme delen zijn gedeeld met de website en getest:
 *   src/reader.js   lees-motor (wijzer, hulp, verbeteren, complimenten)
 *   src/aligner.js  vergelijkt wat het kind zegt met de tekst
 *   src/ocrfix.js   herstelt letterfoutjes van de tekstherkenning
 */
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { SvgXml } from "react-native-svg";
import { Reader } from "./src/reader";
import { createMic, askMicPermission } from "./src/mic";
import { speak, initAudio, stopVoice } from "./src/voice";
import { photoToText, prepareWords } from "./src/scan";
import { boekoeSVG } from "./src/face";
import { STORIES } from "./src/stories";

const C = { bg: "#FFF8EE", ink: "#2B2A33", muted: "#77727F", purple: "#6A4CE0", purpleL: "#EDE8FF", green: "#3F9B6B", greenL: "#E3F5EA",
  orange: "#F2A33A", orangeL: "#FFF1DC", red: "#D9544F", redL: "#FDE7E6", line: "#EFE6D8", card: "#FFFFFF" };

function Boekoe({ emotion = "blij", size = 120 }) {
  return <View style={{ width: size, height: size }}><SvgXml xml={boekoeSVG(emotion)} width={size} height={size} /></View>;
}
function Bubble({ say }) {
  if (!say || !say.text) return null;
  const bg = say.mood === "good" ? C.greenL : say.mood === "fixit" ? C.redL : say.mood === "tip" ? C.orangeL : C.purpleL;
  return (
    <View style={[s.bubble, { backgroundColor: bg }]}>
      <Boekoe emotion={say.emotion || "blij"} size={44} />
      <Text style={s.bubbleText}>{say.text}</Text>
    </View>
  );
}
function Btn({ title, onPress, ghost, disabled, style }) {
  return (
    <Pressable onPress={onPress} disabled={disabled}
      style={({ pressed }) => [s.btn, ghost && s.btnGhost, disabled && { opacity: 0.5 }, pressed && { transform: [{ scale: 0.98 }] }, style]}>
      <Text style={[s.btnText, ghost && { color: C.purple }]}>{title}</Text>
    </Pressable>
  );
}

export default function App() {
  const [screen, setScreen] = useState("home");       // home | stories | busy | read | done
  const [homeSay, setHomeSay] = useState(null);
  const [book, setBook] = useState(null);             // {title, text, syllables, quiz, photo}
  const [rs, setRs] = useState(null);                 // stand van de lees-motor
  const [readSay, setReadSay] = useState(null);
  const [stats, setStats] = useState(null);
  const [doneSay, setDoneSay] = useState(null);
  const reader = useRef(null), mic = useRef(null);

  useEffect(() => {
    initAudio();
    mic.current = createMic(() => reader.current, m => console.log(m));
    setTimeout(prepareWords, 500);                    // woordenlijst alvast klaarzetten
    const h = new Date().getHours();
    const sp = speak(h < 12 ? "greet_morning" : h < 18 ? "greet_afternoon" : "greet_evening");
    setHomeSay({ text: sp.text, emotion: sp.emotion });
    return () => { mic.current && mic.current.remove(); };
  }, []);

  /* ---------- foto van de bladzijde ---------- */
  async function takePhoto(from = "camera") {
    stopVoice();
    try {
      setScreen("busy");
      const r = await photoToText(from);
      if (!r) { setScreen("home"); return; }
      openBook({ title: "Mijn boek", text: r.text, syllables: {}, quiz: null, photo: r.uri });
    } catch (e) {
      setScreen("home");
      const msg = e?.code === "camera" ? "Boekoe mag de camera nog niet gebruiken. Zet de camera aan bij Instellingen → Leesmaatje."
        : e?.code === "no_text" ? "Boekoe ziet geen tekst op deze foto. Maak een foto van dichtbij, recht van boven en met goed licht."
        : e?.code === "unsupported" ? "Tekst lezen werkt niet op dit toestel."
        : "Het lezen van de foto lukte niet. Probeer het nog een keer.";
      Alert.alert("Oeps!", msg);
    }
  }

  /* ---------- lezen ---------- */
  function openBook(b) { setBook(b); setRs(null); setReadSay(null); setScreen("read"); }
  async function startReading() {
    if (!(await askMicPermission())) {
      Alert.alert("Microfoon", "Boekoe moet kunnen meeluisteren. Sta de microfoon en spraakherkenning toe bij Instellingen → Leesmaatje.");
      return;
    }
    const r = new Reader({
      text: book.text, syllables: book.syllables, mic: mic.current,
      say: async (moment, opts = {}) => {
        const sp = speak(moment, opts);
        setReadSay({ text: sp.text, emotion: sp.emotion, mood: opts.mood });
        await sp.done;
        if (moment === "instr_read") setTimeout(() => setReadSay(null), 1500);
      },
      onChange: st => setRs(st),
      onFinish: st => { setStats(st); setScreen("done"); const sp = speak("page_done"); setDoneSay({ text: sp.text, emotion: sp.emotion }); },
      log: m => console.log("[lezen]", m),
    });
    reader.current = r;
    r.start();
  }
  async function stopReading(toScreen) {
    const r = reader.current; reader.current = null;
    if (r) await r.stop();
    stopVoice();
    if (toScreen) setScreen(toScreen);
  }

  /* ---------- schermen ---------- */
  if (screen === "busy") return (
    <Shell><View style={s.center}><Boekoe emotion="nieuwsgierig" size={140} /><Text style={s.h2}>Boekoe leest je bladzijde…</Text>
      <ActivityIndicator size="large" color={C.purple} style={{ marginTop: 16 }} /></View></Shell>
  );

  if (screen === "stories") return (
    <Shell title="Kies een verhaaltje" onBack={() => setScreen("home")}>
      {STORIES.map(st => (
        <Pressable key={st.id || st.title} style={s.card} onPress={() => openBook({ title: st.title, text: st.text, syllables: st.syllables, quiz: st.quiz })}>
          <Text style={s.cardTitle}>{st.title}</Text><Text style={s.muted}>{st.level}</Text>
        </Pressable>
      ))}
    </Shell>
  );

  if (screen === "read" && book) {
    const words = rs ? rs.words : book.text.split(/\s+/).map(raw => ({ raw, status: "pending" }));
    const reading = !!reader.current;
    const progress = rs ? rs.pos / Math.max(1, rs.total) : 0;
    return (
      <Shell title={book.title} onBack={() => stopReading("home")}>
        <View style={s.barBg}><View style={[s.bar, { width: `${progress * 100}%` }]} /></View>
        {book.photo ? <Image source={{ uri: book.photo }} style={s.photo} resizeMode="cover" /> : null}
        <View style={s.page}>
          <Text style={s.pageText}>
            {words.map((w, i) => (
              <Text key={i} style={[
                w.status === "ok" && !w.helped && { color: C.green },
                (w.status === "fixed" || w.helped) && { color: C.orange },
                w.status === "skipped" && { color: "#B9B3C4" },
                w.now && s.now, w.flash && s.flash,
              ]}>{w.raw + " "}</Text>
            ))}
          </Text>
        </View>
        <Bubble say={readSay} />
        <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
          <Btn style={{ flex: 1 }} disabled={reading}
            title={!reading ? "🎤 Ik ga lezen" : rs?.talking ? "🤫 Boekoe praat…" : rs?.ready ? "👂 Lees maar, ik luister!" : "Even wachten…"}
            onPress={startReading} />
          {reading ? <Btn ghost title="Klaar" onPress={() => reader.current && reader.current.finish()} /> : null}
        </View>
      </Shell>
    );
  }

  if (screen === "done" && stats) return (
    <Shell title="Super gedaan!" onBack={() => { stopVoice(); setScreen("home"); }}>
      <View style={s.center}><Boekoe emotion="trots" size={140} /></View>
      <Bubble say={doneSay} />
      <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
        <View style={[s.card, { flex: 1, alignItems: "center" }]}><Text style={s.big}>{stats.wpm || "–"}</Text><Text style={s.muted}>woorden per minuut</Text></View>
        <View style={[s.card, { flex: 1, alignItems: "center" }]}><Text style={s.big}>{stats.acc}%</Text><Text style={s.muted}>zelf goed gelezen</Text></View>
      </View>
      {stats.practice.length ? <View style={s.card}><Text style={s.cardTitle}>🧩 Lastige woorden</Text><Text style={s.pageText}>{stats.practice.join(", ")}</Text></View> : null}
      <Btn title="📖 Nog een bladzijde" onPress={() => { stopVoice(); setScreen("home"); }} style={{ marginTop: 12 }} />
    </Shell>
  );

  return (
    <Shell>
      <View style={s.center}>
        <Bubble say={homeSay} />
        <Pressable onPress={() => { const sp = speak("tap_boekoe"); setHomeSay({ text: sp.text, emotion: sp.emotion }); }}>
          <Boekoe size={180} />
        </Pressable>
      </View>
      <View style={{ flex: 1 }} />
      <Btn title="📷 Maak een foto van je bladzijde" onPress={() => takePhoto("camera")} />
      <Btn ghost title="🖼️ Kies een foto" onPress={() => takePhoto("library")} style={{ marginTop: 10 }} />
      <Btn ghost title="📚 Kies een verhaaltje" onPress={() => setScreen("stories")} style={{ marginTop: 10 }} />
    </Shell>
  );
}

function Shell({ title, onBack, children }) {
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={s.top}>
        {onBack ? <Pressable onPress={onBack} hitSlop={12}><Text style={s.back}>‹ Terug</Text></Pressable> : <Text style={s.brand}>Leesmaatje</Text>}
        {title ? <Text style={s.h1} numberOfLines={1}>{title}</Text> : null}
      </View>
      <ScrollView contentContainerStyle={s.scroll}>{children}</ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  top: { paddingHorizontal: 20, paddingTop: 8, gap: 4 },
  brand: { fontSize: 20, fontWeight: "800", color: C.purple },
  back: { fontSize: 17, color: C.purple, fontWeight: "700" },
  h1: { fontSize: 24, fontWeight: "800", color: C.ink },
  h2: { fontSize: 20, fontWeight: "800", color: C.ink, marginTop: 12, textAlign: "center" },
  scroll: { padding: 20, gap: 10, flexGrow: 1 },
  center: { alignItems: "center", gap: 10 },
  muted: { color: C.muted, fontSize: 14 },
  big: { fontSize: 32, fontWeight: "800", color: C.purple },
  card: { backgroundColor: C.card, borderRadius: 18, padding: 16, borderWidth: 2, borderColor: C.line, gap: 4 },
  cardTitle: { fontSize: 18, fontWeight: "800", color: C.ink },
  btn: { backgroundColor: C.purple, borderRadius: 20, paddingVertical: 18, paddingHorizontal: 16, alignItems: "center" },
  btnGhost: { backgroundColor: "#fff", borderWidth: 2, borderColor: C.line },
  btnText: { color: "#fff", fontSize: 18, fontWeight: "800" },
  bubble: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 18, padding: 12, alignSelf: "stretch" },
  bubbleText: { flex: 1, fontSize: 16, fontWeight: "700", color: C.ink },
  barBg: { height: 10, backgroundColor: C.line, borderRadius: 6, overflow: "hidden" },
  bar: { height: 10, backgroundColor: C.purple },
  photo: { height: 90, borderRadius: 14 },
  page: { backgroundColor: "#fff", borderRadius: 22, padding: 20, borderWidth: 2, borderColor: C.line },
  pageText: { fontSize: 26, lineHeight: 44, color: C.ink, fontWeight: "600" },
  now: { backgroundColor: "#FFE08A", color: C.ink },
  flash: { backgroundColor: "#FFC94D" },
});
