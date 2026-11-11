import { useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  Clock3,
  Code2,
  FolderKanban,
  GraduationCap,
  Layers3,
  MessageSquareText,
  Search,
} from "lucide-react";
import {
  api,
  Bullets,
  complete,
  examplePackage,
  Heading,
  LinkButton,
  Loading,
  minutes,
  nav,
  nextTopic,
  PanelTitle,
  ProgressBar,
  TopicRow,
  useDetail,
  useLab,
} from "./lib";
import { stageIcons } from "./Dashboard";
import type { Status } from "./types";
export const statuses: Status[] = [
  "Not Started",
  "Learning",
  "Completed",
  "Needs Revision",
  "Mastered",
];

export function Roadmap({ selected }: { selected?: string }) {
  const { stages, state, topics } = useLab(),
    current = nextTopic(topics, state);
  return (
    <>
      <Heading
        title="Learning roadmap"
        subtitle="Eight stages from your first Python program to building AI applications."
      />
      <div className="stack">
        {stages.map((s, i) => {
          const list = s.modules.flatMap((m) => m.topics),
            done = list.filter((t) =>
              complete(state.progress[t.id]?.status),
            ).length,
            Icon = stageIcons[i];
          return (
            <details
              key={s.id + selected}
              className="panel stage-details"
              open={selected === s.id || (!selected && list.includes(current))}
            >
              <summary>
                <span
                  className={
                    "tile " + ["mint", "blue", "peach", "lavender"][i % 4]
                  }
                >
                  <Icon />
                </span>
                <span className="grow">
                  <small>
                    STAGE {String(i + 1).padStart(2, "0")} · {list.length}{" "}
                    TOPICS
                  </small>
                  <strong>{s.title}</strong>
                </span>
                <span className="meta">
                  {done}/{list.length}
                </span>
                <ChevronDown size={18} />
              </summary>
              <div className="stage-body">
                <p>{s.description}</p>
                <div className="info-strip">
                  <span>
                    <Clock3 size={14} />
                    {s.hours} study hours
                  </span>
                  <span>
                    <Layers3 size={14} />
                    {i ? "After " + stages[i - 1].title : "No prerequisites"}
                  </span>
                </div>
                <p>
                  <b>Stage project</b> · {s.project}
                </p>
                <ProgressBar value={(done / list.length) * 100} />
                {s.modules.map((m) => (
                  <details className="module" key={m.title}>
                    <summary>
                      <FolderKanban size={17} />
                      <b>{m.title}</b>
                      <span>{m.topics.length} topics</span>
                      <ChevronDown size={15} />
                    </summary>
                    {m.topics.map((t) => (
                      <div key={t.id}>
                        <TopicRow topic={t} />
                        <details className="subtopics">
                          <summary>Subtopics</summary>
                          <Bullets items={t.concepts} />
                        </details>
                      </div>
                    ))}
                  </details>
                ))}
              </div>
            </details>
          );
        })}
      </div>
    </>
  );
}
export function Library({ projects = false }: { projects?: boolean }) {
  const { stages, state, topics } = useLab(),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [status, setStatus] = useState("All statuses");
  const filtered = (
    filter === "all"
      ? topics
      : stages.find((s) => s.id === filter)!.modules.flatMap((m) => m.topics)
  ).filter(
    (t) =>
      (projects
        ? t.project + " " + t.title
        : t.title + " " + t.concepts.join(" ")
      )
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (status === "All statuses" ||
        status === (state.progress[t.id]?.status || "Not Started")),
  );
  return (
    <>
      <Heading
        title={projects ? "Projects" : "Topics and lessons"}
        subtitle={
          projects
            ? "Build a portfolio one practical project at a time."
            : "Explore the curriculum and open a lesson to start studying."
        }
      />
      <div className="filters">
        <label className="search-field">
          <Search size={17} />
          <input
            placeholder={projects ? "Search projects" : "Search topics"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="Stage filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All stages</option>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
        <select
          aria-label="Status filter"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {["All statuses", ...statuses].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      <div className="result-count">
        {filtered.length} {projects ? "projects" : "topics"}
      </div>
      <div className="topic-grid">
        {filtered.map((t) => (
          <a
            className="panel topic-card"
            key={t.id}
            href={"#" + (projects ? "projects/" : "lesson/") + t.id}
          >
            <span className={"tile " + (projects ? "peach" : "mint")}>
              {projects ? <FolderKanban /> : <BookOpen />}
            </span>
            <span className="meta">
              <Clock3 size={13} />
              {minutes(t.minutes)}
            </span>
            <h3>{projects ? t.project : t.title}</h3>
            <p>{projects ? t.title : t.concepts.slice(0, 3).join(" · ")}</p>
            <div className="between">
              <small>
                {projects
                  ? (state.projects[t.id]?.checked.length || 0) +
                    " milestones checked"
                  : state.progress[t.id]?.status || "Not Started"}
              </small>
              <ArrowRight size={16} />
            </div>
          </a>
        ))}
      </div>
      {!filtered.length && (
        <p className="empty">
          No matching topics. Try another search or filter.
        </p>
      )}
    </>
  );
}
export function LessonPage({ id }: { id: string }) {
  const { state, reload, notify } = useLab(),
    { data, error } = useDetail(id),
    [invite, setInvite] = useState(false);
  if (!data) return <Loading error={error} />;
  const { topic, lesson: l, guide } = data;
  async function change(status: Status) {
    try {
      await api("/topics/" + id + "/status", "PUT", { status });
      await reload();
      setInvite(status === "Completed" || status === "Mastered");
      notify("Lesson progress saved");
    } catch (e) {
      notify((e as Error).message);
    }
  }
  return (
    <>
      <Heading
        title={topic.title}
        subtitle={guide.outcome}
        side={
          <label className="control-label">
            Lesson status
            <select
              value={state.progress[id]?.status || "Not Started"}
              onChange={(e) => void change(e.target.value as Status)}
            >
              {statuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        }
      />
      {invite && (
        <div className="assessment-invite" role="status">
          <GraduationCap />
          <span className="grow">
            <strong>Ready to check your understanding?</strong>
            <small>
              Take a {topic.title} interview assessment and get a
              concept-by-concept review.
            </small>
          </span>
          <a className="btn primary" href={"#interview/" + id}>
            Take assessment <ArrowRight size={15} />
          </a>
        </div>
      )}
      <div className="lesson-layout">
        <article className="panel lesson">
          <section id="overview">
            <div className="info-strip">
              <span>
                <Clock3 size={14} />
                {topic.minutes} min
              </span>
              <span>
                <BookOpen size={14} />
                Lesson
              </span>
            </div>
            <h2>{guide.title}</h2>
            <p className="lesson-story">{guide.story}</p>
            <h3>Follow the example</h3>
            <ol className="lesson-steps">
              {guide.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
            <h3>Why use this?</h3>
            <p>{l.why}</p>
          </section>
          <section id="language">
            <h2>The words behind the example</h2>
            <dl className="lesson-terms">
              {guide.terms.map(([term, meaning]) => (
                <div key={term}>
                  <dt>{term}</dt>
                  <dd>{meaning}</dd>
                </div>
              ))}
            </dl>
            <h3>{topic.title} in practice</h3>
            <p>{l.definition}</p>
            <p>{l.explanation}</p>
            <h3>How it looks in code</h3>
            <pre>{l.syntax}</pre>
            <p>{l.usage}</p>
            <h3>Small details worth knowing</h3>
            {guide.details.map((d) => (
              <div key={d.question} className="reading-detail">
                <strong>{d.question}</strong>
                <p>
                  {d.answer}
                  {d.explanation && <> · {d.explanation}</>}
                </p>
              </div>
            ))}
          </section>
          <section id="field-example">
            <h2>Work through four cases</h2>
            <p>{guide.experiment.context}</p>
            <p>
              <b>Use this rule.</b> {guide.experiment.rule}
            </p>
            <div className="example-table-wrap">
              <table className="example-table">
                <thead>
                  <tr>
                    <th>Given</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {guide.experiment.rows.map(([input, result]) => (
                    <tr key={input}>
                      <td>{input}</td>
                      <td>{result}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section id="real-decisions">
            <h2>When the situation changes</h2>
            {guide.decisions.map((item, i) => (
              <div className="case-reading" key={i}>
                <h3>{item.situation}</h3>
                <p>
                  {item.action} {item.reason}
                </p>
                <p>
                  <b>How to check it.</b> {item.check}
                </p>
                <p>
                  <b>What to weigh.</b> {item.tradeoff}
                </p>
              </div>
            ))}
          </section>
          <section id="further">
            <h2>Taking the idea further</h2>
            {guide.further.map((x) => (
              <div key={x.level} className="case-reading">
                <small>{x.level}</small>
                <h3>{x.problem}</h3>
                <p>{x.reasoning}</p>
              </div>
            ))}
          </section>
          <section id="examples">
            <h2>Worked examples</h2>
            {l.examples.map((ex, i) => (
              <div className="worked-example" key={i}>
                <h3>{ex.title}</h3>
                <pre>{ex.code}</pre>
                <small>EXPECTED OUTPUT</small>
                <pre className="output">{ex.output}</pre>
                {examplePackage(ex.code) ? (
                  <>
                    <p className="muted">
                      Reference example · Requires a separate Python environment
                      with {examplePackage(ex.code)}.
                    </p>
                    <LinkButton to={"playground/" + id}>
                      Try the offline exercise
                    </LinkButton>
                  </>
                ) : (
                  <LinkButton to={"playground/" + id + "/example-" + i}>
                    Run example
                  </LinkButton>
                )}
              </div>
            ))}
          </section>
          <section id="patterns">
            <h2>Patterns and pitfalls</h2>
            {[
              ["Common mistakes", l.mistakes],
              ["Edge cases", l.edges],
              ["Real-world use cases", l.useCases],
              ["Useful functions and methods", l.methods],
              ["Best practices", l.practices],
            ].map(([label, items]) => (
              <div key={String(label)}>
                <h3>{label}</h3>
                <Bullets items={items as string[]} />
              </div>
            ))}
          </section>
          <section id="apply">
            <h2>Put it into practice</h2>
            <h3>Mini project</h3>
            <p>{l.miniProject}</p>
            <LinkButton to={"projects/" + id}>Open project brief</LinkButton>
            <h3>Coding exercises</h3>
            {data.exercises.map((ex) => (
              <a
                className="compact-link"
                href={"#playground/" + id + "/" + ex.id}
                key={ex.id}
              >
                {ex.title}
                <ArrowRight size={15} />
              </a>
            ))}
            <h3>Interview perspective</h3>
            <p>{l.interview}</p>
            <h3>Background for further study</h3>
            <Bullets items={l.prerequisites} />
            <h3>Explore next</h3>
            <Bullets items={l.next} />
          </section>
          <button className="btn primary" onClick={() => change("Completed")}>
            <Check size={16} />
            Mark lesson completed
          </button>
        </article>
        <aside className="panel lesson-index">
          <PanelTitle title="In this lesson" />
          {[
            ["overview", "Start with a real case"],
            ["language", "Words and small details"],
            ["field-example", "Four worked cases"],
            ["real-decisions", "Changes and decisions"],
            ["further", "Deeper examples"],
            ["examples", "Code examples"],
            ["patterns", "Patterns & pitfalls"],
            ["apply", "Practice & interview"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() =>
                document
                  .getElementById(key)
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              {label}
            </button>
          ))}
          <div className="index-links">
            <LinkButton to={"playground/" + id}>Coding playground</LinkButton>
            <LinkButton to={"interview/" + id}>Topic assessment</LinkButton>
          </div>
          <p className="muted">
            Lesson status is self-reported. Assessments measure your
            demonstrated skills.
          </p>
        </aside>
      </div>
    </>
  );
}
export function ProjectPage({ id }: { id: string }) {
  const { data, error } = useDetail(id),
    { state, reload, notify } = useLab(),
    [saving, setSaving] = useState(false),
    [pending, setPending] = useState<number[] | null>(null);
  if (!data) return <Loading error={error} />;
  const p = data.project,
    checked = pending ?? state.projects[id]?.checked ?? [];
  async function toggle(i: number) {
    const updated = checked.includes(i)
      ? checked.filter((n) => n !== i)
      : [...checked, i];
    setPending(updated);
    setSaving(true);
    try {
      await api("/topics/" + id + "/project", "PUT", { checked: updated });
      await reload();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setPending(null);
      setSaving(false);
    }
  }
  return (
    <>
      <Heading
        title={p.title}
        subtitle={data.topic.title + " · Portfolio project"}
        side={<LinkButton to={"lesson/" + id}>Related lesson</LinkButton>}
      />
      <div className="dashboard-columns">
        <article className="panel lesson">
          <h2>Project brief</h2>
          <p>{p.problem}</p>
          <h3>Requirements</h3>
          <Bullets items={p.requirements} />
          <h3>Prerequisites</h3>
          <Bullets items={p.prerequisites} />
          <h3>Expected behavior</h3>
          <p>{p.expected}</p>
          <h3>Acceptance tests</h3>
          <Bullets items={p.tests} />
          <details>
            <summary>Implementation hints</summary>
            <Bullets items={p.hints} />
          </details>
          <h3>Suggested improvements</h3>
          <Bullets items={p.improvements} />
          <h3>Interview questions</h3>
          <Bullets items={p.interview} />
        </article>
        <section className="panel fit">
          <PanelTitle title="Implementation checklist" />
          <div className="panel-inner">
            <div className="between">
              <strong>
                {checked.length} of {p.milestones.length} complete
              </strong>
            </div>
            <ProgressBar value={(checked.length / p.milestones.length) * 100} />
            {p.milestones.map((m, i) => (
              <label className="check-row" key={m}>
                <input
                  type="checkbox"
                  checked={checked.includes(i)}
                  disabled={saving}
                  onChange={() => toggle(i)}
                />
                {m}
              </label>
            ))}
            <button
              className="btn secondary"
              onClick={() => nav("playground/" + id)}
            >
              <Code2 size={15} />
              Open playground
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
