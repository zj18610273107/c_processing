const assert = require('assert');
const {
  collectCompletionCandidates,
  isLineInInactiveRegion,
  isMemberAccess
} = require('../completion');
const { parseDocument } = require('../parser');

function createDocument(text) {
  const lines = text.split(/\r?\n/);
  return {
    lineCount: lines.length,
    lineAt(line) {
      return {
        text: lines[line],
        isEmptyOrWhitespace: lines[line].trim().length === 0
      };
    }
  };
}

const source = `
#define ENABLE_BLOCK 0
#define FEATURE_NAME 1

struct log_context {
  int level;
  const char *message;
};

static int append_log(struct log_context *ctx);

#if ENABLE_BLOCK
static int disabled_code(struct log_context *ctx)
{
  ctx->
  return FEATURE_NAME;
}
#endif
`.trim();

const document = createDocument(source);
const parsed = parseDocument(document);

assert.ok(
  isLineInInactiveRegion(parsed.inactiveRegions, 12),
  'completion should only be enabled inside inactive regions'
);

assert.strictEqual(isMemberAccess('  ctx->', 7), true);
assert.strictEqual(isMemberAccess('  ctx', 5), false);

const labels = collectCompletionCandidates(document, { line: 14, character: 9 })
  .map((candidate) => candidate.label);
assert.ok(labels.includes('return'));
assert.ok(labels.includes('FEATURE_NAME'));
assert.ok(labels.includes('append_log'));
assert.ok(labels.includes('disabled_code'));

const memberLabels = collectCompletionCandidates(document, { line: 13, character: 7 })
  .map((candidate) => candidate.label);
assert.ok(memberLabels.includes('level'));
assert.ok(memberLabels.includes('message'));

console.log('completion tests passed');
