const DEFAULT_BLOCKED_SITES = ["instagram.com"];
const ALARM_PREFIX = "allow_until:";
const BLOCKED_INFO_PREFIX = "blockedInfo:";
const sessionStorage = chrome.storage.session ?? chrome.storage.local;

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
      (site) =>
        normalizedHost === site || normalizedHost.endsWith(`.${site}`)
    );

  if (!candidates.length) {
    return normalizedHost;
  }

  return candidates.sort((a, b) => b.length - a.length)[0];
}

function ruleIdForHost(host) {
  let hash = 0;
  for (let i = 0; i < host.length; i += 1) {
    hash = (hash * 31 + host.charCodeAt(i)) >>> 0;
  }
  return (hash % 2147483646) + 1;
}

function buildRule(host) {
  return {
    id: ruleIdForHost(host),
    priority: 1,
    action: {
      type: "redirect",
      redirect: {
        extensionPath: "/blocked.html",
      },
    },
    condition: {
      urlFilter: `||${host}/`,
      resourceTypes: ["main_frame"],
    },
  };
}

function urlMatchesHost(url, host) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === host || parsed.hostname.endsWith(`.${host}`);
  } catch (error) {
    return false;
  }
}

function setBlockedInfo(tabId, info) {
  sessionStorage.set({ [`${BLOCKED_INFO_PREFIX}${tabId}`]: info });
}

function getBlockedInfo(tabId, callback) {
  const key = `${BLOCKED_INFO_PREFIX}${tabId}`;
  sessionStorage.get({ [key]: null }, (data) => {
    callback(data[key] || null);
  });
}

function ensureDefaults(callback) {
  chrome.storage.local.get({ blockedSites: null }, (data) => {
    if (!data.blockedSites) {
      chrome.storage.local.set({ blockedSites: DEFAULT_BLOCKED_SITES }, () =>
        callback()
      );
      return;
    }
    callback();
  });
}

function applyDynamicRules(onApplied) {
  chrome.storage.local.get(
    {
      blockedSites: DEFAULT_BLOCKED_SITES,
      allowUntilByHost: {},
    },
    (data) => {
      const now = Date.now();
      const allowUntilByHost = { ...data.allowUntilByHost };
      const activeHosts = data.blockedSites
        .map(normalizeHost)
        .filter(Boolean)
        .filter((host) => !(allowUntilByHost[host] && allowUntilByHost[host] > now));

      Object.entries(allowUntilByHost).forEach(([host, until]) => {
        if (until <= now) {
          delete allowUntilByHost[host];
        } else {
          chrome.alarms.create(`${ALARM_PREFIX}${host}`, { when: until });
        }
      });

      chrome.storage.local.set({ allowUntilByHost });

      chrome.declarativeNetRequest.getDynamicRules((existing) => {
        const removeRuleIds = existing.map((rule) => rule.id);
        const addRules = activeHosts.map(buildRule);
        chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds,
          addRules,
        }, () => {
          if (typeof onApplied === "function") {
            onApplied();
          }
        });
      });
    }
  );
}

function handleAlarmForHost(host) {
  chrome.storage.local.get(
    {
      blockedSites: DEFAULT_BLOCKED_SITES,
      allowUntilByHost: {},
      lastExpiredAtByHost: {},
    },
    (data) => {
      const allowUntilByHost = { ...data.allowUntilByHost };
      const lastExpiredAtByHost = { ...data.lastExpiredAtByHost };
      delete allowUntilByHost[host];
      lastExpiredAtByHost[host] = Date.now();

      chrome.storage.local.set(
        { allowUntilByHost, lastExpiredAtByHost },
        () => {
          applyDynamicRules(() => {
            chrome.tabs.query({}, (tabs) => {
              tabs.forEach((tab) => {
                if (!tab.id || !tab.url) {
                  return;
                }
                if (urlMatchesHost(tab.url, host)) {
                  chrome.tabs.reload(tab.id);
                }
              });
            });
          });
        }
      );
    }
  );
}

chrome.runtime.onInstalled.addListener(() => {
  ensureDefaults(applyDynamicRules);
});

chrome.runtime.onStartup.addListener(() => {
  ensureDefaults(applyDynamicRules);
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") {
    return;
  }
  if (changes.blockedSites) {
    applyDynamicRules();
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (!alarm.name.startsWith(ALARM_PREFIX)) {
    return;
  }

  const host = alarm.name.slice(ALARM_PREFIX.length);
  if (!host) {
    return;
  }

  handleAlarmForHost(host);
});

if (chrome.declarativeNetRequest.onRuleMatchedDebug) {
  chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
    const tabId = info.request?.tabId;
    const url = info.request?.url;
    if (typeof tabId !== "number" || tabId < 0 || !url) {
      return;
    }

    let host = "";
    try {
      host = new URL(url).hostname;
    } catch (error) {
      host = "";
    }

    chrome.storage.local.get(
      { blockedSites: DEFAULT_BLOCKED_SITES },
      (data) => {
        const blockedSite = resolveBlockedSite(host, data.blockedSites || []);
        setBlockedInfo(tabId, { url, host: blockedSite });
      }
    );
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "GET_CONTEXT") {
    const tabId = sender?.tab?.id;
    if (typeof tabId !== "number") {
      sendResponse({ blockedUrl: "", host: "", timeup: false });
      return;
    }

    getBlockedInfo(tabId, (info) => {
      const host = normalizeHost(info?.host || "");
      chrome.storage.local.get({ lastExpiredAtByHost: {} }, (data) => {
        const lastExpiredAtByHost = { ...data.lastExpiredAtByHost };
        const timeup = Boolean(host && lastExpiredAtByHost[host]);
        if (timeup) {
          delete lastExpiredAtByHost[host];
          chrome.storage.local.set({ lastExpiredAtByHost });
        }
        sendResponse({
          blockedUrl: info?.url || "",
          host,
          timeup,
        });
      });
    });

    return true;
  }

  if (message?.type !== "ALLOW_TEMP") {
    return;
  }

  const minutes = Number(message.minutes);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return;
  }

  const tabId = sender?.tab?.id;
  if (typeof tabId !== "number") {
    return;
  }

  getBlockedInfo(tabId, (info) => {
    const host = normalizeHost(info?.host || "");
    if (!host) {
      sendResponse({ ok: false });
      return;
    }

    const untilMs = Date.now() + minutes * 60 * 1000;
    chrome.storage.local.get(
      { allowUntilByHost: {}, lastExpiredAtByHost: {} },
      (data) => {
        const allowUntilByHost = { ...data.allowUntilByHost };
        allowUntilByHost[host] = untilMs;
        chrome.storage.local.set({ allowUntilByHost }, () => {
          chrome.alarms.create(`${ALARM_PREFIX}${host}`, { when: untilMs });
          applyDynamicRules(() => {
            sendResponse({ ok: true, untilMs, redirectUrl: info?.url || "" });
          });
        });
      }
    );
  });

  return true;
});
