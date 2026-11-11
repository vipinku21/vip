import { useRef, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarClock,
  Check,
  Clock3,
  Database,
  Download,
  Flag,
  FlaskConical,
  Lightbulb,
  LockKeyhole,
  Moon,
  RotateCcw,
  Sun,
  Target,
  Upload,
} from "lucide-react";
import {
  api,
  complete,
  day,
  Heading,
  latestAttempts,
  LinkButton,
  minutes,
  nextTopic,
  offsetDate,
  PanelTitle,
  ProgressBar,
  useLab,
} from "./lib";
import { Stat } from "./Dashboard";
import type { Attempt, Prefs } from "./types";

export function Analytics() {
  const { state, topics } = useLab(),
    attempts = latestAttempts(state),
    total = Object.values(state.activity).reduce((n, a) => n + a.seconds, 0),
    daily = Array.from({ length: 7 }, (_, i) => offsetDate(state.today, i - 6)),
    completed = Object.values(state.progress).filter((p) =>
      complete(p.status),
    ).length;
  const confidence = Object.values(state.progress).filter(
      (p) => p.lastScore !== undefined && p.lastScore !== null,
    ),
    assessed = confidence.filter((p) => p.lastScore! >= 80).length;
  const finished = Object.entries(state.projects).filter(
    ([k, p]) => p.checked.length === (state.projectTotals?.[k] ?? Infinity),
  ).length;
  return (
    <>
      <Heading
        title="Progress and analytics"
        subtitle="Track your study time, project milestones, and assessment results."
      />
      <div className="stat-grid">
        <Stat
          title="Completed topics"
          value={String(completed)}
          desc={topics.length + " topics on your roadmap"}
          icon={BookOpen}
          color="mint"
        />
        <Stat
          title="Active study"
          value={minutes(Math.floor(total / 60))}
          desc="Time in learning activities"
          icon={Clock3}
          color="blue"
        />
        <Stat
          title="Assessed proficiency"
          value={String(assessed)}
          desc="Topics scoring 80% or higher"
          icon={Target}
          color="lavender"
        />
        <Stat
          title="Completed projects"
          value={String(finished)}
          desc={Object.keys(state.projects).length + " projects started"}
          icon={Flag}
          color="peach"
        />
      </div>
      <div className="dashboard-columns">
        <section className="panel">
          <PanelTitle icon={BarChart3} title="Study activity" />
          <div className="panel-inner">
            <small>MINUTES · LAST 7 DAYS</small>
            <div className="bars">
              {daily.map((d) => {
                const m = Math.round((state.activity[d]?.seconds || 0) / 60),
                  max = Math.max(
                    1,
                    ...daily.map((k) => (state.activity[k]?.seconds || 0) / 60),
                  );
                return (
                  <div className="bar-col" key={d}>
                    <div className="bar-space">
                      <div style={{ height: (m / max) * 85 + "%" }}>
                        <span>{m}</span>
                      </div>
                    </div>
                    <small>
                      {new Date(d + "T12:00").toLocaleDateString("en-GB", {
                        weekday: "short",
                      })}
                    </small>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
        <section className="panel">
          <PanelTitle icon={Target} title="Assessment history" />
          <div className="panel-inner">
            {!attempts.length ? (
              <div className="empty">
                <FlaskConical />
                <p>Take an assessment to see your score trend.</p>
                <LinkButton to="interview">Start practice</LinkButton>
              </div>
            ) : (
              <>
                <small>
                  LAST {Math.min(8, attempts.length)} ATTEMPTS · SCORE / 100
                </small>
                <div className="bars">
                  {attempts
                    .slice(0, 8)
                    .reverse()
                    .map((a, i) => (
                      <a
                        href={"#result/" + a.id}
                        className="bar-col"
                        key={a.id}
                      >
                        <div className="bar-space">
                          <div style={{ height: a.score * 0.85 + "%" }}>
                            <span>{a.score}</span>
                          </div>
                        </div>
                        <small>#{Math.max(1, attempts.length - 7) + i}</small>
                      </a>
                    ))}
                </div>
              </>
            )}
          </div>
        </section>
      </div>
      <section className="panel">
        <PanelTitle icon={Lightbulb} title="Skill improvement" />
        <div className="panel-inner">
          {!confidence.length ? (
            <p className="muted">
              Concept scores and changes appear after each topic assessment.
            </p>
          ) : (
            topics
              .filter((t) => state.progress[t.id]?.lastScore != null)
              .map((t) => {
                const list = attempts.filter((a) => a.topic === t.id),
                  diff =
                    list.length > 1 ? list[0].score - list[1].score : undefined;
                return (
                  <div className="concept" key={t.id}>
                    <div className="between">
                      <a href={"#result/" + list[0]?.id}>{t.title}</a>
                      <strong>
                        {list[0]?.score}%{" "}
                        {diff !== undefined &&
                          "(" + (diff >= 0 ? "+" : "") + diff + " pts)"}
                      </strong>
                    </div>
                    <ProgressBar value={list[0]?.score || 0} />
                  </div>
                );
              })
          )}
        </div>
      </section>
    </>
  );
}
export function Gaps() {
  const { state, topics } = useLab(),
    all = latestAttempts(state),
    latest = new Map<string, Attempt>();
  for (const a of all) if (!latest.has(a.topic)) latest.set(a.topic, a);
  return (
    <>
      <Heading
        title="Skill gap analyzer"
        subtitle="See which concepts held up in practice and which need another pass."
      />
      {!all.length ? (
        <section className="panel empty">
          <span className="tile lavender">
            <Target />
          </span>
          <h2>Start with a topic assessment</h2>
          <p>
            Your answers and coding tests determine the concepts to practice
            next.
          </p>
          <LinkButton to={"interview/" + nextTopic(topics, state).id}>
            Choose an assessment
          </LinkButton>
        </section>
      ) : (
        Array.from(latest.values()).map((a) => (
          <section className="panel" key={a.id}>
            <PanelTitle
              title={topics.find((t) => t.id === a.topic)?.title || a.topic}
            >
              <LinkButton to={"result/" + a.id}>Full review</LinkButton>
            </PanelTitle>
            <div className="panel-inner">
              <p>
                Latest {a.level.toLowerCase()} assessment · {a.score}/100 ·{" "}
                {day(a.date)}
              </p>
              <div className="dashboard-columns">
                <div>
                  <h3>Strong areas</h3>
                  {Object.entries(a.concepts).some(([, n]) => n >= 80) ? (
                    Object.entries(a.concepts)
                      .filter(([, n]) => n >= 80)
                      .map(([c, n]) => (
                        <p className="icon-text" key={c}>
                          <Check size={15} />
                          {c} · {n}%
                        </p>
                      ))
                  ) : (
                    <p className="muted">
                      No assessed concepts reached 80% this time.
                    </p>
                  )}
                </div>
                <div>
                  <h3>Recommended revision</h3>
                  {Object.entries(a.concepts)
                    .filter(([, n]) => n < 80)
                    .map(([c, n]) => (
                      <a
                        className="compact-link"
                        key={c}
                        href={
                          "#interview/" +
                          a.topic +
                          "/Revision/" +
                          encodeURIComponent(c)
                        }
                      >
                        {c} · {n}% <ArrowRight size={14} />
                      </a>
                    ))}
                  {Object.values(a.concepts).every((n) => n >= 80) && (
                    <p>All assessed concepts reached the target.</p>
                  )}
                  <LinkButton to={"playground/" + a.topic}>
                    Practice related exercises
                  </LinkButton>
                </div>
              </div>
            </div>
          </section>
        ))
      )}
    </>
  );
}
export function Revision() {
  const { state, topics } = useLab(),
    items = Object.entries(state.progress)
      .filter(([, p]) => p.due)
      .sort((a, b) => a[1].due!.localeCompare(b[1].due!));
  return (
    <>
      <Heading
        title="Revision center"
        subtitle="Revisit completed topics on a schedule that adapts to your assessment results."
      />
      <section className="panel">
        <PanelTitle icon={CalendarClock} title="Scheduled reviews" />
        <div className="panel-inner">
          {items.length ? (
            items.map(([id, p]) => (
              <div key={id} className="revision-row">
                <span
                  className={
                    "tile " + (p.due! <= state.today ? "peach" : "mint")
                  }
                >
                  <RotateCcw />
                </span>
                <div className="grow">
                  <strong>{topics.find((t) => t.id === id)?.title}</strong>
                  <small>
                    {p.due! <= state.today ? "Due for review" : "Next review"} ·{" "}
                    {day(p.due!)} · Interval {[1, 3, 7, 14, 30][p.step || 0]}{" "}
                    days
                  </small>
                </div>
                <LinkButton to={"interview/" + id + "/Revision"}>
                  Quick quiz
                </LinkButton>
              </div>
            ))
          ) : (
            <div className="empty">
              <BookOpen />
              <h3>Your revision schedule starts with a lesson</h3>
              <p>
                Complete a topic or take an assessment to set its review date.
              </p>
              <LinkButton to="lessons">Browse lessons</LinkButton>
            </div>
          )}
        </div>
      </section>
      <section className="panel">
        <PanelTitle title="Review history" />
        <div className="panel-inner">
          {Object.keys(state.revisions).length ? (
            Object.entries(state.revisions)
              .sort((a, b) => b[1].date.localeCompare(a[1].date))
              .map(([id, r]) => (
                <a key={id} className="compact-link" href={"#result/" + id}>
                  {topics.find((t) => t.id === r.topic)?.title} · {day(r.date)}
                  <b>{r.score}/100</b>
                </a>
              ))
          ) : (
            <p className="muted">
              Completed assessments and their next review dates will appear
              here.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
export function Settings() {
  const { state, reload, notify } = useLab(),
    [prefs, setPrefs] = useState<Prefs>(state.preferences),
    [file, setFile] = useState<File | null>(null),
    [working, setWorking] = useState(false),
    [error, setError] = useState(""),
    fileInput = useRef<HTMLInputElement>(null);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true);
    try {
      await api("/preferences", "PUT", prefs);
      await reload();
      notify("Learning preferences saved");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
    }
  }
  async function restore() {
    if (!file) return;
    setWorking(true);
    setError("");
    try {
      await api("/import", "POST", JSON.parse(await file.text()));
      await reload();
      const s = await api<{ preferences: Prefs }>("/state");
      setPrefs(s.preferences);
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      notify("Backup restored");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
    }
  }
  async function backup() {
    try {
      const data = await api("/export"),
        url = URL.createObjectURL(
          new Blob([JSON.stringify(data, null, 2)], {
            type: "application/json",
          }),
        );
      const a = document.createElement("a");
      a.href = url;
      a.download = "ai-career-lab-" + state.today + ".json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 8000);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <Heading
        title="Settings"
        subtitle="Personalize your study plan and manage your account’s learning data."
      />
      <div className="dashboard-columns">
        <section className="panel">
          <PanelTitle title="Learning preferences" />
          <form className="panel-inner form-stack" onSubmit={save}>
            <label>
              Display name
              <input
                required
                maxLength={60}
                value={prefs.name}
                onChange={(e) => setPrefs({ ...prefs, name: e.target.value })}
              />
            </label>
            <label>
              Daily study availability (minutes)
              <input
                type="number"
                min={15}
                max={720}
                required
                value={prefs.dailyMinutes}
                onChange={(e) =>
                  setPrefs({ ...prefs, dailyMinutes: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Theme
              <select
                value={prefs.theme}
                onChange={(e) =>
                  setPrefs({
                    ...prefs,
                    theme: e.target.value as "light" | "dark",
                  })
                }
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>
            <button className="btn primary" disabled={working}>
              Save preferences
            </button>
          </form>
        </section>
        <section className="panel">
          <PanelTitle icon={Database} title="Learning backup" />
          <div className="panel-inner">
            <p>
              Export your progress, projects, code submissions, assessments,
              revision history, and settings in one JSON file.
            </p>
            <button className="btn secondary" onClick={backup}>
              <Download size={15} />
              Export JSON
            </button>
            <hr />
            <label className="control-label">
              Restore a backup
              <input
                ref={fileInput}
                type="file"
                accept=".json,application/json"
                onChange={(e) => {
                  setFile(e.target.files?.[0] || null);
                  setError("");
                }}
              />
            </label>
            {file && (
              <>
                <p>Restoring {file.name} replaces your current learner data.</p>
                <button
                  className="btn secondary"
                  onClick={restore}
                  disabled={working}
                >
                  <Upload size={15} />
                  Restore selected backup
                </button>
              </>
            )}
          </div>
        </section>
      </div>
      {error && (
        <p role="alert" className="error-output">
          {error}
        </p>
      )}
      <section className="panel">
        <PanelTitle icon={LockKeyhole} title="Optional integrations" />
        <div className="panel-inner">
          <div className="between">
            <b>Stack Exchange question retrieval</b>
            <span className="tag">
              {state.integrations.retrieval ? "Configured" : "Off"}
            </span>
          </div>
          <p>
            Set QUESTION_PROVIDER to stackexchange in the project’s .env file,
            then restart the app. Refresh a topic to fetch attributed links.
          </p>
          <div className="between">
            <b>AI feedback provider</b>
            <span className="tag">
              {state.integrations.ai ? "Configured" : "Off"}
            </span>
          </div>
          <p>
            Set AI_BASE_URL, AI_MODEL, and your provider’s AI_API_KEY on the
            server. You can request coaching from an assessment review. Only the
            topic, score, and concept breakdown are sent.
          </p>
        </div>
      </section>
    </>
  );
}
