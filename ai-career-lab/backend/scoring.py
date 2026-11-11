"""Deterministic grading. All answer keys and expected test values stay here."""
import json
import re
from datetime import timedelta
from .database import today

INTERVALS = (1, 3, 7, 14, 30)

def equivalent(a, b):
    if isinstance(a, bool) or isinstance(b, bool):
        return type(a) is type(b) and a == b
    if isinstance(a, (int,float)) and isinstance(b, (int,float)):
        return a == b
    if isinstance(a, list) and isinstance(b, list):
        return len(a) == len(b) and all(equivalent(x,y) for x,y in zip(a,b))
    if isinstance(a, dict) and isinstance(b, dict):
        return a.keys() == b.keys() and all(equivalent(a[k],b[k]) for k in a)
    return type(a) is type(b) and a == b

def grade_cases(ex, outputs):
    result = []
    for i, case in enumerate(ex["tests"]):
        row = outputs[i] if i < len(outputs) else {}
        actual = row.get("actual")
        passed = ("actual" in row and not row.get("error") and
                  equivalent(actual, case["expected"]))
        result.append({"label":case["label"],"passed":passed, "actual":actual,"expected":case["expected"], "error":row.get("error","")})
    return result

def normalize(value):
    return " ".join(str(value).strip().casefold().split())

def matches(text, term):
    return re.search(r"(?<!\w)" + re.escape(normalize(term)) + (r"\w*" if len(term)>3 else r"(?!\w)"), text) is not None

def grade_question(q, answer, submission=None):
    if q["type"] == "coding":
        cases = submission["cases"] if submission else []
        return sum(c["passed"] for c in cases) / len(cases) if cases else 0
    if q.get("options"):
        return float(answer == q["answer"])
    if q["type"] == "output":
        if "as JSON" in q["text"]:
            try: return float(equivalent(json.loads(answer),json.loads(q["answer"])))
            except (ValueError, TypeError): return 0.0
        if q.get("comparison") == "plain":
            return float(normalize(answer).replace(", ",",") == normalize(q["answer"]).replace(", ",","))
        return float(str(answer).strip().replace("\r\n","\n") == str(q["answer"]).strip().replace("\r\n","\n"))
    if q.get("answer") and normalize(answer) == normalize(q["answer"]):
        return 1.0
    rubric = q.get("rubric", [])
    text = normalize(answer)
    return sum(any(matches(text, term) for term in group) for group in rubric) / len(rubric) if rubric else float(normalize(answer) == normalize(q.get("answer","")))

def interpret(score):
    for minimum, label in [(90,"Strong performance"),(80,"Interview-ready for this assessment level"),(60,"Good understanding"),(40,"Developing")]:
        if score >= minimum: return label
    return "Needs foundational revision"

def scheduled(progress, score=None):
    step = min(int(progress.get("step",0)) + 1, len(INTERVALS)-1) if score is not None and score >= 80 and progress.get("due") and progress["due"] <= today().isoformat() else int(progress.get("step",0))
    if score is not None and score < 80: step = 0
    return {**progress,"step":step,"due":(today()+timedelta(days=INTERVALS[step])).isoformat()}

