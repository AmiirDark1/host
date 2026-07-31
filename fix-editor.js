const fs = require("fs");
const path = "client/src/pages/InstanceDetail.jsx";
let s = fs.readFileSync(path, "utf8");

// 1. Add editorScrollTop state
s = s.replace(
  '  const [editorChanged, setEditorChanged] = useState(false);',
  '  const [editorChanged, setEditorChanged] = useState(false);\n  const [editorScrollTop, setEditorScrollTop] = useState(0);'
);

// 2. Replace escapeHtml + highlightCode with placeholder-based approach
const startHl = s.indexOf("  function escapeHtml(str) {");
const endHl = s.indexOf("\n  function handleEditorChange");
if (startHl === -1 || endHl === -1) throw new Error("highlight markers not found");
const newHighlight = String.raw`  function escapeHtml(str) {
    return str
      .replace(/&/g, "\u0000A")
      .replace(/</g, "\u0000L")
      .replace(/>/g, "\u0000G")
      .replace(/"/g, "\u0000Q");
  }

  function highlightCode(content, lang) {
    if (!content) return "";
    const escaped = escapeHtml(content);
    let result = escaped;

    // Comments
    if (lang === "javascript" || lang === "php" || lang === "css" || lang === "sql" || lang === "python" || lang === "shell") {
      if (lang === "css") {
        result = result.replace(/(\/\*[\s\S]*?\*\/)/g, '<span style="color:#6A9955">$1</span>');
      } else {
        result = result.replace(/(\/\/[^\n]*)/g, '<span style="color:#6A9955">$1</span>');
        result = result.replace(/(#[^\n]*)/g, '<span style="color:#6A9955">$1</span>');
        result = result.replace(/(\/\*[\s\S]*?\*\/)/g, '<span style="color:#6A9955">$1</span>');
      }
    }
    if (lang === "html" || lang === "apache") {
      result = result.replace(/(\u0000L!--[\s\S]*?--\u0000G)/g, '<span style="color:#6A9955">$1</span>');
    }

    // Strings
    result = result.replace(/(\u0000Q[^\u0000A]*?\u0000Q|'[^'\n]*'|\u0060[^\u0060]*\u0060)/g, '<span style="color:#CE9178">$1</span>');

    // Keywords
    const keywords =
      lang === "javascript"
        ? /(\b(const|let|var|function|return|if|else|for|while|import|export|from|new|class|extends|super|try|catch|finally|async|await|typeof|instanceof|switch|case|break|continue|default|null|undefined|true|false|this|throw|delete|in|of|yield|static|get|set|do|void)\b)/g
        : lang === "php"
          ? /(\b(\u0000L\?php|\?\u0000G|function|if|else|elseif|for|foreach|while|return|echo|print|class|new|extends|public|private|protected|static|const|try|catch|finally|throw|as|use|namespace|require|require_once|include|include_once|true|false|null|switch|case|break|continue|default|global|isset|empty|unset|array|list|and|or|not|do|endif|endforeach|endwhile|endfor)\b)/g
          : lang === "html"
            ? /(\u0000L\/?[a-zA-Z][a-zA-Z0-9-]*|\b(html|head|body|div|span|p|a|img|script|style|link|meta|title|h1|h2|h3|h4|h5|h6|ul|ol|li|table|tr|td|th|form|input|button|select|option|textarea|nav|header|footer|main|section|article|aside|iframe|video|audio|source|br|hr|strong|em|b|i|u|small|label|blockquote|code|pre)\b)/g
            : lang === "css"
              ? /(\b(@import|@media|@keyframes|@font-face|@supports|from|to|important)\b|#[0-9a-fA-F]{3,8}\b)/g
              : lang === "json"
                ? /(\u0000Q\w+\u0000Q)(\s*:)/g
                : /(\b(function|def|if|else|elif|for|while|return|import|from|class|try|except|finally|with|as|lambda|pass|break|continue|global|nonlocal|True|False|None|and|or|not|in|is|print|echo|select|from|where|insert|update|delete|create|table|into|values|set|drop|alter|join|left|right|inner|outer|group|order|by|having|limit|offset|null|true|false|begin|commit|rollback)\b)/g;

    result = result.replace(keywords, '<span style="color:#569CD6">$1</span>');

    // Numbers
    result = result.replace(/(\b\d+(\.\d+)?\b)/g, '<span style="color:#B5CEA8">$1</span>');

    // Functions (name followed by parenthesis)
    if (lang === "javascript" || lang === "php" || lang === "python") {
      result = result.replace(/(\b[a-zA-Z_]\w*)(?=\s*\()/g, '<span style="color:#DCDCAA">$1</span>');
    }

    // HTML attributes
    if (lang === "html") {
      result = result.replace(/([a-zA-Z-]+)(=)(\u0000Q)/g, '<span style="color:#9CDCFE">$1</span>$2<span style="color:#CE9178">$3');
    }

    // PHP variables
    if (lang === "php") {
      result = result.replace(/(\$[a-zA-Z_]\w*)/g, '<span style="color:#9CDCFE">$1</span>');
    }

    // Restore entities
    return result
      .replace(/\u0000A/g, "\u0026amp;")
      .replace(/\u0000L/g, "\u0026lt;")
      .replace(/\u0000G/g, "\u0026gt;")
      .replace(/\u0000Q/g, "\u0026quot;");
  }

`;
s = s.slice(0, startHl) + newHighlight + s.slice(endHl + 1);

