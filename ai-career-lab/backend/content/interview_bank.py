"""Progressive question sets built from authored interviews, worked cases and deterministic experiments."""
import json
from itertools import combinations
from random import Random
import re

from .practice import questions as original_questions
from .teaching import collection, foundation_details, level_exercises, trials

SET_SIZE = 5
LEVELS = ("Beginner","Intermediate","Advanced")

def choice(prompt, correct, distractors, concept, explanation, hint, kind="choice"):
    options = list(dict.fromkeys([correct,*distractors]))
    if len(options) < 2:
        raise ValueError(f"Indistinguishable choices in {prompt}")
    Random(prompt).shuffle(options)
    return dict(type=kind,text=prompt,answer=correct,options=options,concept=concept,
                explanation=explanation,hint=hint)

def output(prompt, answer, concept, explanation, hint, *, exact=False):
    return dict(type="output",text=prompt,answer=str(answer),concept=concept,
                explanation=explanation,hint=hint,comparison="exact" if exact else "plain")

def written(item, concept, kind="short"):
    prompt, model, *groups = item
    return dict(type=kind,text=prompt,answer=model,concept=concept,
                rubric=[s.split("/") for s in groups],explanation=model,
                hint="Name the decision and connect it to the facts given in the question.")

def result_question(ex, index, prompt):
    case=ex["tests"][index]
    encode=lambda v: json.dumps(v,ensure_ascii=False,separators=(",",":"))
    return output(ex["prompt"]+"\n\n"+prompt+" Return your answer as JSON.\n"+encode(case["input"]),
                  encode(case["expected"]),ex["title"],
                  f"The expected result for this input is {encode(case['expected'])}. {ex['hint']}",
                  "Follow the rule for this input in its original order.")

def code_question(ex):
    return dict(type="coding",text=ex["prompt"],exerciseId=ex["id"],concept=ex["title"],
                explanation=f"Compare the actual output of {ex['title']} against its sample and hidden tests.",
                hint=ex["hint"])

def facts(topic_id, concept):
    if topic_id in foundation_details():
        return [dict(type="short",text=q["q"],answer=q["answers"][0],rubric=[q["answers"]],
                     concept=concept,explanation=q["why"],hint="Read the small details in this topic's lesson.")
                for q in foundation_details()[topic_id]]
    return [written(q,concept) for q in collection("interview")[topic_id]["Beginner"]]

