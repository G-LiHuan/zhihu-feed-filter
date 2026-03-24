# 知乎过滤插件设计文档

**日期：** 2026-03-24
**状态：** 已批准

---

## 概述

一个 Chrome 浏览器扩展，用于过滤知乎页面中的指定内容。支持关键词匹配和广告自动识别，命中的内容直接隐藏。用户通过 Popup 弹窗管理过滤规则。

---

## 架构

```
zhihu-filter/
├── manifest.json          # Chrome 扩展清单 (Manifest V3)
├── content.js             # 注入知乎页面的内容脚本
├── popup/
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
└── icons/
    └── icon.png
```

### 核心流程

1. **content.js** 在 `zhihu.com` 页面加载时启动，先异步读取 `chrome.storage.sync` 中的规则，加载完成后再启动 `MutationObserver` 监听 `#root`（知乎的 React 挂载点），并对当前已有的 feed items 执行一次全量过滤
2. 每次有新节点插入时，遍历新增的 feed items，命中规则则设置 `display: none` 并打上 `data-zf-filtered` 标记
3. **popup.js** 负责读写 `chrome.storage.sync` 中的规则，变更后通过 `chrome.tabs.sendMessage` 通知当前标签页的 content.js 执行全量重过滤；若发送失败（当前标签页非知乎页面）则忽略该错误
4. **chrome.storage.sync** 作为唯一数据源，确保规则在多设备间同步

---

## 过滤逻辑

### content.js 启动序列

1. 调用 `chrome.storage.sync.get` 异步读取规则（`enabled`、`blockAds`、`keywords`）
2. 存储读取完成后启动 `MutationObserver`
3. 对当前页面所有已有的 feed items 执行一次全量过滤
4. 此后每次 MutationObserver 回调时仅处理新增节点

**首次安装默认值**（存储为空时写入）：

```js
{ enabled: true, blockAds: true, keywords: [] }
```

### 已处理节点标记

使用 `data-zf-filtered` 属性标记已处理的节点（无论是否被隐藏），避免重复处理：

- `data-zf-filtered="hidden"` — 命中规则，已隐藏
- `data-zf-filtered="visible"` — 已检查，未命中

MutationObserver 回调中跳过已有 `data-zf-filtered` 属性的节点。

### 关键词匹配

- 对每个 feed item 提取标题 + 摘要文本
- 逐一检查是否包含任意关键词（大小写不敏感）
- 命中则设置 `display: none` 并标记 `data-zf-filtered="hidden"`

**关键词限制：** 最多 100 个关键词，每个不超过 100 个字符（防止超出 `chrome.storage.sync` 配额）。超出限制时 Popup 给出提示，拒绝添加。

### 广告自动识别

知乎广告/推广内容通过以下 CSS 选择器匹配（硬编码，用户无需配置）：

- `[data-za-detail-view-name="FeedAdCard"]` — 信息流广告卡片
- `.ContentItem-Ad` — 内容广告标记
- 包含"赞助"、"推广"文字的标签节点

> 注意：这些选择器与知乎的 DOM 结构绑定，知乎前端更新后可能失效，届时需发布新版本更新选择器。

### MutationObserver

```js
observer.observe(document.getElementById('root'), {
  childList: true,
  subtree: true
})
```

### 总开关行为

- `enabled` 切换为 `false` 时：断开 MutationObserver，遍历所有 `data-zf-filtered="hidden"` 的节点，恢复其 `display`，清除 `data-zf-filtered` 属性
- `enabled` 切换为 `true` 时：重新读取规则，重启 MutationObserver，对所有 feed items 执行全量过滤

### 全量重过滤（规则变更时）

当关键词增减或 `blockAds` 开关变化时，content.js 执行全量重过滤：

1. 遍历所有带 `data-zf-filtered` 属性的节点，恢复 `display` 并清除标记
2. 对当前页面所有 feed items 重新执行完整的过滤检查

---

## Popup 界面

### 功能

- 顶部：插件总开关（启用/禁用）
- 次顶部：广告自动过滤开关（默认开启）
- 中部：关键词列表，每条右侧有删除按钮
- 底部：输入框 + "添加"按钮（支持回车）

### 数据结构

存储在 `chrome.storage.sync`：

```js
{
  enabled: true,        // 插件总开关
  blockAds: true,       // 广告自动识别开关
  keywords: []          // 关键词列表（字符串数组，最多 100 条，每条最多 100 字符）
}
```

### 交互细节

- 规则变更后立即写入 `chrome.storage.sync`
- 通过 `chrome.tabs.sendMessage` 向当前标签页发送更新消息；若当前标签页非知乎页面导致发送失败，静默忽略该错误
- 超出关键词数量或长度限制时，输入框下方显示提示文字，拒绝添加
- Popup 宽度 320px，简洁单列布局

---

## 目标浏览器

Chrome / Chromium（Manifest V3）

---

## 不在范围内

- Firefox 支持
- 用户屏蔽（按用户名过滤）
- 质量阈值过滤（点赞数等）
- 内容折叠或模糊遮罩（仅支持直接隐藏）
