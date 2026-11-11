"""Case-based teaching assets shared by the reading page and assessment authoring."""
import json
from functools import lru_cache
from pathlib import Path

HERE = Path(__file__).parent

@lru_cache
def collection(name):
    records = {}
    for path in sorted((HERE/name).glob("*.json")):
        entries = json.loads(path.read_text(encoding="utf-8-sig"))
        overlap = records.keys() & entries.keys()
        if overlap:
            raise ValueError(f"Duplicate {name} entries in {path.name}: {sorted(overlap)}")
        records.update(entries)
    return records

@lru_cache
def trials():
    return json.loads((HERE/"field_trials.json").read_text(encoding="utf-8"))

@lru_cache
def foundation_details():
    return json.loads((HERE/"foundation_details.json").read_text(encoding="utf-8"))

def teaching_material(topic):
    guide = collection("guides")[topic]
    lab = trials()[topic]
    # Only the intended behavior is shown in the worked table. The two changed
    # policies are introduced later as independent reasoning problems.
    return {**guide, "experiment":{
        "context":lab["context"],"rule":lab["rules"][0],
        "rows":[[s["input"],s["values"][0]] for s in lab["samples"]]
    }, "details":[{"question":q["q"],"answer":q["answers"][0],"explanation":q["why"]}
                  for q in foundation_details().get(topic,[])] +
                 [{"question":q[0],"answer":q[1],"explanation":""}
                  for q in collection("interview").get(topic,{}).get("Beginner",[])] +
                 [{"question":q[0],"answer":q[1],"explanation":""}
                  for q in collection("applied")[topic]["Beginner"]],
            "further":[{"level":level,"problem":example[0],"reasoning":example[1]}
                       for level in ("Intermediate","Advanced")
                       for example in collection("interview")[topic][level][:1]]}

def altered_result(value, cases):
    """Use a plausible domain error of the same type whenever one exists."""
    for case in cases:
        candidate=case["expected"]
        if type(candidate) is type(value) and candidate!=value:
            return candidate
    if isinstance(value,bool): return not value
    if isinstance(value,(int,float)): return value+1
    if isinstance(value,str): return value[:-1] if value else "missing"
    if isinstance(value,list): return value[1:] if value else [None]
    if isinstance(value,dict): return dict(list(value.items())[1:]) if value else {"count":0}
    return 0

def coding_variants(ex):
    """Extend the exact domain contract to batch processing and result auditing."""
    cases = ex["tests"]
    batches = [cases[:2], [], [cases[-1],cases[0],cases[-1]], list(reversed(cases))]
    batch_tests=[{"input":[c["input"] for c in group],"expected":[c["expected"] for c in group],
                  "label":label} for group,label in zip(batches,("Sample batch","No requests","Repeated request","Reversed arrival order"))]
    audits=[]
    for i,group in enumerate(batches):
        entries=[]; wrong=[]
        for j,c in enumerate(group):
            value=c["expected"]
            if (j+i)%2==0:
                value=altered_result(value,cases)
                wrong.append(j)
            entries.append({"input":c["input"],"reported":value})
        audits.append({"input":entries,"expected":wrong,"label":batch_tests[i]["label"]})
    prompts = [
        ("batch","Process a batch","Intermediate",batch_tests,
         "Now solve a batch: solve(value) receives a list of independent inputs in arrival order. Return the list of results, preserving duplicates. An empty batch returns [].",
         "Write a helper for one request, then apply it to each item."),
        ("audit","Audit reported results","Advanced",audits,
         "Now audit a list of records with input and reported fields. Recompute each result from the original rule. Return the zero-based positions of incorrect reports, in order. A missing JSON value is null; distinguish booleans from numbers.",
         "Compute the expected result independently for each input before comparing with the report.")
    ]
    return [{**ex,"id":ex["id"]+"-"+suffix,"title":title+" · "+ex["title"],"difficulty":level,
             "prompt":ex["prompt"]+"\n\n"+task,"hint":hint,"tests":tests,
             "sampleInput":tests[0]["input"],"sampleOutput":tests[0]["expected"]}
            for suffix,title,level,tests,task,hint in prompts]

def level_exercises(topic,lesson):
    from .practice import exercises
    base=exercises(topic,lesson)
    from .level_tasks import CHALLENGES, extended_challenges
    if topic["id"] in CHALLENGES:
        return [*base,*extended_challenges(topic["id"],base[0])]
    if base[0]["language"]=="sql":
        from .sql_levels import extra_sql
        return [*base,*extra_sql(topic["id"])]
    if topic["id"]=="strings":
        return base
    return [*base,*coding_variants(base[0])]

