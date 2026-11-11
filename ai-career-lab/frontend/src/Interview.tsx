import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  Clock3,
  ExternalLink,
  FlaskConical,
  Lightbulb,
  MessageSquareText,
  RefreshCw,
  Target,
} from "lucide-react";
import {
  api,
  day,
  Heading,
  latestAttempts,
  LinkButton,
  Loading,
  nav,
  nextTopic,
  PanelTitle,
  ProgressBar,
  useDetail,
  useLab,
} from "./lib";
import { TopicSelect, Workbench } from "./Playground";
import type { Assessment, Attempt, Source } from "./types";

export function Interview({
  topicId,
  modeParam,
  focus = "",
}: {
  topicId?: string;
  modeParam?: string;
  focus?: string;
}) {
  const { state, topics, reload, notify } = useLab(),
    id = topicId || nextTopic(topics, state).id,
    { data, error } = useDetail(id);
  const previous = latestAttempts(state).find((a) => a.topic === id);
  const levels = ["Beginner", "Intermediate", "Advanced"];
  const [chosenLevel, setLevel] = useState("");
  const [chosenSet, setChosenSet] = useState<number | null>(null);
  const answered = new Set(
    Object.values(state.attempts)
      .filter((a) => a.topic === id)
      .flatMap((a) => a.answeredIds || []),
  );
  const unfinished = (ids: string[]) => ids.some((key) => !answered.has(key));
  const nextLevel =
    levels.find((l) => data?.banks[l].some((s) => unfinished(s.ids))) ||
    "Advanced";
  const level = chosenLevel || (focus && previous ? previous.level : nextLevel);
  const sets = data?.banks[level] || [];
  const setNumber =
    chosenSet ?? sets.find((s) => unfinished(s.ids))?.number ?? 1;
  const levelIds = sets.flatMap((s) => s.ids);
  const covered = levelIds.filter((key) => answered.has(key)).length;
  const total =
    setNumber === 0
      ? levelIds.length
      : sets.find((s) => s.number === setNumber)?.ids.length || 5;
  const skillPurpose: Record<string, string> = {
    Beginner:
      "Learn the vocabulary, trace small examples, and check boundaries.",
    Intermediate:
      "Apply the idea when inputs, requirements, or constraints change.",
    Advanced:
      "Diagnose failures, compare designs, and defend a decision with evidence.",
  };
  const [mode, setMode] = useState(
      ["Revision", "Timed"].includes(modeParam || "") ? modeParam! : "Practice",
    ),
    [exam, setExam] = useState<Assessment | null>(null),
    [answers, setAnswers] = useState<Record<string, string>>({}),
    [hint, setHint] = useState(""),
    [busy, setBusy] = useState(""),
    [message, setMessage] = useState(""),
    [seconds, setSeconds] = useState(600);
  const answersRef = useRef(answers),
    finishing = useRef(false);
  answersRef.current = answers;
  function answer(qid: string, v: string) {
    const a = { ...answersRef.current, [qid]: v };
    answersRef.current = a;
    setAnswers(a);
  }
  async function start() {
    setBusy("start");
    setMessage("");
    try {
      const e = await api<Assessment>(
        "/topics/" + id + "/assessments",
        "POST",
        { level, mode, setNumber, focus: decodeURIComponent(focus) },
      );
      setAnswers({});
      setExam(e);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function finish() {
    if (!exam || finishing.current) return;
    finishing.current = true;
    setBusy("finish");
    try {
      const a = await api<Attempt>(
        "/assessments/" + exam.id + "/finish",
        "POST",
        { answers: answersRef.current },
      );
      await reload();
      nav("result/" + a.id);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      finishing.current = false;
      setBusy("");
    }
  }
  useEffect(() => {
    if (!exam) return;
    const timer = setTimeout(() => {
      api("/assessments/" + exam.id + "/draft", "PUT", { answers }).catch((e) =>
        notify(e.message),
      );
    }, 250);
    return () => clearTimeout(timer);
  }, [answers, exam]);
  useEffect(() => {
    if (!exam?.deadline) return;
    const tick = () => {
      const remaining = Math.max(
        0,
        Math.ceil(exam.deadline! - Date.now() / 1000),
      );
      setSeconds(remaining);
      if (!remaining) void finish();
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [exam]);
  async function refresh() {
    setBusy("refresh");
    try {
      const r = await api<{ message: string; sources: Source[] }>(
        "/topics/" + id + "/refresh",
        "POST",
      );
      setMessage(r.message);
      await reload();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  if (!data) return <Loading error={error} />;
  const sources = Object.values(state.sources).filter((s) => s.topic === id);
  return (
    <>
      <Heading
        title={
          exam ? data.topic.title + " assessment" : "Interview preparation"
        }
        subtitle={
          exam
            ? "Answer each question, then submit for a scored concept review."
            : "Practice topic-specific questions and find out what to study next."
        }
        side={
          !exam && (
            <TopicSelect id={id} onSelect={(t) => nav("interview/" + t)} />
          )
        }
      />
      {!exam ? (
        <>
          <div className="dashboard-columns">
            <section className="panel">
              <PanelTitle icon={MessageSquareText} title="Topic assessment" />
              <div className="panel-inner">
                <span className="tag">Local question bank</span>
                <h2>{data.topic.title}</h2>
                <p>
                  {focus
                    ? "Focused practice · " + decodeURIComponent(focus)
                    : skillPurpose[level]}
                </p>
                <div className="filters">
                  <label className="control-label">
                    Skill level
                    <select
                      value={level}
                      aria-label="Skill level"
                      onChange={(e) => {
                        setLevel(e.target.value);
                        setChosenSet(null);
                      }}
                    >
                      {["Beginner", "Intermediate", "Advanced"].map((x) => (
                        <option key={x} value={x}>
                          {x} ·{" "}
                          {data.banks[x].reduce((n, s) => n + s.ids.length, 0)}{" "}
                          questions
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="control-label">
                    Assessment mode
                    <select
                      value={mode}
                      onChange={(e) => setMode(e.target.value)}
                    >
                      <option>Practice</option>
                      <option>Timed</option>
                      <option>Revision</option>
                    </select>
                  </label>
                </div>
                <div className="bank-coverage">
                  <div className="between">
                    <strong>{level} bank</strong>
                    <span>
                      {covered} of {levelIds.length} answered
                    </span>
                  </div>
                  <ProgressBar
                    value={
                      levelIds.length ? (100 * covered) / levelIds.length : 0
                    }
                  />
                </div>
                {mode !== "Revision" && !focus && (
                  <label className="control-label bank-sets">
                    Practice set
                    <select
                      aria-label="Practice set"
                      value={setNumber}
                      onChange={(e) => setChosenSet(Number(e.target.value))}
                    >
                      {sets.map((s) => (
                        <option key={s.number} value={s.number}>
                          {s.number}. {s.title} ·{" "}
                          {s.ids.filter((key) => answered.has(key)).length}/
                          {s.ids.length} answered
                        </option>
                      ))}
                      <option value={0}>
                        Entire level · {levelIds.length} questions
                      </option>
                    </select>
                  </label>
                )}
                <button
                  className="btn primary"
                  disabled={!!busy}
                  onClick={start}
                >
                  Start assessment <ArrowRight size={15} />
                </button>
                <p className="muted">
                  {mode === "Timed"
                    ? total * 2 +
                      "-minute limit. Saved answers are graded when time expires."
                    : mode === "Revision"
                      ? "A quick review of up to three questions."
                      : "Five-question sets let you finish the level over several visits. Every answered question counts toward coverage, at any score."}
                </p>
              </div>
            </section>
            <section className="panel">
              <PanelTitle icon={Target} title="Previous attempts" />
              <div className="panel-inner">
                {latestAttempts(state)
                  .filter((a) => a.topic === id)
                  .slice(0, 6)
                  .map((a) => (
                    <a
                      key={a.id}
                      className="compact-link"
                      href={"#result/" + a.id}
                    >
                      {day(a.date)} · {a.level}
                      <b>{a.score}/100</b>
                    </a>
                  ))}
                {!previous && (
                  <p className="muted">
                    Your scores for {data.topic.title} will appear here after
                    your first assessment.
                  </p>
                )}
              </div>
            </section>
          </div>
          <section className="panel">
            <PanelTitle icon={BookOpen} title="Sourced questions">
              <button
                className="btn secondary small"
                disabled={!!busy}
                onClick={refresh}
              >
                <RefreshCw size={14} />
                {busy === "refresh" ? "Retrieving…" : "Refresh questions"}
              </button>
            </PanelTitle>
            <div className="panel-inner">
              {message && (
                <p role="status" className="notice">
                  {message}
                </p>
              )}
              {!sources.length && (
                <p className="muted">
                  {state.integrations.retrieval
                    ? "Refresh to retrieve recent discussions on this topic."
                    : "Online retrieval is off. Curated assessments are ready to use offline."}
                </p>
              )}
              {sources.map((s) => (
                <div className="source-row" key={s.url}>
                  <a target="_blank" rel="noreferrer" href={s.url}>
                    {s.title} <ExternalLink size={13} />
                  </a>
                  <small>
                    Sourced · {s.difficulty} · {s.author} on Stack Overflow ·{" "}
                    {s.license} · Published{" "}
                    {day(new Date(s.published * 1000).toISOString())} ·
                    Retrieved {day(s.retrieved)} · {s.tags.join(", ")}
                  </small>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : (
        <>
          <div className="assessment-strip">
            <span>
              {exam.questions.length} questions · {exam.level} · {exam.mode}
            </span>
            {exam.deadline && (
              <strong>
                <Clock3 size={15} />
                {Math.floor(seconds / 60)}:
                {String(seconds % 60).padStart(2, "0")}
              </strong>
            )}
          </div>
          {exam.questions.map((q, i) => (
            <section className="panel question" key={q.id}>
              <div className="between">
                <small>
                  QUESTION {String(i + 1).padStart(2, "0")} /{" "}
                  {String(exam.questions.length).padStart(2, "0")}
                </small>
                <span className="tag">
                  {q.type === "choice"
                    ? "Multiple choice"
                    : q.type === "short"
                      ? "Short answer"
                      : q.type === "output"
                        ? "Predict the output"
                        : q.type === "coding"
                          ? "Coding"
                          : "Scenario"}
                </span>
              </div>
              <h3>{q.text}</h3>
              <p className="meta">
                {q.difficulty} · {q.source} · Updated {q.updated}
              </p>
              {q.options?.length ? (
                <div className="choices">
                  {q.options.map((o, j) => (
                    <label
                      key={o}
                      className={answers[q.id] === o ? "selected" : ""}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        checked={answers[q.id] === o}
                        onChange={() => answer(q.id, o)}
                      />
                      <span>{String.fromCharCode(65 + j)}</span>
                      {o}
                    </label>
                  ))}
                </div>
              ) : q.type === "coding" ? (
                <Workbench
                  data={data}
                  item={q.exerciseId}
                  assessmentId={exam.id}
                  onSubmit={(s) => answer(q.id, s)}
                />
              ) : (
                <textarea
                  className="answer"
                  aria-label={"Answer question " + (i + 1)}
                  rows={3}
                  value={answers[q.id] || ""}
                  onChange={(e) => answer(q.id, e.target.value)}
                  placeholder="Write your answer…"
                />
              )}
              <button
                className="text-link"
                onClick={() => setHint(hint === q.id ? "" : q.id)}
              >
                <Lightbulb size={14} />
                {hint === q.id ? "Hide hint" : "Show question hint"}
              </button>
              {hint === q.id && <p className="notice">{q.hint}</p>}
            </section>
          ))}
          <button className="btn primary" disabled={!!busy} onClick={finish}>
            Submit assessment <Check size={16} />
          </button>
        </>
      )}
    </>
  );
}
export function Result({ id }: { id: string }) {
  const { state, topics } = useLab(),
    a = state.attempts[id],
    [coaching, setCoaching] = useState(""),
    [working, setWorking] = useState(false);
  if (!a) return <Loading error="Assessment result not found." />;
  const weak = Object.entries(a.concepts).filter(([, score]) => score < 80);
  return (
    <>
      <Heading
        title="Assessment review"
        subtitle={
          topics.find((t) => t.id === a.topic)?.title +
          " · " +
          a.level +
          " · " +
          day(a.date)
        }
      />
      <div className="score-banner">
        <div className="score-number">
          {a.score}
          <small>/100</small>
        </div>
        <div>
          <h2>{a.interpretation}</h2>
          <p>This score covers the concepts and difficulty in this attempt.</p>
          <LinkButton to={"interview/" + a.topic}>
            Continue through the question bank
          </LinkButton>
        </div>
      </div>
      <div className="dashboard-columns">
        <section className="panel">
          <PanelTitle title="Concept scores" />
          <div className="panel-inner">
            {Object.entries(a.concepts).map(([c, n]) => (
              <div className="concept" key={c}>
                <div className="between">
                  <span>{c}</span>
                  <b>{n}%</b>
                </div>
                <ProgressBar value={n} />
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <PanelTitle title="Targeted revision" />
          <div className="panel-inner">
            {weak.map(([c]) => (
              <a
                className="compact-link"
                key={c}
                href={
                  "#interview/" + a.topic + "/Revision/" + encodeURIComponent(c)
                }
              >
                Revisit {c} <ArrowRight size={15} />
              </a>
            ))}
            {!weak.length && (
              <p>
                You met the target on every assessed concept. Practice again at
                the next scheduled review.
              </p>
            )}
            <LinkButton to={"playground/" + a.topic}>
              Practice related exercises
            </LinkButton>
            <p className="muted">
              Next review{" "}
              {state.progress[a.topic]?.due
                ? day(state.progress[a.topic].due!)
                : "available in Revision Center"}
            </p>
            {state.integrations.ai && (
              <button
                className="btn secondary"
                disabled={working}
                onClick={async () => {
                  setWorking(true);
                  try {
                    setCoaching(
                      (
                        await api<{ message: string }>(
                          "/attempts/" + id + "/coach",
                          "POST",
                        )
                      ).message,
                    );
                  } catch (e) {
                    setCoaching((e as Error).message);
                  } finally {
                    setWorking(false);
                  }
                }}
              >
                Send concept scores to AI coach
              </button>
            )}
            {coaching && <p className="notice">{coaching}</p>}
          </div>
        </section>
      </div>
      <section className="panel">
        <PanelTitle title="Answer review" />
        <div className="panel-inner">
          {a.reviews.map((r, i) => (
            <details className="review-answer" key={i} open={r.percent < 100}>
              <summary>
                <span className={r.percent === 100 ? "tag" : "tag amber"}>
                  {r.percent}%
                </span>
                <b>{r.concept}</b>
                <ChevronDown size={15} />
              </summary>
              <h3>{r.text}</h3>
              <small>YOUR ANSWER</small>
              <pre className="output">{r.answer || "Unanswered"}</pre>
              <small>ANSWER OR RUBRIC</small>
              <p>{r.solution}</p>
              <p>{r.explanation}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
