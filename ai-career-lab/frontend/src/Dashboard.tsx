import {
  ArrowRight,
  BookOpen,
  Braces,
  CalendarDays,
  ChartNoAxesCombined,
  Check,
  CircleCheck,
  Clock3,
  Code2,
  Database,
  Flame,
  Flag,
  Gauge,
  GitBranch,
  GraduationCap,
  Layers3,
  ListChecks,
  Map,
  MessageSquareText,
  Milestone,
  Play,
  RotateCcw,
  Target,
  Timer,
} from "lucide-react";
import {
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
  streak,
  useLab,
} from "./lib";

export const stageIcons = [
  Braces,
  Database,
  ChartNoAxesCombined,
  GitBranch,
  Gauge,
  Layers3,
  Milestone,
  GraduationCap,
];
export function Dashboard() {
  const { stages, topics, state } = useLab(),
    next = nextTopic(topics, state);
  const index = stages.findIndex((s) =>
      s.modules.some((m) => m.topics.some((t) => t.id === next.id)),
    ),
    stage = stages[index];
  const done = topics.filter((t) =>
    complete(state.progress[t.id]?.status),
  ).length;
  const pct = Math.round((done / topics.length) * 100),
    attempts = latestAttempts(state);
  const due = Object.entries(state.progress).filter(
    ([, p]) => p.due && p.due <= state.today,
  );
  const totalMinutes = Math.floor(
    Object.values(state.activity).reduce((n, x) => n + x.seconds, 0) / 60,
  );
  const learned = stage.modules.flatMap((m) => m.topics);
  const steps = [
    {
      title: "Study " + next.title,
      part: "Theory & examples",
      icon: BookOpen,
      to: "lesson/" + next.id,
      pct: 0.3,
      color: "mint",
    },
    {
      title: "Practice in the playground",
      part: "Coding exercise",
      icon: Code2,
      to: "playground/" + next.id,
      pct: 0.3,
      color: "lavender",
    },
    {
      title: next.project,
      part: "Hands-on project",
      icon: Flag,
      to: "projects/" + next.id,
      pct: 0.25,
      color: "peach",
    },
    {
      title: "Check your understanding",
      part: "Interview & feedback",
      icon: MessageSquareText,
      to: "interview/" + next.id,
      pct: 0.15,
      color: "blue",
    },
  ];
  const goal = state.preferences.dailyMinutes;
  return (
    <>
      <Heading
        title="Learning dashboard"
        subtitle="Your personal workspace for becoming an AI Application Engineer."
        side={
          <div className="date-pill">
            <CalendarDays size={15} />
            {new Date(state.today + "T12:00:00").toLocaleDateString("en-GB", {
              weekday: "short",
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </div>
        }
      />
      {due.length > 0 && (
        <a className="notice" href="#revision">
          <RotateCcw size={16} />
          {due.length} {due.length === 1 ? "topic is" : "topics are"} due for
          revision <ArrowRight size={15} />
        </a>
      )}
      <section className="hero">
        <div className="hero-art">
          <img
            src="/workstation.webp"
            alt="Sage-green desktop computer, keyboard and programming books"
          />
        </div>
        <div className="hero-copy">
          <div className="stage-label">
            <span className="live-dot" />
            CURRENT LEARNING STAGE
          </div>
          <h2>{stage.title}</h2>
          <p>
            {index === 0
              ? "Build a solid foundation in Python, problem-solving, and writing your first programs."
              : stage.description}
          </p>
          <div className="hero-meta">
            <span>
              <Layers3 size={14} />
              Stage {String(index + 1).padStart(2, "0")} of 08
            </span>
            <i />
            <span>
              <BookOpen size={14} />
              {learned.length} topics
            </span>
          </div>
          <a className="btn primary" href={"#lesson/" + next.id}>
            {done || Object.keys(state.progress).length
              ? "Continue learning"
              : "Start learning"}
            <ArrowRight size={16} />
          </a>
        </div>
      </section>
      <div className="stat-grid">
        <Stat
          title="Course progress"
          value={pct + "%"}
          desc={done + " of " + topics.length + " topics completed"}
          icon={ChartNoAxesCombined}
          color="mint"
        />
        <Stat
          title="Study streak"
          value={String(streak(state))}
          unit={streak(state) === 1 ? "day" : "days"}
          desc="Consecutive study days"
          icon={Flame}
          color="peach"
        />
        <Stat
          title="Learning time"
          value={String(Math.floor(totalMinutes / 60))}
          unit={"h " + (totalMinutes % 60) + "m"}
          desc="Total active study time"
          icon={Clock3}
          color="blue"
        />
        <Stat
          title="Interview average"
          value={
            attempts.length
              ? String(
                  Math.round(
                    attempts.reduce((n, a) => n + a.score, 0) / attempts.length,
                  ),
                )
              : "—"
          }
          unit={attempts.length ? "/ 100" : ""}
          desc={
            attempts.length
              ? attempts.length + " assessments taken"
              : "Take your first assessment"
          }
          icon={Target}
          color="lavender"
        />
      </div>
      <div className="dashboard-columns">
        <section className="panel">
          <PanelTitle icon={ListChecks} title="Today's study plan">
            <span className="subtle-pill">
              <Clock3 size={13} />
              {minutes(goal)} goal
            </span>
          </PanelTitle>
          <div className="plan-list">
            {steps.map((x, i) => (
              <a className="plan-row" key={x.part} href={"#" + x.to}>
                <span className={"tile " + x.color}>
                  <x.icon />
                </span>
                <div className="grow">
                  <strong>{x.title}</strong>
                  <small>{x.part}</small>
                </div>
                <span className="meta">
                  {i === 3
                    ? goal -
                      steps
                        .slice(0, 3)
                        .reduce((n, y) => n + Math.round(goal * y.pct), 0)
                    : Math.round(goal * x.pct)}{" "}
                  min
                </span>
              </a>
            ))}
          </div>
          <div className="panel-foot">
            <span>
              <Timer size={14} />
              {minutes(
                Math.floor((state.activity[state.today]?.seconds || 0) / 60),
              )}{" "}
              studied today
            </span>
            <LinkButton to="plan">Weekly plan</LinkButton>
          </div>
        </section>
        <section className="panel">
          <PanelTitle icon={Map} title="Learning roadmap">
            <LinkButton to="roadmap">View all</LinkButton>
          </PanelTitle>
          <div className="stage-list">
            {stages
              .slice(
                Math.max(0, Math.min(index - 1, 4)),
                Math.max(0, Math.min(index - 1, 4)) + 4,
              )
              .map((s) => {
                const j = stages.indexOf(s),
                  current = index === j,
                  finished = s.modules
                    .flatMap((m) => m.topics)
                    .every((t) => complete(state.progress[t.id]?.status));
                return (
                  <a
                    className={"stage-row " + (current ? "current" : "")}
                    key={s.id}
                    href={"#roadmap/" + s.id}
                  >
                    <span className="step-num">
                      {finished ? (
                        <Check size={14} />
                      ) : (
                        String(j + 1).padStart(2, "0")
                      )}
                    </span>
                    <div>
                      <small>STAGE {String(j + 1).padStart(2, "0")}</small>
                      <strong>{s.title}</strong>
                    </div>
                    {current && <span className="on-track">Current</span>}
                  </a>
                );
              })}
          </div>
        </section>
      </div>
      <div className="dashboard-columns">
        <section className="panel">
          <PanelTitle icon={ChartNoAxesCombined} title="Assessment trend">
            <LinkButton to="analytics">History</LinkButton>
          </PanelTitle>
          <div className="panel-inner">
            {attempts.length ? (
              <div className="bars">
                {attempts
                  .slice(0, 7)
                  .reverse()
                  .map((a) => (
                    <a className="bar-col" key={a.id} href={"#result/" + a.id}>
                      <div className="bar-space">
                        <div style={{ height: a.score * 0.85 + "%" }}>
                          <span>{a.score}</span>
                        </div>
                      </div>
                      <small>{day(a.date)}</small>
                    </a>
                  ))}
              </div>
            ) : (
              <p className="muted">
                Your first assessment starts your score history.
              </p>
            )}
            <LinkButton to="interview">Open interview practice</LinkButton>
          </div>
        </section>
        <section className="panel">
          <PanelTitle icon={Flag} title="Projects and skills" />
          <div className="panel-inner">
            <p>
              {
                Object.entries(state.projects).filter(
                  ([k, p]) => p.checked.length === state.projectTotals?.[k],
                ).length
              }{" "}
              completed projects · {Object.keys(state.projects).length} started
            </p>
            <p>
              {
                Object.values(state.progress).filter(
                  (p) => (p.lastScore ?? 0) >= 80,
                ).length
              }{" "}
              topics scored at least 80% in the latest assessment.
            </p>
            <LinkButton to="projects">Open portfolio projects</LinkButton>
          </div>
        </section>
      </div>
      <div className="dashboard-columns">
        <section className="panel">
          <PanelTitle icon={CircleCheck} title="Learning progress">
            <LinkButton to="analytics">Analytics</LinkButton>
          </PanelTitle>
          <div className="panel-inner">
            <div className="between">
              <strong>Roadmap completion</strong>
              <strong>{pct}%</strong>
            </div>
            <ProgressBar value={pct} />
            <p className="muted">
              {done} completed ·{" "}
              {
                Object.values(state.progress).filter(
                  (p) => p.status === "Mastered",
                ).length
              }{" "}
              self-marked mastered ·{" "}
              {
                Object.values(state.progress).filter(
                  (p) =>
                    p.status === "Needs Revision" || (p.lastScore ?? 100) < 80,
                ).length
              }{" "}
              to revise
            </p>
            <LinkButton to="gaps">Review assessed skills</LinkButton>
          </div>
        </section>
        <section className="panel">
          <PanelTitle icon={RotateCcw} title="Upcoming revision" />
          <div className="panel-inner">
            {Object.entries(state.progress)
              .filter(([, p]) => p.due)
              .sort((a, b) => a[1].due!.localeCompare(b[1].due!))
              .slice(0, 3)
              .map(([id, p]) => (
                <a
                  className="compact-link"
                  key={id}
                  href={"#interview/" + id + "/Revision"}
                >
                  {topics.find((t) => t.id === id)?.title}
                  <span>{day(p.due!)}</span>
                </a>
              ))}
            {!Object.values(state.progress).some((p) => p.due) && (
              <p className="muted">
                Complete a lesson to schedule your first review.
              </p>
            )}
            <LinkButton to="revision">Revision center</LinkButton>
          </div>
        </section>
      </div>
    </>
  );
}
export function Stat({
  title,
  value,
  unit,
  desc,
  icon: Icon,
  color,
}: {
  title: string;
  value: string;
  unit?: string;
  desc: string;
  icon: typeof BookOpen;
  color: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-title">
        <span className={"stat-icon " + color}>
          <Icon size={16} />
        </span>
        {title}
      </div>
      <div className="stat-value">
        {value}
        <em>{unit}</em>
      </div>
      <small>{desc}</small>
    </div>
  );
}
export function Plan() {
  const { topics, state } = useLab(),
    first = nextTopic(topics, state),
    goal = state.preferences.dailyMinutes;
  const remaining = topics
    .slice(topics.indexOf(first))
    .filter((t) => !complete(state.progress[t.id]?.status));
  let idx = 0,
    spent = 0;
  return (
    <>
      <Heading
        title="Weekly study plan"
        subtitle={
          "A seven-day plan based on your " +
          minutes(goal) +
          " daily study goal."
        }
      />
      <div className="panel panel-inner">
        <p>
          Work through each topic in order. Read the theory and examples, write
          code, try the project, then use interview feedback to revise.
        </p>
      </div>
      <div className="stack">
        {Array.from({ length: 7 }, (_, i) => {
          let budget = goal;
          const names: string[] = [];
          while (budget > 0 && idx < remaining.length) {
            const t = remaining[idx];
            const cost = Math.max(30, t.minutes),
              n = Math.min(budget, cost - spent);
            names.push(t.title + " · " + n + " min");
            budget -= n;
            spent += n;
            if (spent >= cost) {
              idx++;
              spent = 0;
            }
          }
          return (
            <div className="panel panel-inner" key={i}>
              <div className="between">
                <h3>{i === 0 ? "Today" : day(offsetDate(state.today, i))}</h3>
                <span className="meta">{minutes(goal)}</span>
              </div>
              <p>
                {names.join(" / ") ||
                  "Practice earlier projects and review due topics."}
              </p>
              {i === 0 && (
                <LinkButton to={"lesson/" + first.id}>
                  Open next lesson
                </LinkButton>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
