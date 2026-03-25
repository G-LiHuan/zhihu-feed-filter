// content.js

// ==================== Constants ====================

var DEFAULT_RULES = { enabled: true, blockAds: true, keywords: [] };

var AD_SELECTORS = [
  '[data-za-detail-view-name="FeedAdCard"]',
  '.ContentItem-Ad'
];

var AD_LABEL_TEXTS = ['赞助', '推广'];

var FEED_SELECTOR = '.ContentItem, .QuestionItem, [data-zop], .TopstoryItem';

// ==================== Runtime State ====================

var rules = { enabled: true, blockAds: true, keywords: [] };
var observer = null;

// ==================== Filter Functions ====================

function extractText(el) {
  var titleEl = el.querySelector('.ContentItem-title, .QuestionItem-title, h2');
  var excerptEl = el.querySelector('.ContentItem-excerpt, .RichText');
  var title = titleEl ? titleEl.textContent : '';
  var excerpt = excerptEl ? excerptEl.textContent : '';
  if (!title && !excerpt) return '';
  return (title + ' ' + excerpt).toLowerCase();
}

function shouldHideByKeyword(el, keywords) {
  if (!keywords || keywords.length === 0) return false;
  var text = extractText(el);
  return keywords.some(function(kw) {
    return text.indexOf(kw.toLowerCase()) !== -1;
  });
}

function shouldHideAd(el) {
  for (var i = 0; i < AD_SELECTORS.length; i++) {
    var sel = AD_SELECTORS[i];
    if (el.matches && el.matches(sel)) return true;
    if (el.querySelector(sel)) return true;
  }
  var spans = el.querySelectorAll('span, a, em');
  for (var j = 0; j < spans.length; j++) {
    if (AD_LABEL_TEXTS.indexOf(spans[j].textContent.trim()) !== -1) return true;
  }
  return false;
}

function shouldHide(el) {
  if (rules.blockAds && shouldHideAd(el)) return true;
  if (rules.keywords.length > 0 && shouldHideByKeyword(el, rules.keywords)) return true;
  return false;
}

// ==================== DOM Manipulation ====================

function processItem(el) {
  if (el.hasAttribute('data-zf-filtered')) return;
  if (shouldHide(el)) {
    el.style.display = 'none';
    el.setAttribute('data-zf-filtered', 'hidden');
  } else {
    el.setAttribute('data-zf-filtered', 'visible');
  }
}

function getFeedItems() {
  return document.querySelectorAll(FEED_SELECTOR);
}

function filterAll() {
  var items = getFeedItems();
  for (var i = 0; i < items.length; i++) {
    processItem(items[i]);
  }
}

function resetAndRefilter() {
  var marked = document.querySelectorAll('[data-zf-filtered]');
  for (var i = 0; i < marked.length; i++) {
    if (marked[i].getAttribute('data-zf-filtered') === 'hidden') {
      marked[i].style.display = '';
    }
    marked[i].removeAttribute('data-zf-filtered');
  }
  filterAll();
}

// ==================== Observer ====================

function startObserver() {
  var root = document.getElementById('root');
  if (!root) return;
  observer = new MutationObserver(function(mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var added = mutations[i].addedNodes;
      for (var j = 0; j < added.length; j++) {
        var node = added[j];
        if (node.nodeType !== 1) continue; // ELEMENT_NODE
        if (node.matches && node.matches(FEED_SELECTOR)) processItem(node);
        var descendants = node.querySelectorAll ? node.querySelectorAll(FEED_SELECTOR) : [];
        for (var k = 0; k < descendants.length; k++) {
          processItem(descendants[k]);
        }
      }
    }
  });
  observer.observe(root, { childList: true, subtree: true });
}

function stopObserver() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

// ==================== Enable / Disable ====================

function disable() {
  stopObserver();
  var hidden = document.querySelectorAll('[data-zf-filtered="hidden"]');
  for (var i = 0; i < hidden.length; i++) {
    hidden[i].style.display = '';
    hidden[i].removeAttribute('data-zf-filtered');
  }
  var visible = document.querySelectorAll('[data-zf-filtered="visible"]');
  for (var i = 0; i < visible.length; i++) {
    visible[i].removeAttribute('data-zf-filtered');
  }
}

function enable() {
  filterAll();
  startObserver();
}

// ==================== Init ====================

function initDefaults(stored) {
  var merged = Object.assign({}, DEFAULT_RULES, stored);
  if (Object.keys(stored).length === 0) {
    chrome.storage.sync.set(DEFAULT_RULES);
  }
  return merged;
}

// ==================== Startup ====================

chrome.storage.sync.get(null, function(stored) {
  rules = initDefaults(stored);
  if (rules.enabled) {
    filterAll();
    startObserver();
  }
});

// ==================== Message Listener ====================

chrome.runtime.onMessage.addListener(function(message) {
  if (message.type !== 'UPDATE_RULES') return;
  var prevEnabled = rules.enabled;
  rules = message.rules;
  if (!rules.enabled) {
    disable();
  } else if (!prevEnabled && rules.enabled) {
    enable();
  } else {
    resetAndRefilter();
  }
});

// ==================== Test Export ====================

if (typeof module !== 'undefined') {
  module.exports = {
    extractText: extractText,
    shouldHideByKeyword: shouldHideByKeyword,
    shouldHideAd: shouldHideAd,
    shouldHide: shouldHide,
    initDefaults: initDefaults
  };
}
