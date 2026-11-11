"""Run the pilot on GitHub Codespaces, with data kept in this workspace."""
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
import time
from urllib.error import URLError
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
PORT = 8000


def ready():
    try:
        with urlopen(f"http://127.0.0.1:{PORT}/api/health", timeout=1) as response:
            health = json.load(response)
            return health.get("app") == "AI Career Lab" and health.get("version") == "2.0"
    except (OSError, URLError, ValueError):
        return False


def start():
    name = os.environ.get("CODESPACE_NAME")
    domain = os.environ.get("GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN")
    if not name or not domain:
        raise SystemExit("Start the pilot from the GitHub Codespaces launch link.")
    origin = f"https://{name}-{PORT}.{domain}"
    data = ROOT / "backend/data"
    data.mkdir(parents=True, exist_ok=True)
    key = data / "admin-setup.txt"
    try:
        descriptor = os.open(key, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError:
        pass
    else:
        with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
            stream.write(secrets.token_urlsafe(32))
    if not ready():
        environment = {k: os.environ[k] for k in ("PATH", "HOME", "LANG", "SYSTEMROOT", "TEMP", "TMP") if k in os.environ}
        environment.update(LAB_PUBLIC_ORIGIN=origin, LAB_ADMIN_SETUP_TOKEN=key.read_text(encoding="utf-8").strip())
        with (data / "pilot.log").open("a", encoding="utf-8") as log:
            process = subprocess.Popen(
                [sys.executable, "-m", "uvicorn", "backend.main:app", "--host", "127.0.0.1", "--port", str(PORT)],
                cwd=ROOT, env=environment, stdin=subprocess.DEVNULL,
                stdout=log, stderr=subprocess.STDOUT, start_new_session=os.name != "nt",
            )
        for _ in range(60):
            if process.poll() is not None:
                raise SystemExit("Startup failed. Open ai-career-lab/backend/data/pilot.log.")
            if ready():
                break
            time.sleep(0.5)
        else:
            raise SystemExit("Startup timed out. Open ai-career-lab/backend/data/pilot.log.")
    print(f"AI Career Lab: {origin}")
    print("First visit: open ai-career-lab/backend/data/admin-setup.txt in the file explorer for your owner key.")


if __name__ == "__main__":
    start()
