from datetime import timedelta
from unittest.mock import Mock
import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from backend import curriculum, providers, scoring
from backend.database import Base, connection, get, put, today
from backend.main import app

@pytest.fixture
def pilot_client(tmp_path, monkeypatch):
    from backend import accounts, main
    monkeypatch.setenv("LAB_ADMIN_SETUP_TOKEN", "owner-key-for-isolated-tests-only-1234")
    accounts._attempts.clear()
    engine = create_engine("sqlite:///"+str(tmp_path/"test.sqlite3"),connect_args={"check_same_thread":False})
    monkeypatch.setattr(main, "engine", engine)
    Base.metadata.create_all(engine)
    def isolated():
        with Session(engine) as db, db.begin():
            yield db
    app.dependency_overrides[connection] = isolated
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    engine.dispose()

@pytest.fixture
def client(pilot_client):
    response = pilot_client.post("/api/auth/setup", json={"email":"owner@example.test","password":"isolated test password",
                                "setupToken":"owner-key-for-isolated-tests-only-1234"})
    assert response.status_code == 200, response.text
    return pilot_client

def test_catalog_complete():
    assert len(curriculum.catalog())==8
    assert len(curriculum.topics())==100
    for key in curriculum.topics():
        d=curriculum.lesson_detail(key)
        assert len(d["lesson"]["examples"])>=2
        assert d["project"]["milestones"] and d["project"]["tests"]
        assert d["exercises"] and "tests" not in d["exercises"][0]
        for level in ("Beginner","Intermediate","Advanced"):
            questions=curriculum.question_set(key,level)
            assert {q["type"] for q in questions}=={"choice","coding","short","output","scenario"}
            assert all(q["difficulty"]==level and q["concept"] for q in questions)

def test_scores_and_output_equality():
    ex={"tests":[{"input":"","expected":True,"label":"boolean"},{"input":1,"expected":{"n":[1]},"label":"numeric"}]}
    result=scoring.grade_cases(ex,[{"actual":1},{"actual":{"n":[1.0]}}])
    assert [c["passed"] for c in result]==[False,True]
    qs=curriculum.question_set("strings","Beginner")
    choice,output,short,scenario,coding=qs[-5:]
    assert scoring.grade_question(choice,choice["answer"])==1
    assert scoring.grade_question(output,"YTH")==0
    assert scoring.grade_question(short,"immutable")==.5
    assert scoring.grade_question(scenario,"strip and casefold")==1
    assert scoring.grade_question(coding,"",None)==0

def test_full_bank_and_coverage_survive_backup(client):
    exam=client.post("/api/topics/predicates/assessments",json={"level":"Beginner","setNumber":0}).json()
    assert len(exam["questions"]) == 40
    responses={q["id"]:"I need more practice" for q in exam["questions"] if q["type"]!="coding"}
    assert client.put("/api/assessments/"+exam["id"]+"/draft",json={"answers":responses}).status_code==200
    result=client.post("/api/assessments/"+exam["id"]+"/finish",json={"answers":responses}).json()
    assert result["score"]==0
    assert set(result["answeredIds"])==set(responses)
    assert len(result["answeredIds"])==39
    backup=client.get("/api/export").json()
    assert client.post("/api/import",json=backup).status_code==200
    assert client.get("/api/state").json()["attempts"][exam["id"]]["answeredIds"]==result["answeredIds"]
    del backup["attempts"][exam["id"]]["answeredIds"]
    assert client.post("/api/import",json=backup).status_code==200
    assert client.get("/api/state").json()["attempts"][exam["id"]]["score"]==0

def test_schedule():
    first=scoring.scheduled({"status":"Completed"})
    assert first["due"]==(today()+timedelta(days=1)).isoformat()
    for step,interval in enumerate((3,7,14,30,30)):
        first=scoring.scheduled({**first,"due":today().isoformat()},95)
        assert first["due"]==(today()+timedelta(days=interval)).isoformat()
    assert scoring.scheduled(first,50)["step"]==0

def test_grading_and_backup(client):
    topic="/api/topics/strings"
    assert client.put(topic+"/status",json={"status":"Completed"}).status_code==200
    assert client.put(topic+"/status",json={"status":"invented"}).status_code==422
    assert client.put(topic+"/project",json={"checked":[0,1]}).status_code==200
    session_data=client.post(topic+"/assessments",json={"level":"Beginner","mode":"Practice","setNumber":8}).json()
    assert all("answer" not in q and "rubric" not in q and "explanation" not in q for q in session_data["questions"])
    qs=curriculum.question_set("strings","Beginner")
    qs=qs[-5:]
    coding=qs[-1]
    ex=curriculum.exercise("strings",coding["exerciseId"])
    sub=client.post(topic+"/submissions",json={"exerciseId":ex["id"],"code":"def solve(value): return value[::-1]","assessmentId":session_data["id"],"outputs":[{"actual":c["expected"]} for c in ex["tests"]]}).json()
    answers={qs[0]["id"]:qs[0]["answer"],qs[1]["id"]:"yth",coding["id"]:sub["id"]}
    url="/api/assessments/"+session_data["id"]+"/finish"
    result=client.post(url,json={"answers":answers}).json()
    assert result["score"]==60 and result["concepts"]["Immutability"]==0
    assert client.post(url,json={"answers":{}}).json()==result
    backup=client.get("/api/export").json()
    assert client.post("/api/import",json=backup).status_code==200
    assert client.get("/api/export").json()==backup
    broken={**backup,"progress":{"missing":{"status":"Learning"}}}
    assert client.post("/api/import",json=broken).status_code==422
    assert client.get("/api/export").json()==backup
    assert client.put("/api/preferences",json={"dailyMinutes":0}).status_code==422
    assert client.get("/api/topics/missing").status_code==404

