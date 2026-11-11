"""Playwright launches this disposable profile independently of the learner's server."""
from pathlib import Path
import os
import tempfile

with tempfile.TemporaryDirectory(prefix="career-lab-browser-") as directory:
    os.environ["LAB_DATABASE_URL"]="sqlite:///"+str(Path(directory)/"demo.sqlite3")
    os.environ["QUESTION_PROVIDER"]="off"
    os.environ["LAB_ADMIN_SETUP_TOKEN"]="only-for-the-disposable-browser-test-server"
    os.environ["AI_BASE_URL"]=""
    import uvicorn
    uvicorn.run("backend.main:app",host="127.0.0.1",port=8031,log_level="warning")