class Experiment:
    """Each trial has four authored observations and three explicit competing rules."""
    def __init__(self, trial, concept):
        self.context=trial["context"]
        self.rules=trial["rules"]
        self.samples=trial["samples"]
        self.concept=concept

    def record(self,i,j):
        row=self.samples[i]
        return f"{row['input']} → {row['values'][j]}"

    def evidence(self,indices,rule):
        return "\n".join(self.record(i,rule) for i in indices)

    def request(self,prompt,answer,explanation,hint):
        return output(self.context+"\n\n"+prompt,answer,self.concept,explanation,hint)

    def forecast(self,i,rule):
        row=self.samples[i]
        answers=list(dict.fromkeys([*row["values"],*[s["values"][rule] for s in self.samples]]))
        correct=row["values"][rule]
        return choice(self.context+f"\n\nApply this rule: {self.rules[rule]}\n{row['input']}\nWhat result follows?",
                      correct,[v for v in answers if v!=correct][:3] or ["The rule produces no result."],
                      self.concept,self.record(i,rule)+" follows from the specified rule.",
                      "Use exactly the stated version of the rule for this case.")

    def recorded(self,i,claimed_rule):
        row=self.samples[i]
        claim=row["values"][claimed_rule]
        answer="Pass" if row["values"][0]==claim else "Fail"
        return choice(f"{self.context}\n\nRequirement: {self.rules[0]}\nA test records {row['input']} → {claim}. Does this test pass the requirement?",
                      answer,["Pass","Fail"],self.concept,"The required behavior is "+self.record(i,0)+".",
                      "Work out the expected result before looking at the recorded one.")

    def list_inputs(self,indices):
        return "\n".join(f"{i+1}. {self.samples[i]['input']}" for i in indices)

    def count(self,rule,indices,operation):
        values=[self.samples[i]["values"] for i in indices]
        if operation=="distinct":
            question="How many different results would these inputs produce?"
            answer=len({v[rule] for v in values})
            evidence=self.evidence(indices,rule)
        else:
            question="How many of these cases would change their result if the original rule were replaced?"
            answer=sum(v[0]!=v[rule] for v in values)
            evidence="\n".join(f"{self.samples[i]['input']}: {self.samples[i]['values'][0]} → {self.samples[i]['values'][rule]}" for i in indices)
        rules=self.rules[0] if operation=="distinct" else "Original: "+self.rules[0]+"\nReplacement: "+self.rules[rule]
        return self.request(f"{rules}\n{self.list_inputs(indices)}\n{question} Give a whole number.",
                            answer,evidence,"Write down one result per input before counting.")

    def distinguish(self,left,right,indices):
        differing=[i+1 for i in indices if self.samples[i]["values"][left]!=self.samples[i]["values"][right]]
        answer=", ".join(map(str,differing)) if differing else "none"
        return self.request(f"Two proposals are under review.\nA: {self.rules[left]}\nB: {self.rules[right]}\n{self.list_inputs(indices)}\nWhich numbered cases could distinguish A from B by their outputs? Give every qualifying number in ascending order, separated by commas, or write none.",
                            answer,"\n".join(f"{i+1}. A gives {self.samples[i]['values'][left]}; B gives {self.samples[i]['values'][right]}." for i in indices),
                            "A case provides evidence only if its two predicted outcomes differ.")

    def diagnose(self,observed,indices):
        possible=[j for j in range(3) if all(self.samples[i]["values"][j]==self.samples[i]["values"][observed] for i in indices)]
        letters="ABC"
        answer=", ".join(letters[j] for j in possible)
        descriptions="\n".join(f"{letters[i]}. {r}" for i,r in enumerate(self.rules))
        explanation="\n".join(f"{letters[j]}: "+", ".join(self.samples[i]["values"][j] for i in indices) for j in range(3))
        return self.request(f"Only the following three implementations are possible.\n{descriptions}\nThe following results were observed:\n{self.evidence(indices,observed)}\nWhich implementations are consistent with every observation? Give all matching letters in alphabetical order, separated by commas.",
                            answer,explanation,"Eliminate an implementation only when a recorded result contradicts it.")

    def minimum(self):
        """Find the smallest subset separating all behaviorally different candidates."""
        signatures=[tuple(s["values"][j] for s in self.samples) for j in range(3)]
        full=len(set(signatures))
        for size in range(5):
            for subset in combinations(range(4),size):
                if len({tuple(sig[i] for i in subset) for sig in signatures})==full:
                    example=", ".join(str(i+1) for i in subset) or "no cases"
                    return self.request("A test costs time. Compare three implementations:\n"+"\n".join(self.rules)+"\n"+self.list_inputs(range(4))+"\nWhat is the smallest number of these inputs needed to distinguish every implementation that behaves differently somewhere in this list? Give a whole number.",
                                        size,f"One minimum selection uses {example}. The full list produces {full} distinct behavior patterns.",
                                        "First try each case alone. If no single result separates all observed patterns, try pairs.")

def case_question(cases,i,field,prompt,concept):
    c=cases[i]
    others=[cases[(i+1)%3][field],cases[(i+2)%3][field]]
    distractors=([c["alternative"],*others[:1]] if field=="action" else others)
    hint={"action":"Identify the requirement the change must satisfy.","reason":"Look for a cause that explains this specific outcome.",
          "check":"Choose an observation that would change if the repair failed.","tradeoff":"Look for a cost or limitation of the chosen change."}[field]
    return choice(c["situation"]+"\n\n"+prompt,c[field],distractors,concept,
                  c["action"]+" "+c["reason"]+" "+c["check"],hint)

