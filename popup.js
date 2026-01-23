const siteList = document.getElementById("site-list");
const openOptions = document.getElementById("open-options");

const DEFAULT_BLOCKED_SITES = ["instagram.com"];

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
    item.textContent = site;
    siteList.appendChild(item);
  });
}

openOptions.addEventListener("click", (event) => {
  event.preventDefault();
  chrome.runtime.openOptionsPage();
});

chrome.storage.local.get({ blockedSites: DEFAULT_BLOCKED_SITES }, (data) => {
  const sites = (data.blockedSites || [])
    .map((site) => String(site).trim())
    .filter(Boolean)
    .sort();

  renderSites(sites);
});