// 3. Replace scrollToMatch + runFind, add handleEditorScroll
const startScroll = s.indexOf("  function scrollToMatch(match) {");
const endScroll = s.indexOf("  function findNext() {");
if (startScroll === -1 || endScroll === -1) throw new Error("scroll markers not found");
const newScrollRun = String.raw`  function handleEditorScroll(e) {
    if (editorPreRef.current) {
      editorPreRef.current.scrollTop = e.target.scrollTop;
      editorPreRef.current.scrollLeft = e.target.scrollLeft;
    }
    setEditorScrollTop(e.target.scrollTop);
  }

  function scrollToMatch(match, len) {
    if (!match || !editorRef.current) return;
    const lines = editorRef.current.value.split("\n");
    const target = { line: match.line, col: match.col };
    // Select the match in the textarea
    let charIndex = 0;
    for (let i = 0; i < match.line - 1; i++) {
      charIndex += lines[i].length + 1;
    }
    charIndex += match.col - 1;
    editorRef.current.focus();
    editorRef.current.setSelectionRange(charIndex, charIndex + (len !== undefined ? len : editorFind.length));
    setEditorCursor(target);
  }

  function runFind(content, query) {
    const src = content !== undefined ? content : fmEditContent;
    const q = query !== undefined ? query : editorFind;
    if (!q.trim()) {
      setEditorFindMatches([]);
      setEditorFindIndex(-1);
      return;
    }
    const lines = src.split("\n");
    const matches = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let idx = line.indexOf(q);
      while (idx !== -1) {
        matches.push({ line: i + 1, col: idx + 1 });
        idx = line.indexOf(q, idx + 1);
      }
    }
    setEditorFindMatches(matches);
    setEditorFindIndex(0);
    scrollToMatch(matches[0], q.length);
  }

`;
s = s.slice(0, startScroll) + newScrollRun + s.slice(endScroll);

// 4. saveFile should use closeEditor
s = s.replace(
  `      if (data.success) {
        showMsg("✅ فایل ذخیره شد");
        setFmEditing(null);
        setFmEditContent("");
        loadFmList();
      } else {`,
  `      if (data.success) {
        showMsg("✅ فایل ذخیره شد");
        closeEditor();
        loadFmList();
      } else {`
);

