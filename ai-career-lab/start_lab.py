"""Launch the same loopback-only workspace whether or not it is already running."""
import json
import socket
import threading
import time
import urllib.request
import webbrowser
from urllib.error import URLError

import uvicorn

def running(url):
    try:
        with urllib.request.urlopen(url+"api/health", timeout=1) as response:
            health = json.load(response)
            return health.get("app") == "AI Career Lab" and health.get("version") == "2.0"
    except (URLError, OSError, ValueError, KeyError):
        return False

def open_when_ready(url):
    for _ in range(80):
        if running(url):
            webbrowser.open(url)
            return
        time.sleep(0.25)
    print("Open "+url+" once the server reports that startup is complete.")

if __name__ == "__main__":
    for port in (8000, 8010):
        url = f"http://127.0.0.1:{port}/"
        with socket.socket() as probe:
            if probe.connect_ex(("127.0.0.1", port)) == 0:
                if running(url):
                    webbrowser.open(url)
                    break
                continue
        print("Opening AI Career Lab at "+url+"  Press Ctrl+C here to stop.")
        threading.Thread(target=open_when_ready,args=(url,),daemon=True).start()
        uvicorn.run("backend.main:app",host="127.0.0.1",port=port)
        break
    else:
        raise SystemExit("Both local workspace ports are in use. Close the other instance and reopen the pilot.")

