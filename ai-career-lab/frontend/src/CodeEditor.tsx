import { useEffect, useRef } from "react";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import "monaco-editor/esm/vs/basic-languages/python/python.contribution";
import "monaco-editor/esm/vs/basic-languages/sql/sql.contribution";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
self.MonacoEnvironment = { getWorker: () => new EditorWorker() };
export default function CodeEditor({
  value,
  onChange,
  language,
}: {
  value: string;
  onChange: (s: string) => void;
  language: string;
}) {
  const div = useRef<HTMLDivElement>(null),
    editor = useRef<monaco.editor.IStandaloneCodeEditor | null>(null),
    cb = useRef(onChange);
  cb.current = onChange;
  useEffect(() => {
    const ed = monaco.editor.create(div.current!, {
      value,
      language,
      theme: "vs-dark",
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 14,
      lineHeight: 23,
      padding: { top: 16, bottom: 12 },
      scrollBeyondLastLine: false,
      overviewRulerBorder: false,
      wordWrap: "on",
      tabSize: 4,
      ariaLabel: "Code editor",
      fixedOverflowWidgets: true,
    });
    editor.current = ed;
    ed.onDidChangeModelContent(() => cb.current(ed.getValue()));
    return () => {
      const model = ed.getModel();
      ed.dispose();
      model?.dispose();
      editor.current = null;
    };
  }, [language]);
  useEffect(() => {
    if (editor.current && value !== editor.current.getValue())
      editor.current.setValue(value);
  }, [value]);
  return <div className="editor-host" ref={div} />;
}
