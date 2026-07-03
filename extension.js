const vscode = require('vscode');
const { parseDocument, findMatchingDirectiveLines, getDirectiveSpan } = require('./parser');
const { createParseOptionsForFile } = require('./project-context');

let matchDecoration;
let inactiveDecoration;
let activeEditor;
let refreshTimer;
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
      if (isCOrCppDocument(event.document)) {
        invalidateParseCache();
        scheduleUpdateDecorations();
      }
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (
        event.affectsConfiguration('cPreprocessorVisualizer.inactiveColor') ||
        event.affectsConfiguration('cPreprocessorVisualizer.showInactiveRegions')
      ) {
        createDecorations();
        updateDecorations();
      }
    }),
    createWorkspaceWatcher('**/*.{c,cc,cpp,cxx,h,hh,hpp,hxx}'),
    createWorkspaceWatcher('**/build/compile_commands.json')
  );

  activeEditor = vscode.window.activeTextEditor;
  updateDecorations();
}

function deactivate() {}

function createWorkspaceWatcher(globPattern) {
  const watcher = vscode.workspace.createFileSystemWatcher(globPattern);
  watcher.onDidCreate(handleProjectInputChanged);
  watcher.onDidChange(handleProjectInputChanged);
  watcher.onDidDelete(handleProjectInputChanged);
  return watcher;
}

function handleProjectInputChanged() {
  invalidateParseCache();
  scheduleUpdateDecorations();
}

function invalidateParseCache() {
  parseCache.clear();
}

function scheduleUpdateDecorations() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(updateDecorations, 80);
}

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
  const showInactiveRegions = vscode.workspace
    .getConfiguration('cPreprocessorVisualizer')
    .get('showInactiveRegions', true);
  editor.setDecorations(
    inactiveDecoration,
    showInactiveRegions
      ? parsed.inactiveLines.map((line) => editor.document.lineAt(line).range)
      : []
  );
  editor.setDecorations(matchDecoration, findMatchingDirectiveRanges(editor, parsed.groups));
}

function getParsedDocument(document) {
  const cacheKey = document.uri.toString();
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath;
  const parseOptions = createParseOptionsForFile(document.fileName, workspaceFolder);
  const cached = parseCache.get(cacheKey);
  if (
    cached &&
    cached.version === document.version &&
    cached.signature === parseOptions.signature
  ) {
    return cached.parsed;
  }

  const parsed = parseDocument(document, parseOptions);
  parseCache.set(cacheKey, {
    version: document.version,
    signature: parseOptions.signature,
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
