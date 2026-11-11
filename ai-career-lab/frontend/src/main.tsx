import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  ArrowRight,
  Bell,
  BookOpen,
  CalendarClock,
  ChartNoAxesCombined,
  Check,
  CircleUserRound,
  Clock3,
  Code2,
  Command,
  FlaskConical,
  FolderKanban,
  GraduationCap,
  House,
  LayoutDashboard,
  Map,
  Menu,
  MessageSquareText,
  PanelLeft,
  Search,
  Settings as SettingsIcon,
  Target,
  Terminal,
  X,
} from "lucide-react";
import "@fontsource-variable/dm-sans";
import { Analytics, Gaps, Revision, Settings } from "./Personal";
import { Dashboard, Plan } from "./Dashboard";
import { LessonPage, Library, ProjectPage, Roadmap } from "./Curriculum";
import { Playground } from "./Playground";
import { Interview, Result } from "./Interview";
import { Account, AdminPanel, AuthGate } from "./Accounts";
import { ResumeInterview } from "./ResumeInterview";
import { api, bindAccount, Lab, Loading, minutes, nav, ProgressBar, useRoute } from "./lib";
import type { Stage, State } from "./types";
import "./style.css";

const groups = [
  {
    title: "LEARN",
    links: [
      ["dashboard", "Dashboard", LayoutDashboard],
      ["roadmap", "Learning roadmap", Map],
      ["lessons", "Topics & lessons", BookOpen],
      ["playground", "Coding playground", Code2],
    ],
  },
  {
    title: "PRACTICE",
    links: [
      ["interview", "Interview preparation", MessageSquareText],
      ["resume-interview", "Résumé interviewer", CircleUserRound],
      ["projects", "Projects", FolderKanban],
      ["gaps", "Skill gap analyzer", Target],
    ],
  },
  {
    title: "TRACK",
    links: [
      ["analytics", "Progress & analytics", ChartNoAxesCombined],
      ["revision", "Revision center", CalendarClock],
    ],
  },
] as const;