def pair_question(cases,i,what,concept):
    a,b=cases[i],cases[(i+1)%3]
    prompt=f"Two requests arrive together.\n1. {a['situation']}\n2. {b['situation']}\n"
    if what=="plan":
        correct=a["action"]+" Then: "+b["action"]
        wrong=[a["alternative"]+" Then: "+b["action"],a["action"]+" Then: "+b["alternative"]]
        instruction="Which pair of decisions addresses both requests, in order?"
    elif what=="evidence":
        correct=a["check"]+" Then: "+b["check"]
        wrong=[b["check"]+" Then: "+a["check"],a["check"]+" Then: "+cases[(i+2)%3]["check"]]
        instruction="Which test belongs to each incident? Match the tests in incident order."
    else:
        correct=a["tradeoff"]+" Then: "+b["tradeoff"]
        wrong=[b["tradeoff"]+" Then: "+a["tradeoff"],a["tradeoff"]+" Then: "+cases[(i+2)%3]["tradeoff"]]
        instruction=f"The first team proposes: {a['action']} The second proposes: {b['action']} Which pair of limitations belongs in their design review, in that order?"
    return choice(prompt+instruction,correct,wrong,concept,a["reason"]+" "+b["reason"],
                  "Keep the evidence and decision for each request separate.",kind="scenario")

def project_choice(project,cases,key,stem,concept):
    value=project[key]
    answer=value[-1] if isinstance(value,list) else value
    return choice(project["problem"]+"\n\n"+stem,answer,[c["alternative"] for c in cases[:2]],
                  concept,project["expected"],"Identify the behavior the project's user should be able to observe.")

