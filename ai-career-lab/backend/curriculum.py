import json
from functools import lru_cache
from pathlib import Path
from fastapi import HTTPException
from .content.teaching import level_exercises, teaching_material
from .content.interview_bank import build_bank, LEVELS, SET_SIZE
from .content.projects import project

CONTENT = Path(__file__).with_name("content")

@lru_cache
def catalog():
    return json.loads((CONTENT / "catalog.json").read_text(encoding="utf-8-sig"))

@lru_cache
def topics():
    return {t["id"]:t for s in catalog() for m in s["modules"] for t in m["topics"]}

@lru_cache
def lessons():
    return json.loads((CONTENT / "lessons.json").read_text(encoding="utf-8-sig"))

def topic_pair(topic_id):
    if topic_id not in topics():
        raise HTTPException(404, "Unknown topic")
    return topics()[topic_id], lessons()[topic_id]

@lru_cache
def lesson_detail(topic_id):
    topic, lesson = topic_pair(topic_id)
    return {"topic":topic, "lesson":lesson, "guide":teaching_material(topic_id), "banks":bank_outline(topic_id), "project":project(topic,lesson),
            "exercises":[{k:v for k,v in ex.items() if k != "tests"} for ex in level_exercises(topic,lesson)]}

def exercise(topic_id, exercise_id):
    for ex in level_exercises(*topic_pair(topic_id)):
        if ex["id"] == exercise_id:
            return ex
    raise HTTPException(404, "Unknown exercise")

@lru_cache
def question_set(topic_id, level):
    return build_bank(*topic_pair(topic_id), level)

@lru_cache
def bank_outline(topic_id):
    outline = {}
    for level in LEVELS:
        qs = question_set(topic_id,level)
        outline[level] = [{"number":qs[i]["setNumber"],"title":qs[i]["setTitle"],
                           "ids":[q["id"] for q in qs[i:i+SET_SIZE]]}
                          for i in range(0,len(qs),SET_SIZE)]
    return outline

