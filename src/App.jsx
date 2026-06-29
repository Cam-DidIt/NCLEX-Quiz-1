import { useState, useCallback } from "react";

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
const QTYPE_LABELS = { priority:"Priority", assessment:"Assessment", intervention:"Intervention", teaching:"Patient Teaching", delegation:"Delegation" };
const DIFF_STYLE = { beginner:{bg:"#F0FDF4",color:"#16A34A",border:"#BBF7D0"}, intermediate:{bg:"#FFFBEB",color:"#D97706",border:"#FDE68A"}, advanced:{bg:"#FFF1F2",color:"#DC2626",border:"#FECACA"} };
const C = { bg:"#F1F5F9",card:"#FFFFFF",navy:"#1B3E8C",teal:"#0D9B78",correctBg:"#ECFDF5",correctBorder:"#A7F3D0",correctText:"#065F46",wrongBg:"#FEF2F2",wrongBorder:"#FECACA",wrongText:"#991B1B",selBg:"#EFF6FF",selBorder:"#3B82F6",selText:"#1D4ED8",text:"#0F172A",muted:"#64748B",border:"#E2E8F0",disabled:"#94A3B8" };
const font = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

const SYSTEM_PROMPT = `You are an expert NCLEX-RN question writer and experienced Med-Surg RN. You write questions aligned with the NCSBN NCLEX-RN Test Plan, the Next Generation NCLEX (NGN) clinical judgment model, and content from authoritative nursing references including Saunders Comprehensive Review for the NCLEX-RN, Lewis's Medical-Surgical Nursing, and ATI nursing review materials. All clinical content must reflect current evidence-based nursing practice.

Respond ONLY with a raw JSON object — no markdown fences, no preamble, nothing else:
{
  "stem": "2-3 sentence clinical scenario with specific detail (patient age, diagnosis, relevant vitals or labs). End with a clear, direct question.",
  "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
  "correct": "B",
  "rationale": "2-3 sentences explaining the correct answer using evidence-based clinical reasoning or pathophysiology, consistent with current nursing practice standards.",
  "wrongRationales": {
    "A": "Why A is incorrect based on clinical evidence",
    "C": "Why C is incorrect based on clinical evidence",
    "D": "Why D is incorrect based on clinical evidence"
  },
  "difficulty": "intermediate",
  "questionType": "priority"
}

Rules:
- All content must align with current NCSBN NCLEX-RN Test Plan standards.
- Apply the NGN Clinical Judgment Measurement Model: recognize cues, analyze cues, prioritize hypotheses, generate solutions, take action, evaluate outcomes.
- All 4 options must be clinically plausible with no obvious distractors.
- Use real drug names, real lab reference ranges per current clinical standards, and realistic vital signs.
- wrongRationales contains only the three incorrect options.
- Vary the correct letter — do not always pick C.
- questionType: priority | assessment | intervention | teaching | delegation
- difficulty: beginner | intermediate | advanced`;

function Badge({ children, bg, color, border }) {
  return <span style={{ display:"inline-block", fontSize:12, fontWeight:600, background:bg, color, border:`1px solid ${border}`, padding:"3px 10px", borderRadius:20, lineHeight:1.6 }}>{children}</span>;
}

function AccuracyRing({ pct, size=44 }) {
  const r=16, circ=2*Math.PI*r, filled=(pct/100)*circ;
  const color = pct>=70?"#4ADE80":pct>=50?"#FB923C":"#F87171";
  return (<svg width={size} height={size} viewBox="0 0 40 40"><circle cx="20" cy="20" r={r} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="4"/><circle cx="20" cy="20" r={r} fill="none" stroke={color} strokeWidth="4" strokeDasharray={`${filled} ${circ}`} strokeLinecap="round" transform="rotate(-90 20 20)" style={{transition:"stroke-dasharray 0.5s ease"}}/><text x="20" y="24" textAnchor="middle" fontSize="10" fontWeight="700" fill="white" fontFamily={font}>{pct}%</text></svg>);
}

async function fetchQuestion(topic) {
  const res = await fetch("/.netlify/functions/ask-claude", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({
      model:"claude-sonnet-4-6", max_tokens:1200,
      system: SYSTEM_PROMPT,
      messages:[{ role:"user", content:`Generate a rigorous NCLEX-style Med-Surg question on: ${topic}. Base it on a real scenario a bedside nurse would encounter on a general Med-Surg floor. Ensure all clinical content aligns with current evidence-based nursing practice and NCSBN standards.` }]
    })
  });
  const data = await res.json();
  const raw = (data.content||[]).map(b=>b.text||"").join("");
  return JSON.parse(raw.replace(/```json\n?|```\n?/g,"").trim());
}

