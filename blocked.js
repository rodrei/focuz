const breathText = document.getElementById("breath-text");
const blockedSection = document.getElementById("blocked");
const breathSection = document.querySelector(".breath");

const IN_DURATION_MS = 10000;
const OUT_DURATION_MS = 10000;
const TOTAL_MS = IN_DURATION_MS + OUT_DURATION_MS;

setTimeout(() => {
  breathText.textContent = "Breath out...";
}, IN_DURATION_MS);

setTimeout(() => {
  breathSection.classList.add("hidden");
  blockedSection.classList.remove("hidden");
}, TOTAL_MS);