// 5. Inject render helper consts in Main Render
s = s.replace(
  "  // =============================================================\n  // Main Render\n  // =============================================================\n  return (",
  `  // =============================================================
  // Main Render
  // =============================================================
  const fileLang = fmEditing ? getFileLanguage(fmEditing.name) : "plaintext";
  const editorLines = fmEditContent.split("\\n").length;
  const lineNumbers = Array.from({ length: editorLines }, (_, i) => i + 1);
  const highlightedCode = fmEditing
    ? highlightCode(
        fmEditContent.endsWith("\\n") ? fmEditContent : fmEditContent + "\\n",
        fileLang,
      )
    : "";
  const vsToolbarBtn = {
    background: "#3c3c3c",
    color: "#ccc",
    border: "none",
    borderRadius: 4,
    padding: "3px 10px",
    fontSize: 12,
    cursor: "pointer",
  };
  const vsFindInput = {
    background: "#3c3c3c",
    border: "1px solid #5a5a5a",
    color: "#e8e8e8",
    borderRadius: 4,
    padding: "4px 8px",
    fontSize: 12,
    width: 220,
    outline: "none",
  };

  return (`
);

// 6. Replace editor modal with VS Code style editor
const edStart = s.indexOf("          {fmEditing && (");
const edEnd = s.indexOf("          {/* Rename modal */}");
if (edStart === -1 || edEnd === -1) throw new Error("editor modal markers not found");
const newEditor = String.raw`          {fmEditing && (
            <div className="modal-overlay">
              <div
                className="modal"
                style={{
                  width: "90%",
                  maxWidth: 1100,
                  height: "85vh",
                  display: "flex",
                  flexDirection: "column",
                  padding: 0,
                  overflow: "hidden",
                  background: "#1e1e1e",
                  borderRadius: 8,
                  border: "1px solid #3c3c3c",
                }}
              >
                {/* Title/tab bar */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    background: "#252526",
                    borderBottom: "1px solid #3c3c3c",
                    padding: "0 8px",
                    height: 38,
                    flexShrink: 0,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 14 }}>{getLanguageIcon(fileLang)}</span>
                    <span style={{ color: "#e8e8e8", fontSize: 13, direction: "ltr", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {fmEditing.name}
                    </span>
                    <span style={{ color: "#666", fontSize: 11, direction: "ltr", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {fmEditing.path}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <button
                      className="btn btn-sm"
                      style={{ background: "#0e639c", color: "#fff", border: "none", borderRadius: 4, padding: "3px 12px", fontSize: 12, cursor: "pointer" }}
                      onClick={saveFile}
                    >
                      💾 ذخیره {editorChanged ? "•" : ""}
                    </button>
                    <button
                      className="btn btn-sm"
                      style={{ background: "transparent", color: "#ccc", border: "none", fontSize: 18, cursor: "pointer", padding: "0 6px" }}
                      onClick={closeEditor}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Toolbar */}
                <div style={{ display: "flex", gap: 6, alignItems: "center", padding: "6px 12px", background: "#252526", borderBottom: "1px solid #3c3c3c", flexShrink: 0 }}>
                  <button className="btn btn-sm" style={vsToolbarBtn} onClick={() => { setEditorFindOpen(true); setTimeout(() => findRef.current?.focus(), 50); }}>
                    🔍 جستجو
                  </button>
                  <button className="btn btn-sm" style={vsToolbarBtn} onClick={() => { setEditorGoToOpen(true); setTimeout(() => goToRef.current?.focus(), 50); }}>
                    ⏭ برو به خط
                  </button>
                  <span style={{ color: "#858585", fontSize: 11, marginRight: "auto", display: "flex", alignItems: "center", gap: 4, direction: "ltr" }}>
                    {getLanguageIcon(fileLang)} {fileLang}
                  </span>
                </div>

                {/* Find bar */}
                {editorFindOpen && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", background: "#1e1e1e", borderBottom: "1px solid #3c3c3c" }}>
                    <input
                      ref={findRef}
                      style={vsFindInput}
                      placeholder="جستجو..."
                      value={editorFind}
                      onChange={(e) => { setEditorFind(e.target.value); runFind(e.target.value, e.target.value); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { if (e.shiftKey) findPrev(); else findNext(); } if (e.key === "Escape") setEditorFindOpen(false); }}
                      dir="ltr"
                    />
                    <button className="btn btn-sm btn-outline" style={{ color: "#ccc", padding: "2px 8px" }} onClick={findPrev} title="قبلی">▲</button>
                    <button className="btn btn-sm btn-outline" style={{ color: "#ccc", padding: "2px 8px" }} onClick={findNext} title="بعدی">▼</button>
                    <span style={{ color: "#9a9a9a", fontSize: 12 }}>
                      {editorFindMatches.length > 0 ? String(editorFindIndex + 1) + " / " + String(editorFindMatches.length) : editorFind ? "موردی یافت نشد" : ""}
                    </span>
                  </div>
                )}

                {/* Go to line bar */}
                {editorGoToOpen && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", background: "#1e1e1e", borderBottom: "1px solid #3c3c3c" }}>
                    <span style={{ color: "#9a9a9a", fontSize: 12 }}>برو به خط:</span>
                    <input
                      ref={goToRef}
                      style={Object.assign({}, vsFindInput, { width: 80 })}
                      placeholder="خط"
                      value={editorGoTo}
                      onChange={(e) => setEditorGoTo(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") goToLine(); if (e.key === "Escape") setEditorGoToOpen(false); }}
                    />
                    <button className="btn btn-sm btn-outline" style={{ color: "#ccc" }} onClick={goToLine}>برو</button>
                  </div>
                )}

                {/* Editor area */}
                <div style={{ position: "relative", flex: 1, overflow: "hidden", background: "#1e1e1e" }}>
                  <pre
                    ref={editorPreRef}
                    style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, margin: 0, padding: "12px 12px 12px 64px", fontSize: 13, fontFamily: "Consolas, Monaco, 'Courier New', monospace", lineHeight: 1.6, color: "#d4d4d4", whiteSpace: "pre", overflow: "auto", pointerEvents: "none", direction: "ltr", textAlign: "left", tabSize: 2 }}
                    dangerouslySetInnerHTML={{ __html: highlightedCode }}
                  />
                  <div
                    style={{ position: "absolute", top: 0, left: 0, width: 52, background: "#252526", borderRight: "1px solid #3c3c3c", padding: "12px 0", textAlign: "right", color: "#858585", fontFamily: "Consolas, Monaco, 'Courier New', monospace", fontSize: 13, lineHeight: 1.6, userSelect: "none", direction: "ltr", transform: "translateY(-" + editorScrollTop + "px)" }}
                  >
                    {lineNumbers.map((n) => (
                      <div key={n} style={{ paddingRight: 8 }}>{n}</div>
                    ))}
                  </div>
                  <textarea
                    ref={editorRef}
                    style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, margin: 0, padding: "12px 12px 12px 64px", fontSize: 13, fontFamily: "Consolas, Monaco, 'Courier New', monospace", lineHeight: 1.6, color: "transparent", caretColor: "#aeafad", WebkitTextFillColor: "transparent", background: "transparent", border: "none", outline: "none", resize: "none", whiteSpace: "pre", overflow: "auto", direction: "ltr", textAlign: "left", tabSize: 2, zIndex: 2 }}
                    value={fmEditContent}
                    onChange={handleEditorChange}
                    onKeyDown={handleEditorKeyDown}
                    onScroll={handleEditorScroll}
                    onClick={(e) => updateCursorPos(e.target)}
                    onKeyUp={(e) => updateCursorPos(e.target)}
                    spellCheck={false}
                    autoCapitalize="off"
                    autoCorrect="off"
                  />
                </div>

                {/* Status bar */}
                <div style={{ display: "flex", gap: 16, alignItems: "center", background: "#007acc", color: "#fff", padding: "3px 12px", fontSize: 12, flexShrink: 0, direction: "ltr" }}>
                  <span>⎇ main</span>
                  <span>{editorChanged ? "⚠ اصلاح نشده" : "✔"}</span>
                  <span style={{ marginLeft: "auto" }}>Ln {editorCursor.line}, Col {editorCursor.col}</span>
                  <span>{getLanguageIcon(fileLang)} {fileLang}</span>
                  <span>UTF-8</span>
                  <span>LF</span>
                  <span>Spaces: 2</span>
                </div>
              </div>
            </div>
          )}`;
s = s.slice(0, edStart) + newEditor + "\n\n" + s.slice(edEnd);

fs.writeFileSync(path, s);
console.log("fix-editor applied successfully");