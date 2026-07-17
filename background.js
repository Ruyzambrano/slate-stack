// A background service worker: runs even when nothing is open, which is
// what makes the keyboard shortcut, the right-click menu, and a
// continuously-correct badge count all possible. None of this could live
// in popup.js, which only exists while the popup window is open.

import { addToQueue, extpay } from './shared.js';

// Required once, at the top level of the background script -- ExtPay uses
// this to listen for its own internal messages. Must not be called from
// inside a callback (per ExtPay's own docs), since it should only ever run
// once per service worker wake.
extpay().startBackground();

// --- Badge: always reflect how many tabs are queued, no matter which
// surface (popup, queue page, shortcut, context menu) changed the queue.
// Listening for the storage change itself, rather than calling a
// "refresh the badge" function from every place that can modify the
// queue, means there's exactly one thing responsible for keeping the
// badge correct -- it can't drift out of sync by someone forgetting to
// call it from a fourth place later. ---

async function refreshBadge() {
  const { queue } = await new Promise((resolve) => chrome.storage.local.get({ queue: [] }, resolve));
  const count = queue.length;
  chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
  chrome.action.setBadgeBackgroundColor({ color: '#2d6a4f' });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.queue) refreshBadge();
});

// Service workers are ephemeral -- they can be killed and restarted by
// Chrome at any time, so the badge also needs setting explicitly on
// install/update and on browser startup, not just on the next change.
chrome.runtime.onStartup.addListener(refreshBadge);

chrome.runtime.onInstalled.addListener(() => {
  refreshBadge();

  // Context menu items are registered once here, not on every service
  // worker wake -- creating the same id twice throws a "duplicate id"
  // error. onInstalled fires with reason "update" when you reload an
  // unpacked extension, so this still runs whenever the extension changes.
  chrome.contextMenus.create({
    id: 'slate-stack-add-page',
    title: 'Send this page to Slate Stack',
    contexts: ['page'],
  });
  chrome.contextMenus.create({
    id: 'slate-stack-add-link',
    title: 'Send link to Slate Stack',
    contexts: ['link'],
  });
});

// --- Keyboard shortcuts ---
// Triggering a command shortcut counts as "invoking the extension," same
// as clicking the toolbar icon -- still covered by activeTab, no broader
// permission needed for either of these.

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'add-to-slate-stack') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return;
    await addToQueue({ title: tab.title, url: tab.url });
    return;
  }

  if (command === 'open-slate-stack') {
    chrome.tabs.create({ url: chrome.runtime.getURL('queue.html') });
  }
});

// --- Right-click menu ---
// Right-clicking a link satisfies both "page" and "link" contexts at once,
// so both items can appear together there -- that's expected, not a bug:
// it lets you choose to queue the page you're on, or specifically the link.

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'slate-stack-add-page') {
    if (!tab?.url) return;
    await addToQueue({ title: tab.title, url: tab.url });
  } else if (info.menuItemId === 'slate-stack-add-link') {
    if (!info.linkUrl) return;
    // selectionText is only present if the user had also highlighted the
    // link's visible text -- fall back to the raw URL otherwise, same
    // fallback pattern used everywhere else a title might be missing.
    await addToQueue({ title: info.selectionText || info.linkUrl, url: info.linkUrl });
  }
});
