"""Install the GitHub pilot release from an authenticated alwaysdata SSH session."""
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import subprocess
import sys
import tarfile
import tempfile
from urllib.request import Request, urlopen

TAG = "career-lab-pilot-v2.0.0"
REPOSITORY = "vipinku21/vip"
ASSET = "ai-career-lab-pilot.tar.gz"


def fetch(url):
    return urlopen(Request(url, headers={"User-Agent": "AI-Career-Lab-installer"}), timeout=90)


def main():
    if sys.version_info < (3, 11):
        raise SystemExit("Run with Python 3.11 or newer.")
    account = input("Your alwaysdata account name (before .alwaysdata.net): ").strip().lower()
    if not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", account):
        raise SystemExit("Invalid account name.")
    os.umask(0o077)
    root = Path.home() / "career-lab"
    shared = root / "shared"
    releases = root / "releases"
    shared.mkdir(parents=True, exist_ok=True)
    releases.mkdir(exist_ok=True)
    with fetch(f"https://api.github.com/repos/{REPOSITORY}/releases/tags/{TAG}") as source:
        metadata = json.load(source)
    asset = next(item for item in metadata["assets"] if item["name"] == ASSET)
    expected = asset.get("digest") or ""
    if not re.fullmatch(r"sha256:[a-f0-9]{64}", expected):
        raise SystemExit("GitHub has not supplied a release checksum. Retry the installation later.")
    release = releases / (TAG + "-" + expected[7:19])
    if not release.is_dir():
        with tempfile.TemporaryDirectory(dir=releases) as scratch:
            stage = Path(scratch)
            archive = stage / "pilot.tar.gz"
            with fetch(asset["browser_download_url"]) as source, archive.open("wb") as target:
                shutil.copyfileobj(source, target)
            if hashlib.sha256(archive.read_bytes()).hexdigest() != expected[7:]:
                raise SystemExit("Release checksum did not match.")
            extracted = stage / "app"
            extracted.mkdir()
            with tarfile.open(archive, "r:gz") as bundle:
                for member in bundle:
                    target = (extracted / member.name).resolve()
                    if not target.is_relative_to(extracted) or not member.isfile():
                        raise SystemExit("Unexpected archive entry.")
                    target.parent.mkdir(parents=True, exist_ok=True)
                    with bundle.extractfile(member) as source, target.open("xb") as destination:
                        shutil.copyfileobj(source, destination)
            extracted.rename(release)
    venv = root / "venv"
    if not (venv / "bin/python").exists():
        subprocess.run([sys.executable, "-m", "venv", str(venv)], check=True)
    subprocess.run([str(venv / "bin/python"), "-m", "pip", "install", "--upgrade", "--no-cache-dir", "pip"], check=True)
    subprocess.run([str(venv / "bin/python"), "-m", "pip", "install", "--no-cache-dir",
                    "-r", str(release / "backend/requirements.txt")], check=True)
    settings = shared / "pilot.env"
    keyfile = shared / "admin-setup.txt"
    if not keyfile.exists():
        with keyfile.open("x") as key:
            key.write(secrets.token_urlsafe(32))
    if not settings.exists():
        with settings.open("x") as target:
            target.write(f"LAB_PUBLIC_ORIGIN=https://{account}.alwaysdata.net\n"
                         f"LAB_DATABASE_URL=sqlite:///{shared}/career-lab.db\n"
                         f"LAB_ADMIN_SETUP_TOKEN={keyfile.read_text().strip()}\nLAB_PILOT_LIMIT=20\n")
    pending = root / "current.new"
    pending.unlink(missing_ok=True)
    pending.symlink_to(release, target_is_directory=True)
    pending.replace(root / "current")
    print(f"In Web > Sites, select Program/User program for {account}.alwaysdata.net.")
    print(f"Command: {venv}/bin/python {root}/current/deploy/serve.py")
    print(f"Use the owner key in {keyfile} on the site's first sign-in screen.")


if __name__ == "__main__":
    main()

