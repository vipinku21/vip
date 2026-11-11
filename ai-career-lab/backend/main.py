from collections import defaultdict
import os
from pathlib import Path
from contextlib import asynccontextmanager
from datetime import timedelta
from uuid import uuid4
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import delete
from sqlalchemy.orm import Session
from starlette.middleware.trustedhost import TrustedHostMiddleware
from urllib.parse import urlparse
from . import curriculum as content, providers, scoring
from .database import Base, Record, ROOT, engine, get, group, now, put, today
from . import accounts, resume_interview
from .models import Backup, ChangeStatus, Checklist, Preferences, Responses, Start, SubmissionIn, Tick

@asynccontextmanager
async def lifespan(_):
    Base.metadata.create_all(engine)
    accounts.setup_key()
    yield

app = FastAPI(title="AI Career Lab",version="2.0",lifespan=lifespan)
pilot_origin = accounts.public_origin()
allowed_hosts = [*accounts.LOCAL_HOSTS, "[::1]"]
if pilot_origin:
    allowed_hosts.append(urlparse(pilot_origin).hostname)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=allowed_hosts)
protected = APIRouter(dependencies=[Depends(accounts.current_user)])

@app.middleware("http")
async def local_writes(request: Request, call_next):
    origin = request.headers.get("origin")
    if request.method not in ("GET","HEAD","OPTIONS"):
        valid_origin = origin == (pilot_origin or str(request.base_url).rstrip("/"))
        dev_origin = not pilot_origin and origin in {"http://127.0.0.1:5173", "http://localhost:5173"}
        if (origin and not (valid_origin or dev_origin)) or request.headers.get("sec-fetch-site") == "cross-site":
            return JSONResponse({"detail":"Open the pilot directly to change account data."}, status_code=403)
    response = await call_next(request)
    if request.url.path == "/runner.js":
        runtime_url = (pilot_origin or str(request.base_url).rstrip("/")) + "/runtime/"
        response.headers["Content-Security-Policy"] = (
            f"default-src 'none'; script-src {runtime_url} 'unsafe-eval' 'wasm-unsafe-eval'; "
            f"connect-src {runtime_url}; worker-src 'none'"
        )
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "same-origin"
    response.headers["X-Frame-Options"] = "DENY"
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    return response

DB = Depends(accounts.learner_session)
COLLECTIONS = {"progress":"progress","projects":"project","attempts":"attempt","submissions":"submission","activity":"activity","revisions":"revision","sources":"source"}

@app.get("/api/health")
def health():
    return {"status":"ok","app":"AI Career Lab","version":"2.0"}

@protected.get("/api/catalog")
def catalog():
    return content.catalog()

@protected.get("/api/topics/{topic}")
def detail(topic: str):
    return content.lesson_detail(topic)

@protected.get("/api/export",response_model=Backup)
def export(db: Session=DB):
    return {"version":1,"preferences":get(db,"prefs","learner",Preferences().model_dump()),
            **{name:group(db,kind) for name,kind in COLLECTIONS.items()}}

@protected.get("/api/state")
def state(db: Session=DB):
    result = export(db)
    # Full code and detailed cases are requested individually by the playground.
    result["submissions"] = {k:{key:v[key] for key in ("id","topic","exerciseId","date","passed")} | {"total":len(v["cases"])} for k,v in result["submissions"].items()}
    return {**result,"projectTotals":{k:len(content.lesson_detail(k)["project"]["milestones"]) for k in result["projects"]},"today":today().isoformat(),"integrations":providers.configuration()}

@protected.post("/api/import")
def restore(backup: Backup, db: Session=DB):
    data = backup.model_dump(mode="json")
    replace_kinds = [*COLLECTIONS.values(), "session", "prefs", "provider"]
    db.execute(delete(Record).where(Record.owner == db.info["owner_id"], Record.kind.in_(replace_kinds)))
    put(db,"prefs","learner",data["preferences"])
    for name,kind in COLLECTIONS.items():
        for key,value in data[name].items(): put(db,kind,key,value)
    return {"message":"Backup restored"}

