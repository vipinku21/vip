export type Topic = {
  id: string;
  title: string;
  minutes: number;
  concepts: string[];
  project: string;
};
export type Stage = {
  id: string;
  title: string;
  description: string;
  hours: number;
  project: string;
  modules: { title: string; topics: Topic[] }[];
};
export type Status =
  | "Not Started"
  | "Learning"
  | "Completed"
  | "Needs Revision"
  | "Mastered";
export type Progress = {
  status: Status;
  due?: string;
  step?: number;
  lastScore?: number;
};
export type Lesson = {
  definition: string;
  why: string;
  prerequisites: string[];
  explanation: string;
  syntax: string;
  usage: string;
  examples: {
    title: string;
    code: string;
    output: string;
    language?: string;
  }[];
  mistakes: string[];
  edges: string[];
  useCases: string[];
  methods: string[];
  practices: string[];
  interview: string;
  miniProject: string;
  exercises: string[];
  next: string[];
};
export type Project = {
  title: string;
  problem: string;
  requirements: string[];
  prerequisites: string[];
  milestones: string[];
  hints: string[];
  expected: string;
  tests: string[];
  improvements: string[];
  interview: string[];
};
export type Exercise = {
  id: string;
  title: string;
  difficulty: string;
  language: "python" | "sql";
  prompt: string;
  starter: string;
  sampleInput: unknown;
  sampleOutput: unknown;
  hint: string;
  setup?: string;
};
export type LessonGuide = {
  title: string;
  story: string;
  steps: string[];
  outcome: string;
  terms: [string, string][];
  decisions: {
    situation: string;
    action: string;
    reason: string;
    check: string;
    tradeoff: string;
    alternative: string;
  }[];
  details: { question: string; answer: string; explanation: string }[];
  further: { level: string; problem: string; reasoning: string }[];
  experiment: { context: string; rule: string; rows: [string, string][] };
};
export type BankSet = { number: number; title: string; ids: string[] };
export type Detail = {
  guide: LessonGuide;
  banks: Record<string, BankSet[]>;
  topic: Topic;
  lesson: Lesson;
  project: Project;
  exercises: Exercise[];
};
export type Review = {
  text: string;
  type: string;
  concept: string;
  answer: string;
  solution: string;
  explanation: string;
  percent: number;
};
export type Attempt = {
  answeredIds?: string[];
  id: string;
  topic: string;
  level: string;
  mode: string;
  date: string;
  score: number;
  interpretation: string;
  concepts: Record<string, number>;
  reviews: Review[];
};
export type Case = {
  label: string;
  passed: boolean;
  actual: unknown;
  expected: unknown;
  error: string;
};
export type Submission = {
  id: string;
  topic: string;
  exerciseId: string;
  code: string;
  date: string;
  cases: Case[];
  passed: number;
  assessmentId: string;
};
export type Source = {
  title: string;
  url: string;
  author: string;
  retrieved: string;
  published: number;
  license: string;
  tags: string[];
  difficulty: string;
  topic: string;
};
export type Prefs = {
  name: string;
  dailyMinutes: number;
  theme: "light" | "dark";
};
export type State = {
  projectTotals?: Record<string, number>;
  today: string;
  preferences: Prefs;
  progress: Record<string, Progress>;
  projects: Record<string, { checked: number[] }>;
  attempts: Record<string, Attempt>;
  submissions: Record<
    string,
    {
      id: string;
      topic: string;
      exerciseId: string;
      date: string;
      passed: number;
      total: number;
    }
  >;
  activity: Record<string, { seconds: number }>;
  revisions: Record<
    string,
    { topic: string; date: string; score: number; nextDue: string }
  >;
  sources: Record<string, Source>;
  integrations: { ai: boolean; retrieval: boolean };
};
export type Question = {
  id: string;
  text: string;
  concept: string;
  type: string;
  options?: string[];
  hint: string;
  exerciseId?: string;
  difficulty: string;
  source: string;
  updated: string;
};
export type Assessment = {
  id: string;
  topic: string;
  mode: string;
  level: string;
  deadline: number | null;
  questions: Question[];
};
