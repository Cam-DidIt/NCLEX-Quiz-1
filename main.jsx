import { useState, useCallback } from "react";

// ─── Topic registry ───────────────────────────────────────────────────────────
const TOPICS = [
  { id: "Cardiac",               desc: "MI, CHF, dysrhythmias, HTN" },
  { id: "Respiratory",           desc: "COPD, pneumonia, PE, ARF" },
  { id: "Renal",                 desc: "CKD, UTI, acute kidney injury" },
  { id: "Endocrine",             desc: "DM, thyroid, adrenal crisis" },
  { id: "GI & Hepatic",          desc: "Obstruction, liver failure, pancreatitis" },
  { id: "Neurological",          desc: "Stroke, seizures, increased ICP" },
  { id: "Orthopedic",            desc: "Fractures, compartment syndrome" },
  { id: "Fluids & Electrolytes", desc: "Na, K, Ca, fluid balance" },
  { id: "Wound Care",            desc: "Pressure injuries, wound healing" },
  { id: "Priority & Delegation", desc: "Triage, UAP tasks, SBAR" },
  { id: "Medications",           desc: "Common Med-Surg drugs & safety" },
];

const QTYPE_LABELS = {
  priority:     "Priority",
  assessment:   "Assessment",
  intervention: "Intervention",
  teaching:     "Patient Teaching",
  delegation:   "Delegation",
};

const DIFF_STYLE = {
  beginner:     { bg: "#F0FDF4", color: "#16A34A", border: "#BBF7D0" },
  intermediate: { bg: "#FFFBEB", color: "#D97706", border: "#FDE68A" },
  advanced:     { bg: "#FFF1F2", color: "#DC2626", border: "#FECACA" },
};

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:           "#F1F5F9",
  card:         "#FFFFFF",
  navy:         "#1B3E8C",
  navyDark:     "#152E6B",
  teal:         "#0D9B78",
  correctBg:    "#ECFDF5",
  correctBorder:"#A7F3D0",
  correctText:  "#065F46",
  wrongBg:      "#FEF2F2",
  wrongBorder:  "#FECACA",
  wrongText:    "#991B1B",
  selBg:        "#EFF6FF",
  selBorder:    "#3B82F6",
  selText:      "#1D4ED8",
  text:         "#0F172A",
  muted:        "#64748B",
  border:       "#E2E8F0",
  disabled:     "#94A3B8",
};

const font = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

// ─── Small helpers ────────────────────────────────────────────────────────────
function Badge({ children, bg, color, border }) {
  return (
    <span style={{
      display: "inline-block", fontSize: 12, fontWeight: 600,
      background: bg, color, border: `1px solid ${border}`,
      padding: "3px 10px", borderRadius: 20, lineHeight: 1.6,
    }}>
      {children}
    </span>
  );
}

function AccuracyRing({ pct, size = 44 }) {
  const r = 16, circ = 2 * Math.PI * r;
  const filled = (pct / 100) * circ;
  const color = pct >= 70 ? "#4ADE80" : pct >= 50 ? "#FB923C" : "#F87171";
  return (
    <svg width={size} height={size} viewBox="0 0 40 40">
      <circle cx="20" cy="20" r={r} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="4"/>
      <circle cx="20" cy="20" r={r} fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 20 20)" style={{ transition: "stroke-dasharray 0.5s ease" }}/>
      <text x="20" y="24" textAnchor="middle" fontSize="10" fontWeight="700"
        fill="white" fontFamily={font}>{pct}%</text>
    </svg>
  );
}

