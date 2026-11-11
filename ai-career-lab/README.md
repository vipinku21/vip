# AI Career Lab — Learn, Code, Interview & Grow

An invitation-only learning app for people working toward an AI Application Engineer role. It includes 8 stages, 24 modules, 100 example-led lessons, 301 coding exercises, 100 project briefs, and 9,500 assessment questions across three difficulty levels.

## Pilot accounts and résumé interviews

The first owner creates the sole admin account with a private setup key. On a local installation, open `backend/data/admin-setup.txt` to find the key. The owner receives the original single-learner history from that database. Each invited learner starts with their own empty workspace.

Open **Pilot access**, enter a tester’s email, then share their single-use link privately. Links expire in seven days. The default is 20 testers plus the admin. Active learners and pending invitations each take one place. Removing a learner signs them out and releases the place. Inviting the same email again restores access to that learner’s account.

In **Résumé interviewer**, enter a target role and supply résumé text or selected project descriptions. The interviewer asks six questions, follows up on earlier answers, and offers feedback. The learner can resume or clear their interview. Voice playback and editable dictation depend on browser support and microphone permission. A browser’s speech provider may process audio. Guided interviews work without a model subscription. Optional model-generated questions require the learner’s separate consent.

## Free hosted pilot from GitHub

Use the alwaysdata Free personal-use plan for this noncommercial pilot. A single Python process serves the browser app and keeps accounts, progress and interviews in persistent SQLite storage. GitHub hosts the source and ready-to-run release. [Free hosting plan](https://www.alwaysdata.com/en/offers/) · [Python hosting configuration](https://help.alwaysdata.com/en/docs/web-hosting/languages/python/configuration/)

1. Activate the free account and enable SSH access. Open a terminal on the hosting account. Download the installer from the tagged release source and run it with Python 3.11 or later:

   ```sh
   curl -fL https://raw.githubusercontent.com/vipinku21/vip/career-lab-pilot-v2.0.0/ai-career-lab/deploy/install_alwaysdata.py -o install_career_lab.py
   python3 install_career_lab.py
   ```

2. In **Web → Sites**, edit the site for your assigned address. Choose **User program** and paste the command printed by the installer. The service reads the IP and port assigned by the host.
3. Open your HTTPS address. Read `~/career-lab/shared/admin-setup.txt` in your private hosting account and use it to set your admin email and password. Share invitation links from **Pilot access**.

The installer verifies the GitHub release checksum and keeps the database and private settings in `~/career-lab/shared` across deployments. Use the host’s backup facilities for the whole database. Learners can separately export course progress under Settings. The résumé transcript is managed from the interview page.

## Open the app

Double-click **Start AI Career Lab.cmd** in this folder. It opens the pilot in your browser, using port 8000 or 8010 if the older app is already using 8000. Keep the server window open while studying. Press Ctrl+C there to stop.

On a fresh checkout, install Python 3.11 or later with the Windows Python launcher, and Node.js 22 with npm. The launcher prepares the project's Python environment, installs the packages, and builds the frontend on the first start. Initial installation needs internet access. Subsequent starts use the installed files. Python, SQL, fonts and the editor are served from this computer.

## First session

Open **Learning roadmap → Programming Fundamentals → Python → Python Strings**. The lesson includes ten worked examples. Choose **Run example**, then **Run code**. Select **Reverse a string** in the playground and implement `solve(value)`. Use **Submit tests** to evaluate your implementation, including empty input, punctuation and Unicode.

Every topic opens directly from search. For an introduction requiring no Python, open [Predicates](http://127.0.0.1:8000/#lesson/predicates) to follow a library reservation, or [Classification](http://127.0.0.1:8000/#lesson/classification) to follow a parcel inspection. Each reading includes a scenario, a walk-through, local definitions, worked inputs and outputs, and cases where the decision changes.

Return to the lesson and choose **Mark lesson completed → Take assessment**. Select a five-question set or the entire level. In sets containing a coding question, submit the coding tests before choosing **Submit assessment**. The review links weak concepts to focused practice. **Revision center** shows the next scheduled review.

Use **Settings** to change study availability, change theme or export a JSON backup. Restoring a backup replaces the signed-in learner’s course records in one database transaction. Unsubmitted playground drafts are saved per account in the current browser. Submitted code is included in backups.

## Manual setup and development

From this project directory in PowerShell:

```powershell
py -3 -m venv backend/.venv
.\backend\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
cd frontend
npm.cmd ci
npm.cmd run build
cd ..
.\backend\.venv\Scripts\python.exe start_lab.py
```

For hot reload, use two terminals. In the project directory start the backend:

```powershell
.\backend\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

Start Vite in the other terminal:

```powershell
cd frontend
npm.cmd run dev
```

Open [the development UI](http://127.0.0.1:5173/). Vite proxies `/api` to port 8000. Rebuild the frontend after changing its source to update the single-server version. The server mounts the built frontend at startup. Start it after the initial build.

## How learning and scoring work

- Lesson status is self-reported. The latest assessment score and concept breakdown provide separate evidence of proficiency. The skill gap analyzer uses the latest assessment per topic, and each earlier attempt remains available.
- The planner selects the earliest unfinished topic in curriculum order. The daily plan divides available minutes among theory and examples, coding, project work, interview and feedback. The weekly plan budgets upcoming topics in order. Advance when the prerequisites are complete.
- Every topic has 40 Beginner, 30 Intermediate, and 25 Advanced questions. Each complete bank includes choices, output predictions, short answers, scenarios and a coding task. Beginner emphasizes vocabulary and worked examples, Intermediate changes the inputs or constraints, and Advanced asks for diagnosis, test design and tradeoffs. Repeated answers count once toward question coverage. Completing a level recommends the next one regardless of score. Earlier scores and attempts stay available. Short reviews use subsets. Timed assessments allow two minutes per question. The server enforces the deadline and grades the last saved responses if time expires.
- Questions have equal weight. Multiple-choice and output answers use exact comparisons, including structural comparisons for JSON. Written answers earn one fraction of the question score per matched rubric group. Wording beyond the synonym list can score low, and keyword matches can miss negation. The review shows the rubric. Coding scores equal the fraction of real test cases passed.
- The worker runs Python through Pyodide and SQL through sql.js, with a new in-memory environment per run and a fresh SQL database per case. The browser sends actual returned values to the server for comparison with withheld expected values. This personal practice grader trusts its local browser. It is designed for self-study rather than proctored exams.
- Execution stops after eight seconds of learner code, or manually with **Stop**. Runtime initialization has a separate 45-second timeout. Errors, output, and saved submissions appear below the editor. Python practice uses standard-library code. Advanced examples requiring additional frameworks are labeled in the lesson, with a link to a related offline exercise. The application never executes learner-supplied Python on the Windows host.
- Reviews start after one day. A due review scoring at least 80 advances to 3, 7, 14, then 30 days. Lower scores return the interval to one day. An early successful assessment preserves the current interval. **Needs Revision** schedules the topic for today.
- Learning time counts visible learning activity in short intervals and pauses after two minutes without interaction. Dashboard totals start at zero. The learner database contains no demonstration attempts.
- Project checklists are self-reported milestones. Each brief includes requirements, acceptance cases, hints, improvements and interview prompts. Exercises have machine-graded tests. Larger project briefs guide independent implementation.

## Optional services and local data

Copy `.env.example` to `.env` in this folder and restart the server after edits. Local study works with the defaults.

| Variable | Purpose |
| --- | --- |
| `LAB_TIMEZONE` | Study-day boundary. Defaults to `Asia/Kolkata`. |
| `LAB_DATABASE_URL` | Optional SQLAlchemy SQLite URL pointing to a database in an existing directory. Defaults to `backend/data/career-lab.db`. |
| `QUESTION_PROVIDER` | Set to `stackexchange` to enable real Stack Overflow API searches. Defaults to `off`. |
| `STACKEXCHANGE_KEY` | Optional Stack Exchange application key. |
| `AI_BASE_URL` | Chat Completions compatible API base URL, including its version path if required. Remote services require HTTPS. Loopback HTTP is supported for local models. |
| `AI_MODEL` | Exact model name for the configured provider. |
| `AI_API_KEY` | Provider token if required. The server reads and uses it. |
| `LAB_BACKEND` | Optional Vite development proxy destination. |

**Refresh questions** searches recent discussions from the preceding year. It stores source titles, original links, author, license, tags, publication times and first retrieval times. Repeated refreshes retain the first retrieval date for duplicates. Network failure or provider backoff leaves cached entries available. Source difficulty is a rough tag-count estimate. Sourced discussions link to the original material and are separate from locally authored graded assessments. [Stack Exchange API documentation](https://api.stackexchange.com/docs/advanced-search)

For optional coaching, configure the AI provider and use **Send concept scores to AI coach** on a result. The server sends only the topic, score and concept breakdown. AI feedback is advisory and does not affect scoring. Credentials stay in server environment variables.

SQLite data lives in this project by default. If the folder is synced by OneDrive and you prefer an unsynced database, point `LAB_DATABASE_URL` to an existing local directory using a URL such as `sqlite:///C:/LearningData/career-lab.db`. Use JSON export/import to move progress between databases. Keep the app on loopback for personal use.

## Project layout

```text
Start AI Career Lab.cmd          Windows entry point
start_lab.py                    Local server and browser launcher
.env.example                    Optional provider settings
backend/
  main.py                       REST routes, grading flow, static frontend
  database.py                   SQLAlchemy records and atomic persistence
  models.py                     Pydantic input and backup validation
  curriculum.py                 Curriculum and practice lookups
  scoring.py                    Rubrics, test equality, review intervals
  providers.py                  Optional question and AI integrations
  content/catalog.json          Stage, module and topic hierarchy
  content/lessons.json          Structured lessons and worked examples
  content/guides/              Standalone lessons and real-world decisions
  content/interview/           Level-specific written interviews and rubrics
  content/applied/             Additional interview and transfer problems
  content/field_trials.json    Worked inputs and alternative decision rules
  content/interview_bank.py    Bank assembly and deterministic case questions
  content/practice.py           Original interviews, exercises and test cases
  content/projects.py           Project briefs and completion milestones
  tests/                        Backend checks and disposable browser server
frontend/
  src/                          React, TypeScript, Tailwind, local Monaco
  public/runner.js              Browser-only execution worker
  public/runtime/               Python and SQL engines copied at install
  scripts/runtime.mjs           Offline runtime preparation
  tests/workflow.spec.ts        Browser demonstration and regression tests
  dist/                         Production build served by FastAPI
```

Open [the local API explorer](http://127.0.0.1:8000/docs) for request schemas and interactive documentation. Main API resources include `/api/catalog`, `/api/topics/{topic}`, `/api/state`, per-topic progress, submissions and assessments, `/api/assessments/{id}/finish`, `/api/preferences`, `/api/export`, and `/api/import`.

To add a topic, retain stable IDs and add its catalog entry, lesson, exercise fixtures, interview cards, and project brief. The catalog test checks all topics and difficulty levels. Add an exercise or assessment fixture to change its grading, without changing the execution engine.

## Verification

From the project directory:

```powershell
.\backend\.venv\Scripts\python.exe -m pytest backend/tests -q
cd frontend
npm.cmd run build
npm.cmd run test:e2e
```

The browser suite uses installed Google Chrome. For Microsoft Edge set `$env:LAB_BROWSER = "msedge"` before running it. It starts a separate backend on port 8031, uses a temporary SQLite file, and forces external providers off. It leaves your regular workspace on port 8000 available.

The Strings demonstration opens the roadmap and complete lesson, runs a sample in Pyodide, solves the reverse exercise, marks the lesson complete, starts an assessment, and submits four passing coding tests plus written answers. The chosen answers yield **60/100**, with 0% for immutability and string methods. It opens targeted revision, closes the app tab and reopens it in a fresh browser profile, verifies saved completion and score, and refreshes sourced questions to check the unconfigured status. The suite also exercises SQL, execution cancellation, project persistence, dark mode and mobile navigation.

