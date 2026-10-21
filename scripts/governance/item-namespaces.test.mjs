// B-11746: the protocol gates see every family namespace, through one shared list.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ITEM_PREFIXES, ITEM_PREFIX_SRC } from './item-namespaces.mjs';
import { itemIds } from './descent-gate.mjs';
import { ITEM_RE } from './undeclared-descent.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MEMBER_IDS = ['T-035', 'LS-047', 'PULSE-331', 'QHI-040', 'QCI-024'];
const KERNEL_IDS = ['B-123', 'BL-491', 'FLT-1708', 'TA-12', 'WVR-10'];

test('AC1: descent-gate reads every member and kernel id from a subject', () => {
  for (const id of [...MEMBER_IDS, ...KERNEL_IDS]) assert.deepEqual(itemIds(`fix(${id}): x`), [id], id);
});

test('AC2: undeclared-descent reads a subject-leading id in every namespace, BL included', () => {
  for (const id of [...MEMBER_IDS, ...KERNEL_IDS]) assert.equal((ITEM_RE.exec(`${id}: x`) || [])[1], id, id);
});

test('AC3: no gate keeps a private prefix group; all four import the shared list', () => {
  const files = ['descent-gate.mjs', 'undeclared-descent.mjs', 'reconciliation-gate.mjs', '../state/handoff-derive.mjs'];
  for (const f of files) {
    const src = fs.readFileSync(path.join(HERE, f), 'utf8');
    assert.match(src, /import \{ ITEM_PREFIX_SRC \} from '[./]+(governance\/)?item-namespaces\.mjs'/, f);
    assert.doesNotMatch(src, /\(\?:B\|BL|\(\?:FLT\|BL\|B\)|\(B-\\d\+\)/, `${f} still hardcodes a prefix group`);
  }
});

test('AC4: id-shaped tokens that are not items stay invisible', () => {
  for (const s of ['P-256 curve', 'SHA-256 digest', 'UTF-8 text', 'ISO-8601 date', 'NS-12 note']) {
    assert.deepEqual(itemIds(s), [], s);
    assert.equal(ITEM_RE.exec(s), null, s);
  }
});

test('the alternation tries longer prefixes first, so BL-490 is not read as B plus a dangling L', () => {
  assert.deepEqual(itemIds('BL-490'), ['BL-490']);
  assert.ok(ITEM_PREFIX_SRC.indexOf('PULSE') < ITEM_PREFIX_SRC.indexOf('|T|') || !ITEM_PREFIX_SRC.includes('|T|'));
  assert.equal(new Set(ITEM_PREFIXES).size, ITEM_PREFIXES.length, 'no duplicate prefix');
});
