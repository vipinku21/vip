import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  ArrowRight,
  Check,
  Code2,
  Copy,
  KeyRound,
  Link as LinkIcon,
  UserRound,
  Users,
} from "lucide-react";
import { api, Heading, Loading, PanelTitle, useRoute } from "./lib";
import "./accounts.css";

export interface Account {
  id: string;
  email: string;
  role: "admin" | "learner";
}

interface Identity {
  user: Account | null;
  adminSetup: boolean;
  localSetup: boolean;
}

type Mode = "login" | "signup" | "setup";
const identityChannel = "ai-career-lab-identity";

function invitationCode(value = "") {
  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
}

export function AuthGate({
  children,
}: {
  children: (account: Account, onLogout: () => Promise<void>) => ReactNode;
}) {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [page, parameter] = useRoute();
  const accountChanges = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    let live = true;
    api<Identity>("/auth/me")
      .then((result) => {
        if (live) {
          setIdentity(result);
          setError("");
        }
      })
      .catch((err: Error) => {
        if (live) setError(err.message);
      });
    const expired = () =>
      setIdentity((current) => current && { ...current, user: null });
    window.addEventListener("lab-session-expired", expired);
    const channel =
      typeof BroadcastChannel === "undefined"
        ? null
        : new BroadcastChannel(identityChannel);
    accountChanges.current = channel;
    if (channel) channel.onmessage = () => window.location.reload();
    return () => {
      live = false;
      window.removeEventListener("lab-session-expired", expired);
      accountChanges.current = null;
      channel?.close();
    };
  }, [retry]);

  async function logout() {
    await api("/auth/logout", "POST");
    if (page !== "signup") window.location.replace("#login");
    setIdentity((current) => current && { ...current, user: null });
    accountChanges.current?.postMessage("changed");
  }

  if (!identity)
    return (
      <main className="account-loading">
        <Loading error={error} />
        {error && (
          <button
            className="btn secondary"
            onClick={() => {
              setError("");
              setRetry((value) => value + 1);
            }}
          >
            Try again
          </button>
        )}
      </main>
    );

  const usingInvite = page === "signup" && !!parameter;
  if (identity.user && !usingInvite)
    return <>{children(identity.user, logout)}</>;

  const mode: Mode = identity.adminSetup
    ? "setup"
    : page === "signup"
      ? "signup"
      : "login";
  function authenticated(user: Account) {
    if (["login", "signup", "setup", ""].includes(page))
      window.location.replace("#dashboard");
    setIdentity({ user, adminSetup: false, localSetup: false });
    accountChanges.current?.postMessage("changed");
  }

  return (
    <main className="account-shell">
      <div className="account-body">
        <div className="brand account-brand">
          <span className="brand-icon">
            <Code2 size={21} aria-hidden="true" />
          </span>
          AI Career Lab
        </div>
        <section className="account-card">
          {identity.user && usingInvite ? (
            <div className="account-form">
              <h1>Use your invitation</h1>
              <p>
                You’re signed in as <strong>{identity.user.email}</strong>. Sign
                out to register with the invited email address.
              </p>
              {error && (
                <p className="account-error" role="alert">
                  {error}
                </p>
              )}
              <button
                className="btn primary"
                onClick={() =>
                  void logout().catch((err: Error) => setError(err.message))
                }
              >
                Sign out
              </button>
              <a className="text-link" href="#dashboard">
                Return to my workspace <ArrowRight size={15} />
              </a>
            </div>
          ) : (
            <AccountForm
              key={mode + (parameter || "")}
              mode={mode}
              invite={usingInvite ? invitationCode(parameter) : ""}
              localSetup={identity.localSetup}
              authenticated={authenticated}
            />
          )}
        </section>
      </div>
      <div className="account-photo" aria-hidden="true" />
    </main>
  );
}

