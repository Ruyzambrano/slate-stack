export const SETTINGS_DEFAULTS = {
  sortOrder: 'oldest',
  removeOnOpen: true,
};

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

export async function addToQueue({ title, url }) {
  if (isRestrictedUrl(url)) return { added: false, reason: 'restricted' };

  const { queue } = await new Promise((resolve) => chrome.storage.local.get({ queue: [] }, resolve));
  if (queue.some((item) => item.url === url)) return { added: false, reason: 'duplicate' };

  const updated = [
    ...queue,
    { id: crypto.randomUUID(), title: title || url, url, addedAt: Date.now() },
  ];
  await new Promise((resolve) => chrome.storage.local.set({ queue: updated }, resolve));
  return { added: true };
}
