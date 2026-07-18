# Slate Stack

A standalone Chrome extension: send open tabs into a simple queue, then read them one at a time. This started as half of a combined "Readrail" learning build, split out into its own extension because the problem it solves (too many open tabs, context-switching) is genuinely distinct from the readability problem the other half solves — different audience, different pitch, meant to be sold separately rather than bundled.

## Try it (2 minutes)

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**, select this `read-later` folder.
4. Open a few articles, add them via the toolbar popup, a right-click, or the keyboard shortcut, then click the toolbar icon and "Open Slate Stack."

## What's in here

- `manifest.json` — permissions: `activeTab`, `storage`, `contextMenus`. Still no `"scripting"` or `"tabs"` — this extension never touches page content and never reads tabs it wasn't directly interacted with; it only reads its own stored data and opens tabs, neither of which needs broader access. Also declares a background service worker and one keyboard `command`.
- `shared.js` — settings defaults, the restricted-page check, and `addToQueue()`, the one definition of "add this to the list" used by the popup button, the keyboard shortcut, and both context-menu entries.
- `popup.html` / `popup.js` — "Add this tab to Slate Stack" and "Open Slate Stack" buttons, disabled with an explanation on pages the extension can't touch.
- `queue.html` / `queue.js` — the full-page list view: sort order, remove-on-open setting, relative timestamps, and the "Read next" button. (Internal filenames still say "queue" — implementation detail, invisible to anyone using the extension.)
- `background.js` — a service worker handling the keyboard shortcut, the right-click menu, and keeping the toolbar badge count correct at all times.

## How it works

The list is a plain array of `{ id, title, url, addedAt }` objects stored under one key in `chrome.storage.local` (on-device only, no account, no sync). `addToQueue()` in `shared.js` appends to it, skipping duplicates and restricted pages. The list page opens via `chrome.tabs.create({ url: chrome.runtime.getURL('queue.html') })` — a real tab, addressed via `chrome-extension://` instead of `https://`.

**Why every item now has an `id`.** Originally items were just removed by array position (`queue.filter((_, i) => i !== index)`), which was fine when the list only ever displayed in one fixed order. Once "newest first" became an option, the position shown on screen stops matching the position in the underlying stored array — so removing "the 3rd item you see" is not the same as removing "the 3rd item stored." Giving every item a stable `id` at creation time (via `crypto.randomUUID()`) means every action — open, remove, read next — can say "this exact item" regardless of how it's currently being displayed.

**Migrating data that predates this change.** Anything queued before this update was saved without an `id`. Rather than silently break (or lose) that data, `queue.js` checks for missing ids every time it loads the list, backfills them, and saves the result once — a small, one-time migration rather than a hard requirement that you clear your list to keep using it. Worth remembering as a general pattern: adding a new required field to something already saved in `chrome.storage.local` means writing a migration path, not just assuming new-shaped data everywhere.

**Sort order.** The stored array is always oldest-first (insertion order) — "newest first" is purely a reversed *copy* made at display and read-time; the actual stored order never changes just because of how it's currently being viewed. "Read next" always acts on whatever is first in the *displayed* order, so it stays consistent with whichever sort mode is selected.

**Remove-on-open.** "Open" (per-row) only removes the item if that setting is on; "Read next" always removes, regardless of the setting — that distinction is deliberate. "Open" is a peek, "Read next" is the defining action of working through a queue.

**Relative timestamps** ("added 3d ago") are computed from the `addedAt` field that was already being stored but not displayed — a small addition, not new data.

One thing worth noticing throughout: rendering still uses `.textContent`, never `.innerHTML`, for saved titles/URLs — a page's `<title>` is attacker-controllable text, so writing it in as text rather than markup is what stops it from ever being interpreted as real HTML.

## Keyboard shortcuts, badge, and right-click menu

These all needed the same thing: code that runs even when the popup isn't open, which is what `background.js` is for.

**Keyboard shortcuts** — two separate `commands`, each doing exactly one thing rather than one shortcut trying to be context-sensitive: `Ctrl/Cmd+Shift+S` (suggested) adds the current tab, same as the popup button; `Ctrl/Cmd+Shift+O` (suggested) opens the Slate Stack list, same as the popup's "Open" button. Both changeable at `chrome://extensions/shortcuts`. As with Slate Focus, the popup doesn't assert either suggested key is definitely live — Chrome only auto-assigns a suggested binding if nothing else on the machine already claimed that combination, so `chrome.commands.onCommand` just checks which command name fired and branches accordingly, with no assumption about which keys actually triggered it.

**Toolbar badge** shows how many tabs are currently queued. Rather than calling a "please update the badge" function from the popup, the queue page, the shortcut handler, and the context menu handler separately (four places to remember, four places to get out of sync), `background.js` listens for `chrome.storage.onChanged` on the `queue` key and updates the badge whenever it changes, from *any* source. It also sets the badge on `chrome.runtime.onStartup` and `onInstalled`, since service workers are ephemeral and can be killed and restarted by Chrome at any time — without that, the badge could show stale or blank state until the next actual queue change.

