import {
  addToQueue,
  isRestrictedUrl,
  isPremium,
  extpay,
  FREE_TAB_LIMIT,
} from './shared.js';

const addBtn = document.getElementById('addToQueueBtn');
const openBtn = document.getElementById('openQueueBtn');
const restrictedNote = document.getElementById('restrictedNote');
const limitNote = document.getElementById('limitNote');
const queueCountEl = document.getElementById('queueCount');

const premiumLocked = document.getElementById('premiumLocked');
const premiumActive = document.getElementById('premiumActive');
const buyBtn = document.getElementById('buyBtn');
const loginBtn = document.getElementById('loginBtn');

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

async function refreshPremiumUI() {
  const premium = await isPremium();
  premiumLocked.style.display = premium ? 'none' : 'block';
  premiumActive.style.display = premium ? 'block' : 'none';
}

buyBtn.addEventListener('click', () => {
  extpay().openPaymentPage();
});

loginBtn.addEventListener('click', () => {
  extpay().openLoginPage();
});

refreshQueueCount();
applyRestrictedState();
refreshPremiumUI();

addBtn.addEventListener('click', async () => {
  const tab = await activeTab();
  const result = await addToQueue({ title: tab.title, url: tab.url });
  refreshQueueCount();
  limitNote.style.display = 'none';

  if (result.added) {
    const original = addBtn.textContent;
    addBtn.textContent = 'Added!';
    setTimeout(() => {
      addBtn.textContent = original;
    }, 900);
  } else if (result.reason === 'limit') {
    limitNote.textContent = `Free tier is capped at ${FREE_TAB_LIMIT} saved tabs — upgrade for unlimited.`;
    limitNote.style.display = 'block';
  }
});

openBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('queue.html') });
});