function AccountForm({
  mode,
  invite,
  localSetup,
  authenticated,
}: {
  mode: Mode;
  invite: string;
  localSetup: boolean;
  authenticated: (user: Account) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const creating = mode !== "login";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const body: Record<string, string> = {
      email: String(form.get("email")).trim(),
      password: String(form.get("password")),
    };
    if (mode === "signup") body.invite = String(form.get("invite")).trim();
    if (mode === "setup")
      body.setupToken = String(form.get("setupToken")).trim();
    setBusy(true);
    setError("");
    try {
      const result = await api<{ user: Account }>(
        "/auth/" + (mode === "signup" ? "register" : mode),
        "POST",
        body,
      );
      authenticated(result.user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="account-form" onSubmit={submit}>
      <header>
        <h1>
          {mode === "setup"
            ? "Set up your admin account"
            : creating
              ? "Join the pilot"
              : "Sign in"}
        </h1>
        <p>
          {mode === "setup"
            ? "This account manages learner invitations and access."
            : creating
              ? "Use the email address and invitation you received from the pilot admin."
              : "Continue your lessons and interview practice."}
        </p>
      </header>
      <label>
        Email address
        <input
          type="email"
          name="email"
          autoComplete="username"
          required
          maxLength={254}
        />
      </label>
      <label>
        Password
        <input
          type="password"
          name="password"
          aria-label="Password"
          autoComplete={creating ? "new-password" : "current-password"}
          minLength={creating ? 12 : undefined}
          maxLength={128}
          required
          aria-describedby={creating ? "account-password-hint" : undefined}
        />
        {creating && (
          <small id="account-password-hint">Use at least 12 characters.</small>
        )}
      </label>
      {mode === "signup" && (
        <label>
          Invitation code
          <input
            name="invite"
            defaultValue={invite}
            required
            autoComplete="off"
            spellCheck={false}
            autoCapitalize="none"
          />
        </label>
      )}
      {mode === "setup" && (
        <label>
          Owner setup key
          <input
            name="setupToken"
            type="password"
            aria-label="Owner setup key"
            required
            autoComplete="off"
            aria-describedby="owner-key-help"
          />
          <small id="owner-key-help">
            {localSetup ? (
              <>
                On the computer running the app, open{" "}
                <code>backend/data/admin-setup.txt</code> and paste the key
                here.
              </>
            ) : (
              <>
                Use the owner key from the hosting service’s{" "}
                <code>LAB_ADMIN_SETUP_TOKEN</code> setting.
              </>
            )}
          </small>
        </label>
      )}
      {error && (
        <p className="account-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn primary" disabled={busy}>
        {busy
          ? "Please wait…"
          : mode === "setup"
            ? "Create admin account"
            : creating
              ? "Create account"
              : "Sign in"}
        <ArrowRight size={16} aria-hidden="true" />
      </button>
      {mode !== "setup" && (
        <div className="account-switch">
          {creating ? "Already have an account?" : "Have an invitation?"}{" "}
          <a href={creating ? "#login" : "#signup"}>
            {creating ? "Sign in" : "Create an account"}
          </a>
        </div>
      )}
    </form>
  );
}

interface Invite {
  id: string;
  email: string;
  expires: string;
}
interface Pilot {
  limit: number;
  users: Account[];
  invites: Invite[];
}

function expiry(date: string) {
  return new Date(date).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function AdminPanel() {
  const [pilot, setPilot] = useState<Pilot | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [invitation, setInvitation] = useState<{
    email: string;
    url: string;
    expires: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [selection, setSelection] = useState<{
    kind: "invites" | "users";
    id: string;
    email: string;
  } | null>(null);
  const confirmation = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (selection) confirmation.current?.showModal();
  }, [selection]);

  async function reload() {
    setPilot(await api<Pilot>("/admin/pilot"));
  }
  useEffect(() => {
    let live = true;
    api<Pilot>("/admin/pilot")
      .then((data) => {
        if (live) setPilot(data);
      })
      .catch((err: Error) => {
        if (live) setError(err.message);
      });
    return () => {
      live = false;
    };
  }, []);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    setCopied(false);
    try {
      const target = email.trim();
      const result = await api<{ code: string; expires: string }>(
        "/admin/invites",
        "POST",
        { email: target },
      );
      const link = new URL(window.location.pathname, window.location.origin);
      link.hash = "signup/" + encodeURIComponent(result.code);
      setInvitation({ email: target, url: link.href, expires: result.expires });
      setEmail("");
      await reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy || !selection) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(
        "/admin/" + selection.kind + "/" + encodeURIComponent(selection.id),
        "DELETE",
      );
      if (invitation?.email.toLowerCase() === selection.email.toLowerCase())
        setInvitation(null);
      setNotice(
        (selection.kind === "invites"
          ? "Invitation revoked for "
          : "Access removed for ") +
          selection.email +
          ".",
      );
      setSelection(null);
      await reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!invitation) return;
    try {
      await navigator.clipboard.writeText(invitation.url);
      setCopied(true);
    } catch {
      setNotice("Select the invitation link and copy it manually.");
    }
  }

  if (!pilot)
    return (
      <>
        <Loading error={error} />
        {error && (
          <button
            className="btn secondary"
            onClick={() =>
              void reload()
                .then(() => setError(""))
                .catch((err: Error) => setError(err.message))
            }
          >
            Try again
          </button>
        )}
      </>
    );
  const learners = pilot.users.filter((user) => user.role === "learner").length;
  const available = Math.max(0, pilot.limit - learners - pilot.invites.length);
  return (
    <>
      <Heading
        title="Pilot access"
        subtitle="Invite learners and manage who can sign in to AI Career Lab."
      />
      <div className="account-admin">
        <section className="panel">
          <PanelTitle icon={Users} title="Learner seats" />
          <div className="account-seats">
            <div>
              <strong>
                {available} of {pilot.limit}
              </strong>
              <small>Seats available</small>
            </div>
            <div>
              <strong>{learners}</strong>
              <small>Active learners</small>
            </div>
            <div>
              <strong>{pilot.invites.length}</strong>
              <small>Pending invitations</small>
            </div>
          </div>
        </section>
        <section className="panel">
          <PanelTitle icon={LinkIcon} title="Invite a learner" />
          <div className="panel-inner account-invite">
            <p>
              Each invitation reserves one seat for its email address. Share the
              link directly with that learner.
            </p>
            <form className="account-invite-form" onSubmit={invite}>
              <label>
                Learner email
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  maxLength={254}
                  autoComplete="off"
                  required
                />
              </label>
              <button
                className="btn primary"
                disabled={busy || available === 0}
              >
                Create invitation
              </button>
            </form>
            {available === 0 && (
              <p className="muted">
                All seats are reserved. Revoke an unused invitation or remove
                learner access to free a seat.
              </p>
            )}
            {invitation && (
              <div className="account-share">
                <strong>Invitation for {invitation.email}</strong>
                <small>
                  Copy this link before leaving this page. It expires{" "}
                  {expiry(invitation.expires)}.
                </small>
                <div>
                  <input
                    readOnly
                    value={invitation.url}
                    aria-label="Invitation link"
                    onFocus={(event) => event.target.select()}
                  />
                  <button
                    className="btn secondary"
                    onClick={() => void copyLink()}
                  >
                    {copied ? <Check size={15} /> : <Copy size={15} />}
                    {copied ? "Copied" : "Copy link"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
        {error && (
          <p className="account-error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="account-notice" role="status">
            {notice}
          </p>
        )}
        <section className="panel">
          <PanelTitle icon={KeyRound} title="Pending invitations" />
          {pilot.invites.length === 0 ? (
            <p className="panel-inner muted">
              There are no pending invitations.
            </p>
          ) : (
            <ul className="account-list">
              {pilot.invites.map((entry) => (
                <li key={entry.id}>
                  <span>
                    <b>{entry.email}</b>
                    <small>Expires {expiry(entry.expires)}</small>
                  </span>
                  <button
                    className="btn secondary small"
                    disabled={busy}
                    onClick={() =>
                      setSelection({
                        kind: "invites",
                        id: entry.id,
                        email: entry.email,
                      })
                    }
                  >
                    Revoke invitation
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="panel">
          <PanelTitle icon={UserRound} title="Active accounts" />
          <ul className="account-list">
            {pilot.users.map((user) => (
              <li key={user.id}>
                <span>
                  <b>{user.email}</b>
                  <small>
                    {user.role === "admin" ? "Administrator" : "Learner"}
                  </small>
                </span>
                {user.role === "learner" && (
                  <button
                    className="btn secondary small"
                    disabled={busy}
                    onClick={() =>
                      setSelection({
                        kind: "users",
                        id: user.id,
                        email: user.email,
                      })
                    }
                  >
                    Remove access
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
        {selection && (
          <dialog
            className="account-confirm"
            ref={confirmation}
            aria-labelledby="access-change-title"
            onCancel={() => setSelection(null)}
          >
            <strong id="access-change-title">
              {selection.kind === "invites"
                ? "Revoke the invitation for "
                : "Remove access for "}
              {selection.email}?
            </strong>
            <p>
              {selection.kind === "invites"
                ? "The learner will need a fresh invitation to join."
                : "This learner will be signed out and their seat will become available."}
            </p>
            <div>
              <button
                className="btn secondary"
                disabled={busy}
                onClick={() => setSelection(null)}
              >
                Cancel
              </button>
              <button
                className="btn primary"
                disabled={busy}
                onClick={() => void remove()}
              >
                {selection.kind === "invites"
                  ? "Confirm revocation"
                  : "Confirm removal"}
              </button>
            </div>
          </dialog>
        )}
      </div>
    </>
  );
}
