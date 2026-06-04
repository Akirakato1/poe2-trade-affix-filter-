import assert from 'node:assert/strict';
import { test } from 'node:test';

import content from '../src/content.js';

const {
  BORDER_CLASSES,
  classForEvaluation,
  statusForEvaluation,
} = content;

test('statusForEvaluation returns none when no filter is configured', () => {
  assert.equal(statusForEvaluation({ hasFilter: false, parsed: true, passed: true }), 'none');
});

test('statusForEvaluation fails parsed rows with no explicit affixes while a filter is active', () => {
  assert.equal(statusForEvaluation({ hasFilter: true, parsed: false, passed: false }), 'fail');
});

test('classForEvaluation maps pass and fail states to extension-owned classes', () => {
  assert.equal(classForEvaluation('pass'), BORDER_CLASSES.pass);
  assert.equal(classForEvaluation('fail'), BORDER_CLASSES.fail);
  assert.equal(classForEvaluation('none'), '');
});
