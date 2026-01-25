const STYLE_ID = "focuz-hide-youtube-feed";
let isEnabled = false;

function isHomePage() {
  return window.location.pathname === "/";
}

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = "#contents{display:none !important;}";
  document.documentElement.appendChild(style);
}

function removeStyle() {
  const style = document.getElementById(STYLE_ID);
  if (style) {
    style.remove();
  }
}

function applyState() {
  if (isEnabled && isHomePage()) {
    ensureStyle();
  } else {
    removeStyle();
  }
}

function refreshFromStorage() {
  chrome.storage.local.get({ blockYoutubeFeed: false }, (data) => {
    isEnabled = Boolean(data.blockYoutubeFeed);
    applyState();
  });
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes.blockYoutubeFeed) {
    return;
  }
  isEnabled = Boolean(changes.blockYoutubeFeed.newValue);
  applyState();
});

window.addEventListener("yt-navigate-finish", applyState);
window.addEventListener("popstate", applyState);

document.addEventListener("DOMContentLoaded", () => {
  refreshFromStorage();
  applyState();
});

refreshFromStorage();
