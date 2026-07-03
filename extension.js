const vscode = require('vscode');
const { parseDocument, findMatchingDirectiveLines, getDirectiveSpan } = require('./parser');

let matchDecoration;
let inactiveDecoration;
let activeEditor;
const parseCache = new Map();

function activate(context) {
  createDecorations();

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      activeEditor = editor;
      updateDecorations();
    }),
    vscode.window.onDidChangeTextEditorSelection((event) => {
      if (event.textEditor === activeEditor) {
        updateDecorations();
      }
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      parseCache.delete(event.document.uri.toString());
      if (activeEditor && event.document === activeEditor.document) {
        updateDecorations();
      }
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('cPreprocessorVisualizer.inactiveColor')) {
        createDecorations();
        updateDecorations();
      }
    })
  );

  activeEditor = vscode.window.activeTextEditor;
  updateDecorations();
}

function deactivate() {}

function createDecorations() {
  matchDecoration?.dispose();
  inactiveDecoration?.dispose();

  const inactiveColor = vscode.workspace
    .getConfiguration('cPreprocessorVisualizer')
    .get('inactiveColor', '#5ac83cd9');

  matchDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(255, 214, 102, 0.22)',
    border: '1px solid rgba(255, 193, 7, 0.85)',
    overviewRulerColor: 'rgba(255, 193, 7, 0.85)',
    overviewRulerLane: vscode.OverviewRulerLane.Right
  });

  inactiveDecoration = vscode.window.createTextEditorDecorationType({
    color: inactiveColor
  });
}

function updateDecorations() {
  const editor = activeEditor;
  if (!editor || !isCOrCppDocument(editor.document)) {
    return;
  }

  const parsed = getParsedDocument(editor.document);
  editor.setDecorations(
    inactiveDecoration,
    parsed.inactiveLines.map((line) => editor.document.lineAt(line).range)
  );
  editor.setDecorations(matchDecoration, findMatchingDirectiveRanges(editor, parsed.groups));
}

function getParsedDocument(document) {
  const cacheKey = document.uri.toString();
  const cached = parseCache.get(cacheKey);
  if (cached && cached.version === document.version) {
    return cached.parsed;
  }

  const parsed = parseDocument(document);
  parseCache.set(cacheKey, {
    version: document.version,
    parsed
  });
  return parsed;
}

function isCOrCppDocument(document) {
  if (['c', 'cpp', 'objective-c', 'objective-cpp'].includes(document.languageId)) {
    return true;
  }

  return /\.(c|cc|cpp|cxx|h|hh|hpp|hxx)$/i.test(document.fileName);
}

function findMatchingDirectiveRanges(editor, groups) {
  const cursorLine = editor.selection.active.line;
  const activeSpan = getDirectiveSpan(editor.document.lineAt(cursorLine).text);
  if (
    !activeSpan ||
    editor.selection.active.character < activeSpan.start ||
    editor.selection.active.character >= activeSpan.end
  ) {
    return [];
  }

  return findMatchingDirectiveLines(editor.document, cursorLine, groups)
    .map((line) => {
      const textLine = editor.document.lineAt(line);
      const span = getDirectiveSpan(textLine.text);
      if (!span) {
        return undefined;
      }

      return new vscode.Range(line, span.start, line, span.end);
    })
    .filter(Boolean);
}

module.exports = {
  activate,
  deactivate
};