function Disclaimer() {
  return (
    <div style={{ margin:"1rem auto 0", maxWidth:560, background:"#FFF7ED", border:"1px solid #FED7AA", borderRadius:10, padding:"10px 14px" }}>
      <p style={{ margin:0, fontSize:12, color:"#92400E", lineHeight:1.6 }}>
        <strong>Disclaimer:</strong> This tool is intended as a supplemental study aid only and does not replace NCLEX-approved review courses, licensed educators, or authoritative nursing textbooks. Questions are AI-generated and aligned with NCSBN guidelines but have not been independently verified by a testing authority. Always confirm clinical information with accredited nursing resources such as Saunders, ATI, or your nursing program faculty.
      </p>
    </div>
  );
}

function SetupScreen({ selectedTopics, toggleTopic, onStart, isLoading, error, score, total, streak }) {
  const accuracy = total>0 ? Math.round((score/total)*100) : null;
  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:font, color:C.text }}>
      <div style={{ maxWidth:600, margin:"0 auto", padding:"2rem 1rem 3rem" }}>
        <div style={{ textAlign:"center", marginBottom:"2rem" }}>
          <div style={{ width:64, height:64, borderRadius:"50%", background:C.navy, margin:"0 auto 1rem", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </div>
          <h1 style={{ margin:"0 0 6px", fontSize:26, fontWeight:700 }}>Med-Surg NCLEX Prep</h1>
          <p style={{ margin:0, color:C.muted, fontSize:15 }}>AI-generated questions aligned with NCSBN NCLEX-RN standards</p>
          <Disclaimer />
        </div>
        {total>0 && (
          <div style={{ background:C.card, borderRadius:16, border:`1px solid ${C.border}`, padding:"1rem 1.5rem", marginBottom:"1.25rem", display:"flex", justifyContent:"space-around" }}>
            {[{label:"Answered",value:total,color:C.text},{label:"Accuracy",value:`${accuracy}%`,color:accuracy>=70?"#059669":accuracy>=50?"#D97706":"#DC2626"},{label:"Streak",value:`${streak}`,color:"#D97706"}].map(s=>(
              <div key={s.label} style={{ textAlign:"center" }}><div style={{ fontSize:22, fontWeight:700, color:s.color }}>{s.value}</div><div style={{ fontSize:12, color:C.muted }}>{s.label}</div></div>
            ))}
          </div>
        )}
        <div style={{ background:C.card, borderRadius:16, border:`1px solid ${C.border}`, padding:"1.25rem", marginBottom:"1.25rem" }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"1rem" }}>
            <span style={{ fontSize:14, fontWeight:600 }}>Focus areas</span>
            <span style={{ fontSize:13, color:C.muted }}>{selectedTopics.length===0?"All topics (random)":`${selectedTopics.length} selected`}</span>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            {TOPICS.map(t=>{ const sel=selectedTopics.includes(t.id); return (
              <button key={t.id} onClick={()=>toggleTopic(t.id)} style={{ textAlign:"left", padding:"10px 12px", borderRadius:10, width:"100%", border:sel?`1.5px solid ${C.selBorder}`:`1px solid ${C.border}`, background:sel?C.selBg:"#FAFAFA", cursor:"pointer" }}>
                <div style={{ fontSize:13, fontWeight:500, color:sel?C.selText:C.text }}>{t.id}</div>
                <div style={{ fontSize:11, color:sel?"#60A5FA":"#94A3B8", marginTop:2 }}>{t.desc}</div>
              </button>
            );})}
          </div>
        </div>
        {error && <div style={{ background:C.wrongBg, border:`1px solid ${C.wrongBorder}`, borderRadius:10, padding:"10px 14px", marginBottom:12, fontSize:13, color:C.wrongText }}>{error}</div>}
        <button onClick={onStart} disabled={isLoading} style={{ width:"100%", padding:16, border:"none", borderRadius:12, background:isLoading?C.disabled:C.navy, color:"#FFFFFF", fontSize:16, fontWeight:600, cursor:isLoading?"not-allowed":"pointer" }}>
          {isLoading?"Generating question...":total>0?"Next question →":"Start quiz"}
        </button>
      </div>
    </div>
  );
}

