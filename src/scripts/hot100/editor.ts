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
    guides: { bracketPairs: 'active', indentation: true },
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
