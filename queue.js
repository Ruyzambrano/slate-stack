// A real, standalone page inside the extension -- opened via
// chrome.tabs.create({ url: chrome.runtime.getURL('queue.html') }). Full
// page rather than the 300px popup, so it can show a list, settings, and
// licensing all in one place.
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

// --- Premium / licensing ---

async function refreshPremiumUI() {
  premium = await isPremium();
  premiumLocked.style.display = premium ? 'none' : 'block';
  premiumActive.style.display = premium ? 'block' : 'none';
  // Settings are gated the same honest way as Slate Focus: disabling them
  // isn't just cosmetic, changing them genuinely has no effect until
  // unlocked, since render() below always forces the free defaults when
  // not premium.
  sortOrderSelect.disabled = !premium;
  removeOnOpenCheckbox.disabled = !premium;
}

buyBtn.addEventListener('click', () => {
  extpay().openPaymentPage();
});

loginBtn.addEventListener('click', () => {
  extpay().openLoginPage();
});

// Unlike the popup (which naturally re-checks on every open), this is a
// regular tab that can stay open across the whole checkout flow -- so give
// it an explicit way to re-check paid status without needing a manual page
// reload after paying in the other tab.
refreshStatusBtn.addEventListener('click', async () => {
  refreshStatusBtn.disabled = true;
  refreshStatusBtn.textContent = 'Checking…';
  await refreshPremiumUI();
  refreshStatusBtn.disabled = false;
  refreshStatusBtn.textContent = 'Refresh status';
  load();
});

// Items saved before this update don't have an `id` field, since sorting
// and remove-on-open both need a stable identity that survives being
// reordered for display -- an array index alone isn't enough once "oldest
// first" and "newest first" can show the same item at different positions.
// Rather than lose or break old data, backfill an id the first time an
// old-format queue is loaded, and persist that back once.
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
  // Free tier always sees the default order/behavior, same reasoning as
  // Slate Focus's currentSettings() -- disabling the controls isn't
  // enough on its own if a stale/edited storage value could still apply.
  const settings = premium ? stored : SETTINGS_DEFAULTS;

  countNote.textContent = premium
    ? `${queue.length} saved (unlimited)`
    : `${queue.length} / ${FREE_TAB_LIMIT} saved on the free tier`;

  // The underlying array is always stored oldest-first (insertion order).
  // "Newest first" is purely a display-time reversal of a copy -- the
  // stored order never changes just because of how it's being viewed.
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
    // .textContent (not innerHTML) so a page title full of "<script>" or
    // similar can never be interpreted as real HTML.
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

// "Read next" always removes, regardless of the remove-on-open setting --
// that's the one thing that makes it a queue you work *through* rather
// than just a list you occasionally glance at. It opens whatever is
// currently first in the *displayed* order, so it respects sort order too.
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