// ─── API call ────────────────────────────────────────────────────────────────
async function fetchQuestion(topic) {
  const res = await fetch("/.netlify/functions/ask-claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: `You are an expert NCLEX question writer and experienced Med-Surg RN. Your questions mirror the NCLEX-RN in style, rigor, and clinical realism.

Respond ONLY with a raw JSON object — no markdown fences, no preamble, nothing else:
{
  "stem": "2–3 sentence clinical scenario with specific detail (patient age, diagnosis, relevant vitals or labs). End with a clear, direct question.",
  "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
  "correct": "B",
  "rationale": "2–3 sentences explaining the correct answer using clinical reasoning or pathophysiology.",
  "wrongRationales": {
    "A": "Why A is incorrect",
    "C": "Why C is incorrect",
    "D": "Why D is incorrect"
  },
  "difficulty": "intermediate",
  "questionType": "priority"
}

Rules:
• All 4 options must be clinically plausible — no obvious distractors.
• Use real drug names, real lab reference ranges, and realistic vital signs.
• wrongRationales contains only the three incorrect options.
• Vary the correct letter — don't always pick C.
• questionType: priority | assessment | intervention | teaching | delegation
• difficulty: beginner | intermediate | advanced`,
      messages: [{
        role: "user",
        content: `Generate a rigorous NCLEX-style Med-Surg question on: ${topic}. It should reflect a real scenario a bedside nurse would encounter on a general Med-Surg floor.`,
      }],
    }),
  });
  const data = await res.json();
  const raw = (data.content || []).map(b => b.text || "").join("");
  const clean = raw.replace(/```json\n?|```\n?/g, "").trim();
  return JSON.parse(clean);
}

// ─── Setup screen ─────────────────────────────────────────────────────────────
function SetupScreen({ selectedTopics, toggleTopic, onStart, isLoading, error, score, total, streak }) {
  const accuracy = total > 0 ? Math.round((score / total) * 100) : null;
  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: font, color: C.text }}>
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "2rem 1rem 3rem" }}>

        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%", background: C.navy,
            margin: "0 auto 1rem", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none"
              stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
          </div>
          <h1 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 700, letterSpacing: "-0.5px" }}>
            Med-Surg NCLEX Prep
          </h1>
          <p style={{ margin: 0, color: C.muted, fontSize: 15, lineHeight: 1.5 }}>
            AI-generated questions written in a real Med-Surg nurse's clinical voice
          </p>
        </div>

        {/* Session stats (if returning) */}
        {total > 0 && (
          <div style={{
            background: C.card, borderRadius: 16, border: `1px solid ${C.border}`,
            padding: "1rem 1.5rem", marginBottom: "1.25rem",
            display: "flex", justifyContent: "space-around",
          }}>
            {[
              { label: "Answered", value: total, color: C.text },
              { label: "Accuracy", value: `${accuracy}%`, color: accuracy >= 70 ? "#059669" : accuracy >= 50 ? "#D97706" : "#DC2626" },
              { label: "Streak", value: `${streak}`, color: "#D97706" },
            ].map(s => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Topic selector */}
        <div style={{
          background: C.card, borderRadius: 16, border: `1px solid ${C.border}`,
          padding: "1.25rem", marginBottom: "1.25rem",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Focus areas</span>
            <span style={{ fontSize: 13, color: C.muted }}>
              {selectedTopics.length === 0 ? "All topics (random)" : `${selectedTopics.length} selected`}
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {TOPICS.map(t => {
              const sel = selectedTopics.includes(t.id);
              return (
                <button key={t.id} onClick={() => toggleTopic(t.id)} style={{
                  textAlign: "left", padding: "10px 12px", borderRadius: 10, width: "100%",
                  border: sel ? `1.5px solid ${C.selBorder}` : `1px solid ${C.border}`,
                  background: sel ? C.selBg : "#FAFAFA",
                  cursor: "pointer", transition: "all 0.12s",
                }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: sel ? C.selText : C.text }}>{t.id}</div>
                  <div style={{ fontSize: 11, color: sel ? "#60A5FA" : "#94A3B8", marginTop: 2 }}>{t.desc}</div>
                </button>
              );
            })}
          </div>
          {selectedTopics.length > 0 && (
            <button onClick={() => TOPICS.forEach(t => selectedTopics.includes(t.id) && toggleTopic(t.id))}
              style={{ marginTop: 10, fontSize: 12, color: C.muted, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              Clear — practice all topics
            </button>
          )}
        </div>

        {error && (
          <div style={{
            background: C.wrongBg, border: `1px solid ${C.wrongBorder}`,
            borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: 13, color: C.wrongText,
          }}>
            {error} — Please try again.
          </div>
        )}

        <button onClick={onStart} disabled={isLoading} style={{
          width: "100%", padding: 16, border: "none", borderRadius: 12,
          background: isLoading ? C.disabled : C.navy,
          color: "#FFFFFF", fontSize: 16, fontWeight: 600,
          cursor: isLoading ? "not-allowed" : "pointer", transition: "background 0.15s",
        }}>
          {isLoading ? "Generating your first question…" : total > 0 ? "Next question →" : "Start quiz"}
        </button>
      </div>
    </div>
  );
}

// ─── Quiz screen ──────────────────────────────────────────────────────────────
function QuizScreen({ question, score, total, streak, onBack, onNext, isLoading }) {
  const [selected, setSelected] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [showWrong, setShowWrong] = useState(false);

  const accuracy = total > 0 ? Math.round((score / total) * 100) : 0;
  const isCorrect = selected === question.correct;
  const diff = DIFF_STYLE[question.difficulty] || DIFF_STYLE.intermediate;

  const optBg = (letter) => {
    if (!answered) return selected === letter ? C.selBg : C.card;
    if (letter === question.correct) return C.correctBg;
    if (letter === selected) return C.wrongBg;
    return "#FAFAFA";
  };
  const optBorder = (letter) => {
    if (!answered) return selected === letter ? C.selBorder : C.border;
    if (letter === question.correct) return C.correctBorder;
    if (letter === selected) return C.wrongBorder;
    return C.border;
  };
  const optColor = (letter) => {
    if (!answered) return selected === letter ? C.selText : C.text;
    if (letter === question.correct) return C.correctText;
    if (letter === selected) return C.wrongText;
    return "#94A3B8";
  };
  const circleBg = (letter) => {
    if (!answered) return selected === letter ? C.selBorder : "#E2E8F0";
    if (letter === question.correct) return "#10B981";
    if (letter === selected) return "#EF4444";
    return "#E2E8F0";
  };
  const circleColor = (letter) => {
    if (!answered && selected !== letter) return "#94A3B8";
    return "#FFFFFF";
  };

  const submit = () => { if (selected && !answered) setAnswered(true); };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: font, color: C.text }}>

      {/* Sticky header */}
      <div style={{ background: C.navy, padding: "10px 1rem", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 600, margin: "0 auto", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onBack} style={{
            background: "none", border: "none", color: "rgba(255,255,255,0.7)",
            fontSize: 13, cursor: "pointer", padding: 0, flexShrink: 0,
          }}>
            ← Topics
          </button>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#FFFFFF" }}>{score}/{total}</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: ".06em" }}>score</div>
            </div>
            {streak >= 2 && (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#FCD34D" }}>+{streak}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: ".06em" }}>streak</div>
              </div>
            )}
            <AccuracyRing pct={accuracy} />
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "1.5rem 1rem 3rem" }}>

        {/* Badges */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: "1rem" }}>
          <Badge bg="#EDE9FE" color="#5B21B6" border="#C4B5FD">{question.topic}</Badge>
          {question.questionType && (
            <Badge bg="#F0FDF4" color="#166534" border="#BBF7D0">
              {QTYPE_LABELS[question.questionType] || question.questionType}
            </Badge>
          )}
          {question.difficulty && (
            <Badge bg={diff.bg} color={diff.color} border={diff.border}>{question.difficulty}</Badge>
          )}
        </div>

        {/* Question stem */}
        <div style={{
          background: C.card, borderRadius: 16, padding: "1.5rem",
          border: `1px solid ${C.border}`, marginBottom: "1rem", boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.75, color: C.text }}>{question.stem}</p>
        </div>

        {/* Options */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: "1.25rem" }}>
          {["A", "B", "C", "D"].map(letter => (
            <button key={letter} onClick={() => !answered && setSelected(letter)} style={{
              display: "flex", alignItems: "flex-start", gap: 12,
              padding: "14px 16px", borderRadius: 12, width: "100%", textAlign: "left",
              background: optBg(letter), border: `1.5px solid ${optBorder(letter)}`,
              color: optColor(letter), cursor: answered ? "default" : "pointer",
              transition: "all 0.12s",
            }}>
              <span style={{
                width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 700,
                background: circleBg(letter), color: circleColor(letter),
                transition: "background 0.12s",
              }}>
                {answered && letter === question.correct ? "✓" :
                 answered && letter === selected && letter !== question.correct ? "✕" :
                 letter}
              </span>
              <span style={{ fontSize: 14, lineHeight: 1.6, paddingTop: 4 }}>
                {question.options[letter]}
              </span>
            </button>
          ))}
        </div>

        {/* Submit / Result area */}
        {!answered ? (
          <button onClick={submit} disabled={!selected} style={{
            width: "100%", padding: 15, border: "none", borderRadius: 12,
            background: selected ? C.navy : "#E2E8F0",
            color: selected ? "#FFFFFF" : C.disabled,
            fontSize: 15, fontWeight: 600,
            cursor: selected ? "pointer" : "not-allowed", transition: "background 0.15s",
          }}>
            Submit answer
          </button>
        ) : (
          <div>
            {/* Result banner */}
            <div style={{
              background: isCorrect ? C.correctBg : C.wrongBg,
              border: `1px solid ${isCorrect ? C.correctBorder : C.wrongBorder}`,
              borderRadius: 12, padding: "14px 18px", marginBottom: "1rem",
              display: "flex", alignItems: "flex-start", gap: 12,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                background: isCorrect ? "#10B981" : "#EF4444",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "white", fontSize: 16, fontWeight: 700, marginTop: 1,
              }}>
                {isCorrect ? "✓" : "✕"}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: isCorrect ? C.correctText : C.wrongText }}>
                  {isCorrect ? "Correct!" : "Incorrect"}
                </div>
                {!isCorrect && (
                  <div style={{ fontSize: 13, color: C.wrongText, marginTop: 3 }}>
                    Correct answer: <strong>{question.correct} — {question.options[question.correct]}</strong>
                  </div>
                )}
              </div>
            </div>

            {/* Rationale */}
            <div style={{
              background: C.card, borderRadius: 12, padding: "1.25rem",
              border: `1px solid ${C.border}`, marginBottom: "0.75rem",
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 8 }}>
                Rationale
              </div>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.75, color: C.text }}>
                {question.rationale}
              </p>
            </div>

            {/* Wrong option explanations */}
            {question.wrongRationales && Object.keys(question.wrongRationales).length > 0 && (
              <div style={{ marginBottom: "1.25rem" }}>
                <button onClick={() => setShowWrong(v => !v)} style={{
                  fontSize: 13, color: C.selBorder, background: "none", border: "none",
                  cursor: "pointer", padding: "0 0 8px", fontWeight: 500,
                }}>
                  {showWrong ? "▲ Hide" : "▼ Show"} why other options are wrong
                </button>
                {showWrong && (
                  <div style={{
                    background: C.card, borderRadius: 12, border: `1px solid ${C.border}`,
                    overflow: "hidden",
                  }}>
                    {Object.entries(question.wrongRationales).map(([letter, reason], idx, arr) => (
                      <div key={letter} style={{
                        padding: "12px 16px",
                        borderBottom: idx < arr.length - 1 ? `1px solid #F8FAFC` : "none",
                      }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginRight: 8 }}>
                          Option {letter}:
                        </span>
                        <span style={{ fontSize: 13, color: "#374151", lineHeight: 1.65 }}>{reason}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Next question */}
            <button onClick={() => onNext(isCorrect)} disabled={isLoading} style={{
              width: "100%", padding: 15, border: "none", borderRadius: 12,
              background: isLoading ? C.disabled : C.teal,
              color: "#FFFFFF", fontSize: 15, fontWeight: 600,
              cursor: isLoading ? "not-allowed" : "pointer", transition: "background 0.15s",
            }}>
              {isLoading ? "Loading next question…" : "Next question →"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Root app ─────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen]   = useState("setup");
  const [question, setQuestion] = useState(null);
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [score, setScore]     = useState(0);
  const [total, setTotal]     = useState(0);
  const [streak, setStreak]   = useState(0);
  // track correct/incorrect per next call so we can update before screen change
  const [pendingCorrect, setPendingCorrect] = useState(null);

  const toggleTopic = (id) =>
    setSelectedTopics(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);

  const loadQuestion = useCallback(async (scoreDelta) => {
    setIsLoading(true);
    setError(null);

    // Commit score from previous question if provided
    if (scoreDelta !== undefined) {
      setTotal(t => t + 1);
      if (scoreDelta === 1) { setScore(s => s + 1); setStreak(s => s + 1); }
      else setStreak(0);
    }

    const pool = selectedTopics.length > 0 ? selectedTopics : TOPICS.map(t => t.id);
    const topic = pool[Math.floor(Math.random() * pool.length)];

    try {
      const q = await fetchQuestion(topic);
      setQuestion({ ...q, topic });
      setScreen("quiz");
    } catch (err) {
      console.error(err);
      setError("Could not generate a question. Please try again.");
      setScreen("setup");
    } finally {
      setIsLoading(false);
    }
  }, [selectedTopics]);

  // "Next question" callback receives whether last answer was correct
  const handleNext = useCallback((wasCorrect) => {
    loadQuestion(wasCorrect ? 1 : 0);
  }, [loadQuestion]);

  if (screen === "setup") {
    return (
      <SetupScreen
        selectedTopics={selectedTopics}
        toggleTopic={toggleTopic}
        onStart={() => loadQuestion()}
        isLoading={isLoading}
        error={error}
        score={score}
        total={total}
        streak={streak}
      />
    );
  }

  if (screen === "quiz" && question) {
    return (
      <QuizScreen
        question={question}
        score={score}
        total={total}
        streak={streak}
        onBack={() => setScreen("setup")}
        onNext={handleNext}
        isLoading={isLoading}
      />
    );
  }

  return null;
}