@protected.put("/api/preferences")
def preferences(preferences: Preferences, db: Session=DB):
    put(db,"prefs","learner",preferences.model_dump())
    return preferences

@protected.post("/api/activity")
def activity(tick: Tick, db: Session=DB):
    from sqlalchemy import text
    # Acquire the write lock before reading the daily counter.
    db.execute(text("BEGIN IMMEDIATE"))
    key = today().isoformat()
    value = get(db,"activity",key,{"seconds":0})
    put(db,"activity",key,{"seconds":min(86400,value["seconds"]+tick.seconds)})
    return {"saved":True}

@protected.put("/api/topics/{topic}/status")
def status(topic: str, change: ChangeStatus, db: Session=DB):
    content.topic_pair(topic)
    prior = get(db,"progress",topic,{"status":"Not Started"})
    progress = {**prior,"status":change.status}
    if change.status in ("Completed","Mastered") and not prior.get("due"):
        progress = scoring.scheduled(progress)
    if change.status == "Needs Revision": progress.update(step=0,due=today().isoformat())
    if change.status == "Not Started": progress.update(step=0,due=None)
    put(db,"progress",topic,progress)
    return progress

@protected.put("/api/topics/{topic}/project")
def project(topic:str, update:Checklist, db: Session=DB):
    count = len(content.lesson_detail(topic)["project"]["milestones"])
    if any(i>=count for i in update.checked): raise HTTPException(422,"Unknown milestone")
    result = {"checked":sorted(set(update.checked))}
    put(db,"project",topic,result)
    return result

@protected.get("/api/topics/{topic}/exercises/{exercise_id}/inputs")
def inputs(topic:str,exercise_id:str):
    ex = content.exercise(topic,exercise_id)
    return [c["input"] for c in ex["tests"]]

@protected.post("/api/topics/{topic}/submissions")
def submit_code(topic:str, body:SubmissionIn,db:Session=DB):
    ex = content.exercise(topic,body.exerciseId)
    if body.assessmentId:
        active = get(db,"session",body.assessmentId)
        if not active or active["topic"]!=topic or get(db,"attempt",body.assessmentId): raise HTTPException(409,"This assessment is closed")
        if active["deadline"] and now().timestamp()>active["deadline"]: raise HTTPException(409,"Time has expired")
    cases = scoring.grade_cases(ex,[v.model_dump(exclude_unset=True) for v in body.outputs])
    key = uuid4().hex
    result = {"id":key,"topic":topic,"exerciseId":ex["id"],"date":now().isoformat(),"code":body.code,"cases":cases,"passed":sum(c["passed"] for c in cases),"assessmentId":body.assessmentId}
    put(db,"submission",key,result)
    return result

@protected.get("/api/submissions/{key}")
def submission(key:str,db:Session=DB):
    result = get(db,"submission",key)
    if not result: raise HTTPException(404,"Unknown submission")
    return result

@protected.post("/api/topics/{topic}/assessments")
def start(topic:str,body:Start,db:Session=DB):
    qs = content.question_set(topic,body.level)
    if body.focus:
        qs = [q for q in qs if q["concept"]==body.focus]
        if not qs:
            # Historic reviews can link to a concept from another skill level.
            qs = [q for level in content.LEVELS for q in content.question_set(topic,level)
                  if q["concept"]==body.focus]
        if not qs: raise HTTPException(422,"This earlier concept has changed. Choose a fresh topic assessment.")
    if body.mode=="Revision":
        qs = qs[:3]
    elif body.setNumber and not body.focus:
        qs = [q for q in qs if q["setNumber"]==body.setNumber]
        if not qs: raise HTTPException(422,"Unknown question set for this difficulty")
    key = uuid4().hex
    deadline = (now()+timedelta(minutes=2*len(qs))).timestamp() if body.mode=="Timed" else None
    data = {"id":key,"topic":topic,"mode":body.mode,"level":qs[0]["difficulty"],"setNumber":body.setNumber,"deadline":deadline,"questions":qs,"answers":{}}
    put(db,"session",key,data)
    return {**data,"questions":[{k:v for k,v in q.items() if k not in ("answer","rubric","explanation","solution","exampleSolution")} for q in qs]}

