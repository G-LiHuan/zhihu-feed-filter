// tests/popup.test.js

// Set up a minimal DOM before loading popup.js
document.body.innerHTML = `
  <input type="checkbox" id="toggle-enabled">
  <input type="checkbox" id="toggle-ads">
  <div id="keyword-list"></div>
  <input type="text" id="keyword-input">
  <button id="add-btn"></button>
  <div id="keyword-error"></div>
`;

global.chrome = {
  storage: { sync: { get: jest.fn(), set: jest.fn() } },
  tabs: { query: jest.fn(), sendMessage: jest.fn() },
  runtime: { lastError: null }
};

const { validateKeyword } = require('../popup/popup.js');

describe('validateKeyword', () => {
  test('rejects empty string', () => {
    const result = validateKeyword('', []);
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  test('rejects whitespace-only string', () => {
    const result = validateKeyword('   ', []);
    expect(result.valid).toBe(false);
  });

  test('rejects keyword longer than 100 characters', () => {
    const long = 'a'.repeat(101);
    const result = validateKeyword(long, []);
    expect(result.valid).toBe(false);
  });

  test('accepts keyword of exactly 100 characters', () => {
    const exact = 'a'.repeat(100);
    const result = validateKeyword(exact, []);
    expect(result.valid).toBe(true);
  });

  test('rejects when keyword list is at 100-item capacity', () => {
    const existing = Array.from({ length: 100 }, (_, i) => `kw${i}`);
    const result = validateKeyword('new', existing);
    expect(result.valid).toBe(false);
  });

  test('accepts when keyword list has 99 items', () => {
    const existing = Array.from({ length: 99 }, (_, i) => `kw${i}`);
    const result = validateKeyword('new', existing);
    expect(result.valid).toBe(true);
  });

  test('rejects duplicate keyword', () => {
    const result = validateKeyword('广告', ['广告', '推广']);
    expect(result.valid).toBe(false);
  });

  test('accepts valid unique keyword', () => {
    const result = validateKeyword('营销', ['广告']);
    expect(result.valid).toBe(true);
    expect(result.value).toBe('营销');
  });

  test('trims whitespace and returns trimmed value', () => {
    const result = validateKeyword('  营销  ', []);
    expect(result.valid).toBe(true);
    expect(result.value).toBe('营销');
  });
});