function Workspace({ account, onLogout }: { account: Account; onLogout: () => Promise<void> }) {
  React.useLayoutEffect(() => {
    bindAccount(account.id);
    return () => bindAccount(undefined);
  }, [account.id]);
  const [route, id, item, focus] = useRoute(),
    page = route || "dashboard";
  const [stages, setStages] = useState<Stage[]>([]),
    [state, setState] = useState<State | null>(null),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [search, setSearch] = useState(false),
    [query, setQuery] = useState(""),
    [menu, setMenu] = useState(false),
    [bell, setBell] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(),
    notify = useCallback((s: string) => {
      setToast(s);
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(""), 4200);
    }, []);
  const reload = useCallback(async () => {
    setState(await api<State>("/state"));
  }, []);
  const boot = () => {
    setError("");
    Promise.all([api<Stage[]>("/catalog"), api<State>("/state")])
      .then(([ss, st]) => {
        setStages(ss);
        setState(st);
      })
      .catch((e) => setError(e.message));
  };
  useEffect(boot, []);
  useEffect(() => {
    document.documentElement.dataset.theme =
      state?.preferences.theme || "light";
  }, [state?.preferences.theme]);
  useEffect(() => {
    setSearch(false);
    setMenu(false);
    setBell(false);
  }, [page, id, item]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearch((v) => !v);
      }
      if (e.key === "Escape") {
        setSearch(false);
        setMenu(false);
        setBell(false);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (
      !["lesson", "playground", "interview", "projects", "result", "resume-interview"].includes(
        page,
      )
    )
      return;
    let last = Date.now(),
      activeAt = Date.now();
    const interact = () => {
      activeAt = Date.now();
    };
    const tick = () => {
      const n = Date.now(),
        seconds = Math.min(30, Math.floor((n - last) / 1000));
      last = n;
      if (
        seconds > 0 &&
        n - activeAt < 120000 &&
        document.visibilityState === "visible"
      )
        void api("/activity", "POST", { seconds }).catch(() => {});
    };
    const interval = setInterval(tick, 15000);
    const visibility = () => {
      last = Date.now();
      activeAt = last;
    };
    window.addEventListener("pointerdown", interact);
    window.addEventListener("keydown", interact);
    window.addEventListener("scroll", interact);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      clearInterval(interval);
      window.removeEventListener("pointerdown", interact);
      window.removeEventListener("keydown", interact);
      window.removeEventListener("scroll", interact);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [page, id]);
  useEffect(() => {
    if (["dashboard", "analytics", "plan"].includes(page))
      reload().catch(() => {});
  }, [page, reload]);
  if (!state || !stages.length)
    return (
      <main className="startup">
        <div className="brand-icon">
          <Code2 />
        </div>
        <h1>AI Career Lab</h1>
        <Loading error={error} />
        {error && (
          <button className="btn primary" onClick={boot}>
            Reconnect to local app
          </button>
        )}
      </main>
    );
  const topics = stages.flatMap((s) => s.modules.flatMap((m) => m.topics)),
    active =
      page === "lesson"
        ? "lessons"
        : page === "plan"
          ? "dashboard"
          : page === "result"
            ? "interview"
            : page,
    name =
      groups.flatMap((g) => [...g.links]).find((l) => l[0] === active)?.[1] ||
      (page === "admin" ? "Pilot access" : "Settings");
  const due = topics.filter(
      (t) =>
        state.progress[t.id]?.due && state.progress[t.id].due! <= state.today,
    ),
    studied = Math.floor((state.activity[state.today]?.seconds || 0) / 60),
    goal = state.preferences.dailyMinutes;
  const hits = topics
    .filter((t) =>
      (t.title + " " + t.concepts.join(" "))
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .slice(0, 10);
  let content;
  switch (page) {
    case "admin":
      content = account.role === "admin" ? <AdminPanel /> : <Loading error="Only the admin can manage pilot access." />;
      break;
    case "resume-interview":
      content = <ResumeInterview />;
      break;
    case "dashboard":
      content = <Dashboard />;
      break;
    case "roadmap":
      content = <Roadmap selected={id} />;
      break;
    case "lessons":
      content = <Library />;
      break;
    case "lesson":
      content = <LessonPage key={id} id={id} />;
      break;
    case "playground":
      content = <Playground topicId={id} item={item} />;
      break;
    case "interview":
      content = (
        <Interview
          key={[id, item, focus].join("/")}
          topicId={id}
          modeParam={item}
          focus={focus}
        />
      );
      break;
    case "result":
      content = <Result id={id} />;
      break;
    case "projects":
      content = id ? <ProjectPage key={id} id={id} /> : <Library projects />;
      break;
    case "gaps":
      content = <Gaps />;
      break;
    case "analytics":
      content = <Analytics />;
      break;
    case "revision":
      content = <Revision />;
      break;
    case "settings":
      content = <Settings />;
      break;
    case "plan":
      content = <Plan />;
      break;
    default:
      content = <Loading error="This page could not be found." />;
  }
  return (
    <Lab.Provider value={{ account, stages, topics, state, reload, notify }}>
      <div className="shell">
        {menu && (
          <button
            aria-label="Close navigation"
            className="scrim"
            onClick={() => setMenu(false)}
          />
        )}
        <aside className={"sidebar " + (menu ? "opened" : "")}>
          <a className="brand" href="#dashboard">
            <span className="brand-icon">
              <Code2 size={22} strokeWidth={2.5} />
            </span>
            <span>AI Career Lab</span>
          </a>
          <nav>
            {groups.map((g) => (
              <div className="nav-group" key={g.title}>
                <small>{g.title}</small>
                {g.links.map(([key, title, Icon]) => (
                  <a
                    key={key}
                    className={active === key ? "selected" : ""}
                    href={"#" + key}
                    aria-current={active === key ? "page" : undefined}
                  >
                    <Icon size={17} />
                    {title}
                  </a>
                ))}
              </div>
            ))}
          </nav>
          <div className="sidebar-bottom">
            {account.role === "admin" && <a className="settings-link" href="#admin"><CircleUserRound size={17} /> Pilot access</a>}
            <a href="#plan" className="daily-goal">
              <div>
                <span>
                  <Clock3 size={15} />
                  Daily goal
                </span>
                <ArrowRight size={13} />
              </div>
              <ProgressBar value={Math.min(100, (studied / goal) * 100)} />
              <small>
                {minutes(studied)} of {minutes(goal)} studied
              </small>
            </a>
            <a
              className={
                "settings-link " + (active === "settings" ? "selected" : "")
              }
              href="#settings"
            >
              <SettingsIcon size={17} />
              Settings
            </a>
            <button className="settings-link sign-out" onClick={() => void onLogout().catch((e) => notify(e.message))}>Sign out</button>
          </div>
        </aside>
        <div className="main-column">
          <div className="topbar">
            <button
              className="mobile-toggle icon-btn"
              aria-label="Open navigation"
              onClick={() => setMenu(true)}
            >
              <Menu size={20} />
            </button>
            <div className="crumb">
              <PanelLeft size={16} />
              <span>Workspace</span>
              <i>/</i>
              <b>{name}</b>
            </div>
            <div className="top-tools">
              <button
                className="search-trigger"
                onClick={() => {
                  setQuery("");
                  setSearch(true);
                }}
              >
                <Search size={15} />
                <span>Search topics...</span>
                <kbd>Ctrl K</kbd>
              </button>
              <div className="bell-wrap">
                <button
                  className="icon-btn"
                  aria-label="Revision notifications"
                  onClick={() => setBell(!bell)}
                >
                  <Bell size={18} />
                  {!!due.length && <i />}
                </button>
                {bell && (
                  <div className="popover">
                    <b>Revision notifications</b>
                    {due.length ? (
                      due.map((t) => (
                        <a key={t.id} href={"#interview/" + t.id + "/Revision"}>
                          {t.title} is due <ArrowRight size={13} />
                        </a>
                      ))
                    ) : (
                      <p>No reviews due today.</p>
                    )}
                  </div>
                )}
              </div>
              <span className="top-divider" />
              <a
                className="avatar"
                aria-label="Profile settings"
                href="#settings"
              >
                {state.preferences.name === "Learner" ? (
                  <GraduationCap size={18} />
                ) : (
                  state.preferences.name.trim().slice(0, 2).toUpperCase()
                )}
              </a>
            </div>
          </div>
          <main className="main-content" key={page === "lesson" ? id : page}>
            {content}
          </main>
        </div>
      </div>
      {search && (
        <div className="modal-back" onClick={() => setSearch(false)}>
          <section
            role="dialog"
            aria-label="Search all topics"
            aria-modal="true"
            className="search-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="search-input">
              <Search size={18} />
              <input
                autoFocus
                placeholder="Search topics or concepts…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && hits[0]) {
                    nav("lesson/" + hits[0].id);
                    setSearch(false);
                  }
                }}
              />
              <button
                aria-label="Close search"
                className="icon-btn"
                onClick={() => setSearch(false)}
              >
                <X size={17} />
              </button>
            </div>
            {hits.map((t) => (
              <a
                key={t.id}
                href={"#lesson/" + t.id}
                onClick={() => setSearch(false)}
              >
                <BookOpen size={16} />
                <span>{t.title}</span>
                <ArrowRight size={14} />
              </a>
            ))}
            {!hits.length && <p className="panel-inner">No matching topics.</p>}
          </section>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
          <button onClick={() => setToast("")} aria-label="Dismiss message">
            <X size={14} />
          </button>
        </div>
      )}
    </Lab.Provider>
  );
}
createRoot(document.getElementById("root")!).render(
  <AuthGate>{(account, onLogout) => <Workspace key={account.id} account={account} onLogout={onLogout} />}</AuthGate>
);
