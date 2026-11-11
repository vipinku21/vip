import { mkdir, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = new URL("../", import.meta.url);
for (const [name, files] of Object.entries({
  pyodide: [
    "pyodide.js",
    "pyodide.asm.js",
    "pyodide.asm.wasm",
    "python_stdlib.zip",
    "pyodide-lock.json",
  ],
  "sql.js": ["dist/sql-wasm.js", "dist/sql-wasm.wasm"],
})) {
  const dest = new URL("public/runtime/" + name + "/", root);
  await mkdir(fileURLToPath(dest), { recursive: true });
  for (const file of files)
    await copyFile(
      new URL("node_modules/" + name + "/" + file, root),
      new URL(file.split("/").pop(), dest),
    );
}
