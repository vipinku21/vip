"""SQLite storage. Each learner's records belong to their authenticated account."""
import os
from datetime import datetime, timezone, date
from pathlib import Path
from zoneinfo import ZoneInfo
from dotenv import load_dotenv
from sqlalchemy import JSON, String, create_engine, event, select
from sqlalchemy.dialects.sqlite import insert
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT.parent / ".env")
DATA = ROOT / "data"
DATA.mkdir(exist_ok=True)
engine = create_engine(os.getenv("LAB_DATABASE_URL", "sqlite:///" + str(DATA / "career-lab.db")), connect_args={"check_same_thread": False, "timeout": 20})

@event.listens_for(engine, "connect")
def configure(db, _):
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("PRAGMA busy_timeout=20000")

class Base(DeclarativeBase):
    pass

class LegacyRecord(Base):
    """Pre-pilot records are copied to the verified owner on first setup."""
    __tablename__ = "learner_records"
    kind: Mapped[str] = mapped_column(String(24), primary_key=True)
    key: Mapped[str] = mapped_column(String(180), primary_key=True)
    value: Mapped[dict] = mapped_column(JSON, nullable=False)

class Record(Base):
    __tablename__ = "account_records"
    owner: Mapped[str] = mapped_column(String(32), primary_key=True)
    kind: Mapped[str] = mapped_column(String(24), primary_key=True)
    key: Mapped[str] = mapped_column(String(180), primary_key=True)
    value: Mapped[dict] = mapped_column(JSON, nullable=False)

def connection():
    with Session(engine) as db:
        try:
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise

def get(db, kind, key, default=None):
    row = db.get(Record, (db.info["owner_id"], kind, key), populate_existing=True)
    return row.value if row else default

def put(db, kind, key, value):
    stmt = insert(Record).values(owner=db.info["owner_id"], kind=kind, key=key, value=value)
    db.execute(stmt.on_conflict_do_update(index_elements=["owner","kind","key"], set_={"value": stmt.excluded.value}))

def group(db, kind):
    return {r.key: r.value for r in db.scalars(select(Record).where(Record.owner == db.info["owner_id"], Record.kind == kind))}

def now():
    return datetime.now(timezone.utc)

def today() -> date:
    return now().astimezone(ZoneInfo(os.getenv("LAB_TIMEZONE","Asia/Kolkata"))).date()

