// Loaded as an ES module so it can import the shared logic instead of
// duplicating it -- the same addToQueue used here is also used by the
// keyboard shortcut and both context-menu entries in background.js.
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

// Same lesson as Slate Focus: don't let the button silently do nothing on
// a chrome:// page -- disable it and say why.
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

// Opens ExtensionPay's hosted checkout in a new tab. The popup closes as
// soon as that tab gets focus, so the next time it's opened,
// refreshPremiumUI() below re-checks paid status fresh from ExtensionPay's
// servers -- no manual "activate" step needed.
buyBtn.addEventListener('click', () => {
  extpay().openPaymentPage();
});

// For someone who already paid but is on a new browser/device/profile:
// ExtensionPay's own login page (email magic link), replacing the old
// "paste your license key" flow entirely.
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

  // Brief inline feedback so clicking doesn't feel like it did nothing --
  // stays silent for restricted/duplicate, but the free-tier cap is the
  // actual upsell moment, so that one gets a real message.
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
