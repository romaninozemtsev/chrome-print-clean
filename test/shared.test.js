const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeHost,
  isValidDomain,
  mergeSettings,
  buildHideCss,
  buildIsolateCss,
  buildHighlightCss,
  printableWidthPx,
  pageBoxCss,
} = require('../shared.js');

test('normalizeHost strips www and lowercases', () => {
  assert.equal(normalizeHost('www.United.com'), 'united.com');
  assert.equal(normalizeHost('mail.google.com'), 'mail.google.com');
  assert.equal(normalizeHost('  WWW.Example.COM  '), 'example.com');
});

test('isValidDomain accepts real domains', () => {
  assert.ok(isValidDomain('united.com'));
  assert.ok(isValidDomain('mail.google.com'));
  assert.ok(isValidDomain('a-b.co.uk'));
});

test('isValidDomain rejects malformed input', () => {
  assert.equal(isValidDomain('united'), false); // no dot
  assert.equal(isValidDomain('http://united.com'), false); // scheme
  assert.equal(isValidDomain('united .com'), false); // space
  assert.equal(isValidDomain('-united.com'), false); // leading hyphen
  assert.equal(isValidDomain('united.com/path'), false); // path
  assert.equal(isValidDomain(''), false);
});

test('mergeSettings lets user values win over defaults', () => {
  const defaults = { 'united.com': ['.a'], 'x.com': ['.def'] };
  const user = { 'x.com': ['.user'], 'y.com': ['.y'] };
  assert.deepEqual(mergeSettings(defaults, user), {
    'united.com': ['.a'],
    'x.com': ['.user'],
    'y.com': ['.y'],
  });
});

test('mergeSettings tolerates missing arguments', () => {
  assert.deepEqual(mergeSettings(null, null), {});
  assert.deepEqual(mergeSettings({ a: 1 }, undefined), { a: 1 });
});

test('buildHideCss emits print-hiding rules', () => {
  assert.equal(
    buildHideCss(['.a', '#b']),
    '.a { display: none !important; } #b { display: none !important; }'
  );
  assert.equal(buildHideCss([]), '');
  assert.equal(buildHideCss(undefined), '');
});

test('buildIsolateCss keeps only the given selectors', () => {
  assert.equal(
    buildIsolateCss(['.content']),
    'body *:not(:is(.content)):not(:is(.content) *):not(:has(:is(.content)))' +
      ' { display: none !important; }'
  );
  assert.equal(
    buildIsolateCss(['.a', '#b']),
    'body *:not(:is(.a, #b)):not(:is(.a, #b) *):not(:has(:is(.a, #b)))' +
      ' { display: none !important; }'
  );
  assert.equal(buildIsolateCss([]), '');
  assert.equal(buildIsolateCss(undefined), '');
});

test('buildHighlightCss emits forced-colour highlight rules', () => {
  const css = buildHighlightCss(['.a', '#b'], '#fff176');
  assert.match(css, /\.a \{ background-color: #fff176 !important;/);
  assert.match(css, /#b \{ background-color: #fff176 !important;/);
  assert.match(css, /print-color-adjust: exact !important;/);
  assert.equal(buildHighlightCss([]), '');
  assert.equal(buildHighlightCss(undefined), '');
});

test('buildHighlightCss falls back to the default colour', () => {
  assert.match(buildHighlightCss(['.a']), /background-color: #fff176 !important;/);
});

test('printableWidthPx shrinks with larger margins', () => {
  const a4Normal = printableWidthPx('A4', 'normal');
  const a4None = printableWidthPx('A4', 'none');
  const letterNormal = printableWidthPx('Letter', 'normal');
  assert.ok(a4None > a4Normal); // no margins => wider content area
  assert.ok(letterNormal > a4Normal); // Letter is wider than A4
  // A4 portrait at 14mm margins ~= 688px, matching the original frozen target.
  assert.equal(a4Normal, 688);
});

test('printableWidthPx defaults unknown values to A4/normal', () => {
  assert.equal(printableWidthPx('Foo', 'bar'), printableWidthPx('A4', 'normal'));
});

test('pageBoxCss maps paper size and margins to an @page rule', () => {
  assert.equal(pageBoxCss('A4', 'normal'), '@page { size: a4; margin: 14mm; }');
  assert.equal(
    pageBoxCss('Letter', 'narrow'),
    '@page { size: letter; margin: 6mm; }'
  );
  assert.equal(pageBoxCss('A4', 'none'), '@page { size: a4; margin: 0mm; }');
});
