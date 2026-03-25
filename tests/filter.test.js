// tests/filter.test.js

// Mock chrome API before requiring content.js
global.chrome = {
  storage: { sync: { get: jest.fn((keys, cb) => cb({})), set: jest.fn() } },
  runtime: { onMessage: { addListener: jest.fn() }, lastError: null }
};

const { shouldHideByKeyword, extractText } = require('../content.js');

function makeEl(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.firstElementChild;
}

describe('extractText', () => {
  test('extracts title text', () => {
    const el = makeEl('<div><div class="ContentItem-title">这是标题</div></div>');
    expect(extractText(el)).toContain('这是标题');
  });

  test('extracts excerpt text', () => {
    const el = makeEl('<div><div class="ContentItem-excerpt">这是摘要</div></div>');
    expect(extractText(el)).toContain('这是摘要');
  });

  test('returns empty string when no text elements found', () => {
    const el = makeEl('<div><span>其他内容</span></div>');
    expect(extractText(el)).toBe('');
  });
});

describe('shouldHideByKeyword', () => {
  test('returns false when keywords array is empty', () => {
    const el = makeEl('<div><div class="ContentItem-title">正常内容</div></div>');
    expect(shouldHideByKeyword(el, [])).toBe(false);
  });

  test('returns true when title contains a keyword', () => {
    const el = makeEl('<div><div class="ContentItem-title">营销推广内容</div></div>');
    expect(shouldHideByKeyword(el, ['营销'])).toBe(true);
  });

  test('returns true when excerpt contains a keyword', () => {
    const el = makeEl('<div><div class="ContentItem-excerpt">这是广告文案</div></div>');
    expect(shouldHideByKeyword(el, ['广告'])).toBe(true);
  });

  test('is case-insensitive for latin characters', () => {
    const el = makeEl('<div><div class="ContentItem-title">Hello World</div></div>');
    expect(shouldHideByKeyword(el, ['hello'])).toBe(true);
  });

  test('returns false when no keyword matches', () => {
    const el = makeEl('<div><div class="ContentItem-title">正常问题标题</div></div>');
    expect(shouldHideByKeyword(el, ['广告', '推广', '营销'])).toBe(false);
  });

  test('returns true if any one keyword matches (OR logic)', () => {
    const el = makeEl('<div><div class="ContentItem-title">推广活动介绍</div></div>');
    expect(shouldHideByKeyword(el, ['广告', '推广'])).toBe(true);
  });
});
