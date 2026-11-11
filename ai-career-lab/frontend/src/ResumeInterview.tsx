import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, FileText, Mic, MicOff, RotateCcw, Volume2 } from "lucide-react";
import { api, Heading, Loading, PanelTitle } from "./lib";
import "./resume-interview.css";

interface Turn {
  question: string;
  answer?: string;
  source: "guided" | "model" | "fallback";
}
interface ReviewItem {
  title: string;
  turn: number | null;
  example: string;
  practice: string;
}
interface InterviewSession {
  id: string;
  role: string;
  revision: number;
  evidence: string[];
  useModel: boolean;
  finished: boolean;
  turns: Turn[];
  review: ReviewItem[];
}
interface InterviewPage {
  interview: InterviewSession | null;
  modelHost: string | null;
  limit: number;
}
interface SpeechResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { resultIndex: number; results: ArrayLike<SpeechResult> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type Recognizer = new () => Recognition;
const browser = window as Window & {
  SpeechRecognition?: Recognizer;
  webkitSpeechRecognition?: Recognizer;
};
const RecognitionService = browser.SpeechRecognition || browser.webkitSpeechRecognition;
const hasSpeaker = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

function speak(question: string) {
  if (!hasSpeaker) return;
  window.speechSynthesis.cancel();
  const speech = new SpeechSynthesisUtterance(question);
  const englishVoices = window.speechSynthesis.getVoices().filter(v => /^en\b/i.test(v.lang));
  const voice = englishVoices.find(v => v.localService) || englishVoices[0];
  if (voice) speech.voice = voice;
  speech.lang = voice?.lang || "en-US";
  window.speechSynthesis.speak(speech);
}

export function ResumeInterview() {
  const [page, setPage] = useState<InterviewPage | null>(null);
  const [role, setRole] = useState("");
  const [resume, setResume] = useState("");
  const [useModel, setUseModel] = useState(false);
  const [voice, setVoice] = useState(false);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [clearRequested, setClearRequested] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [speechMessage, setSpeechMessage] = useState("");
  const microphone = useRef<Recognition | null>(null);
  const current = page?.interview;
  const turn = current?.turns.at(-1);
  const playback = voice && current && !current.finished ? turn?.question : "";

  useEffect(() => {
    let mounted = true;
    api<InterviewPage>("/resume").then(data => {
      if (mounted) setPage(data);
    }).catch(e => { if (mounted) setError(e.message); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (playback) speak(playback);
    return () => { if (hasSpeaker) window.speechSynthesis.cancel(); };
  }, [playback]);

  const releaseMic = useCallback(() => {
    const mic = microphone.current;
    if (mic) {
      mic.onend = mic.onerror = mic.onresult = null;
      mic.abort();
      microphone.current = null;
    }
  }, []);
  useEffect(() => releaseMic, [releaseMic]);

  function changeVoice(enabled: boolean) {
    releaseMic();
    setInterim("");
    setListening(false);
    setSpeechMessage("");
    setVoice(enabled);
  }

  function dictate() {
    if (!RecognitionService || microphone.current) return;
    if (hasSpeaker) window.speechSynthesis.cancel();
    setSpeechMessage("");
    const mic = new RecognitionService();
    mic.lang = /^en\b/i.test(navigator.language) ? navigator.language : "en-US";
    mic.interimResults = true;
    mic.continuous = true;
    mic.onresult = event => {
      let partial = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) final += " " + result[0].transcript;
        else partial += " " + result[0].transcript;
      }
      if (final.trim()) setAnswer(previous => (previous.trimEnd() + " " + final.trim()).trim().slice(0, 4000));
      setInterim(partial.trim());
    };
    mic.onerror = event => {
      setSpeechMessage(event.error === "not-allowed"
        ? "Microphone access is blocked. Allow it in your browser or type your answer."
        : "Dictation stopped. You can type your answer or try the microphone again.");
    };
    mic.onend = () => {
      microphone.current = null;
      setListening(false);
      setInterim("");
    };
    microphone.current = mic;
    try { mic.start(); setListening(true); }
    catch {
      microphone.current = null;
      setSpeechMessage("The microphone could not start. Type your answer or check your browser’s microphone settings.");
    }
  }

  async function act(job: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try { await job(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  function display(current: InterviewSession | null) {
    setPage(previous => previous && ({ ...previous, interview: current }));
    setAnswer("");
    setSpeechMessage("");
    setClearRequested(false);
    setInterim("");
  }
  async function start() {
    const result = await api<InterviewSession>("/resume", "POST", { role, resume, useModel });
    display(result);
    setResume("");
  }
  const position = current ? { id: current.id, revision: current.revision } : null;
  async function respond() {
    const result = await api<InterviewSession>("/resume/answer", "POST", { ...position, answer });
    display(result);
  }
  async function endEarly() {
    display(await api<InterviewSession>("/resume/finish", "POST", position));
  }
  async function clear() {
    await api("/resume", "DELETE", position);
    changeVoice(false);
    setUseModel(false);
    display(null);
  }
  const voiceControls = (
    <div className="resume-voice-option">
      <label>
        <input type="checkbox" checked={voice} onChange={e => changeVoice(e.target.checked)}
          disabled={!hasSpeaker && !RecognitionService} />
        Enable spoken questions and dictation
      </label>
      <p>Your browser may send audio or question text to its speech service. Dictation starts when you select the microphone. You can edit each answer before sending.</p>
      {(!hasSpeaker || !RecognitionService) && <p>{!hasSpeaker && !RecognitionService
        ? "This browser supports text interviews only."
        : !RecognitionService ? "Dictation is unavailable in this browser. You can listen and type your answers."
        : "Spoken playback is unavailable here. You can read questions and dictate your answers."}</p>}
    </div>
  );
  if (!page) return error ? <div className="panel panel-inner" role="alert">{error} <button className="btn secondary" onClick={() => location.reload()}>Reload interview</button></div> : <Loading />;

  return <>
    <Heading title="Résumé interviewer" subtitle="Practise a job interview drawn from your experience and what you say along the way." />
    {error && <div className="notice resume-actions" role="alert">{error}
      <button className="btn secondary" disabled={busy} onClick={() => void act(async () => {
        setPage(await api<InterviewPage>("/resume")); setClearRequested(false);
      })}><RotateCcw size={14} /> Refresh interview</button></div>}
    {!current ? <section className="panel resume-panel">
      <PanelTitle icon={FileText} title="Prepare your interview" />
      <form className="panel-inner resume-form" onSubmit={e => { e.preventDefault(); void act(start); }}>
        <label htmlFor="resume-role">Target role</label>
        <input required id="resume-role" value={role} onChange={e => setRole(e.target.value)}
          placeholder="For example, junior data analyst" minLength={2} maxLength={100}/>
        <label htmlFor="resume-input">Résumé or selected project descriptions</label>
        <textarea required id="resume-input" rows={8} minLength={35} maxLength={30000} value={resume}
          placeholder="Paste work experience, coursework, or a project you can talk about." onChange={e => setResume(e.target.value)}/>
        <div className="resume-actions">
          <label className="btn secondary resume-file">Import a .txt file
            <input type="file" accept=".txt,text/plain" disabled={busy} onChange={async e => {
              const file = e.target.files?.[0]; e.target.value = "";
              if (!file) return;
              try {
                if (!file.name.toLowerCase().endsWith(".txt") || file.size > 120000) throw Error("Choose a plain text (.txt) résumé under 120 KB, or paste selected sections.");
                const text = await file.text();
                if (text.length > 30000 || text.includes("\0")) throw Error("Paste up to 30,000 characters of plain résumé text.");
                setResume(text); setError("");
              } catch (e) { setError((e as Error).message); }
            }}/>
          </label>
          <small>For PDF or Word, copy and paste the relevant sections.</small>
        </div>
        <p>The interviewer asks up to {page.limit} questions. Your account saves up to three résumé excerpts and the transcript. Leave out contact details or confidential work.</p>
        {page.modelHost && <div className="resume-voice-option"><label>
          <input type="checkbox" checked={useModel} onChange={e => setUseModel(e.target.checked)}/>
          Use the configured AI interviewer
        </label>
          <p>Enabling this sends the target role, selected résumé excerpts and conversation to {page.modelHost} for each new question. The built-in guided interviewer works without this option.</p>
        </div>}
        {voiceControls}
        <div><button className="btn primary" disabled={busy || role.trim().length < 2 || resume.trim().length < 35}>
          {busy ? "Preparing interview…" : "Start résumé interview"} <ArrowRight size={15}/>
        </button></div>
      </form>
    </section> : <div className="resume-layout">
      <div>
        {!current.finished && turn && <section className="panel resume-panel" aria-label="Current question">
          <PanelTitle title={"Question " + current.turns.length + " of " + page.limit}/>
          <div className="panel-inner resume-form">
            <h2 className="resume-question" aria-live="polite">{turn.question}</h2>
            {turn.source === "fallback" && <p>The configured AI service is unavailable. The guided interviewer supplied this question.</p>}
            {voiceControls}
            {voice && hasSpeaker && <div className="resume-actions">
              <button className="btn secondary" disabled={listening} onClick={() => speak(turn.question)}><Volume2 size={16}/> Read question aloud</button>
              <button className="text-link" onClick={() => window.speechSynthesis.cancel()}>Stop playback</button>
            </div>}
            <label htmlFor="resume-answer">Your answer</label>
            <textarea id="resume-answer" value={answer} rows={5} maxLength={4000}
              onChange={e => setAnswer(e.target.value)} placeholder="Answer as you would in the interview." />
            {voice && RecognitionService && <div className="resume-actions">
              <button className="btn secondary" disabled={busy} onClick={() => listening ? microphone.current?.stop() : dictate()}>
                {listening ? <MicOff size={16}/> : <Mic size={16}/>}
                {listening ? "Stop dictation" : "Dictate answer"}
              </button>
              <span role="status">{listening ? ("Listening… " + interim) : speechMessage}</span>
            </div>}
            <div className="resume-actions">
              <button className="btn primary" disabled={busy || listening || !answer.trim()} onClick={() => void act(respond)}>
                {busy ? "Saving…" : current.turns.length === page.limit ? "Send answer and finish" : "Send answer"} <ArrowRight size={15}/>
              </button>
              {current.turns.length > 1 && <button className="btn secondary" disabled={busy || listening || !!answer.trim()} onClick={() => void act(endEarly)}>Finish with answered questions</button>}
            </div>
          </div>
        </section>}
        {current.finished && <section className="panel resume-panel">
          <PanelTitle title="Interview review" />
          <div className="panel-inner">
            <p>{current.turns.filter(t => t.answer).length} answers submitted for {current.role}. Use these practice notes to prepare your next attempt.</p>
            {current.review.map(item => <div className="resume-review" key={item.title}>
              <h3>{item.title}</h3>
              {item.turn ? <><small>From answer {item.turn}</small><blockquote>{item.example}</blockquote></>
                : <small>No clear example picked up in your answers.</small>}
              <p>{item.practice}</p>
            </div>)}
          </div>
        </section>}
        {current.turns.some(t => t.answer) && <section className="panel resume-panel">
          <PanelTitle title="Interview transcript" />
          <div className="panel-inner">
            {current.turns.filter(t => t.answer).map((t, i) => <div className="resume-review" key={i}>
              <small>Question {i + 1}</small><h3>{t.question}</h3><p className="resume-reply">{t.answer}</p>
            </div>)}
          </div>
        </section>}
      </div>
      <aside className="panel resume-panel">
        <PanelTitle title={current.role}/>
        <div className="panel-inner">
          <h3>From your résumé</h3>
          {current.evidence.map(line => <blockquote key={line}>{line}</blockquote>)}
          <small>{current.useModel ? "Configured AI interviewer" : "Guided interviewer"}</small>
          <div className="resume-review">
            {clearRequested ? <>
              <p>Delete the saved excerpts and conversation from this account? You can then start a new interview.</p>
              <div className="resume-actions"><button className="btn secondary" disabled={busy} onClick={() => void act(clear)}>Delete interview</button>
                <button className="text-link" disabled={busy} onClick={() => setClearRequested(false)}>Keep interview</button></div>
            </> : <button className="text-link" disabled={busy || listening} onClick={() => setClearRequested(true)}>Clear saved interview</button>}
          </div>
        </div>
      </aside>
    </div>}
  </>;
}
