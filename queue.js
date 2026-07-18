import {
  SETTINGS_DEFAULTS,
  FREE_TAB_LIMIT,
  isPremium,
  extpay,
} from './shared.js';

const listEl = document.getElementById('queueList');
const emptyEl = document.getElementById('emptyState');
const nextBtn = document.getElementById('readNextBtn');
const sortOrderSelect = document.getElementById('sortOrder');
const removeOnOpenCheckbox = document.getElementById('removeOnOpen');
const countNote = document.getElementById('countNote');

const premiumLocked = document.getElementById('premiumLocked');
const premiumActive = document.getElementById('premiumActive');
const buyBtn = document.getElementById('buyBtn');
const loginBtn = document.getElementById('loginBtn');
const refreshStatusBtn = document.getElementById('refreshStatusBtn');

let premium = false;

function relativeTime(timestamp) {
  const diffSec = Math.round((Date.now() - timestamp) / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHour = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHour / 24);
  const diffWeek = Math.round(diffDay / 7);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return `${diffWeek}w ago`;
}

function truncate(text, max = 60) {
  return text.length > max ? text.slice(0, max) + '…' : text;
}

async function currentSettings() {
  return new Promise((resolve) => chrome.storage.local.get(SETTINGS_DEFAULTS, resolve));
}

function saveQueue(queue) {
  chrome.storage.local.set({ queue });
}

async function refreshPremiumUI() {
  premium = await isPremium();
  premiumLocked.style.display = premium ? 'none' : 'block';
  premiumActive.style.display = premium ? 'block' : 'none';
  sortOrderSelect.disabled = !premium;
  removeOnOpenCheckbox.disabled = !premium;
}

buyBtn.addEventListener('click', () => {
  extpay().openPaymentPage();
});

loginBtn.addEventListener('click', () => {
  extpay().openLoginPage();
});

refreshStatusBtn.addEventListener('click', async () => {
  refreshStatusBtn.disabled = true;
  refreshStatusBtn.textContent = 'Checking…';
  await refreshPremiumUI();
  refreshStatusBtn.disabled = false;
  refreshStatusBtn.textContent = 'Refresh status';
  load();
});

function ensureIds(queue) {
  let changed = false;
  const migrated = queue.map((item) => {
    if (item.id) return item;
    changed = true;
    return { ...item, id: crypto.randomUUID() };
  });
  return { migrated, changed };
}

function load() {
  chrome.storage.local.get({ queue: [] }, ({ queue }) => {
    const { migrated, changed } = ensureIds(queue);
    if (changed) saveQueue(migrated);
    render(migrated);
  });
}

function removeById(id, queue) {
  saveQueue(queue.filter((item) => item.id !== id));
  load();
}

async function render(queue) {
  const stored = await currentSettings();
  const settings = premium ? stored : SETTINGS_DEFAULTS;

  countNote.textContent = premium
    ? `${queue.length} saved (unlimited)`
    : `${queue.length} / ${FREE_TAB_LIMIT} saved on the free tier`;

  const displayOrder = settings.sortOrder === 'newest' ? [...queue].slice().reverse() : queue;

  listEl.innerHTML = '';

  if (displayOrder.length === 0) {
    emptyEl.style.display = 'block';
    nextBtn.disabled = true;
    nextBtn.textContent = 'Nothing queued';
    return;
  }

  emptyEl.style.display = 'none';
  nextBtn.disabled = false;
  nextBtn.textContent = `Read next: ${truncate(displayOrder[0].title, 50)}`;

  displayOrder.forEach((item, displayIndex) => {
    const row = document.createElement('div');
    row.className = 'row';

    const meta = document.createElement('div');
    meta.className = 'meta';

    const title = document.createElement('div');
    title.className = 'title';

    title.textContent = (displayIndex === 0 ? '▶ ' : '') + item.title;

    const url = document.createElement('div');
    url.className = 'url';
    url.textContent = item.url;

    const time = document.createElement('div');
    time.className = 'time';
    time.textContent = `added ${relativeTime(item.addedAt)}`;

    meta.appendChild(title);
    meta.appendChild(url);
    meta.appendChild(time);

    const actions = document.createElement('div');
    actions.className = 'actions';

    const openBtn = document.createElement('button');
    openBtn.className = 'small';
    openBtn.textContent = 'Open';
    openBtn.addEventListener('click', async () => {
      chrome.tabs.create({ url: item.url });
      if (settings.removeOnOpen) removeById(item.id, queue);
    });

    const removeBtn = document.createElement('button');
    removeBtn.className = 'small danger';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => removeById(item.id, queue));

    actions.appendChild(openBtn);
    actions.appendChild(removeBtn);

    row.appendChild(meta);
    row.appendChild(actions);
    listEl.appendChild(row);
  });
}

nextBtn.addEventListener('click', async () => {
  const stored = await currentSettings();
  const settings = premium ? stored : SETTINGS_DEFAULTS;
  chrome.storage.local.get({ queue: [] }, ({ queue }) => {
    if (queue.length === 0) return;
    const displayOrder = settings.sortOrder === 'newest' ? [...queue].slice().reverse() : queue;
    const next = displayOrder[0];
    chrome.tabs.create({ url: next.url });
    saveQueue(queue.filter((item) => item.id !== next.id));
    load();
  });
});

sortOrderSelect.addEventListener('change', () => {
  chrome.storage.local.set({ sortOrder: sortOrderSelect.value });
  load();
});

removeOnOpenCheckbox.addEventListener('change', () => {
  chrome.storage.local.set({ removeOnOpen: removeOnOpenCheckbox.checked });
});

(async () => {
  await refreshPremiumUI();
  const settings = await currentSettings();
  sortOrderSelect.value = settings.sortOrder;
  removeOnOpenCheckbox.checked = settings.removeOnOpen;
  load();
})();
