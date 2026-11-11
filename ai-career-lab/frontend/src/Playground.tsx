import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  Braces,
  Check,
  CircleAlert,
  Code2,
  FlaskConical,
  History,
  Lightbulb,
  Play,
  RotateCcw,
  Square,
  Terminal,
} from "lucide-react";
import {
  api,
  day,
  display,
  examplePackage,
  Heading,
  Loading,
  nav,
  nextTopic,
  PanelTitle,
  useDetail,
  useLab,
} from "./lib";
import type { Detail, Exercise, Submission } from "./types";
const CodeEditor = lazy(() => import("./CodeEditor"));
type RunResult = {
  stdout: string;
  stderr: string;
  outputs: { actual?: unknown; error?: string }[];
  fatal?: string;
};
export function TopicSelect({
  id,
  onSelect,
}: {
  id: string;
  onSelect: (s: string) => void;
}) {
  const { stages } = useLab();
  return (
    <label className="control-label">
      Topic
      <select
        aria-label="Choose topic"
        value={id}
        onChange={(e) => onSelect(e.target.value)}
      >
        {stages.map((s) => (
          <optgroup key={s.id} label={s.title}>
            {s.modules
              .flatMap((m) => m.topics)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
export function Playground({
  topicId,
  item,
}: {
  topicId?: string;
  item?: string;
}) {
  const { topics, state } = useLab(),
    id = topicId || nextTopic(topics, state).id,
    { data, error } = useDetail(id);
  return (
    <>
      <Heading
        title="Coding playground"
        subtitle="Write code, run examples, and test your solutions in an isolated browser workspace."
        side={<TopicSelect id={id} onSelect={(s) => nav("playground/" + s)} />}
      />
      {data ? (
        <>
          <div className="filters">
            <label className="control-label">
              Exercise or example
              <select
                aria-label="Exercise or example"
                value={item || data.exercises[0].id}
                onChange={(e) => nav("playground/" + id + "/" + e.target.value)}
              >
                <optgroup label="Exercises">
                  {data.exercises.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.title}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Lesson examples">
                  {data.lesson.examples.map((x, i) => (
                    <option
                      disabled={!!examplePackage(x.code)}
                      key={i}
                      value={"example-" + i}
                    >
                      {x.title}
                      {examplePackage(x.code) ? " · separate environment" : ""}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>
          </div>
          <Workbench key={id + item} data={data} item={item} />
        </>
      ) : (
        <Loading error={error} />
      )}
    </>
  );
}
export function Workbench({
  data,
  item,
  assessmentId = "",
  onSubmit,
}: {
  data: Detail;
  item?: string;
  assessmentId?: string;
  onSubmit?: (id: string) => void;
}) {
  const { state, reload, notify, account } = useLab(),
    example = item?.startsWith("example-")
      ? data.lesson.examples[Number(item.slice(8))]
      : null;
  const ex: Exercise =
      data.exercises.find((e) => e.id === item) || data.exercises[0],
    id = data.topic.id;
  const lang = example
    ? example.language === "sql" ||
      /^\s*(SELECT|CREATE TABLE|WITH |INSERT INTO|PRAGMA)/i.test(example.code)
      ? "sql"
      : "python"
    : ex.language;
  const starter = example ? example.code : ex.starter;
  const storageKey = ["lab-draft", account.id, id, item || ex.id, assessmentId].join("/");
  const [code, setCode] = useState(
    () => localStorage.getItem(storageKey) ?? starter,
  );
  const [input, setInput] = useState(
    example
      ? ""
      : lang === "sql"
        ? String(ex.sampleInput)
        : JSON.stringify(ex.sampleInput),
  );
  const [hint, setHint] = useState(false),
    [busy, setBusy] = useState(""),
    [stdout, setOut] = useState(""),
    [stderr, setErr] = useState(""),
    [cases, setCases] = useState<Submission | null>(null),
    [tab, setTab] = useState("Output"),
    [ran, setRan] = useState(false);
  const worker = useRef<Worker | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(),
    cancel = useRef<(() => void) | null>(null),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      cancel.current?.();
      worker.current?.terminate();
      clearTimeout(timer.current);
    };
  }, []);
  const history = Object.values(state.submissions)
    .filter((s) => s.topic === id && s.exerciseId === ex.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  function edit(s: string) {
    setCode(s);
    try {
      localStorage.setItem(storageKey, s);
    } catch {
      /* Database submission history remains available. */
    }
  }
  async function run(test: boolean) {
    if (busy) return;
    setBusy("Preparing runtime…");
    setErr("");
    setOut("");
    setCases(null);
    setRan(true);
    setTab("Output");
    try {
      const inputs = test
        ? await api<unknown[]>(
            "/topics/" + id + "/exercises/" + ex.id + "/inputs",
          )
        : [example || lang === "sql" ? input : JSON.parse(input)];
      if (!alive.current) return;
      const result = await new Promise<RunResult>((resolve, reject) => {
        const w = new Worker("/runner.js");
        worker.current = w;
        const fail = (text: string) => {
          w.terminate();
          clearTimeout(timer.current);
          reject(new Error(text));
        };
        cancel.current = () => fail("Execution stopped.");
        timer.current = setTimeout(
          () =>
            fail(
              "The local runtime took too long to load. Restart the app and check its runtime files.",
            ),
          45000,
        );
        w.onerror = (e) =>
          fail(e.message || "The local runtime could not start.");
        w.onmessage = ({ data: msg }) => {
          if (msg.ready) {
            clearTimeout(timer.current);
            setBusy("Running…");
            timer.current = setTimeout(
              () =>
                fail(
                  "Execution stopped after 8 seconds. Check for an infinite loop or reduce the input size.",
                ),
              8000,
            );
            return;
          }
          clearTimeout(timer.current);
          w.terminate();
          msg.fatal ? reject(new Error(msg.fatal)) : resolve(msg);
        };
        w.postMessage({
          language: lang,
          code,
          inputs,
          sample: !test,
          script: !!example,
        });
      });
      if (!alive.current) return;
      setOut(result.stdout);
      setErr(result.stderr);
      if (test) {
        const sub = await api<Submission>(
          "/topics/" + id + "/submissions",
          "POST",
          { code, exerciseId: ex.id, assessmentId, outputs: result.outputs },
        );
        setCases(sub);
        onSubmit?.(sub.id);
        await reload();
        notify(
          "Submission saved · " +
            sub.passed +
            "/" +
            sub.cases.length +
            " tests passed",
        );
      }
    } catch (e) {
      if (alive.current)
        setErr(
          e instanceof SyntaxError
            ? "Enter a valid JSON sample input, including quotes around strings."
            : (e as Error).message,
        );
    } finally {
      clearTimeout(timer.current);
      worker.current = null;
      cancel.current = null;
      if (alive.current) setBusy("");
    }
  }
  if (example && examplePackage(example.code))
    return (
      <section className="panel panel-inner">
        <h2>{example.title}</h2>
        <p>
          This reference example requires a separately configured Python
          environment with {examplePackage(example.code)}.
        </p>
        <a className="text-link" href={"#playground/" + id}>
          Open the offline exercise
        </a>
      </section>
    );
  return (
    <div className="workbench">
      <section className="panel panel-inner">
        <div className="between">
          <span className="tag">
            {example ? "Lesson example" : ex.difficulty}
          </span>
          <span className="meta">
            <Braces size={15} />
            {lang === "sql" ? "SQLite · sql.js" : "Python · Pyodide"}
          </span>
        </div>
        <h2>{example ? example.title : ex.title}</h2>
        <p>{example ? data.lesson.usage : ex.prompt}</p>
        <div className="sample-grid">
          <label className="control-label">
            {lang === "sql"
              ? "Sample database setup"
              : "Sample input" + (!example ? " (JSON)" : "")}
            <textarea
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
          </label>
          <div>
            <small className="control-label">Expected sample output</small>
            <pre className="output">
              {display(example ? example.output : ex.sampleOutput)}
            </pre>
          </div>
        </div>
        {!example && (
          <>
            <button className="text-link" onClick={() => setHint(!hint)}>
              <Lightbulb size={15} />
              {hint ? "Hide hint" : "Show hint"}
            </button>
            {hint && <p className="notice">{ex.hint}</p>}
          </>
        )}
      </section>
      <section className="panel editor-panel">
        <div className="editor-top">
          <span>
            <Code2 size={16} />
            {lang === "sql" ? "query.sql" : "main.py"}
          </span>
          <button
            className="icon-text"
            disabled={!!busy}
            onClick={() => {
              edit(starter);
              setCases(null);
              setOut("");
              setErr("");
              setRan(false);
            }}
          >
            <RotateCcw size={14} />
            Reset code
          </button>
        </div>
        <Suspense fallback={<Loading />}>
          <CodeEditor value={code} onChange={edit} language={lang} />
        </Suspense>
        <div className="editor-actions">
          <button
            className="btn secondary"
            disabled={!!busy}
            onClick={() => run(false)}
          >
            <Play size={15} />
            Run code
          </button>
          {!example && (
            <button
              className="btn primary"
              disabled={!!busy}
              onClick={() => run(true)}
            >
              <FlaskConical size={15} />
              Submit tests
            </button>
          )}
          {busy && (
            <>
              <button
                className="btn secondary"
                onClick={() => cancel.current?.()}
              >
                <Square size={13} />
                Stop
              </button>
              <small role="status">{busy}</small>
            </>
          )}
        </div>
      </section>
      <section className="panel">
        <div className="tabs">
          {["Output", ...(!example ? ["Submission history"] : [])].map((t) => (
            <button
              key={t}
              className={t === tab ? "active" : ""}
              onClick={() => setTab(t)}
            >
              {t === "Output" ? <Terminal size={15} /> : <History size={15} />}{" "}
              {t}
            </button>
          ))}
        </div>
        <div className="panel-inner" aria-live="polite">
          {tab === "Output" ? (
            <>
              {stdout && <pre className="output">{stdout}</pre>}
              {stderr && <pre className="error-output">{stderr}</pre>}
              {!stdout && !stderr && !cases && (
                <p className="muted">
                  {busy
                    ? busy
                    : ran
                      ? "Execution finished with no printed output."
                      : "Run your code to see the output here."}
                </p>
              )}
              {cases && (
                <>
                  <h3>
                    {cases.passed} / {cases.cases.length} tests passed
                  </h3>
                  {cases.cases.map((c, i) => (
                    <div
                      key={i}
                      className={"case " + (c.passed ? "pass" : "fail")}
                    >
                      {c.passed ? (
                        <Check size={16} />
                      ) : (
                        <CircleAlert size={16} />
                      )}
                      <div>
                        <b>{c.label}</b>
                        {!c.passed && (
                          <pre>
                            {c.error ||
                              "Expected " +
                                JSON.stringify(c.expected) +
                                "\nReceived " +
                                JSON.stringify(c.actual)}
                          </pre>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </>
          ) : (
            <>
              {!history.length && (
                <p className="muted">Your test submissions will appear here.</p>
              )}
              {history.map((s) => (
                <button
                  className="history-row"
                  key={s.id}
                  onClick={async () => {
                    try {
                      const sub = await api<Submission>("/submissions/" + s.id);
                      edit(sub.code);
                      setCases(sub);
                      setOut("");
                      setErr("");
                      setTab("Output");
                    } catch (e) {
                      notify((e as Error).message);
                    }
                  }}
                >
                  <span>
                    {day(s.date)} ·{" "}
                    {new Date(s.date).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <strong>
                    {s.passed}/{s.total} passed · Load code
                  </strong>
                </button>
              ))}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
