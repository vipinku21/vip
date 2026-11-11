"""Owner bootstrap, email-bound pilot invitations and account-scoped sessions."""
import hashlib
import hmac
import os
import re
import secrets
import time
from collections import deque
from threading import BoundedSemaphore, Lock
from typing import Annotated
from urllib.parse import urlsplit
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import Boolean, Integer, String, delete, func, insert, literal, select, text
from sqlalchemy.orm import Mapped, Session, mapped_column

from .database import Base, DATA, LegacyRecord, Record, connection

router = APIRouter(prefix="/api")
COOKIE = "career_pilot_session"
DAY = 86400
LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1", "testserver"}
Email = Annotated[str, Field(max_length=254)]
NewPassword = Annotated[str, Field(min_length=12, max_length=128)]
DB = Depends(connection, scope="function")
_hash_slots = BoundedSemaphore(1)


class Account(Base):
    __tablename__ = "accounts"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    password_hash: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(12))
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class LoginSession(Base):
    __tablename__ = "login_sessions"
    digest: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(32), index=True)
    expires: Mapped[int] = mapped_column(Integer)


class Invitation(Base):
    __tablename__ = "pilot_invitations"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    digest: Mapped[str] = mapped_column(String(64), unique=True)
    expires: Mapped[int] = mapped_column(Integer)


class EmailForm(BaseModel):
    email: Email

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value):
        email = value.strip().casefold()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
            raise ValueError("Enter a valid email address")
        return email


class Login(EmailForm):
    password: str = Field(min_length=1, max_length=128)


class Setup(EmailForm):
    password: NewPassword
    setupToken: str = Field(min_length=1, max_length=256)


class Signup(EmailForm):
    password: NewPassword
    invite: str = Field(min_length=1, max_length=256)


def public_origin():
    value = os.getenv("LAB_PUBLIC_ORIGIN", "").strip().rstrip("/")
    if not value and os.getenv("RENDER_EXTERNAL_HOSTNAME"):
        value = "https://" + os.environ["RENDER_EXTERNAL_HOSTNAME"]
    if value:
        parsed = urlsplit(value)
        if parsed.scheme != "https" or not parsed.hostname or parsed.netloc != parsed.hostname or parsed.path or parsed.query or parsed.fragment:
            raise RuntimeError("LAB_PUBLIC_ORIGIN must contain only an HTTPS origin.")
    return value


def cap():
    return max(10, min(20, int(os.getenv("LAB_PILOT_LIMIT", "20"))))


def setup_key():
    configured = os.getenv("LAB_ADMIN_SETUP_TOKEN")
    if configured:
        if len(configured) < 32:
            raise RuntimeError("Set LAB_ADMIN_SETUP_TOKEN to at least 32 characters.")
        return configured
    if public_origin():
        raise RuntimeError("Set LAB_ADMIN_SETUP_TOKEN before hosting the pilot.")
    path = DATA / "admin-setup.txt"
    if not path.exists():
        try:
            with os.fdopen(os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600), "w", encoding="utf-8") as stream:
                stream.write(secrets.token_urlsafe(32))
        except FileExistsError:
            pass
    return path.read_text(encoding="utf-8").strip()


def digest(token):
    return hashlib.sha256(token.encode()).hexdigest()


def password_digest(password, salt):
    with _hash_slots:
        return hashlib.scrypt(password.encode(), salt=salt, n=32768, r=8, p=1, maxmem=64 * 1024 * 1024).hex()


def hash_password(password):
    salt = secrets.token_bytes(16)
    return salt.hex() + ":" + password_digest(password, salt)


def valid_password(password, encoded):
    salt, expected = encoded.split(":")
    return hmac.compare_digest(password_digest(password, bytes.fromhex(salt)), expected)


def public_user(user):
    return {"id": user.id, "email": user.email, "role": user.role}


def owner(db):
    return db.scalar(select(Account).where(Account.role == "admin"))


