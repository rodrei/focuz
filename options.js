const siteInput = document.getElementById("site-input");
const addButton = document.getElementById("add-site");
const siteList = document.getElementById("site-list");
const status = document.getElementById("status");

const DEFAULT_BLOCKED_SITES = ["instagram.com"];

function setStatus(message) {
  status.textContent = message;
}

function normalizeSite(value) {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return "";
  }

  const withoutWildcards = trimmed.replace(/^\*\./, "").replace(/^\./, "");

  if (withoutWildcards.includes("://")) {
    try {
      return new URL(withoutWildcards).hostname;
    } catch (error) {
      return "";
    }
  }

  const stripped = withoutWildcards.split("/")[0].split("?")[0].split("#")[0];
  return stripped;
}

function renderSites(sites) {
  siteList.innerHTML = "";

  if (!sites.length) {
    const empty = document.createElement("li");
    empty.textContent = "No sites blocked.";
    siteList.appendChild(empty);
    return;
  }

  sites.forEach((site) => {
    const item = document.createElement("li");
    const label = document.createElement("span");
    label.className = "site-name";
    label.textContent = site;

    const removeButton = document.createElement("button");
    removeButton.className = "remove";
    removeButton.type = "button";
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", () => removeSite(site));

    item.appendChild(label);
    item.appendChild(removeButton);
    siteList.appendChild(item);
  });
}

function loadSites(callback) {
  chrome.storage.local.get({ blockedSites: DEFAULT_BLOCKED_SITES }, (data) => {
    const sites = (data.blockedSites || []).map((site) => normalizeSite(site));
    const uniqueSites = Array.from(new Set(sites)).filter(Boolean).sort();
    callback(uniqueSites);
  });
}

function saveSites(sites) {
  chrome.storage.local.set({ blockedSites: sites }, () => {
    renderSites(sites);
  });
}

function addSite() {
  const normalized = normalizeSite(siteInput.value);
  if (!normalized) {
    setStatus("Enter a valid site like example.com.");
    return;
  }

  loadSites((sites) => {
    if (sites.includes(normalized)) {
      setStatus("That site is already blocked.");
      return;
    }

    const nextSites = [...sites, normalized].sort();
    saveSites(nextSites);
    siteInput.value = "";
    setStatus("Site added.");
  });
}

function removeSite(site) {
  loadSites((sites) => {
    const nextSites = sites.filter((entry) => entry !== site);
    saveSites(nextSites);
    setStatus("Site removed.");
  });
}

addButton.addEventListener("click", addSite);
siteInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    addSite();
  }
});

loadSites((sites) => {
  if (!sites.length) {
    saveSites(DEFAULT_BLOCKED_SITES);
    return;
  }
  renderSites(sites);
});
