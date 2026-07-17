// Shared between popup.js, queue.js, and background.js, loaded as an ES
// module by all three. Same reasoning as Slate Focus's shared.js: one
// definition of "what does adding a tab actually mean" instead of three
// copies that could quietly drift apart.

export const SETTINGS_DEFAULTS = {
  sortOrder: 'oldest', // 'oldest' | 'newest'
  removeOnOpen: true,
};

// Free tier cap -- unlimited is a premium feature. Chosen generously enough
// that it doesn't cripple the free tool (you can genuinely use it for a
// while before hitting this), but real enough that a heavy user has a
// reason to pay.
export const FREE_TAB_LIMIT = 15;

// Same restricted-page list as Slate Focus. There's no shared file between
// the two separate extensions (they're meant to be sold independently), so
// this is intentionally duplicated rather than imported across extensions.
export function isRestrictedUrl(url) {
  if (!url) return true;
  return (
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('edge://') ||
    url.startsWith('about:') ||
    url.startsWith('https://chrome.google.com/webstore') ||
    url.startsWith('https://chromewebstore.google.com')
  );
}

// --- Licensing: ExtensionPay (extensionpay.com), no server of our own.
// ExtPay handles the Stripe checkout, the "paid?" check, and cross-device
// login itself -- no license key to copy-paste. REPLACE this placeholder
// once you've registered the extension at https://extensionpay.com -- a
// separate id from Slate Focus's, since these are sold as two independent
// extensions.
import ExtPay from './vendor/extpay.js';

export const EXTPAY_EXTENSION_ID = 'slate-stack';

// A fresh ExtPay(...) instance per call, not a shared singleton -- ExtPay's
// own docs recommend this for service-worker contexts, since Chrome can
// kill and restart the background service worker at any time. Cheap to
// construct: just a small object of closures, no network call.
export function extpay() {
  return ExtPay(EXTPAY_EXTENSION_ID);
}

export async function isPremium() {
  try {
    const user = await extpay().getUser();
    return !!user.paid;
  } catch (err) {
    // Network error talking to extensionpay.com -- fail closed (treat as
    // not-premium) rather than throwing and breaking free-tier saving.
    return false;
  }
}

// The one place that knows how to add something to the queue: used by the
// popup button, the keyboard shortcut, and both right-click context menu
// entries. Returns { added: true } on success, or { added: false, reason }
// so callers can decide what feedback (if any) makes sense -- silent for
// restricted/duplicate, but the free-tier cap is worth surfacing since
// it's the actual upsell moment.
export async function addToQueue({ title, url }) {
  if (isRestrictedUrl(url)) return { added: false, reason: 'restricted' };

  const { queue } = await new Promise((resolve) => chrome.storage.local.get({ queue: [] }, resolve));
  if (queue.some((item) => item.url === url)) return { added: false, reason: 'duplicate' };

  const premium = await isPremium();
  if (!premium && queue.length >= FREE_TAB_LIMIT) {
    return { added: false, reason: 'limit' };
  }

  const updated = [
    ...queue,
    { id: crypto.randomUUID(), title: title || url, url, addedAt: Date.now() },
  ];
  await new Promise((resolve) => chrome.storage.local.set({ queue: updated }, resolve));
  return { added: true };
}
