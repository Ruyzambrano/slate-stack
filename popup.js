import { addToQueue, isRestrictedUrl } from './shared.js';

const addBtn = document.getElementById('addToQueueBtn');
const openBtn = document.getElementById('openQueueBtn');
const restrictedNote = document.getElementById('restrictedNote');
const queueCountEl = document.getElementById('queueCount');

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function refreshQueueCount() {
  chrome.storage.local.get({ queue: [] }, ({ queue }) => {
    queueCountEl.textContent = queue.length;
  });
}

async function applyRestrictedState() {
  const tab = await activeTab();
  const restricted = isRestrictedUrl(tab?.url);
  addBtn.disabled = restricted;
  restrictedNote.style.display = restricted ? 'block' : 'none';
}

refreshQueueCount();
applyRestrictedState();

addBtn.addEventListener('click', async () => {
  const tab = await activeTab();
  const result = await addToQueue({ title: tab.title, url: tab.url });
  refreshQueueCount();

  if (result.added) {
    const original = addBtn.textContent;
    addBtn.textContent = 'Added!';
    setTimeout(() => {
      addBtn.textContent = original;
    }, 900);
  }
});

openBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('queue.html') });
});
