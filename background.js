import { addToQueue, extpay } from './shared.js';

extpay().startBackground();

async function refreshBadge() {
  const { queue } = await new Promise((resolve) => chrome.storage.local.get({ queue: [] }, resolve));
  const count = queue.length;
  chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
  chrome.action.setBadgeBackgroundColor({ color: '#2d6a4f' });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.queue) refreshBadge();
});

chrome.runtime.onStartup.addListener(refreshBadge);

chrome.runtime.onInstalled.addListener(() => {
  refreshBadge();

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


chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'slate-stack-add-page') {
    if (!tab?.url) return;
    await addToQueue({ title: tab.title, url: tab.url });
  } else if (info.menuItemId === 'slate-stack-add-link') {
    if (!info.linkUrl) return;
    await addToQueue({ title: info.selectionText || info.linkUrl, url: info.linkUrl });
  }
});
