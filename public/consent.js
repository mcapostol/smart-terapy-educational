import { getBrowserStorage, readConsent, hasRememberedChoice, clearCalculatorPreferences, setRememberedChoice } from "./preferences.js";

export function setupConsent() {
  if (document.querySelector("#cookie-dialog")) return;
  const storage = getBrowserStorage();
  if (!hasRememberedChoice(storage)) clearCalculatorPreferences(storage);
  const dialog = document.createElement("dialog");
  dialog.id = "cookie-dialog";
  dialog.className = "cookie-dialog";
  dialog.setAttribute("aria-labelledby", "cookie-title");
  dialog.setAttribute("aria-describedby", "cookie-description");
  dialog.innerHTML = `
    <button type="button" class="cookie-close" aria-label="Închide fără să salvezi alegerea">×</button>
    <p class="eyebrow">CONFIDENȚIALITATEA TA CONTEAZĂ</p>
    <h2 id="cookie-title">Tu alegi ce păstrăm.</h2>
    <p id="cookie-description">Folosim stocarea locală din browser pentru a reține alegerea ta privind cookies și preferințele. Opțional, putem păstra setările calculatorului de ateliere. Nu folosim cookies de publicitate sau analiză.</p>
    <div class="cookie-essential"><span>Necesare</span><small>Rețin această alegere timp de 180 de zile.</small><strong>Mereu active</strong></div>
    <label class="cookie-option" for="cookie-functional"><input id="cookie-functional" type="checkbox"><span><strong>Preferințe opționale</strong><small>Rețin tipul atelierului, participanții și sesiunile pe acest dispozitiv.</small></span></label>
    <div class="cookie-links"><a class="cookie-policy-link">Politica de cookies</a><a class="cookie-privacy-link">Confidențialitate & GDPR</a></div>
    <div class="cookie-actions"><button id="cookie-reject" type="button" class="button">Refuz opționale</button><button id="cookie-accept" type="button" class="button">Accept opționale</button><button id="cookie-save" type="button" class="button button-outline">Salvează selecția</button></div>
    <p id="cookie-status" role="status"></p>
    <p class="cookie-note">Poți schimba alegerea oricând din „Setări cookies”, în partea de jos a paginii.</p>`;
  dialog.querySelector(".cookie-policy-link").href = new URL("./cookies.html", import.meta.url).href;
  dialog.querySelector(".cookie-privacy-link").href = new URL("./confidentialitate.html", import.meta.url).href;
  document.body.append(dialog);
  const optional = dialog.querySelector("#cookie-functional");
  const status = dialog.querySelector("#cookie-status");
  const open = () => {
    optional.checked = hasRememberedChoice(storage);
    status.textContent = "";
    if (!dialog.open) dialog.showModal();
  };
  const save = enabled => {
    const saved = setRememberedChoice(storage, enabled);
    if (!saved && enabled) {
      optional.checked = false;
      status.textContent = "Browserul nu permite salvarea preferințelor. Poți continua fără opțiunile de memorare, folosind Refuz opționale.";
      return;
    }
    dialog.close();
  };
  dialog.querySelector("#cookie-reject").addEventListener("click", () => save(false));
  dialog.querySelector("#cookie-accept").addEventListener("click", () => save(true));
  dialog.querySelector("#cookie-save").addEventListener("click", () => save(optional.checked));
  dialog.querySelector(".cookie-close").addEventListener("click", () => dialog.close());
  document.addEventListener("click", event => {
    if (event.target.closest("[data-open-consent]")) open();
  });
  window.addEventListener("consentchange", () => { optional.checked = hasRememberedChoice(storage); });
  window.addEventListener("storage", () => {
    optional.checked = hasRememberedChoice(storage);
    if (!readConsent(storage)) { clearCalculatorPreferences(storage); open(); }
  });
  window.addEventListener("pageshow", event => {
    if (event.persisted && !readConsent(storage)) { clearCalculatorPreferences(storage); open(); }
  });
  if (!readConsent(storage)) open();
}
