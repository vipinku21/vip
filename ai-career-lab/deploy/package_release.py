"""Package the server and built browser app without learner data or credentials."""
import argparse
from pathlib import Path
import tarfile

PROJECT = Path(__file__).resolve().parents[1]


def package(dist, output):
    for required in ("index.html", "runner.js", "runtime/pyodide/pyodide.asm.wasm", "runtime/sql.js/sql-wasm.wasm"):
        if not (dist / required).is_file():
            raise SystemExit(f"Build the frontend first. Missing {required}.")
    source = [*sorted((PROJECT / "backend").glob("*.py")), PROJECT / "backend/requirements.txt",
              *sorted((PROJECT / "backend/content").rglob("*.py")),
              *sorted((PROJECT / "backend/content").rglob("*.json")), PROJECT / "deploy/serve.py"]
    with tarfile.open(output, "w:gz", compresslevel=6) as archive:
        for path in source:
            archive.add(path, arcname=path.relative_to(PROJECT).as_posix(), recursive=False)
        for path in sorted(dist.rglob("*")):
            if path.is_file() and not path.is_symlink():
                archive.add(path, arcname="frontend/dist/" + path.relative_to(dist).as_posix(), recursive=False)
        modules = PROJECT / "frontend/node_modules"
        for name in ("pyodide", "sql.js", "monaco-editor", "react", "react-dom", "lucide-react", "@fontsource-variable/dm-sans"):
            for path in sorted((modules/name).glob("*")):
                if path.is_file() and path.name.lower().startswith(("license", "licence", "ofl", "notice")):
                    archive.add(path, arcname=f"licenses/{name}/{path.name}", recursive=False)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=Path)
    parser.add_argument("--dist", type=Path, default=PROJECT / "frontend/dist")
    args = parser.parse_args()
    package(args.dist, args.output)

