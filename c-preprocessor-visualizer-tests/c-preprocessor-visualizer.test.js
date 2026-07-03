const assert = require('assert');
const { parseDocument, findMatchingDirectiveLines, getDirectiveSpan } = require('../parser');

const C_PREPROCESSOR_SOURCE = `
#ifndef __C_PREPROCESSOR_VISUALIZER_SAMPLE_H_
#define __C_PREPROCESSOR_VISUALIZER_SAMPLE_H_

#define AAAAAAAAAA 1
#define FEATURE_X 1
#define FEATURE_Y 0
#define TARGET_LEVEL 2
#define USE_FAST_PATH 1
#define TEMP_SWITCH 1

#ifdef AAAAAAAAAA
int a = 0;
#else
int b = 0;
#endif

#if defined(FEATURE_X) && TARGET_LEVEL >= 2
int feature_x_level = 2;
  #ifdef USE_FAST_PATH
  int fast_path_enabled = 1;
  #else
  int slow_path_enabled = 1;
  #endif
#elif defined(FEATURE_Y)
int feature_y_fallback = 1;
#else
int no_feature_enabled = 1;
#endif

#ifndef DISABLE_LOGGING
int logging_enabled = 1;
  #if FEATURE_Y
  int verbose_logging = 1;
  #else
  int compact_logging = 1;
  #endif
#endif

#undef TEMP_SWITCH

#ifdef TEMP_SWITCH
int temp_switch_enabled = 1;
#else
int temp_switch_disabled = 1;
#endif

#if defined(UNKNOWN_MACRO) || defined(USE_FAST_PATH)
int known_or_fast = 1;
#else
int neither_known_nor_fast = 1;
#endif

#endif
`.trim();

function createDocument(text) {
  const lines = text.split(/\r?\n/);

  return {
    lineCount: lines.length,
    lineAt(line) {
      const text = lines[line];
      return {
        text,
        isEmptyOrWhitespace: text.trim().length === 0
      };
    }
  };
}

const document = createDocument(C_PREPROCESSOR_SOURCE);
const parsed = parseDocument(document);

function findLine(text, occurrence = 1) {
  let seen = 0;
  for (let line = 0; line < document.lineCount; line++) {
    if (document.lineAt(line).text.trim() === text) {
      seen += 1;
      if (seen === occurrence) {
        return line;
      }
    }
  }

  throw new Error(`Line not found: ${text}`);
}

assert.deepStrictEqual(
  parsed.inactiveLines,
  [
    findLine('int b = 0;'),
    findLine('int slow_path_enabled = 1;'),
    findLine('int feature_y_fallback = 1;'),
    findLine('int no_feature_enabled = 1;'),
    findLine('int verbose_logging = 1;'),
    findLine('int temp_switch_enabled = 1;'),
    findLine('int neither_known_nor_fast = 1;')
  ],
  'inactive C preprocessor branch bodies should be marked inactive'
);

assert.deepStrictEqual(
  findMatchingDirectiveLines(document, findLine('#ifdef AAAAAAAAAA'), parsed.groups),
  [
    findLine('#ifdef AAAAAAAAAA'),
    findLine('#else'),
    findLine('#endif')
  ],
  'cursor on #ifdef should highlight that #ifdef, its matching #else, and #endif'
);

assert.deepStrictEqual(
  findMatchingDirectiveLines(document, findLine('#else'), parsed.groups),
  [
    findLine('#ifdef AAAAAAAAAA'),
    findLine('#else'),
    findLine('#endif')
  ],
  'cursor on #else should highlight the matching #ifdef, #else, and #endif'
);

assert.deepStrictEqual(
  findMatchingDirectiveLines(document, findLine('#endif'), parsed.groups),
  [
    findLine('#ifdef AAAAAAAAAA'),
    findLine('#else'),
    findLine('#endif')
  ],
  'cursor on #endif for a branch with #else should highlight the matching #ifdef, #else, and #endif'
);

assert.deepStrictEqual(
  findMatchingDirectiveLines(document, findLine('#if defined(FEATURE_X) && TARGET_LEVEL >= 2'), parsed.groups),
  [
    findLine('#if defined(FEATURE_X) && TARGET_LEVEL >= 2'),
    findLine('#elif defined(FEATURE_Y)'),
    findLine('#else', 3),
    findLine('#endif', 3)
  ],
  'cursor on a #if with #elif should highlight #if, #elif, #else, and #endif'
);

assert.deepStrictEqual(
  findMatchingDirectiveLines(document, findLine('#elif defined(FEATURE_Y)'), parsed.groups),
  [
    findLine('#if defined(FEATURE_X) && TARGET_LEVEL >= 2'),
    findLine('#elif defined(FEATURE_Y)'),
    findLine('#else', 3),
    findLine('#endif', 3)
  ],
  'cursor on #elif should highlight the full branch directive set'
);

assert.deepStrictEqual(
  findMatchingDirectiveLines(document, findLine('#ifndef __C_PREPROCESSOR_VISUALIZER_SAMPLE_H_'), parsed.groups),
  [findLine('#ifndef __C_PREPROCESSOR_VISUALIZER_SAMPLE_H_'), document.lineCount - 1],
  'cursor on the outer #ifndef should highlight its matching #endif when there is no #else'
);

assert.deepStrictEqual(
  findMatchingDirectiveLines(document, document.lineCount - 1, parsed.groups),
  [findLine('#ifndef __C_PREPROCESSOR_VISUALIZER_SAMPLE_H_'), document.lineCount - 1],
  'cursor on the outer #endif should highlight the matching #ifndef when there is no #else'
);

assert.deepStrictEqual(
  getDirectiveSpan('#ifdef AAAAAAAAAA'),
  { start: 0, end: 6 },
  'only the #ifdef token should be highlighted, not the whole line'
);

assert.deepStrictEqual(
  getDirectiveSpan('    #   endif'),
  { start: 4, end: 13 },
  'directive spans should include the # and directive keyword with internal spacing'
);

console.log('C preprocessor visualizer tests passed');
