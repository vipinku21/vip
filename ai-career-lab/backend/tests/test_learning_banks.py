from collections import Counter
import re

from backend import curriculum, scoring
from backend.content.teaching import collection, trials


def test_all_cases_and_progressive_banks():
    topics = set(curriculum.topics())
    assert topics == set(collection("guides")) == set(trials())
    assert topics == set(collection("interview")) == set(collection("applied"))
    total = 0
    for topic in topics:
        detail = curriculum.lesson_detail(topic)
        guide = detail["guide"]
        assert len(guide["steps"]) >= 3
        assert len(guide["terms"]) >= 4
        assert len(guide["decisions"]) >= 3
        assert len(guide["experiment"]["rows"]) == 4
        assert len(guide["details"]) >= 8
        assert all(all(c.get(k) for k in ("situation","action","reason","check","tradeoff","alternative")) for c in guide["decisions"])
        assert len({tuple(s["values"][i] for s in trials()[topic]["samples"]) for i in range(3)}) == 3
        all_prompts = set()
        ids = set()
        exercise_ids = set()
        for level, expected in (("Beginner",40),("Intermediate",30),("Advanced",25)):
            bank = curriculum.question_set(topic,level)
            assert len(bank) == expected
            assert list(Counter(q["setNumber"] for q in bank).values()) == [5] * (expected//5)
            assert [key for s in detail["banks"][level] for key in s["ids"]] == [q["id"] for q in bank]
            total += len(bank)
            for q in bank:
                stem = re.sub(r"\s+", " ", q["text"]).casefold().strip()
                assert stem not in all_prompts, (topic, level, q["id"],stem)
                assert q["id"] not in ids
                all_prompts.add(stem)
                ids.add(q["id"])
                if q.get("options"):
                    assert len(q["options"]) == len(set(q["options"])) >= 2
                    assert q["answer"] in q["options"]
                if q.get("rubric"):
                    assert all(group and all(term.strip() for term in group) for group in q["rubric"])
                if "answer" in q:
                    assert scoring.grade_question(q,q["answer"]) == 1, (q["id"],q["answer"])
                if q["type"]=="coding":
                    assert q["exerciseId"] not in exercise_ids
                    exercise_ids.add(q["exerciseId"])
                    assert curriculum.exercise(topic,q["exerciseId"])["tests"]
        assert len(exercise_ids) == 3
    assert total == 9500

