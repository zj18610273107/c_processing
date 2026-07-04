const C_KEYWORDS = [
  'auto',
  'break',
  'case',
  'char',
  'const',
  'continue',
  'default',
  'do',
  'double',
  'else',
  'enum',
  'extern',
  'float',
  'for',
  'goto',
  'if',
  'inline',
  'int',
  'long',
  'register',
  'restrict',
  'return',
  'short',
  'signed',
  'sizeof',
  'static',
  'struct',
  'switch',
  'typedef',
  'union',
  'unsigned',
  'void',
  'volatile',
  'while',
  'NULL'
];

function collectCompletionCandidates(document, position) {
  const source = getDocumentText(document);
  const memberAccess = isMemberAccess(document.lineAt(position.line).text, position.character);
  const candidates = new Map();

  if (memberAccess) {
    for (const field of collectMemberNames(source)) {
      addCandidate(candidates, field, 'field');
    }
    return [...candidates.values()];
  }

  for (const keyword of C_KEYWORDS) {
    addCandidate(candidates, keyword, 'keyword');
  }

  for (const macro of collectMacroNames(source)) {
    addCandidate(candidates, macro, 'macro');
  }

  for (const fn of collectFunctionNames(source)) {
    addCandidate(candidates, fn, 'function');
  }

  for (const identifier of collectIdentifiers(source)) {
    addCandidate(candidates, identifier, 'identifier');
  }

  return [...candidates.values()];
}

function isLineInInactiveRegion(inactiveRegions, line) {
  return inactiveRegions.some(({ start, end }) => line >= start && line <= end);
}

function getDocumentText(document) {
  const lines = [];
  for (let line = 0; line < document.lineCount; line++) {
    lines.push(document.lineAt(line).text);
  }
  return lines.join('\n');
}

function collectMacroNames(source) {
  return [...source.matchAll(/^\s*#\s*define\s+([A-Za-z_]\w*)/gm)]
    .map((match) => match[1]);
}

function collectFunctionNames(source) {
  return [...source.matchAll(/\b([A-Za-z_]\w*)\s*\([^;{}#]*\)\s*(?:\{|;)/g)]
    .map((match) => match[1])
    .filter((name) => !C_KEYWORDS.includes(name));
}

function collectIdentifiers(source) {
  return [...source.matchAll(/\b[A-Za-z_]\w*\b/g)]
    .map((match) => match[0])
    .filter((name) => name.length > 1)
    .filter((name) => !C_KEYWORDS.includes(name));
}

function collectMemberNames(source) {
  const fields = new Set();

  for (const match of source.matchAll(/\b(?:struct|union)\s+\w*\s*\{([\s\S]*?)\}\s*\w*\s*;/g)) {
    collectFieldsFromBlock(match[1], fields);
  }

  for (const match of source.matchAll(/(?:->|\.)\s*([A-Za-z_]\w*)/g)) {
    fields.add(match[1]);
  }

  return [...fields];
}

function collectFieldsFromBlock(block, fields) {
  for (const rawLine of block.split(/\r?\n/)) {
    const line = rawLine
      .replace(/\/\*.*?\*\//g, '')
      .replace(/\/\/.*$/, '')
      .trim();
    if (!line || !line.endsWith(';') || line.includes('(')) {
      continue;
    }

    const declaration = line.slice(0, -1);
    for (const part of declaration.split(',')) {
      const match = part.trim().match(/(?:\*|\s)([A-Za-z_]\w*)(?:\s*\[[^\]]*\])?$/);
      if (match) {
        fields.add(match[1]);
      }
    }
  }
}

function isMemberAccess(lineText, character) {
  const prefix = lineText.slice(0, character);
  return /(?:->|\.)\s*(?:[A-Za-z_]\w*)?$/.test(prefix);
}

function addCandidate(candidates, label, kind) {
  if (!label || candidates.has(label)) {
    return;
  }

  candidates.set(label, {
    label,
    kind
  });
}

module.exports = {
  collectCompletionCandidates,
  isLineInInactiveRegion,
  isMemberAccess
};