@protected.put("/api/assessments/{key}/draft")
def save_draft(key:str,body:Responses,db:Session=DB):
    active = get(db,"session",key)
    if not active or get(db,"attempt",key): raise HTTPException(409,"Assessment closed")
    if not active["deadline"] or now().timestamp()<=active["deadline"]:
        put(db,"session",key,{**active,"answers":body.answers})
    return {"saved":True}

@protected.post("/api/assessments/{key}/finish")
def finish(key:str,body:Responses,db:Session=DB):
    from sqlalchemy import text
    db.execute(text("BEGIN IMMEDIATE"))
    existing = get(db,"attempt",key)
    if existing: return existing
    active = get(db,"session",key)
    if not active: raise HTTPException(404,"Unknown assessment")
    answers = active["answers"] if active["deadline"] and now().timestamp()>active["deadline"] else body.answers
    reviews = []
    concepts = defaultdict(list)
    grades = []
    answered_ids = []
    for q in active["questions"]:
        answer = answers.get(q["id"],"")
        sub = get(db,"submission",answer) if q["type"]=="coding" and answer else None
        if sub and (sub["assessmentId"]!=key or sub["exerciseId"]!=q["exerciseId"]): sub=None
        grade = scoring.grade_question(q,answer,sub)
        if (sub is not None if q["type"]=="coding" else bool(answer.strip())):
            answered_ids.append(q["id"])
        grades.append(grade)
        concepts[q["concept"]].append(grade)
        solution = q.get("answer") or " · ".join(" / ".join(row) for row in q.get("rubric",[])) or q["explanation"]
        if q["type"]=="coding": answer = (str(sub["passed"])+"/"+str(len(sub["cases"]))+" tests passed") if sub else "No submission"
        reviews.append({"text":q["text"],"type":q["type"],"concept":q["concept"],"answer":answer,"solution":str(solution),"explanation":q["explanation"],"percent":round(grade*100)})
    score = round(100*sum(grades)/len(grades))
    result = {"id":key,"topic":active["topic"],"level":active["level"],"mode":active["mode"],"date":now().isoformat(),"score":score,"interpretation":scoring.interpret(score),"reviews":reviews,"answeredIds":answered_ids,
              "concepts":{k:round(100*sum(v)/len(v)) for k,v in concepts.items()}}
    put(db,"attempt",key,result)
    prior = get(db,"progress",active["topic"],{"status":"Learning"})
    updated = scoring.scheduled({**prior,"lastScore":score},score)
    put(db,"progress",active["topic"],updated)
    put(db,"revision",key,{"topic":active["topic"],"score":score,"date":result["date"],"nextDue":updated["due"]})
    db.execute(delete(Record).where(Record.owner == db.info["owner_id"], Record.kind=="session",Record.key==key))
    return result

@protected.post("/api/topics/{topic}/refresh")
def fetch_questions(topic:str,db:Session=DB):
    return providers.refresh(db,content.topic_pair(topic)[0])

@protected.post("/api/attempts/{key}/coach")
def coach(key:str,db:Session=DB):
    result=get(db,"attempt",key)
    if not result: raise HTTPException(404,"Unknown attempt")
    return providers.coach(result)

app.include_router(accounts.router)
app.include_router(protected)
app.include_router(resume_interview.router)

dist = Path(os.getenv("LAB_FRONTEND_DIST", ROOT.parent / "frontend" / "dist"))
if dist.is_dir():
    app.mount("/",StaticFiles(directory=dist,html=True),name="workspace")

