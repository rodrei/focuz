const RULESET_ID = "block_instagram";
const ALARM_NAME = "instagram_allow_until";
const BLOCKED_URL_PREFIX = "blockedUrl:";
const sessionStorage = chrome.storage.session ?? chrome.storage.local;

function setRulesetEnabled(enabled) {
  const update = enabled
    ? { enableRulesetIds: [RULESET_ID] }
    : { disableRulesetIds: [RULESET_ID] };

  chrome.declarativeNetRequest.updateEnabledRulesets(update);
}

function scheduleAllowUntil(untilMs) {
  chrome.alarms.create(ALARM_NAME, { when: untilMs });
  chrome.storage.local.set({ allowUntil: untilMs, lastExpiredAt: 0 });
}

function applyAllowanceState() {
  chrome.storage.local.get({ allowUntil: 0 }, (data) => {
    const now = Date.now();
    if (data.allowUntil && data.allowUntil > now) {
      setRulesetEnabled(false);
      chrome.alarms.create(ALARM_NAME, { when: data.allowUntil });
    } else {
      setRulesetEnabled(true);
      chrome.storage.local.set({ allowUntil: 0 });
    }
  });
}

function setBlockedUrl(tabId, url) {
  sessionStorage.set({ [`${BLOCKED_URL_PREFIX}${tabId}`]: url });
}

function getBlockedUrl(tabId, callback) {
  const key = `${BLOCKED_URL_PREFIX}${tabId}`;
  sessionStorage.get({ [key]: "" }, (data) => {
    callback(data[key] || "");
  });
}

chrome.runtime.onInstalled.addListener(() => {
  applyAllowanceState();
});

chrome.runtime.onStartup.addListener(() => {
  applyAllowanceState();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== ALARM_NAME) {
    return;
  }

  setRulesetEnabled(true);
  chrome.storage.local.set({ allowUntil: 0, lastExpiredAt: Date.now() });
  chrome.tabs.query(
    { url: ["*://*.instagram.com/*", "*://instagram.com/*"] },
    (tabs) => {
      tabs.forEach((tab) => {
        if (tab.id !== undefined) {
          chrome.tabs.reload(tab.id);
        }
      });
    }
  );
});

if (chrome.declarativeNetRequest.onRuleMatchedDebug) {
  chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
    if (info?.rule?.ruleId !== 1) {
      return;
    }

    const tabId = info.request?.tabId;
    if (typeof tabId !== "number" || tabId < 0) {
      return;
    }

    setBlockedUrl(tabId, info.request.url);
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "ALLOW_TEMP") {
    return;
  }

  const minutes = Number(message.minutes);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return;
  }

  const untilMs = Date.now() + minutes * 60 * 1000;
  setRulesetEnabled(false);
  scheduleAllowUntil(untilMs);

  const tabId = sender?.tab?.id;
  if (typeof tabId === "number") {
    getBlockedUrl(tabId, (redirectUrl) => {
      sendResponse({ ok: true, untilMs, redirectUrl });
    });
    return true;
  }

  sendResponse({ ok: true, untilMs });
});
