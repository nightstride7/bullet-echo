import { useState, useRef } from "react";
import { parseProducts, mergeProducts, TEMPLATE } from "./pipeline.js";

const btn = (c = "#00d4ff") => ({ padding: "7px 14px", background: "transparent", border: `1px solid ${c}55`, color: c, fontSize: 8, letterSpacing: 2, cursor: "pointer", fontFamily: "'Orbitron',monospace" });

export default function PipelinePanel({ products, custom, onApply, onReset }) {
  const [text, setText] = useState("");
  const [msg, setMsg] = useState(null);
  const file = useRef(null);

  const add = (raw, replace = false) => {
    const r = parseProducts(raw);
    if (!r.ok) return setMsg({ bad: true, t: r.errors.join(" · ") });
    onApply(replace ? r.products : mergeProducts(products, r.products));
    setMsg({ t: `${replace ? "Replaced with" : "Added"} ${r.products.length} target(s).` });
    setText("");
  };
  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ products }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `bullet-echo-pipeline-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const onFile = async (e) => {
    const f = e.target.files?.[0];
    if (f) add(await f.text(), true);
    e.target.value = "";
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
      <div style={{ fontSize: 8, letterSpacing: 3, color: "rgba(0,212,255,0.6)", marginBottom: 8 }}>PIPELINE DATA · {products.length} TARGETS · {custom ? "YOURS" : "SAMPLE"}</div>
      <p style={{ fontSize: 8, color: "rgba(0,212,255,0.45)", lineHeight: 1.9, marginBottom: 12 }}>
        Run prompts/assess.md in any LLM, paste the JSON it returns below. One product, an array, or an exported file all work. Everything stays in this browser.
      </p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste assessment JSON here…" spellCheck={false}
        style={{ width: "100%", minHeight: 180, boxSizing: "border-box", background: "rgba(0,8,20,0.8)", border: "1px solid rgba(0,212,255,0.2)", color: "#9fe8ff", fontFamily: "monospace", fontSize: 11, padding: 10, resize: "vertical" }} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "10px 0" }}>
        <button style={btn("#ffa000")} onClick={() => add(text)} disabled={!text.trim()}>+ ADD TO PIPELINE</button>
        <button style={btn()} onClick={() => setText(TEMPLATE)}>INSERT TEMPLATE</button>
        <button style={btn()} onClick={() => file.current?.click()}>IMPORT FILE (REPLACES)</button>
        <button style={btn()} onClick={exportJson}>EXPORT JSON</button>
        {custom && <button style={btn("#ff6b6b")} onClick={() => { if (confirm("Reset to the sample data? Your imported targets will be removed.")) onReset(); }}>RESET TO SAMPLE</button>}
        <input ref={file} type="file" accept="application/json,.json" onChange={onFile} style={{ display: "none" }} />
      </div>
      {msg && <div style={{ fontSize: 9, letterSpacing: 1, color: msg.bad ? "#ff6b6b" : "#4dff7c" }}>{msg.t}</div>}
    </div>
  );
}
