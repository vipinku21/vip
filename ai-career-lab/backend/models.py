from datetime import date, datetime
from typing import Annotated, Literal
from pydantic import BaseModel, Field, HttpUrl, JsonValue, model_validator

Text = Annotated[str, Field(max_length=30000)]
CourseStatus = Literal["Not Started","Learning","Completed","Needs Revision","Mastered"]
Level = Literal["Beginner","Intermediate","Advanced"]

class Preferences(BaseModel):
    name: str = Field(default="Learner",min_length=1,max_length=60,pattern=r"\S")
    dailyMinutes: int = Field(default=120,ge=15,le=720)
    theme: Literal["light","dark"] = "light"

class Progress(BaseModel):
    status: CourseStatus = "Not Started"
    due: date | None = None
    step: int = Field(0,ge=0,le=4)
    lastScore: int | None = Field(None,ge=0,le=100)

class ChangeStatus(BaseModel):
    status: CourseStatus

class Tick(BaseModel):
    seconds: int = Field(ge=1,le=60)

class Activity(BaseModel):
    seconds: int = Field(ge=0,le=172800)

class Checklist(BaseModel):
    checked: list[Annotated[int,Field(ge=0,le=100)]] = Field(max_length=100)

class Start(BaseModel):
    level: Level = "Beginner"
    mode: Literal["Practice","Timed","Revision"] = "Practice"
    setNumber: int = Field(default=1, ge=0, le=10)
    focus: str = Field("",max_length=150)

class Responses(BaseModel):
    answers: dict[str,Text] = Field(max_length=50)

class Output(BaseModel):
    actual: JsonValue = None
    error: Text = ""

class SubmissionIn(BaseModel):
    exerciseId: str = Field(max_length=150)
    code: Text
    outputs: list[Output] = Field(max_length=100)
    assessmentId: str = Field("",max_length=100)

class Case(BaseModel):
    label: str
    passed: bool
    actual: JsonValue = None
    expected: JsonValue = None
    error: Text = ""

class Submission(BaseModel):
    id: str
    topic: str
    exerciseId: str
    code: Text
    date: datetime
    cases: list[Case] = Field(min_length=1,max_length=100)
    passed: int = Field(ge=0,le=100)
    assessmentId: str = ""

class Review(BaseModel):
    text: str
    type: str
    concept: str
    answer: Text
    solution: str
    explanation: str
    percent: int = Field(ge=0,le=100)

class Attempt(BaseModel):
    answeredIds: list[str] = Field(default_factory=list, max_length=50)
    id: str
    topic: str
    level: Level
    mode: str
    date: datetime
    score: int = Field(ge=0,le=100)
    interpretation: str
    concepts: dict[str,Annotated[int,Field(ge=0,le=100)]]
    reviews: list[Review] = Field(min_length=1,max_length=100)

class Revision(BaseModel):
    topic: str
    date: datetime
    score: int = Field(ge=0,le=100)
    nextDue: date

class Source(BaseModel):
    topic: str
    title: str
    url: HttpUrl
    author: str
    retrieved: datetime
    published: int
    license: str
    tags: list[str]
    difficulty: str
    kind: str

class Backup(BaseModel):
    version: Literal[1]
    preferences: Preferences
    progress: dict[str,Progress]
    projects: dict[str,Checklist]
    attempts: dict[str,Attempt]
    submissions: dict[str,Submission]
    activity: dict[date,Activity]
    revisions: dict[str,Revision]
    sources: dict[str,Source]

    @model_validator(mode="after")
    def validate_references(self):
        from .curriculum import topics, lesson_detail
        known = topics()
        ids = set(self.progress) | set(self.projects)
        for records in (self.attempts,self.submissions,self.revisions,self.sources):
            ids.update(r.topic for r in records.values())
        if ids-set(known): raise ValueError("Backup references unknown curriculum topics")
        for records in (self.attempts,self.submissions):
            if any(k!=v.id for k,v in records.items()): raise ValueError("Record IDs must match")
        for key, value in self.projects.items():
            count = len(lesson_detail(key)["project"]["milestones"])
            if any(i>=count for i in value.checked): raise ValueError("Invalid milestone")
        return self

