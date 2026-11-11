/* Each run has a fresh worker and an in-memory filesystem. */
self.onmessage = async ({ data }) => {
  const { language, code, inputs, sample } = data;
  let stdout = "",
    stderr = "";
  const append = (current, text) =>
    current.length < 12000 ? (current + text + "\n").slice(0, 12000) : current;
  try {
    const outputs = [];
    if (language === "sql") {
      importScripts("/runtime/sql.js/sql-wasm.js");
      const SQL = await initSqlJs({
        locateFile: (file) => "/runtime/sql.js/" + file,
      });
      self.postMessage({ ready: true });
      for (const setup of inputs) {
        const db = new SQL.Database();
        try {
          if (setup) db.run(setup);
          const result = db.exec(code);
          const rows = result.at(-1)?.values || [];
          outputs.push({ actual: rows });
          if (sample)
            stdout = append(
              stdout,
              data.script
                ? rows
                    .map((row) =>
                      row
                        .map((v) => (v === null ? "NULL" : String(v)))
                        .join(" | "),
                    )
                    .join("\n")
                : JSON.stringify(rows),
            );
        } catch (e) {
          outputs.push({ error: String(e) });
          stderr = append(stderr, String(e));
        } finally {
          db.close();
        }
      }
    } else {
      importScripts("/runtime/pyodide/pyodide.js");
      const py = await loadPyodide({
        indexURL: "/runtime/pyodide/",
        stdout: (t) => {
          stdout = append(stdout, t);
        },
        stderr: (t) => {
          stderr = append(stderr, t);
        },
      });
      self.postMessage({ ready: true });
      py.globals.set("_lab_source", code);
      py.globals.set("_lab_inputs", JSON.stringify(inputs));
      py.globals.set("_lab_script", !!data.script);
      const results = await py.runPythonAsync(
        [
          "import json as _json, traceback as _tb, builtins as _bi",
          "_results = []",
          "for _input in _json.loads(_lab_inputs):",
          '    _space = {"__name__": "__main__"}',
          "    _lines = iter(str(_input).splitlines())",
          '    def _read(prompt=""):',
          '        if prompt: print(prompt, end="")',
          "        try: return next(_lines)",
          '        except StopIteration: raise EOFError("No more sample input")',
          '    _space["input"] = _read',
          "    try:",
          '        exec(compile(_lab_source, "<playground>", "exec"), _space)',
          '        _value = None if _lab_script else _space["solve"](_input)',
          "        _json.dumps(_value, allow_nan=False)",
          '        _results.append({"actual": _value})',
          "    except BaseException:",
          '        _results.append({"error": _tb.format_exc(limit=5)[-4000:]})',
          "_json.dumps(_results, allow_nan=False)",
        ].join("\n"),
      );
      outputs.push(...JSON.parse(results));
      for (const row of outputs) {
        if (row.error) stderr = append(stderr, row.error);
        else if (sample && !data.script)
          stdout = append(
            stdout,
            typeof row.actual === "string"
              ? row.actual
              : JSON.stringify(row.actual),
          );
      }
    }
    self.postMessage({ outputs, stdout, stderr });
  } catch (error) {
    self.postMessage({ fatal: String(error), stdout, stderr });
  }
};
