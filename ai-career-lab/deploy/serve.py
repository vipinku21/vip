"""Start a single alwaysdata ASGI process using its assigned socket and private settings."""
import os
from pathlib import Path
import sys

import uvicorn
from dotenv import load_dotenv

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root))
load_dotenv(Path.home() / "career-lab/shared/pilot.env")

if __name__ == "__main__":
    if not os.getenv("LAB_PUBLIC_ORIGIN") or not os.getenv("LAB_ADMIN_SETUP_TOKEN"):
        raise SystemExit("Run the pilot installer to prepare private hosting settings.")
    uvicorn.run("backend.main:app", host=os.environ["IP"], port=int(os.environ["PORT"]), workers=1)

