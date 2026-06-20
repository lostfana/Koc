import { useState, useEffect } from "react";
import { Dumbbell, TrendingUp, Salad, UserCog, Flame, CheckCircle2, RotateCcw, Plus, Minus, Loader2, AlertCircle, Sparkles, X, Moon, Droplet, Check } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const GOALS = ["Kilo verme", "Kas kazanma", "Dayanıklılık", "Genel fitness"];
const LEVELS = ["Başlangıç", "Orta", "İleri"];
const EQUIPMENT = ["Sadece vücut ağırlığı", "Ev ekipmanı (dambıl/bant)", "Spor salonu"];
const SPLITS = ["İtiş-Çekiş-Bacak (PPL)", "Üst vücut / Alt vücut", "Tam vücut"];

const TABS = [
  { id: "today", label: "BUGÜN", icon: Dumbbell },
  { id: "progress", label: "İLERLEME", icon: TrendingUp },
  { id: "nutrition", label: "BESLENME", icon: Salad },
  { id: "supplements", label: "TAKVİYELER", icon: Sparkles },
  { id: "profile", label: "PROFİL", icon: UserCog },
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function stripFences(text) {
  return text.replace(/```json|```/g, "").trim();
}

async function callClaude(system, prompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error("AI isteği başarısız");
  const data = await res.json();
  const text = data.content.map((b) => b.text || "").join("\n");
  return JSON.parse(stripFences(text));
}

function calcStreak(history) {
  const byDate = {};
  history.forEach((h) => (byDate[h.date] = h.completed));
  let streak = 0;
  let d = new Date();
  if (!(todayStr() in byDate)) d.setDate(d.getDate() - 1);
  while (true) {
    const key = d.toISOString().slice(0, 10);
    if (byDate[key]) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else break;
  }
  return streak;
}

function parseSupplement(text) {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function Section({ title, children }) {
  return (
    <div className="mb-6">
      <div className="text-xs tracking-widest text-[#8A9098] mb-2" style={{ fontFamily: "Oswald, sans-serif" }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function PrimaryButton({ children, onClick, disabled, loading, icon: Icon }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="inline-flex items-center gap-2 px-5 py-3 rounded-md font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      style={{ background: "#FF5A1F", color: "#14181C", fontFamily: "Inter, sans-serif" }}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : Icon ? <Icon size={16} /> : null}
      {children}
    </button>
  );
}

function GhostButton({ children, onClick, disabled, icon: Icon }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium disabled:opacity-40 transition-colors"
      style={{ background: "transparent", color: "#F2EFE9", border: "1px solid #2A323B", fontFamily: "Inter, sans-serif" }}
    >
      {Icon ? <Icon size={15} /> : null}
      {children}
    </button>
  );
}

function ErrorBanner({ message, onClose }) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-2 px-4 py-3 rounded-md mb-4 text-sm" style={{ background: "#2A1A14", border: "1px solid #5A2E1A", color: "#FFB68A", fontFamily: "Inter, sans-serif" }}>
      <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
      <div className="flex-1">{message}</div>
      <button onClick={onClose}><X size={14} /></button>
    </div>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState(null);
  const [history, setHistory] = useState([]);
  const [weightLog, setWeightLog] = useState([]);
  const [plan, setPlan] = useState(null);
  const [actualLog, setActualLog] = useState([]);
  const [nutrition, setNutrition] = useState(null);
  const [dailyLog, setDailyLog] = useState({ water: 0, mealsEaten: {}, supplementsTaken: {} });
  const [tab, setTab] = useState("today");
  const [planLoading, setPlanLoading] = useState(false);
  const [nutritionLoading, setNutritionLoading] = useState(false);
  const [error, setError] = useState("");
  const [weightInput, setWeightInput] = useState("");
  const [draft, setDraft] = useState({
    name: "",
    age: "",
    goal: GOALS[0],
    level: LEVELS[0],
    equipment: EQUIPMENT[0],
    split: SPLITS[0],
    daysPerWeek: 4,
    notes: "",
    pushExercises: "",
    pullExercises: "",
    legExercises: "",
    supplements: "Protein tozu\nKreatin\nMultivitamin\nB12\nMagnezyum\nFolik asit\nOmega 3",
  });

  useEffect(() => {
    (async () => {
      try {
        const p = await window.storage.get("profile", false).catch(() => null);
        if (p) {
          setProfile(JSON.parse(p.value));
          setDraft(JSON.parse(p.value));
        }
        const h = await window.storage.get("workout-history", false).catch(() => null);
        if (h) setHistory(JSON.parse(h.value));
        const w = await window.storage.get("weight-log", false).catch(() => null);
        if (w) setWeightLog(JSON.parse(w.value));
        const cp = await window.storage.get("current-plan", false).catch(() => null);
        if (cp) {
          const parsedPlan = JSON.parse(cp.value);
          setPlan(parsedPlan);
          setActualLog((parsedPlan?.exercises || []).map((ex) => ({ name: ex.name, sets: ex.sets, reps: ex.reps })));
        }
        const nu = await window.storage.get("nutrition-" + todayStr(), false).catch(() => null);
        if (nu) setNutrition(JSON.parse(nu.value));
        const dl = await window.storage.get("daily-log-" + todayStr(), false).catch(() => null);
        if (dl) {
          const parsed = JSON.parse(dl.value);
          setDailyLog({
            water: parsed.water || 0,
            mealsEaten: parsed.mealsEaten || {},
            supplementsTaken: typeof parsed.supplementsTaken === "string" ? {} : (parsed.supplementsTaken || {}),
          });
        }
      } catch (e) {
        // first run
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const saveProfile = async () => {
    const p = { ...draft };
    setProfile(p);
    setTab("today");
    try {
      await window.storage.set("profile", JSON.stringify(p), false);
    } catch (e) {
      setError("Profil kaydedilemedi.");
    }
  };

  const dayNumber = history.length + 1;
  const streak = calcStreak(history);
  const completedToday = history.some((h) => h.date === todayStr() && h.completed);

  const generatePlan = async () => {
    if (!profile) return;
    setPlanLoading(true);
    setError("");
    try {
      const recent = history
        .slice(-6)
        .map((h) => {
          const exList = h.exercises?.length ? " [" + h.exercises.map((ex) => `${ex.name} ${ex.sets}x${ex.reps}`).join(", ") + "]" : "";
          return `${h.date} - ${h.day_type || h.title} (${h.completed ? "tamamlandı" : "atlandı"})${exList}`;
        })
        .join(" | ") || "Henüz geçmiş yok";

      const prefs = [
        profile.pushExercises && `İtiş: ${profile.pushExercises}`,
        profile.pullExercises && `Çekiş: ${profile.pullExercises}`,
        profile.legExercises && `Bacak: ${profile.legExercises}`,
      ]
        .filter(Boolean)
        .join(". ") || "Belirtilmedi";

      const system =
        "Sen spor koçusun. Sadece JSON döndür. Şema: {\"day_type\":string, \"title\":string, \"focus\":string, \"duration_min\":number, \"intensity\":string, \"exercises\":[{\"name\":string,\"sets\":string,\"reps\":string,\"note\":string}], \"coach_note\":string}. Tüm Türkçe.";
      const prompt = `Sporcu: hedef=${profile.goal}, seviye=${profile.level}, ekipman=${profile.equipment}, split=${profile.split}, gün=${dayNumber}.
Tercihler: ${prefs}
Geçmiş: ${recent}
PPL'ye sadık kal. Mümkünse tercih edilen hareketleri kullan. İlerleme önerisi yap.`;
      const result = await callClaude(system, prompt);
      setPlan(result);
      setActualLog((result?.exercises || []).map((ex) => ({ name: ex.name, sets: ex.sets, reps: ex.reps })));
      await window.storage.set("current-plan", JSON.stringify(result), false);
    } catch (e) {
      setError("Antrenman programı oluşturulamadı.");
    } finally {
      setPlanLoading(false);
    }
  };

  const logWorkout = async (completed) => {
    const entry = {
      date: todayStr(),
      title: plan?.title || "Dinlenme günü",
      day_type: plan?.day_type || "Dinlenme",
      exercises: completed ? actualLog : plan?.exercises || [],
      completed,
    };
    const newHistory = [...history.filter((h) => h.date !== todayStr()), entry];
    setHistory(newHistory);
    try {
      await window.storage.set("workout-history", JSON.stringify(newHistory), false);
      await window.storage.delete("current-plan", false).catch(() => {});
    } catch (e) {
      setError("Kayıt yapılamadı.");
    }
    setPlan(null);
    setActualLog([]);
  };

  const addWeight = async () => {
    const val = parseFloat(weightInput.replace(",", "."));
    if (!val || val <= 0) return;
    const entry = { date: todayStr(), weight: val };
    const newLog = [...weightLog.filter((w) => w.date !== todayStr()), entry].sort((a, b) => a.date.localeCompare(b.date));
    setWeightLog(newLog);
    setWeightInput("");
    try {
      await window.storage.set("weight-log", JSON.stringify(newLog), false);
    } catch (e) {
      setError("Kilo kaydedilemedi.");
    }
  };

  const generateNutrition = async () => {
    if (!profile) return;
    setNutritionLoading(true);
    setError("");
    try {
      const latestWeight = weightLog.length ? weightLog[weightLog.length - 1].weight : null;
      const system =
        "Sen beslenme uzmanısın. Sadece JSON döndür. Şema: {\"summary\":string, \"daily_target\":{\"calories\":string,\"protein\":string,\"carbs\":string,\"fat\":string}, \"meals\":[{\"name\":string,\"time\":string,\"items\":string,\"calories_estimate\":string}], \"hydration_note\":string}. Tüm Türkçe.";
      const prompt = `Sporcu: hedef=${profile.goal}, seviye=${profile.level}, kilo=${latestWeight || "?"}kg, antrenman=${plan?.title || "belirtilmedi"}.
4 öğün ve günlük hedefi hesapla.`;
      const result = await callClaude(system, prompt);
      setNutrition(result);
      await window.storage.set("nutrition-" + todayStr(), JSON.stringify(result), false);
      const resetLog = { water: dailyLog.water, mealsEaten: {}, supplementsTaken: {} };
      setDailyLog(resetLog);
      await window.storage.set("daily-log-" + todayStr(), JSON.stringify(resetLog), false);
    } catch (e) {
      setError("Beslenme önerisi oluşturulamadı.");
    } finally {
      setNutritionLoading(false);
    }
  };

  const saveDailyLog = async (newLog) => {
    setDailyLog(newLog);
    try {
      await window.storage.set("daily-log-" + todayStr(), JSON.stringify(newLog), false);
    } catch (e) {
      setError("Kayıt yapılamadı.");
    }
  };

  const addWater = (delta) => {
    const next = Math.max(0, dailyLog.water + delta);
    saveDailyLog({ ...dailyLog, water: next });
  };

  const toggleMealEaten = (index) => {
    const nextEaten = { ...dailyLog.mealsEaten, [index]: !dailyLog.mealsEaten[index] };
    saveDailyLog({ ...dailyLog, mealsEaten: nextEaten });
  };

  const toggleSupplement = (suppName) => {
    const nextTaken = { ...dailyLog.supplementsTaken, [suppName]: !dailyLog.supplementsTaken[suppName] };
    saveDailyLog({ ...dailyLog, supplementsTaken: nextTaken });
  };

  const resetAll = async () => {
    if (!window.confirm("Tüm veriler silinecek. Devam edilsin mi?")) return;
    try {
      await window.storage.delete("profile", false).catch(() => {});
      await window.storage.delete("workout-history", false).catch(() => {});
      await window.storage.delete("weight-log", false).catch(() => {});
      await window.storage.delete("current-plan", false).catch(() => {});
      await window.storage.delete("nutrition-" + todayStr(), false).catch(() => {});
      await window.storage.delete("daily-log-" + todayStr(), false).catch(() => {});
    } catch (e) {}
    setProfile(null);
    setHistory([]);
    setWeightLog([]);
    setPlan(null);
    setNutrition(null);
    setDailyLog({ water: 0, mealsEaten: {}, supplementsTaken: {} });
    setDraft({
      name: "",
      age: "",
      goal: GOALS[0],
      level: LEVELS[0],
      equipment: EQUIPMENT[0],
      split: SPLITS[0],
      daysPerWeek: 4,
      notes: "",
      pushExercises: "",
      pullExercises: "",
      legExercises: "",
      supplements: "Protein tozu\nKreatin\nMultivitamin\nB12\nMagnezyum\nFolik asit\nOmega 3",
    });
  };

  const inputClass = "w-full px-3 py-2.5 rounded-md text-sm outline-none";
  const inputStyle = { background: "#1E242B", border: "1px solid #2A323B", color: "#F2EFE9", fontFamily: "Inter, sans-serif" };

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-96" style={{ background: "#14181C" }}>
        <Loader2 className="animate-spin" color="#FF5A1F" size={28} />
      </div>
    );
  }

  return (
    <div style={{ background: "#14181C", color: "#F2EFE9", fontFamily: "Inter, sans-serif", minHeight: "600px" }} className="w-full rounded-lg overflow-hidden">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: #2A323B; border-radius: 3px; }
      `}</style>

      {!profile ? (
        <div className="p-6 md:p-10 max-w-lg mx-auto">
          <div className="mb-6">
            <div className="text-xs tracking-[0.2em] mb-1" style={{ color: "#FF5A1F", fontFamily: "Oswald, sans-serif" }}>
              YENİ PROGRAM
            </div>
            <h1 className="text-2xl font-semibold" style={{ fontFamily: "Oswald, sans-serif" }}>
              PROFİLİNİ OLUŞTUR
            </h1>
          </div>
          <ErrorBanner message={error} onClose={() => setError("")} />
          <div className="space-y-4">
            <div>
              <label className="text-xs text-[#8A9098] mb-1 block">İsim</label>
              <input className={inputClass} style={inputStyle} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ali" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[#8A9098] mb-1 block">Yaş</label>
                <input className={inputClass} style={inputStyle} value={draft.age} onChange={(e) => setDraft({ ...draft, age: e.target.value })} placeholder="28" />
              </div>
              <div>
                <label className="text-xs text-[#8A9098] mb-1 block">Haftalık gün</label>
                <input type="number" min="1" max="7" className={inputClass} style={inputStyle} value={draft.daysPerWeek} onChange={(e) => setDraft({ ...draft, daysPerWeek: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-xs text-[#8A9098] mb-1 block">Hedef</label>
              <select className={inputClass} style={inputStyle} value={draft.goal} onChange={(e) => setDraft({ ...draft, goal: e.target.value })}>
                {GOALS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-[#8A9098] mb-1 block">Seviye</label>
              <select className={inputClass} style={inputStyle} value={draft.level} onChange={(e) => setDraft({ ...draft, level: e.target.value })}>
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-[#8A9098] mb-1 block">Ekipman</label>
              <select className={inputClass} style={inputStyle} value={draft.equipment} onChange={(e) => setDraft({ ...draft, equipment: e.target.value })}>
                {EQUIPMENT.map((eq) => (
                  <option key={eq} value={eq}>
                    {eq}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-[#8A9098] mb-1 block">Antrenman düzeni</label>
              <select className={inputClass} style={inputStyle} value={draft.split} onChange={(e) => setDraft({ ...draft, split: e.target.value })}>
                {SPLITS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-[#8A9098] mb-1 block">İtiş günü hareketleri</label>
              <textarea className={inputClass} style={inputStyle} rows={2} value={draft.pushExercises} onChange={(e) => setDraft({ ...draft, pushExercises: e.target.value })} placeholder="bench press, shoulder press, dips" />
            </div>
            <div>
              <label className="text-xs text-[#8A9098] mb-1 block">Çekiş günü hareketleri</label>
              <textarea className={inputClass} style={inputStyle} rows={2} value={draft.pullExercises} onChange={(e) => setDraft({ ...draft, pullExercises: e.target.value })} placeholder="lat pulldown, barbell row, curl" />
            </div>
            <div>
              <label className="text-xs text-[#8A9098] mb-1 block">Bacak günü hareketleri</label>
              <textarea className={inputClass} style={inputStyle} rows={2} value={draft.legExercises} onChange={(e) => setDraft({ ...draft, legExercises: e.target.value })} placeholder="squat, leg press, calf raise" />
            </div>
            <div>
              <label className="text-xs text-[#8A9098] mb-1 block">Günlük takviyeler</label>
              <textarea className={inputClass} style={inputStyle} rows={2} value={draft.supplements} onChange={(e) => setDraft({ ...draft, supplements: e.target.value })} placeholder="protein tozu, kreatin" />
            </div>
            <div>
              <label className="text-xs text-[#8A9098] mb-1 block">Notlar / kısıtlamalar</label>
              <textarea className={inputClass} style={inputStyle} rows={2} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="sağ dizimde hassasiyet var" />
            </div>
            <PrimaryButton onClick={saveProfile} icon={Sparkles}>
              Paneli başlat
            </PrimaryButton>
          </div>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row">
          <div className="md:w-56 flex-shrink-0 p-4 md:p-5" style={{ borderRight: "1px solid #2A323B" }}>
            <div className="mb-6">
              <div className="text-[10px] tracking-[0.25em] mb-2" style={{ color: "#8A9098", fontFamily: "Oswald, sans-serif" }}>
                30 GÜNLÜK PROGRAM
              </div>
              <div className="flex items-baseline gap-2">
                <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "2rem", fontWeight: 700, color: "#F2EFE9" }}>
                  {String(Math.min(dayNumber, 30)).padStart(2, "0")}
                </span>
                <span style={{ color: "#5C6670", fontFamily: "JetBrains Mono, monospace" }}>/30</span>
              </div>
              <div className="flex items-center gap-1.5 mt-2 text-xs" style={{ color: streak > 0 ? "#FF5A1F" : "#5C6670" }}>
                <Flame size={13} />
                <span>{streak > 0 ? `${streak} gün üst üste` : "seri henüz yok"}</span>
              </div>
            </div>
            <nav className="flex md:flex-col gap-1 overflow-x-auto">
              {TABS.map((t) => {
                const Icon = t.icon;
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-md text-xs whitespace-nowrap transition-colors"
                    style={{
                      fontFamily: "Oswald, sans-serif",
                      letterSpacing: "0.06em",
                      background: active ? "#1E242B" : "transparent",
                      color: active ? "#FF5A1F" : "#8A9098",
                      borderLeft: active ? "2px dashed #FF5A1F" : "2px dashed transparent",
                    }}
                  >
                    <Icon size={15} /> {t.label}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="flex-1 p-5 md:p-8 min-w-0">
            <ErrorBanner message={error} onClose={() => setError("")} />

            {tab === "today" && (
              <div>
                {dayNumber > 30 && <div className="text-xs mb-4 px-3 py-2 rounded-md" style={{ background: "#1E242B", color: "#3FA796" }}>30 günlük program tamamlandı.</div>}
                {completedToday ? (
                  <div className="text-center py-12">
                    <CheckCircle2 size={40} color="#3FA796" className="mx-auto mb-3" />
                    <div className="text-lg font-semibold" style={{ fontFamily: "Oswald, sans-serif" }}>
                      BUGÜN TAMAMLANDI
                    </div>
                  </div>
                ) : !plan ? (
                  <div className="text-center py-12 max-w-sm mx-auto">
                    <Dumbbell size={32} color="#FF5A1F" className="mx-auto mb-3" />
                    <div className="text-lg font-semibold mb-2" style={{ fontFamily: "Oswald, sans-serif" }}>
                      BUGÜNÜN PROGRAMI
                    </div>
                    <PrimaryButton onClick={generatePlan} loading={planLoading} icon={Sparkles}>
                      Program oluştur
                    </PrimaryButton>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {plan.day_type && <span className="text-xs px-2 py-1 rounded font-semibold" style={{ background: "#1E242B", color: "#3FA796" }}>{plan.day_type}</span>}
                        <h2 className="text-xl font-semibold" style={{ fontFamily: "Oswald, sans-serif" }}>
                          {plan.title}
                        </h2>
                      </div>
                      <span className="text-xs px-2 py-1 rounded" style={{ background: "#1E242B", color: "#FF5A1F" }}>
                        {plan.intensity}
                      </span>
                    </div>
                    <div className="text-sm text-[#8A9098] mb-4">
                      {plan.focus} · {plan.duration_min} dk
                    </div>

                    <div className="p-4 rounded-md mb-5" style={{ background: "#1E242B", borderLeft: "3px solid #FF5A1F" }}>
                      <div className="text-sm italic" style={{ color: "#F2EFE9" }}>"{plan.coach_note}"</div>
                    </div>

                    <Section title="EGZERSİZLER">
                      <div className="text-xs text-[#5C6670] mb-2">Gerçekte yaptığın set/tekrarı düzenle</div>
                      <div className="space-y-2">
                        {plan.exercises?.map((ex, i) => (
                          <div key={i} className="flex items-center justify-between px-3 py-2.5 rounded-md gap-3" style={{ background: "#1E242B" }}>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium">{ex.name}</div>
                              {ex.note && <div className="text-xs text-[#8A9098] mt-0.5">{ex.note}</div>}
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <input
                                value={actualLog[i]?.sets ?? ex.sets}
                                onChange={(e) => setActualLog((prev) => prev.map((p, idx) => (idx === i ? { ...p, sets: e.target.value } : p)))}
                                className="text-sm text-center rounded px-1.5 py-1"
                                style={{ width: "38px", fontFamily: "JetBrains Mono, monospace", color: "#FF5A1F", background: "#14181C", border: "1px solid #2A323B" }}
                              />
                              <span style={{ color: "#5C6670" }}>×</span>
                              <input
                                value={actualLog[i]?.reps ?? ex.reps}
                                onChange={(e) => setActualLog((prev) => prev.map((p, idx) => (idx === i ? { ...p, reps: e.target.value } : p)))}
                                className="text-sm text-center rounded px-1.5 py-1"
                                style={{ width: "48px", fontFamily: "JetBrains Mono, monospace", color: "#FF5A1F", background: "#14181C", border: "1px solid #2A323B" }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </Section>

                    <div className="flex flex-wrap gap-3 mt-6">
                      <PrimaryButton onClick={() => logWorkout(true)} icon={CheckCircle2}>
                        Tamamladım
                      </PrimaryButton>
                      <GhostButton onClick={() => logWorkout(false)} icon={Moon}>
                        Dinlenme günü
                      </GhostButton>
                      <GhostButton onClick={generatePlan} disabled={planLoading} icon={RotateCcw}>
                        Yeniden oluştur
                      </GhostButton>
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === "progress" && (
              <div>
                <h2 className="text-lg font-semibold mb-4" style={{ fontFamily: "Oswald, sans-serif" }}>
                  İLERLEME
                </h2>
                <Section title="KİLO TAKİBİ">
                  <div className="flex gap-2 mb-4">
                    <input className={inputClass} style={{ ...inputStyle, maxWidth: "140px" }} placeholder="kg" value={weightInput} onChange={(e) => setWeightInput(e.target.value)} />
                    <GhostButton onClick={addWeight} icon={Plus}>
                      Ekle
                    </GhostButton>
                  </div>
                  {weightLog.length > 1 ? (
                    <div style={{ height: 220 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={weightLog}>
                          <CartesianGrid stroke="#2A323B" strokeDasharray="3 3" />
                          <XAxis dataKey="date" tick={{ fill: "#8A9098", fontSize: 11 }} tickFormatter={(d) => d.slice(5)} />
                          <YAxis tick={{ fill: "#8A9098", fontSize: 11 }} domain={["auto", "auto"]} />
                          <Tooltip contentStyle={{ background: "#1E242B", border: "1px solid #2A323B", color: "#F2EFE9" }} />
                          <Line type="monotone" dataKey="weight" stroke="#FF5A1F" strokeWidth={2} dot={{ fill: "#FF5A1F", r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="text-sm text-[#5C6670]">En az 2 kayıt ekleyin</div>
                  )}
                </Section>
                <Section title="ANTRENMAN GEÇMİŞİ">
                  {history.length === 0 ? (
                    <div className="text-sm text-[#5C6670]">Henüz kayıt yok.</div>
                  ) : (
                    <div className="space-y-1.5 max-h-72 overflow-y-auto">
                      {[...history]
                        .reverse()
                        .map((h, i) => (
                          <div key={i} className="flex items-center justify-between px-3 py-2 rounded-md text-sm" style={{ background: "#1E242B" }}>
                            <span style={{ fontFamily: "JetBrains Mono, monospace", color: "#8A9098" }}>{h.date}</span>
                            <span className="flex-1 mx-3 truncate">{h.day_type ? `${h.day_type} · ${h.title}` : h.title}</span>
                            {h.completed ? <CheckCircle2 size={15} color="#3FA796" /> : <Moon size={15} color="#5C6670" />}
                          </div>
                        ))}
                    </div>
                  )}
                </Section>
              </div>
            )}

            {tab === "nutrition" && (
              <div>
                <h2 className="text-lg font-semibold mb-4" style={{ fontFamily: "Oswald, sans-serif" }}>
                  BESLENME
                </h2>

                <Section title="SU TAKİBİ">
                  <div className="flex items-center gap-4">
                    <button onClick={() => addWater(-1)} className="p-2 rounded-md" style={{ background: "#1E242B", border: "1px solid #2A323B" }}>
                      <Minus size={14} />
                    </button>
                    <div className="flex items-center gap-2">
                      <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "1.5rem", fontWeight: 700 }}>{dailyLog.water}</span>
                      <span className="text-xs text-[#8A9098]">bardak</span>
                    </div>
                    <button onClick={() => addWater(1)} className="p-2 rounded-md" style={{ background: "#1E242B", border: "1px solid #2A323B" }}>
                      <Plus size={14} />
                    </button>
                    <div className="flex gap-1 ml-2">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <Droplet key={i} size={14} color={i < dailyLog.water ? "#3FA796" : "#2A323B"} fill={i < dailyLog.water ? "#3FA796" : "none"} />
                      ))}
                    </div>
                  </div>
                </Section>

                {!nutrition ? (
                  <div className="text-center py-10 max-w-sm">
                    <Salad size={28} color="#3FA796" className="mb-3" />
                    <p className="text-sm text-[#8A9098] mb-5">Beslenme önerisi oluştur</p>
                    <PrimaryButton onClick={generateNutrition} loading={nutritionLoading} icon={Sparkles}>
                      Öneri oluştur
                    </PrimaryButton>
                  </div>
                ) : (
                  <div>
                    {nutrition.daily_target && (
                      <div className="grid grid-cols-4 gap-2 mb-4">
                        {[
                          ["Kalori", nutrition.daily_target.calories],
                          ["Protein", nutrition.daily_target.protein],
                          ["Karb.", nutrition.daily_target.carbs],
                          ["Yağ", nutrition.daily_target.fat],
                        ].map(([label, val]) => (
                          <div key={label} className="text-center px-2 py-3 rounded-md" style={{ background: "#1E242B" }}>
                            <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.95rem", fontWeight: 700, color: "#FF5A1F" }}>
                              {val}
                            </div>
                            <div className="text-[10px] text-[#8A9098] mt-0.5">{label}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="p-4 rounded-md mb-5" style={{ background: "#1E242B", borderLeft: "3px solid #3FA796" }}>
                      <div className="text-sm">{nutrition.summary}</div>
                    </div>
                    <div className="space-y-2 mb-4">
                      {nutrition.meals?.map((m, i) => {
                        const eaten = !!dailyLog.mealsEaten[i];
                        return (
                          <div key={i} className="px-3 py-2.5 rounded-md flex items-start justify-between gap-3" style={{ background: "#1E242B", opacity: eaten ? 0.6 : 1 }}>
                            <div className="min-w-0">
                              <div className="flex items-center justify-between mb-1 gap-3">
                                <span className="text-sm font-medium" style={{ textDecoration: eaten ? "line-through" : "none" }}>
                                  {m.name}
                                </span>
                                <span className="text-xs flex-shrink-0" style={{ fontFamily: "JetBrains Mono, monospace", color: "#8A9098" }}>
                                  {m.time}
                                </span>
                              </div>
                              <div className="text-sm text-[#8A9098]">{m.items}</div>
                              {m.calories_estimate && <div className="text-xs mt-1" style={{ color: "#3FA796" }}>{m.calories_estimate}</div>}
                            </div>
                            <button
                              onClick={() => toggleMealEaten(i)}
                              className="p-1.5 rounded-md flex-shrink-0"
                              style={{ background: eaten ? "#3FA796" : "transparent", border: eaten ? "1px solid #3FA796" : "1px solid #2A323B" }}
                            >
                              <Check size={14} color={eaten ? "#14181C" : "#5C6670"} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    {nutrition.hydration_note && <div className="text-xs text-[#8A9098] mb-4">💧 {nutrition.hydration_note}</div>}
                    <GhostButton onClick={generateNutrition} disabled={nutritionLoading} icon={RotateCcw}>
                      Yeniden oluştur
                    </GhostButton>
                  </div>
                )}
              </div>
            )}

            {tab === "supplements" && (
              <div>
                <h2 className="text-lg font-semibold mb-4" style={{ fontFamily: "Oswald, sans-serif" }}>
                  TAKVİYELER
                </h2>
                {!profile.supplements ? (
                  <div className="text-center py-10 max-w-sm">
                    <Sparkles size={28} color="#3FA796" className="mb-3" />
                    <p className="text-sm text-[#8A9098] mb-5">Profilde henüz takviye eklemedin. PROFİL sekmesine git ve takviyelerini belirt.</p>
                  </div>
                ) : (
                  <div>
                    <Section title="GÜNLÜK TAKVİYE TAKİBİ">
                      <div className="space-y-2">
                        {parseSupplement(profile.supplements).map((supp, i) => {
                          const taken = !!dailyLog.supplementsTaken[supp];
                          return (
                            <div key={i} className="px-3 py-2.5 rounded-md flex items-center justify-between" style={{ background: "#1E242B", opacity: taken ? 0.6 : 1 }}>
                              <span className="text-sm font-medium" style={{ textDecoration: taken ? "line-through" : "none" }}>
                                {supp}
                              </span>
                              <button
                                onClick={() => toggleSupplement(supp)}
                                className="p-1.5 rounded-md"
                                style={{ background: taken ? "#3FA796" : "transparent", border: taken ? "1px solid #3FA796" : "1px solid #2A323B" }}
                              >
                                <Check size={14} color={taken ? "#14181C" : "#5C6670"} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </Section>
                    <div className="text-xs text-[#8A9098] mt-4">💡 Profilde yeni takviye eklemek istersen, PROFİL sekmesine git.</div>
                  </div>
                )}
              </div>
            )}

            {tab === "profile" && (
              <div className="max-w-md">
                <h2 className="text-lg font-semibold mb-4" style={{ fontFamily: "Oswald, sans-serif" }}>
                  PROFİL
                </h2>
                <div className="space-y-4">
                  <input className={inputClass} style={inputStyle} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="İsim" />
                  <input className={inputClass} style={inputStyle} value={draft.age} onChange={(e) => setDraft({ ...draft, age: e.target.value })} placeholder="Yaş" />
                  <select className={inputClass} style={inputStyle} value={draft.goal} onChange={(e) => setDraft({ ...draft, goal: e.target.value })}>
                    {GOALS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                  <select className={inputClass} style={inputStyle} value={draft.level} onChange={(e) => setDraft({ ...draft, level: e.target.value })}>
                    {LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                  <textarea className={inputClass} style={inputStyle} rows={2} value={draft.supplements} onChange={(e) => setDraft({ ...draft, supplements: e.target.value })} placeholder="Takviyeler" />
                  <textarea className={inputClass} style={inputStyle} rows={2} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="Notlar" />
                  <div className="flex gap-3">
                    <PrimaryButton onClick={saveProfile} icon={CheckCircle2}>
                      Kaydet
                    </PrimaryButton>
                    <GhostButton onClick={resetAll} icon={RotateCcw}>
                      Sıfırla
                    </GhostButton>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
