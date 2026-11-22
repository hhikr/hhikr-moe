// The Hot 100 practice editor: Monaco with VS Code's keys, a dark theme matching the lesson's
// code panel, Java snippets, and hooks for running code and showing compiler errors.
// Loaded on demand when the reader opens the practice tab (see LessonPage.astro).
import * as monaco from './monaco-slim';
import EditorWorker from '../../../node_modules/monaco-editor/esm/vs/editor/editor.worker.js?worker';

(self as unknown as { MonacoEnvironment: monaco.Environment }).MonacoEnvironment = {
  getWorker: () => new EditorWorker(),
};

const CODE_BG = '#17212d';
monaco.editor.defineTheme('hot100-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'keyword', foreground: 'c6a5ef' },
    { token: 'string', foreground: 'dfb48c' },
    { token: 'number', foreground: 'acd4a2' },
    { token: 'comment', foreground: '85967a', fontStyle: 'italic' },
    { token: 'type', foreground: '80cbc5' },
  ],
  colors: {
    'editor.background': CODE_BG,
    'editorGutter.background': CODE_BG,
    'editor.lineHighlightBackground': '#2b78d61f',
    'editorLineNumber.foreground': '#607082',
    'editorLineNumber.activeForeground': '#9fb4cc',
  },
});
// Code is always on the dark slate, in both site themes, like the code panel of the lesson.
const themeName = () => 'hot100-dark';

// Snippets a learner reaches for in algorithm problems; the language server adds real completions later.
const SNIPPETS: [string, string, string][] = [
  ['sout', 'System.out.println($0);', '打印一行'],
  ['fori', 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n\t$0\n}', '下标循环'],
  ['foreach', 'for (${1:int} ${2:value} : ${3:nums}) {\n\t$0\n}', '遍历'],
  ['while', 'while (${1:condition}) {\n\t$0\n}', '循环'],
  ['if', 'if (${1:condition}) {\n\t$0\n}', '条件'],
  ['map', 'Map<${1:Integer}, ${2:Integer}> ${3:map} = new HashMap<>();', '哈希表'],
  ['set', 'Set<${1:Integer}> ${2:set} = new HashSet<>();', '集合'],
  ['list', 'List<${1:Integer}> ${2:list} = new ArrayList<>();', '动态数组'],
  ['deque', 'Deque<${1:Integer}> ${2:stack} = new ArrayDeque<>();', '栈 / 双端队列'],
  ['pq', 'PriorityQueue<${1:Integer}> ${2:heap} = new PriorityQueue<>(${3:(a, b) -> a - b});', '优先队列'],
  ['dp', 'int[] dp = new int[${1:n} + 1];', 'DP 数组'],
  ['dfs', 'private void dfs(${1:int i}) {\n\tif (${2:i >= n}) return;\n\t$0\n}', '递归辅助方法'],
];
const disposeSnippets = monaco.languages.registerCompletionItemProvider('java', {
  provideCompletionItems(model, position) {
    const word = model.getWordUntilPosition(position);
    const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
    return {
      suggestions: SNIPPETS.map(([label, body, detail]) => ({
        label,
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: body,
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        detail,
        range,
        sortText: `~${label}`,
      })),
    };
  },
});
void disposeSnippets;

export interface EditorHandle {
  getValue(): string;
  /** Replace the whole text; undoable, so Ctrl+Z brings the old code back. */
  setValue(value: string): void;
  focus(): void;
  /** Put the cursor on a line and scroll it into view. */
  jump(line: number, column?: number): void;
  /** Show problems (compile errors, diagnostics) as squiggles; owner keeps sources apart. */
  setMarkers(owner: string, markers: { line: number; column?: number; endLine?: number; endColumn?: number; message: string; severity?: 'error' | 'warning' | 'info' }[]): void;
  layout(): void;
  model: monaco.editor.ITextModel;
  editor: monaco.editor.IStandaloneCodeEditor;
  monaco: typeof monaco;
}

export interface EditorOptions {
  value: string;
  uri?: string;
  onChange?(value: string): void;
  onRun?(): void;
  onSubmit?(): void;
  ariaLabel?: string;
}

const SEVERITY = { error: monaco.MarkerSeverity.Error, warning: monaco.MarkerSeverity.Warning, info: monaco.MarkerSeverity.Info };

// ------------------------------------------------------------------ language server (JDT LS via the judge)

type Pos = { line: number; character: number };
type Range = { start: Pos; end: Pos };
const K = monaco.languages.CompletionItemKind;
// LSP CompletionItemKind (1-based) → Monaco's.
const KINDS = [K.Text, K.Text, K.Method, K.Function, K.Constructor, K.Field, K.Variable, K.Class, K.Interface, K.Module, K.Property, K.Unit, K.Value, K.Enum, K.Keyword, K.Snippet, K.Color, K.File, K.Reference, K.Folder, K.EnumMember, K.Constant, K.Struct, K.Event, K.Operator, K.TypeParameter];
const toRange = (r: Range) => new monaco.Range(r.start.line + 1, r.start.character + 1, r.end.line + 1, r.end.character + 1);
const toPos = (p: monaco.Position): Pos => ({ line: p.lineNumber - 1, character: p.column - 1 });