function QuizScreen({ question, score, total, streak, onBack, onNext, isLoading }) {
  const [selected, setSelected] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [showWrong, setShowWrong] = useState(false);
  const accuracy = total>0 ? Math.round((score/total)*100) : 0;
  const isCorrect = selected===question.correct;
  const diff = DIFF_STYLE[question.difficulty]||DIFF_STYLE.intermediate;
  const optBg = l => !answered ? (selected===l?C.selBg:C.card) : l===question.correct?C.correctBg:l===selected?C.wrongBg:"#FAFAFA";
  const optBorder = l => !answered ? (selected===l?C.selBorder:C.border) : l===question.correct?C.correctBorder:l===selected?C.wrongBorder:C.border;
  const optColor = l => !answered ? (selected===l?C.selText:C.text) : l===question.correct?C.correctText:l===selected?C.wrongText:"#94A3B8";
  const circleBg = l => !answered?(selected===l?C.selBorder:"#E2E8F0"):l===question.correct?"#10B981":l===selected?"#EF4444":"#E2E8F0";
  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:font, color:C.text }}>
      <div style={{ background:C.navy, padding:"10px 1rem", position:"sticky", top:0, zIndex:10 }}>
        <div style={{ maxWidth:600, margin:"0 auto", display:"flex", alignItems:"center" }}>
          <button onClick={onBack} style={{ background:"none", border:"none", color:"rgba(255,255,255,0.7)", fontSize:13, cursor:"pointer", padding:0 }}>← Topics</button>
          <div style={{ flex:1 }}/>
          <div style={{ display:"flex", gap:20, alignItems:"center" }}>
            <div style={{ textAlign:"center" }}><div style={{ fontSize:15, fontWeight:700, color:"#FFF" }}>{score}/{total}</div><div style={{ fontSize:10, color:"rgba(255,255,255,0.55)", textTransform:"uppercase" }}>score</div></div>
            {streak>=2 && <div style={{ textAlign:"center" }}><div style={{ fontSize:15, fontWeight:700, color:"#FCD34D" }}>+{streak}</div><div style={{ fontSize:10, color:"rgba(255,255,255,0.55)", textTransform:"uppercase" }}>streak</div></div>}
            <AccuracyRing pct={accuracy}/>
          </div>
        </div>
      </div>
      <div style={{ maxWidth:600, margin:"0 auto", padding:"1.5rem 1rem 3rem" }}>
        <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:"1rem" }}>
          <Badge bg="#EDE9FE" color="#5B21B6" border="#C4B5FD">{question.topic}</Badge>
          {question.questionType && <Badge bg="#F0FDF4" color="#166534" border="#BBF7D0">{QTYPE_LABELS[question.questionType]||question.questionType}</Badge>}
          {question.difficulty && <Badge bg={diff.bg} color={diff.color} border={diff.border}>{question.difficulty}</Badge>}
          <Badge bg="#EFF6FF" color="#1D4ED8" border="#BFDBFE">NCSBN Aligned</Badge>
        </div>
        <div style={{ background:C.card, borderRadius:16, padding:"1.5rem", border:`1px solid ${C.border}`, marginBottom:"1rem" }}>
          <p style={{ margin:0, fontSize:15, lineHeight:1.75 }}>{question.stem}</p>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:"1.25rem" }}>
          {["A","B","C","D"].map(l=>(
            <button key={l} onClick={()=>!answered&&setSelected(l)} style={{ display:"flex", alignItems:"flex-start", gap:12, padding:"14px 16px", borderRadius:12, width:"100%", textAlign:"left", background:optBg(l), border:`1.5px solid ${optBorder(l)}`, color:optColor(l), cursor:answered?"default":"pointer", transition:"all 0.12s" }}>
              <span style={{ width:28, height:28, borderRadius:"50%", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, background:circleBg(l), color:"#FFF", transition:"background 0.12s" }}>
                {answered&&l===question.correct?"✓":answered&&l===selected&&l!==question.correct?"✕":l}
              </span>
              <span style={{ fontSize:14, lineHeight:1.6, paddingTop:4 }}>{question.options[l]}</span>
            </button>
          ))}
        </div>
        {!answered ? (
          <button onClick={()=>selected&&setAnswered(true)} disabled={!selected} style={{ width:"100%", padding:15, border:"none", borderRadius:12, background:selected?C.navy:"#E2E8F0", color:selected?"#FFF":C.disabled, fontSize:15, fontWeight:600, cursor:selected?"pointer":"not-allowed" }}>Submit answer</button>
        ) : (
          <div>
            <div style={{ background:isCorrect?C.correctBg:C.wrongBg, border:`1px solid ${isCorrect?C.correctBorder:C.wrongBorder}`, borderRadius:12, padding:"14px 18px", marginBottom:"1rem", display:"flex", alignItems:"flex-start", gap:12 }}>
              <div style={{ width:32, height:32, borderRadius:"50%", background:isCorrect?"#10B981":"#EF4444", display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontSize:16, fontWeight:700 }}>{isCorrect?"✓":"✕"}</div>
              <div>
                <div style={{ fontWeight:700, fontSize:15, color:isCorrect?C.correctText:C.wrongText }}>{isCorrect?"Correct!":"Incorrect"}</div>
                {!isCorrect && <div style={{ fontSize:13, color:C.wrongText, marginTop:3 }}>Correct answer: <strong>{question.correct} — {question.options[question.correct]}</strong></div>}
              </div>
            </div>
            <div style={{ background:C.card, borderRadius:12, padding:"1.25rem", border:`1px solid ${C.border}`, marginBottom:"0.75rem" }}>
              <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".07em", marginBottom:8 }}>Clinical Rationale</div>
              <p style={{ margin:0, fontSize:14, lineHeight:1.75 }}>{question.rationale}</p>
            </div>
            {question.wrongRationales && Object.keys(question.wrongRationales).length>0 && (
              <div style={{ marginBottom:"1.25rem" }}>
                <button onClick={()=>setShowWrong(v=>!v)} style={{ fontSize:13, color:C.selBorder, background:"none", border:"none", cursor:"pointer", padding:"0 0 8px", fontWeight:500 }}>{showWrong?"▲ Hide":"▼ Show"} why other options are wrong</button>
                {showWrong && (
                  <div style={{ background:C.card, borderRadius:12, border:`1px solid ${C.border}`, overflow:"hidden" }}>
                    {Object.entries(question.wrongRationales).map(([l,reason],idx,arr)=>(
                      <div key={l} style={{ padding:"12px 16px", borderBottom:idx<arr.length-1?"1px solid #F8FAFC":"none" }}>
                        <span style={{ fontSize:12, fontWeight:700, color:C.muted, marginRight:8 }}>Option {l}:</span>
                        <span style={{ fontSize:13, color:"#374151", lineHeight:1.65 }}>{reason}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <button onClick={()=>onNext(isCorrect)} disabled={isLoading} style={{ width:"100%", padding:15, border:"none", borderRadius:12, background:isLoading?C.disabled:C.teal, color:"#FFF", fontSize:15, fontWeight:600, cursor:isLoading?"not-allowed":"pointer" }}>
              {isLoading?"Loading next question...":"Next question →"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState("setup");
  const [question, setQuestion] = useState(null);
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [streak, setStreak] = useState(0);
  const toggleTopic = id => setSelectedTopics(prev=>prev.includes(id)?prev.filter(t=>t!==id):[...prev,id]);
  const loadQuestion = useCallback(async (scoreDelta) => {
    setIsLoading(true); setError(null);
    if (scoreDelta!==undefined) { setTotal(t=>t+1); if(scoreDelta===1){setScore(s=>s+1);setStreak(s=>s+1);}else setStreak(0); }
    const pool = selectedTopics.length>0?selectedTopics:TOPICS.map(t=>t.id);
    const topic = pool[Math.floor(Math.random()*pool.length)];
    try { const q=await fetchQuestion(topic); setQuestion({...q,topic}); setScreen("quiz"); }
    catch(err) { console.error(err); setError("Could not generate a question. Please try again."); setScreen("setup"); }
    finally { setIsLoading(false); }
  }, [selectedTopics]);
  const handleNext = useCallback(wasCorrect=>loadQuestion(wasCorrect?1:0), [loadQuestion]);
  if (screen==="setup") return <SetupScreen selectedTopics={selectedTopics} toggleTopic={toggleTopic} onStart={()=>loadQuestion()} isLoading={isLoading} error={error} score={score} total={total} streak={streak}/>;
  if (screen==="quiz"&&question) return <QuizScreen question={question} score={score} total={total} streak={streak} onBack={()=>setScreen("setup")} onNext={handleNext} isLoading={isLoading}/>;
  return null;
}
