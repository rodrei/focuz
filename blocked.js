const breathText = document.getElementById("breath-text");
const blockedSection = document.getElementById("blocked");
const timeupSection = document.getElementById("timeup");
const breathSection = document.querySelector(".breath");
const buttons = document.querySelectorAll("button[data-minutes]");
const blockedSite = document.getElementById("blocked-site");
const fallbackUrl = (() => {
  const params = new URLSearchParams(window.location.search);
  const queryUrl = params.get("u");
  if (queryUrl && queryUrl.startsWith("http")) {
    return queryUrl;
  }

  if (!window.location.hash) {
    return "";
  }
  const candidate = window.location.hash.slice(1);
  return candidate.startsWith("http") ? candidate : "";
})();

const IN_DURATION_MS = 5000;
const OUT_DURATION_MS = 5000;
const TOTAL_MS = IN_DURATION_MS + OUT_DURATION_MS;

function showBlocked() {
  breathSection.classList.add("hidden");
  blockedSection.classList.remove("hidden");
}

function showTimeup() {
  breathSection.classList.add("hidden");
  timeupSection.classList.remove("hidden");
}

function runBreathing() {
  setTimeout(() => {
    breathText.textContent = "Breath out...";
  }, IN_DURATION_MS);

  setTimeout(() => {
    showBlocked();
  }, TOTAL_MS);
}

function init() {
  if (!chrome.runtime?.sendMessage) {
    runBreathing();
    return;
  }

  chrome.runtime.sendMessage(
    { type: "GET_CONTEXT", blockedUrl: fallbackUrl },
    (response) => {
    if (response?.host) {
      blockedSite.textContent = response.host;
    }

    if (response?.timeup) {
      showTimeup();
      return;
    }

      runBreathing();
    }
  );
}

init();

buttons.forEach((button) => {
  button.addEventListener("click", () => {
    const minutes = Number(button.dataset.minutes);
    if (!minutes) {
      return;
    }

    chrome.runtime.sendMessage(
      {
        type: "ALLOW_TEMP",
        minutes,
        blockedUrl: fallbackUrl,
      },
      (response) => {
        const redirectUrl = response?.redirectUrl;
        if (redirectUrl) {
          window.location.href = redirectUrl;
        }
      }
    );
  });
});
