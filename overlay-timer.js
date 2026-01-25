const DEFAULT_BLOCKED_SITES = ["instagram.com"];
const OVERLAY_ID = "focuz-allow-overlay";

let overlayClosed = false;
let tickInterval = null;

function normalizeHost(host) {
  const trimmed = host.trim().toLowerCase();
  if (!trimmed) {
    return "";
  }
  return trimmed.replace(/^\*\./, "").replace(/^\./, "");
}

function resolveBlockedSite(host, blockedSites) {
  const normalizedHost = normalizeHost(host);
  if (!normalizedHost) {
    return "";
  }

  const candidates = blockedSites
    .map(normalizeHost)
    .filter(Boolean)
    .filter(
      (site) => normalizedHost === site || normalizedHost.endsWith(`.${site}`)
    );

  if (!candidates.length) {
    return "";
  }

  return candidates.sort((a, b) => b.length - a.length)[0];
}

function ensureOverlay() {
  let overlay = document.getElementById(OVERLAY_ID);
  if (overlay) {
    return overlay;
  }

  overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.innerHTML = `
    <div class="focuz-overlay__content">
      <span class="focuz-overlay__label">Time left</span>
      <span class="focuz-overlay__time" id="focuz-overlay-time">--</span>
      <button class="focuz-overlay__close" type="button" aria-label="Close">×</button>
    </div>
  `;

  const style = document.createElement("style");
  style.textContent = `
    #${OVERLAY_ID} {
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 2147483647;
      font-family: "Georgia", "Times New Roman", serif;
      color: #1b1b1b;
    }
    #${OVERLAY_ID} .focuz-overlay__content {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border: 2px solid #1b1b1b;
      background: #fffaf1;
      box-shadow: 4px 4px 0 #d35400;
      font-size: 13px;
    }
    #${OVERLAY_ID} .focuz-overlay__label {
      text-transform: uppercase;
      letter-spacing: 0.04em;
      font-size: 11px;
    }
    #${OVERLAY_ID} .focuz-overlay__time {
      font-weight: 600;
    }
    #${OVERLAY_ID} .focuz-overlay__close {
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: 16px;
      line-height: 1;
      padding: 0 2px;
      color: #1b1b1b;
    }
  `;

  document.documentElement.appendChild(style);
  document.body.appendChild(overlay);

  const closeButton = overlay.querySelector(".focuz-overlay__close");
  closeButton.addEventListener("click", () => {
    overlayClosed = true;
    removeOverlay();
  });

  return overlay;
}

function removeOverlay() {
  const overlay = document.getElementById(OVERLAY_ID);
  if (overlay) {
    overlay.remove();
  }
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
}

function formatMinutesLeft(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) {
    return `${seconds}s`;
  }
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

function updateOverlay(untilMs) {
  if (overlayClosed) {
    return;
  }

  if (!untilMs || untilMs <= Date.now()) {
    removeOverlay();
    return;
  }

  const overlay = ensureOverlay();
  const timeNode = overlay.querySelector("#focuz-overlay-time");
  timeNode.textContent = formatMinutesLeft(untilMs - Date.now());
}

function startCountdown(untilMs) {
  updateOverlay(untilMs);
  if (tickInterval) {
    clearInterval(tickInterval);
  }
  tickInterval = setInterval(() => {
    updateOverlay(untilMs);
  }, 1000);
}

function refreshOverlay() {
  const currentHost = normalizeHost(window.location.hostname);
  chrome.storage.local.get(
    { blockedSites: DEFAULT_BLOCKED_SITES, allowUntilByHost: {} },
    (data) => {
      const blockedSite = resolveBlockedSite(currentHost, data.blockedSites || []);
      if (!blockedSite) {
        removeOverlay();
        return;
      }

      const untilMs = data.allowUntilByHost?.[blockedSite] || 0;
      if (!untilMs || untilMs <= Date.now()) {
        removeOverlay();
        return;
      }

      startCountdown(untilMs);
    }
  );
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") {
    return;
  }
  if (changes.allowUntilByHost || changes.blockedSites) {
    refreshOverlay();
  }
});

window.addEventListener("pageshow", refreshOverlay);
refreshOverlay();
