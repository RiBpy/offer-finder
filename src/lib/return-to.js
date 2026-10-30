// Remembers, for this browser tab, which offer list the visitor was on, so
// "back to offers" links return to that list (with its filters and scroll
// position) instead of the plain home page. sessionStorage can be blocked, so
// every access is guarded and the links fall back to "/".

const LIST_KEY = "of.returnTo"; // last list an offer was opened from: { href, label, scrollY }
const HOME_KEY = "of.homeHref"; // last home page URL, filters included
const RESTORE_KEY = "of.restoreScroll";

function read(key) {
  try {
    return JSON.parse(window.sessionStorage.getItem(key));
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export const RETURN_EVENT = "of-return-to";

export function rememberList(entry) {
  write(LIST_KEY, entry);
  if (entry.href === "/" || entry.href.startsWith("/?")) {
    write(HOME_KEY, entry.href);
    window.dispatchEvent(new Event(RETURN_EVENT));
  }
}

export function rememberedList() {
  return read(LIST_KEY);
}

export function rememberedHomeHref() {
  return read(HOME_KEY) || "/";
}

/** Called when a back link is followed: the list scrolls back to where it was. */
export function requestScrollRestore() {
  write(RESTORE_KEY, true);
}

/** The scroll position to restore on this list, once; null when not returning to it. */
export function takeScrollRestore(href) {
  if (!read(RESTORE_KEY)) return null;
  write(RESTORE_KEY, false);
  const entry = read(LIST_KEY);
  return entry?.href === href ? entry.scrollY ?? 0 : null;
}