def signed_in(request, db):
    token = request.cookies.get(COOKIE)
    if not token or len(token) > 128:
        return None
    return db.scalar(select(Account).join(LoginSession, LoginSession.user_id == Account.id).where(
        LoginSession.digest == digest(token), LoginSession.expires > time.time(), Account.active.is_(True)))


def current_user(request: Request, db: Session = DB):
    user = signed_in(request, db)
    if user is None:
        raise HTTPException(401, "Please sign in to your account.")
    if request.headers.get("x-lab-account", user.id) != user.id:
        raise HTTPException(401, "The signed-in account changed. Reopen your workspace.")
    return user


def learner_session(user: Account = Depends(current_user), db: Session = DB):
    db.info["owner_id"] = user.id
    return db


def admin(user: Account = Depends(current_user)):
    if user.role != "admin":
        raise HTTPException(403, "Only the pilot admin can manage access.")
    return user


# Keep password hashing and failed bootstrap attempts bounded on a small, single-worker pilot.
_attempts = {}
_attempt_lock = Lock()


def check_rate(request, email):
    stamp = time.monotonic()
    address = request.client.host if request.client else "unknown"
    with _attempt_lock:
        for key in ("ip:" + address, "email:" + email):
            if len(_attempts) >= 2048:
                for old in [k for k,q in _attempts.items() if not q or q[-1] < stamp - 600]:
                    del _attempts[old]
            if key not in _attempts and len(_attempts) >= 2048:
                raise HTTPException(429, "Too many sign-in attempts. Try again later.")
            queue = _attempts.setdefault(key, deque())
            while queue and queue[0] < stamp - 600:
                queue.popleft()
            threshold = 60 if key.startswith("ip:") else 12
            if len(queue) >= threshold:
                raise HTTPException(429, "Too many sign-in attempts. Try again in ten minutes.")
            queue.append(stamp)


def open_session(db, user, response, request):
    token = secrets.token_urlsafe(32)
    previous = request.cookies.get(COOKIE, "")
    db.execute(delete(LoginSession).where((LoginSession.expires <= time.time()) | (LoginSession.digest == digest(previous))))
    db.add(LoginSession(digest=digest(token), user_id=user.id, expires=int(time.time()) + 7 * DAY))
    response.set_cookie(COOKIE, token, max_age=7*DAY, httponly=True, secure=bool(public_origin()), samesite="lax", path="/")
    return {"user": public_user(user)}


@router.get("/auth/me")
def identity(request: Request, db: Session = DB):
    user = signed_in(request, db)
    return {"user": public_user(user) if user else None, "adminSetup": owner(db) is None,
            "localSetup": not public_origin() and not os.getenv("LAB_ADMIN_SETUP_TOKEN")}


@router.post("/auth/setup")
def setup(form: Setup, request: Request, response: Response, db: Session = DB):
    check_rate(request, form.email)
    db.execute(text("BEGIN IMMEDIATE"))
    if owner(db):
        raise HTTPException(409, "The admin account has already been set up.")
    key = setup_key()
    if not key or not hmac.compare_digest(digest(key), digest(form.setupToken.strip())):
        raise HTTPException(403, "The owner setup key did not match.")
    user = Account(id=uuid4().hex, email=form.email, password_hash=hash_password(form.password), role="admin", active=True)
    db.add(user)
    db.flush()
    db.execute(insert(Record).from_select(["owner","kind","key","value"],
               select(literal(user.id), LegacyRecord.kind, LegacyRecord.key, LegacyRecord.value)))
    return open_session(db, user, response, request)


@router.post("/auth/login")
def login(form: Login, request: Request, response: Response, db: Session = DB):
    check_rate(request, form.email)
    user = db.scalar(select(Account).where(Account.email == form.email))
    encoded = user.password_hash if user else "00"*16 + ":" + "00"*64
    if not valid_password(form.password, encoded) or not user or not user.active:
        raise HTTPException(401, "The email or password did not match an active account.")
    return open_session(db, user, response, request)