def test_retrieval_and_cache(client,monkeypatch):
    topic="/api/topics/strings/refresh"
    monkeypatch.setenv("QUESTION_PROVIDER","off")
    assert "off" in client.post(topic).json()["message"]
    monkeypatch.setenv("QUESTION_PROVIDER","stackexchange")
    result={"items":[{"title":"Python string question","question_id":123,"link":"https://stackoverflow.com/questions/123","owner":{"display_name":"Author"},"creation_date":1794000000,"tags":["python","string"],"content_license":"CC BY-SA 4.0"}]}
    getter=Mock(return_value=httpx.Response(200,json=result,request=httpx.Request("GET","https://api.stackexchange.com")))
    monkeypatch.setattr(providers.httpx,"get",getter)
    first=client.post(topic).json()
    second=client.post(topic).json()
    assert len(first["sources"])==1 and second["sources"]==first["sources"]
    assert getter.call_args.kwargs["params"]["q"]=="python string"
    getter.side_effect=httpx.ConnectError("offline")
    assert client.post(topic).json()["sources"]==first["sources"]

def test_timed_deadline_and_unrelated_submission(client):
    session_data=client.post("/api/topics/strings/assessments",json={"mode":"Timed"}).json()
    key=session_data["id"]
    q=curriculum.question_set("strings","Beginner")[0]
    client.put("/api/assessments/"+key+"/draft",json={"answers":{q["id"]:q["answer"]}})
    with _session_for_test() as db:
        db.info["owner_id"] = client.get("/api/auth/me").json()["user"]["id"]
        active=get(db,"session",key)
        put(db,"session",key,{**active,"deadline":1})
    result=client.post("/api/assessments/"+key+"/finish",json={"answers":{}}).json()
    assert result["score"]==20
    assert client.post("/api/topics/strings/submissions",json={"exerciseId":"strings-reverse","code":"","outputs":[],"assessmentId":key}).status_code==409

def _session_for_test():
    from contextlib import contextmanager
    return contextmanager(app.dependency_overrides[connection])()

def test_invitation_isolation_setup_and_removal(pilot_client):
    from backend.accounts import COOKIE
    from backend.database import LegacyRecord
    c = pilot_client
    assert c.get("/api/state").status_code == 401
    assert c.get("/api/topics/predicates").status_code == 401
    with _session_for_test() as db:
        db.add(LegacyRecord(kind="progress",key="strings",value={"status":"Completed"}))
    owner = {"email":"owner@example.test","password":"correct test password","setupToken":"owner-key-for-isolated-tests-only-1234"}
    assert c.post("/api/auth/setup",json={**owner,"setupToken":"wrong"}).status_code == 403
    assert c.post("/api/auth/setup",json=owner).json()["user"]["role"] == "admin"
    assert c.post("/api/auth/setup",json=owner).status_code == 409
    assert c.get("/api/state").json()["progress"]["strings"]["status"] == "Completed"
    session = c.post("/api/topics/strings/assessments",json={}).json()["id"]
    account = {"email":"tester@example.test","password":"unique test password"}
    code = c.post("/api/admin/invites",json={"email":account["email"]}).json()["code"]
    admin_cookie = c.cookies.get(COOKIE)
    c.cookies.clear()
    assert c.post("/api/auth/register",json={**account,"email":"other@example.test","invite":code}).status_code == 403
    member = c.post("/api/auth/register",json={**account,"invite":code}).json()["user"]
    assert member["role"] == "learner"
    assert c.get("/api/admin/pilot").status_code == 403
    assert c.get("/api/state").json()["progress"] == {}
    assert c.post("/api/assessments/"+session+"/finish",json={"answers":{}}).status_code == 404
    assert c.post("/api/import",json=c.get("/api/export").json()).status_code == 200
    assert c.post("/api/auth/register",json={**account,"invite":code}).status_code == 403
    assert c.put("/api/preferences",json={},headers={"origin":"https://unrelated.example"}).status_code == 403
    member_cookie = c.cookies.get(COOKIE)
    c.cookies.clear()
    c.cookies.set(COOKIE, admin_cookie)
    assert c.get("/api/state").json()["progress"]["strings"]["status"] == "Completed"
    assert c.delete("/api/admin/users/"+member["id"]).status_code == 200
    c.cookies.clear()
    c.cookies.set(COOKIE, member_cookie)
    assert c.get("/api/state").status_code == 401
    assert c.post("/api/auth/login",json=account).status_code == 401

def test_pilot_reserves_limits_and_releases_a_seat(client,monkeypatch):
    monkeypatch.setenv("LAB_PILOT_LIMIT","10")
    for n in range(10):
        assert client.post("/api/admin/invites",json={"email":f"learner{n}@example.test"}).status_code == 200
    next_email = {"email":"next@example.test"}
    assert client.post("/api/admin/invites",json=next_email).status_code == 409
    pilot = client.get("/api/admin/pilot").json()
    assert pilot["limit"] == 10 and len(pilot["invites"]) == 10
    assert client.delete("/api/admin/invites/"+pilot["invites"][0]["id"]).status_code == 200
    assert client.post("/api/admin/invites",json=next_email).status_code == 200

