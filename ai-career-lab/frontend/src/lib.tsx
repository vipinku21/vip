import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Clock3,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react";
import type { Detail, Stage, State, Topic } from "./types";
import type { Account } from "./Accounts";

let expectedAccount: string | undefined;
let identityGeneration = 0;
export function bindAccount(id: string | undefined) {
  expectedAccount = id;
  identityGeneration++;
}

export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const generation = identityGeneration;
  const response = await fetch("/api" + path, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(expectedAccount && !path.startsWith("/auth/") ? { "X-Lab-Account": expectedAccount } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    if (response.status === 401 && expectedAccount && generation === identityGeneration && !path.startsWith("/auth/")) {
      window.dispatchEvent(new Event("lab-session-expired"));
    }
    let detail;
    try {
      detail = (await response.json()).detail;
    } catch {
      /* non-JSON outage */
    }
    throw new Error(
      typeof detail === "string"
        ? detail
        : response.status === 422
          ? "The data did not pass validation. Check the fields and try again."
          : "Could not reach the local service (" + response.status + ").",
    );
  }
  return response.json();
}
export function nav(path: string) {
  window.location.hash = path;
}
export function useRoute() {
  const [route, setRoute] = useState(location.hash.slice(1).split("/"));
  useEffect(() => {
    const change = () => {
      setRoute(location.hash.slice(1).split("/"));
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  return route;
}
export const Lab = createContext<{
  account: Account;
  stages: Stage[];
  topics: Topic[];
  state: State;
  reload: () => Promise<void>;
  notify: (s: string) => void;
} | null>(null);
export function useLab() {
  const lab = useContext(Lab);
  if (!lab) throw Error("Workspace unavailable");
  return lab;
}
export function useDetail(id: string) {
  const [data, setData] = useState<Detail | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    setData(null);
    setError("");
    api<Detail>("/topics/" + id)
      .then((d) => {
        if (live) setData(d);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [id]);
  return { data, error };
}
export function examplePackage(code: string) {
  return code.match(
    /^(?:from|import)\s+(numpy|pandas|sklearn|sqlite3|pydantic|fastapi)\b/m,
  )?.[1];
}
export const complete = (status?: string) =>
  status === "Completed" || status === "Mastered";
export function nextTopic(topics: Topic[], state: State) {
  return (
    topics.find((t) => !complete(state.progress[t.id]?.status)) || topics[0]
  );
}
export const display = (v: unknown) =>
  typeof v === "string" ? v : (JSON.stringify(v, null, 2) ?? "");
export const minutes = (n: number) =>
  n >= 60
    ? Math.floor(n / 60) + "h" + (n % 60 ? " " + Math.round(n % 60) + "m" : "")
    : Math.round(n) + "m";
export function day(date: string) {
  return new Date(
    date.length === 10 ? date + "T12:00:00" : date,
  ).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
export function offsetDate(iso: string, offset: number) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}
export function streak(state: State) {
  let days = 0;
  let d = state.activity[state.today]?.seconds
    ? state.today
    : offsetDate(state.today, -1);
  while (state.activity[d]?.seconds) {
    days++;
    d = offsetDate(d, -1);
  }
  return days;
}
export function latestAttempts(s: State) {
  return Object.values(s.attempts).sort((a, b) => b.date.localeCompare(a.date));
}
export function Heading({
  title,
  subtitle,
  side,
}: {
  title: string;
  subtitle: string;
  side?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {side}
    </header>
  );
}
export function PanelTitle({
  icon: Icon,
  title,
  children,
}: {
  icon?: typeof BookOpen;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="panel-heading">
      <h2>
        {Icon && <Icon size={19} />} {title}
      </h2>
      {children}
    </div>
  );
}
export function LinkButton({
  to,
  children,
}: {
  to: string;
  children: ReactNode;
}) {
  return (
    <a className="text-link" href={"#" + to}>
      {children}
      <ArrowRight size={15} />
    </a>
  );
}
export function Loading({ error }: { error?: string }) {
  return (
    <div className="empty" role="status">
      {error ? <TriangleAlert /> : <LoaderCircle className="spin" />}
      <p>{error || "Opening your workspace…"}</p>
    </div>
  );
}
export function ProgressBar({ value }: { value: number }) {
  return (
    <div
      className="track"
      role="progressbar"
      aria-label="Progress"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <i style={{ width: value + "%" }} />
    </div>
  );
}
export function TopicRow({ topic }: { topic: Topic }) {
  const { state } = useLab();
  const status = state.progress[topic.id]?.status || "Not Started";
  return (
    <a className="topic-row" href={"#lesson/" + topic.id}>
      <span className={"tile " + (complete(status) ? "mint" : "stone")}>
        {complete(status) ? <Check /> : <BookOpen />}
      </span>
      <span className="grow">
        <strong>{topic.title}</strong>
        <small>{topic.concepts.slice(0, 2).join(" · ")}</small>
      </span>
      <span className="meta">
        <Clock3 size={13} />
        {topic.minutes}m
      </span>
      <span className="tag">{status}</span>
      {state.progress[topic.id]?.lastScore != null && (
        <span
          className={
            "tag " + (state.progress[topic.id].lastScore! < 80 ? "amber" : "")
          }
        >
          {state.progress[topic.id].lastScore}% assessed
        </span>
      )}
      <ChevronRight size={16} />
    </a>
  );
}
export function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="bullets">
      {items.map((s, i) => (
        <li key={i}>{s}</li>
      ))}
    </ul>
  );
}