@router.post("/auth/logout")
def logout(request: Request, response: Response, db: Session = DB):
    db.execute(delete(LoginSession).where(LoginSession.digest == digest(request.cookies.get(COOKIE, ""))))
    response.delete_cookie(COOKIE, path="/", httponly=True, samesite="lax", secure=bool(public_origin()))
    return {"signedOut": True}


def active_learners(db):
    return db.scalar(select(func.count()).select_from(Account).where(Account.active.is_(True), Account.role == "learner"))


@router.post("/auth/register")
def register(form: Signup, request: Request, response: Response, db: Session = DB):
    check_rate(request, form.email)
    db.execute(text("BEGIN IMMEDIATE"))
    invitation = db.scalar(select(Invitation).where(Invitation.email == form.email, Invitation.digest == digest(form.invite.strip()),
                           Invitation.expires > time.time()))
    if not invitation:
        raise HTTPException(403, "Use an unexpired invitation issued to this email.")
    if active_learners(db) >= cap():
        raise HTTPException(409, "All pilot places are taken.")
    user = db.scalar(select(Account).where(Account.email == form.email))
    if user and user.active:
        raise HTTPException(409, "This account is already active.")
    if user is None:
        user = Account(id=uuid4().hex, email=form.email, role="learner")
        db.add(user)
    user.active = True
    user.password_hash = hash_password(form.password)
    db.delete(invitation)
    return open_session(db, user, response, request)


def expiry_string(stamp):
    from datetime import datetime, timezone
    return datetime.fromtimestamp(stamp, timezone.utc).isoformat()


@router.get("/admin/pilot", dependencies=[Depends(admin)])
def pilot(db: Session = DB):
    users = db.scalars(select(Account).where(Account.active.is_(True)).order_by(Account.email))
    invites = db.scalars(select(Invitation).where(Invitation.expires > time.time()).order_by(Invitation.email))
    return {"limit": cap(), "users": [public_user(user) for user in users],
            "invites": [{"id": i.id, "email": i.email, "expires": expiry_string(i.expires)} for i in invites]}


@router.post("/admin/invites", dependencies=[Depends(admin)])
def invite(form: EmailForm, db: Session = DB):
    db.execute(text("BEGIN IMMEDIATE"))
    db.execute(delete(Invitation).where(Invitation.expires <= time.time()))
    if db.scalar(select(Account.id).where(Account.email == form.email, Account.active.is_(True))):
        raise HTTPException(409, "This email already has pilot access.")
    if db.scalar(select(Invitation.id).where(Invitation.email == form.email)):
        raise HTTPException(409, "An invitation already exists for this email. Revoke it to issue a new link.")
    reserved = db.scalar(select(func.count()).select_from(Invitation))
    if active_learners(db) + reserved >= cap():
        raise HTTPException(409, "All pilot places are reserved.")
    code = secrets.token_urlsafe(32)
    expires = int(time.time()) + 7 * DAY
    db.add(Invitation(id=uuid4().hex, email=form.email, digest=digest(code), expires=expires))
    return {"code": code, "expires": expiry_string(expires)}


@router.delete("/admin/invites/{key}", dependencies=[Depends(admin)])
def revoke_invite(key: str, db: Session = DB):
    db.execute(delete(Invitation).where(Invitation.id == key))
    return {"revoked": True}


@router.delete("/admin/users/{key}", dependencies=[Depends(admin)])
def remove_access(key: str, db: Session = DB):
    db.execute(text("BEGIN IMMEDIATE"))
    user = db.get(Account, key)
    if not user or user.role != "learner":
        raise HTTPException(400, "Choose a tester account.")
    user.active = False
    db.execute(delete(LoginSession).where(LoginSession.user_id == key))
    return {"revoked": True}