**Right-click menu** adds two entries via `chrome.contextMenus`: "Send this page to Slate Stack" (contexts: `page`) and "Send link to Slate Stack" (contexts: `link`) — the second lets you queue a link you see while browsing without navigating to it first, something the toolbar button can't do at all. Right-clicking directly on a link satisfies both contexts at once, so both items can appear together; that's expected, not a bug. Both are registered once in `chrome.runtime.onInstalled`, not on every service worker wake, since re-registering the same menu id throws a "duplicate id" error.

## Free vs. Premium

Saving and reading tabs is free up to a point: the free tier caps the list at `FREE_TAB_LIMIT` (15) saved tabs, and locks sort order to oldest-first with remove-on-open always on. Premium removes the cap entirely and unlocks the sort-order and remove-on-open controls. `addToQueue()` in `shared.js` returns `{ added: false, reason: 'limit' }` instead of just `false` once the cap is hit while on the free tier — a richer result than before, so the popup can show a specific "upgrade for unlimited" message instead of silently doing nothing. `queue.js` and `popup.js` both compute `const settings = premium ? stored : SETTINGS_DEFAULTS;` before using sort order or remove-on-open, the same "don't trust disabled inputs alone" reasoning as Slate Focus — even manually-edited storage can't fake unlocked settings.

**Licensing runs through ExtensionPay (extensionpay.com), no server of ours.** This replaced an earlier Gumroad-based design that required customers to copy-paste a license key — real friction for a $5 impulse buy. ExtensionPay is a service purpose-built for browser extension payments via Stripe, with no key to type. `shared.js` vendors the client library at `vendor/extpay.js` (committed directly, since Chrome Web Store policy forbids loading remotely-hosted code) and exports `extpay()`, which returns a fresh `ExtPay(EXTPAY_EXTENSION_ID)` instance. `buyBtn` calls `extpay().openPaymentPage()`, opening Stripe Checkout in a new tab; `isPremium()` calls `extpay().getUser()`, which asks ExtensionPay's servers for real-time paid status. No manual "activate" step — the popup and the full `queue.html` page both re-check on load.

**One placeholder needs replacing before this can actually sell anything:** `EXTPAY_EXTENSION_ID` at the top of `shared.js`, currently `REPLACE_WITH_SLATE_STACK_EXTPAY_ID`, separate from Slate Focus's own id since these are sold as two independent extensions. It becomes real once you register this extension at [extensionpay.com](https://extensionpay.com) and connect Stripe.

**Cross-device/browser, handled properly.** This was the direct problem with the Gumroad approach: `chrome.storage.sync` only reaches devices signed into the same Chrome account, not a different browser vendor or a signed-out profile. ExtensionPay sidesteps this entirely — paid status is tied to an email login on their servers (`extpay().openLoginPage()`, wired to "Already paid? Log in"), working identically across Chrome, Edge, Brave, or Firefox.

**No "Deactivate" button anymore.** That was a Gumroad-era testing convenience for toggling a local flag; ExtensionPay's paid status is a live read from their servers, not a local flag to clear. For your own testing, use a Stripe test-mode account and [Stripe's test cards](https://docs.stripe.com/testing). Since `queue.html` is a regular tab that can stay open across the whole checkout flow (unlike the popup, which naturally re-checks every time it's reopened), it also has an explicit "Refresh status" button for re-checking paid status without a full page reload.

## Going deeper

- [chrome.tabs API reference](https://developer.chrome.com/docs/extensions/reference/api/tabs)
- [chrome.storage API reference](https://developer.chrome.com/docs/extensions/reference/api/storage)
- [chrome.commands API reference](https://developer.chrome.com/docs/extensions/reference/api/commands)
- [chrome.contextMenus API reference](https://developer.chrome.com/docs/extensions/reference/api/contextMenus)
- [chrome.action API reference (badge)](https://developer.chrome.com/docs/extensions/reference/api/action)
- [ExtensionPay documentation](https://extensionpay.com/) / [ExtPay library source](https://github.com/Glench/ExtPay)

## Published

Live on the Chrome Web Store: https://chromewebstore.google.com/detail/gnbomomkdojpfpmkjehfpbpljhgcalfp

Homepage / privacy policy: https://ruyzambrano.github.io/slate-stack/

Not needed for personal use — `chrome://extensions` → Load unpacked is still a fully working install if you want to run from source. To publish an update: bump `"version"` in `manifest.json`, re-zip this folder's contents (`manifest.json` at the root of the zip, not nested in a folder), and upload it as a new package via the Chrome Web Store Developer Dashboard — this resubmits the item for the same review process as a first-time submission.

Icons are done (`icons/`, referenced from `manifest.json`) — regenerate anytime with `python3 icons/generate_icons.py` (requires Pillow). Promotional images (small tile, marquee) live in `marketing/`, generated by `marketing/generate_promo.py`.
