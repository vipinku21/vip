from unittest.mock import Mock

import pytest
from fastapi import FastAPI, Header
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from backend import resume_interview as interview
from backend.accounts import learner_session
from backend.database import Base


@pytest.fixture
def client(tmp_path):
    engine = create_engine("sqlite:///" + str(tmp_path / "interviews.db"),
                           connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    application = FastAPI()
    application.include_router(interview.router)

    def account(x_learner: str = Header(default="one")):
        with Session(engine) as db:
            db.info["owner_id"] = x_learner
            yield db
            db.commit()

    application.dependency_overrides[learner_session] = account
    with TestClient(application) as test_client:
        yield test_client
    engine.dispose()


CV = "Ada Smith\nada@example.org\nBuilt a parcel classifier to identify damaged packages.\nTested parcel predictions with depot inspectors."
ROLE = "Data analyst"


def position(record):
    return {"id": record["id"], "revision": record["revision"]}


def test_guided_interview_is_resumable_private_and_answer_dependent(client, monkeypatch):
    network = Mock(side_effect=AssertionError("Guided interviews must stay on this service"))
    monkeypatch.setattr(interview.httpx, "post", network)
    latest = client.post("/api/resume", json={"resume": CV, "role": ROLE}).json()
    assert "parcel classifier" in latest["turns"][0]["question"]
    assert "example.org" not in str(latest)
    first_position = position(latest)
    assert client.get("/api/resume", headers={"x-learner": "two"}).json()["interview"] is None
    answers = ["I reduced missed cases by 20%.", "I compared the same parcels before and after.",
               "The inspectors found crushed boxes in storage.", "I built a second check for new depots.",
               "I would check both datasets.", "I would measure the change against the baseline."]
    for i, answer in enumerate(answers):
        response = client.post("/api/resume/answer", json={**position(latest), "answer": answer})
        assert response.status_code == 200, response.text
        latest = response.json()
        if i == 0:
            assert "20%" in latest["turns"][-1]["question"]
            stale = client.post("/api/resume/answer", json={**first_position, "answer": "Duplicate"})
            assert stale.status_code == 409
        if i == 3:
            assert "two teams use your analysis" in latest["turns"][-1]["question"]
        assert client.get("/api/resume").json()["interview"] == latest
    assert latest["finished"] and len(latest["turns"]) == 6
    assert all(item["turn"] and item["practice"] for item in latest["review"])
    assert client.request("DELETE", "/api/resume", json=position(latest), headers={"x-learner": "two"}).status_code == 409
    assert client.request("DELETE", "/api/resume", json=position(latest)).status_code == 200
    assert client.get("/api/resume").json()["interview"] is None
    network.assert_not_called()


def test_optional_model_sends_only_selected_material_and_recovers(client, monkeypatch):
    monkeypatch.setenv("AI_BASE_URL", "https://example.test/v1")
    monkeypatch.setenv("AI_MODEL", "mock")
    response = Mock()
    response.json.return_value = {"choices": [{"message": {"content": "Which mistakes did your parcel classifier miss?"}}]}
    post = Mock(return_value=response)
    monkeypatch.setattr(interview.httpx, "post", post)
    latest = client.post("/api/resume", json={"resume": CV, "role": ROLE, "useModel": True}).json()
    assert latest["turns"][0]["source"] == "model"
    history = post.call_args.kwargs["json"]["messages"][-1]["content"]
    assert "parcel classifier" in history and "ada@example.org" not in history
    post.side_effect = interview.httpx.ConnectError("Temporary network failure")
    latest = client.post("/api/resume/answer", json={**position(latest), "answer": "I reduced false alerts by 5%."}).json()
    assert latest["turns"][-1]["source"] == "fallback" and "5%" in latest["turns"][-1]["question"]
    latest = client.post("/api/resume/finish", json=position(latest)).json()
    assert latest["finished"] and latest["review"]
