/**
 * Unit Tests — CSV utilities (utils/csv.js)
 * Covers: RFC-4180 parsing, quoted fields, escaped quotes, CRLF/BOM,
 * header normalization and safe serialization round-trips.
 */
const test = require('node:test');
const assert = require('node:assert');
const { parseCsv, rowsToObjects, toCsv, csvEscape } = require('../../backend/src/utils/csv');

test('parseCsv: simple rows with LF endings', () => {
  const rows = parseCsv('name,phone\nA,9876543210\nB,9123456780');
  assert.deepEqual(rows, [
    ['name', 'phone'],
    ['A', '9876543210'],
    ['B', '9123456780']
  ]);
});

test('parseCsv: CRLF line endings', () => {
  const rows = parseCsv('a,b\r\n1,2\r\n3,4\r\n');
  assert.deepEqual(rows, [['a', 'b'], ['1', '2'], ['3', '4']]);
});

test('parseCsv: quoted fields with commas and newlines', () => {
  const rows = parseCsv('name,notes\n"Sharma, Ananya","Line1\nLine2"');
  assert.deepEqual(rows, [['name', 'notes'], ['Sharma, Ananya', 'Line1\nLine2']]);
});

test('parseCsv: escaped double quotes', () => {
  const rows = parseCsv('v\n"he said ""hello"""');
  assert.deepEqual(rows, [['v'], ['he said "hello"']]);
});

test('parseCsv: strips UTF-8 BOM', () => {
  const rows = parseCsv('\uFEFFname\nAnanya');
  assert.deepEqual(rows, [['name'], ['Ananya']]);
});

test('parseCsv: drops empty trailing rows but keeps real empties', () => {
  const rows = parseCsv('a,b\n,\n1,2\n\n');
  assert.equal(rows.length, 2); // header + 1 real row (',' row kept as it is a real row shape)
});

test('rowsToObjects: normalizes headers and maps values', () => {
  const objs = rowsToObjects(parseCsv('Customer Name,Mobile-Number,Email\nAnanya,9876500001,a@x.com'));
  assert.equal(objs.length, 1);
  assert.equal(objs[0].customer_name, 'Ananya');
  assert.equal(objs[0].mobile_number, '9876500001');
  assert.equal(objs[0].email, 'a@x.com');
});

test('rowsToObjects: returns [] for header-only CSV', () => {
  assert.deepEqual(rowsToObjects(parseCsv('a,b')), []);
});

test('csvEscape: quotes only when needed', () => {
  assert.equal(csvEscape('plain'), 'plain');
  assert.equal(csvEscape('with,comma'), '"with,comma"');
  assert.equal(csvEscape('say "hi"'), '"say ""hi"""');
  assert.equal(csvEscape(null), '');
});

test('toCsv: round-trips through parseCsv', () => {
  const csv = toCsv(['name', 'phone'], [['Sharma, Ananya', '98765'], ['Ok', '12']]);
  const rows = parseCsv(csv);
  assert.deepEqual(rows, [['name', 'phone'], ['Sharma, Ananya', '98765'], ['Ok', '12']]);
});