def sets_for(topic,lesson,level):
    tid=topic["id"]
    g=collection("guides")[tid]; cases=g["decisions"][:3]; terms=g["terms"][:4]
    concept=topic["title"]
    exp=Experiment(trials()[tid],concept)
    exs=level_exercises(topic,lesson)
    from .projects import project as make_project
    project=make_project(topic,lesson)
    anchor=collection("interview")[tid]
    extra=[written(q,concept,"short" if level=="Beginner" else "scenario") for q in collection("applied")[tid][level]]
    if level=="Beginner":
        seed=original_questions(topic,lesson,level)
        micro=facts(tid,concept)
        vocab=[choice(f"In this topic, what does “{word}” mean?",meaning,
                      [entry[1] for entry in terms if entry[0]!=word][:2],word,meaning,
                      "Think about the part this term plays in the lesson's worked example.") for word,meaning in terms]
        examples=[output("Read the worked example. What output is displayed? Keep the original line breaks.\n\n"+e["code"],
                         e["output"],e["title"],e["title"]+" gives:\n"+e["output"],"Trace each instruction in order.",exact=True)
                  for e in lesson["examples"][:2]]
        steps=g["steps"][:3]
        positions=[0,1,2]
        Random(tid).shuffle(positions)
        sequence=" → ".join("ABC"[positions.index(i)] for i in range(3))
        order=choice(g["story"]+"\n\nArrange these steps into the order used by the lesson.\n"+
                     "\n".join(f"{'ABC'[j]}. {steps[i]}" for j,i in enumerate(positions)),
                     sequence,[s for s in ("A → B → C","C → A → B","B → C → A","B → A → C") if s!=sequence][:3],
                     concept," ".join(steps),"Begin with the information available at the start.")
        origin=exs[0]
        sample=origin["tests"][0]
        sample_json=json.dumps(sample["expected"],ensure_ascii=False)
        form=type(sample["expected"])
        shape={list:"a list",dict:"an object",str:"text",int:"a number",float:"a number",bool:"a Boolean",type(None):"a missing value"}[form]
        shape_q=choice(origin["prompt"]+"\n\nFor the sample input "+json.dumps(sample["input"],ensure_ascii=False)+", what kind of value should the caller receive?",shape,
                       [s for s in ("a number","a list","text","an object","a Boolean") if s!=shape][:2],
                       origin["title"],"The sample result is "+sample_json+".","Focus on the shape of the returned result.")
        return [
            ("Words and small details",[*vocab[:2],*micro[:3]]),
            ("Read a worked example",[*vocab[2:4],*examples,order]),
            ("Trace a real decision",[*[exp.forecast(i,0) for i in range(4)],exp.count(0,range(4),"distinct")]),
            ("Choose a first step",[*[case_question(cases,i,"action","What should the person handling this case do?",concept) for i in range(3)],
                  project_choice(project,cases,"expected","Which behavior should the finished project provide?",concept),shape_q]),
            ("Explain the result",[*[case_question(cases,i,"reason","The proposed action is: "+cases[i]["action"]+" Which explanation supports it?",concept) for i in range(3)],
                  result_question(origin,0,"Trace the published sample."),result_question(origin,-1,"Predict what this boundary input returns.")]),
            ("Check your work",[*[case_question(cases,i,"check","Which check would show whether the change worked here?",concept) for i in range(3)],
                  exp.recorded(0,1),exp.recorded(1,2)]),
            ("Everyday interview details",extra),
            ("Topic interview",seed)
        ]
    authored=[written(q,concept,"short" if i==0 else "scenario") for i,q in enumerate(anchor[level])]
    coding=(exs[1] if level=="Intermediate" else exs[-1]) if tid=="strings" else exs[-2 if level=="Intermediate" else -1]
    if level=="Intermediate":
        return [
            ("Apply the concept",authored),
            ("Change one requirement",[*[exp.forecast(i,1) for i in range(4)],exp.count(1,range(4),"changed")]),
            ("Compare possible repairs",[exp.distinguish(0,2,[0,1,2]),exp.diagnose(1,[0,2]),*[pair_question(cases,i,"plan",concept) for i in range(3)]]),
            ("Verify the change",[exp.forecast(1,2),exp.forecast(3,2),*[pair_question(cases,i,"evidence",concept) for i in range(3)]]),
            ("Investigate mismatches",[exp.diagnose(2,[1,3]),exp.distinguish(1,2,[0,2]),exp.count(2,range(4),"changed"),
                   result_question(coding,0,"Predict the sample result of this extended task."),result_question(coding,2,"Trace this additional input for the extended task.")]),
            ("Apply and implement",[*extra,exp.distinguish(0,2,[1,3]),code_question(coding)])
        ]
    return [
        ("Design and diagnosis",authored),
        ("Defend the tradeoff",[*[case_question(cases,i,"tradeoff","Review this design: "+cases[i]["action"]+" What limitation belongs in the decision record?",concept) for i in range(3)],
               exp.diagnose(2,[0,1,2]),extra[0]]),
        ("Construct a discriminating test",[exp.distinguish(0,1,range(4)),exp.distinguish(0,2,range(4)),extra[1],
               exp.minimum(),exp.diagnose(0,range(4))]),
        ("Reason across incidents",[*[pair_question(cases,i,"tradeoff",concept) for i in range(3)],
               extra[2],extra[3]]),
        ("Audit the implementation",[result_question(coding,0,"Predict the result for this advanced sample."),result_question(coding,-1,"Trace this audit on the final fixture."),
               extra[4],exp.distinguish(1,2,range(4)),code_question(coding)])
    ]

def build_bank(topic, lesson, level):
    result=[]
    for section,(title,questions) in enumerate(sets_for(topic,lesson,level),1):
        if len(questions)!=SET_SIZE:
            raise ValueError(f"{topic['id']} / {level} / {title} requires {SET_SIZE} items")
        for n,question in enumerate(questions,1):
            label=question["concept"]
            if label==topic["title"]:
                terms=[*topic["concepts"],*[t[0] for t in collection("guides")[topic["id"]]["terms"]]]
                haystack=(question["text"]+" "+str(question.get("answer",""))).lower()
                label=next((t for t in sorted(terms,key=len,reverse=True)
                            if len(t)>2 and re.search(r"(?<!\w)"+re.escape(t.lower())+r"(?!\w)",haystack)),title)
            result.append({**question,"concept":label,"id":f"{topic['id']}.{level.lower()}.v2.{section}.{n}",
                           "setNumber":section,"setTitle":title,"difficulty":level,
                           "source":"Local casebook","updated":"2026-11-11"})
    return result