/**
 * IntelliSense from the judge's JDT LS: completion, hover, signature help, formatting and live
 * diagnostics. Quietly does nothing when the service is off or unreachable.
 */
export function attachLanguageServer(handle: EditorHandle, base: string, onStatus?: (text: string) => void) {
  let session = '';
  try { session = sessionStorage.getItem('hot100-lsp') || ''; } catch { /* private mode */ }
  if (!/^[a-f0-9]{24}$/.test(session)) {
    session = [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(16).padStart(2, '0')).join('');
    try { sessionStorage.setItem('hot100-lsp', session); } catch { /* fine */ }
  }
  let off = false;
  async function call<T>(action: string, payload: Record<string, unknown>, signal?: AbortSignal): Promise<T | null> {
    if (off) return null;
    try {
      const response = await fetch(`${base}/lsp/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session, ...payload }), signal });
      const data = await response.json().catch(() => ({}));
      if (data.disabled) { off = true; onStatus?.(''); return null; }
      if (response.status === 503) onStatus?.('智能提示正在启动…');
      if (!response.ok) return null;
      return data.result as T;
    } catch { return null; }
  }
  const mine = (model: monaco.editor.ITextModel) => model === handle.model;

  const disposables = [
    monaco.languages.registerCompletionItemProvider('java', {
      triggerCharacters: ['.', '@'],
      async provideCompletionItems(model, position, context, token) {
        if (!mine(model)) return { suggestions: [] };
        const controller = new AbortController();
        token.onCancellationRequested(() => controller.abort());
        const result = await call<{ incomplete: boolean; items: any[] }>('complete', { code: model.getValue(), position: toPos(position), context: { triggerKind: context.triggerKind + 1, triggerCharacter: context.triggerCharacter } }, controller.signal);
        if (!result) return { suggestions: [] };
        const word = model.getWordUntilPosition(position);
        const fallback = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
        return {
          incomplete: result.incomplete,
          suggestions: result.items.map((item) => ({
            label: item.labelDetails ? { label: item.label, detail: item.labelDetails.detail, description: item.labelDetails.description } : item.label,
            kind: KINDS[item.kind] ?? K.Text,
            detail: item.detail,
            documentation: item.documentation ? { value: item.documentation } : undefined,
            sortText: item.sortText, filterText: item.filterText, preselect: item.preselect,
            insertText: item.insertText,
            insertTextRules: item.snippet ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet : undefined,
            range: item.range ? toRange(item.range) : fallback,
            additionalTextEdits: item.additionalTextEdits?.map((e: { range: Range; text: string }) => ({ range: toRange(e.range), text: e.text })),
            commitCharacters: item.commitCharacters,
            tags: item.deprecated ? [monaco.languages.CompletionItemTag.Deprecated] : undefined,
            lsp: item,
          })),
        };
      },
      async resolveCompletionItem(item: any) {
        if (!item.lsp?.data) return item;
        const more = await call<{ detail?: string; documentation?: string; additionalTextEdits?: { range: Range; text: string }[] }>('resolve', { item: item.lsp });
        if (!more) return item;
        return {
          ...item,
          detail: more.detail || item.detail,
          documentation: more.documentation ? { value: more.documentation } : item.documentation,
          additionalTextEdits: more.additionalTextEdits?.map((e) => ({ range: toRange(e.range), text: e.text })) ?? item.additionalTextEdits,
        };
      },
    }),
    monaco.languages.registerHoverProvider('java', {
      async provideHover(model, position) {
        if (!mine(model)) return null;
        const result = await call<{ contents: string[]; range?: Range }>('hover', { code: model.getValue(), position: toPos(position) });
        return result && { contents: result.contents.map((value) => ({ value })), range: result.range ? toRange(result.range) : undefined };
      },
    }),
    monaco.languages.registerSignatureHelpProvider('java', {
      signatureHelpTriggerCharacters: ['(', ','],
      signatureHelpRetriggerCharacters: [')'],
      async provideSignatureHelp(model, position, _token, context) {
        if (!mine(model)) return null;
        const result = await call<{ activeSignature: number; activeParameter: number; signatures: { label: string; documentation?: string; parameters: { label: string | [number, number]; documentation?: string }[] }[] }>('signature', { code: model.getValue(), position: toPos(position), context: { triggerKind: context.triggerKind, isRetrigger: context.isRetrigger, triggerCharacter: context.triggerCharacter } });
        if (!result) return null;
        return {
          value: {
            activeSignature: result.activeSignature, activeParameter: result.activeParameter,
            signatures: result.signatures.map((s) => ({ label: s.label, documentation: s.documentation ? { value: s.documentation } : undefined, parameters: s.parameters.map((p) => ({ label: p.label, documentation: p.documentation ? { value: p.documentation } : undefined })) })),
          },
          dispose() {},
        };
      },
    }),
    monaco.languages.registerDocumentFormattingEditProvider('java', {
      async provideDocumentFormattingEdits(model) {
        if (!mine(model)) return [];
        const result = await call<{ text: string }>('format', { code: model.getValue() });
        return result && result.text !== model.getValue() ? [{ range: model.getFullModelRange(), text: result.text }] : [];
      },
    }),
  ];

  // Live diagnostics: after the reader pauses typing, ask for the problems in the current text.
  let timer: ReturnType<typeof setTimeout> | undefined, request = 0;
  const check = async () => {
    const mineRequest = ++request, code = handle.model.getValue();
    const result = await call<{ range: Range; severity: number; message: string }[]>('diagnostics', { code });
    if (!result || mineRequest !== request || code !== handle.model.getValue()) return;
    onStatus?.('');
    monaco.editor.setModelMarkers(handle.model, 'jdt', result.map((d) => ({
      ...{ startLineNumber: d.range.start.line + 1, startColumn: d.range.start.character + 1, endLineNumber: d.range.end.line + 1, endColumn: d.range.end.character + 1 },
      message: d.message,
      severity: d.severity === 1 ? monaco.MarkerSeverity.Error : d.severity === 2 ? monaco.MarkerSeverity.Warning : monaco.MarkerSeverity.Info,
      source: 'Java',
    })));
  };
  const schedule = () => { clearTimeout(timer); timer = setTimeout(check, 700); };
  const changes = handle.model.onDidChangeContent(schedule);
  schedule();
  return {
    refresh: schedule,
    dispose() { clearTimeout(timer); changes.dispose(); disposables.forEach((d) => d.dispose()); monaco.editor.setModelMarkers(handle.model, 'jdt', []); },
  };
}

export function createEditor(host: HTMLElement, options: EditorOptions): EditorHandle {
  const uri = monaco.Uri.parse(options.uri ?? 'inmemory://hot100/Solution.java');
  monaco.editor.getModel(uri)?.dispose();
  const model = monaco.editor.createModel(options.value, 'java', uri);
  model.updateOptions({ tabSize: 4, insertSpaces: true });
  const editor = monaco.editor.create(host, {
    model,
    theme: themeName(),
    ariaLabel: options.ariaLabel ?? 'Java 代码编辑器',
    automaticLayout: true,
    fontFamily: "'JetBrains Mono Variable', Consolas, 'Microsoft YaHei', monospace",
    fontSize: 14,
    lineHeight: 22,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    padding: { top: 14, bottom: 14 },
    fixedOverflowWidgets: true,
    bracketPairColorization: { enabled: true },
    // No bracket-pair guide: the coloured box it draws around the enclosing
    // { } block puzzled readers. Plain indentation guides are enough.
    guides: { bracketPairs: false, bracketPairsHorizontal: false, indentation: true },
    renderLineHighlight: 'all',
    smoothScrolling: true,
    tabSize: 4,
    quickSuggestions: { other: true, comments: false, strings: false },
    suggest: { showWords: true, snippetsPreventQuickSuggestions: false },
    wordBasedSuggestions: 'currentDocument',
    stickyScroll: { enabled: false },
    unicodeHighlight: { ambiguousCharacters: false },
  });
  editor.onDidChangeModelContent(() => options.onChange?.(model.getValue()));
  if (options.onRun) editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, options.onRun);
  if (options.onSubmit) editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Quote, options.onSubmit);

  return {
    model,
    editor,
    monaco,
    getValue: () => model.getValue(),
    setValue(value) {
      if (value === model.getValue()) return;
      editor.pushUndoStop();
      editor.executeEdits('hot100', [{ range: model.getFullModelRange(), text: value }]);
      editor.pushUndoStop();
    },
    focus: () => editor.focus(),
    jump(line, column = 1) {
      editor.setPosition({ lineNumber: line, column });
      editor.revealLineInCenterIfOutsideViewport(line);
      editor.focus();
    },
    setMarkers(owner, markers) {
      monaco.editor.setModelMarkers(
        model,
        owner,
        markers.map((m) => ({
          startLineNumber: m.line,
          startColumn: m.column ?? 1,
          endLineNumber: m.endLine ?? m.line,
          endColumn: m.endColumn ?? (m.column ? m.column + 1 : model.getLineMaxColumn(Math.min(m.line, model.getLineCount()))),
          message: m.message,
          severity: SEVERITY[m.severity ?? 'error'],
        })),
      );
    },
    layout: () => editor.layout(),
  };
}
