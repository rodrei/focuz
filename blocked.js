const breathText = document.getElementById("breath-text");
const blockedSection = document.getElementById("blocked");
const timeupSection = document.getElementById("timeup");
const breathSection = document.querySelector(".breath");
const buttons = document.querySelectorAll("button[data-minutes]");

const IN_DURATION_MS = 10000;
const OUT_DURATION_MS = 10000;
const TOTAL_MS = IN_DURATION_MS + OUT_DURATION_MS;

const storage = chrome.storage?.local;

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

if (storage) {
  storage.get({ lastExpiredAt: 0 }, (data) => {
    if (data.lastExpiredAt) {
      showTimeup();
      storage.set({ lastExpiredAt: 0 });
      return;
    }

    runBreathing();
  });
} else {
  runBreathing();
}

buttons.forEach((button) => {
  button.addEventListener("click", () => {
    const minutes = Number(button.dataset.minutes);
    if (!minutes) {
      return;
    }

    chrome.runtime.sendMessage({
      type: "ALLOW_TEMP",
      minutes,
    }, (response) => {
      const redirectUrl = response?.redirectUrl;
      if (redirectUrl) {
        window.location.href = redirectUrl;
      }
    });
  });
});
