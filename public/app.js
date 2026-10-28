import { CONTACT_EMAIL, buildContactMessage } from "./contact.js";

const WORKSHOPS = Object.freeze({
  creativ: Object.freeze({ label: "Atelier creativ", rate: 55, min: 6, max: 20, unit: "copil" }),
  senzorial: Object.freeze({ label: "Atelier senzorial", rate: 60, min: 6, max: 20, unit: "copil" }),
  scoala: Object.freeze({ label: "Program pentru școli", rate: 45, min: 15, max: 30, unit: "copil" }),
  parinte: Object.freeze({ label: "Atelier părinte–copil", rate: 85, min: 6, max: 15, unit: "pereche copil + adult" }),
});

const DEFAULT_SELECTION = Object.freeze({ type: "creativ", participants: 12, sessions: 1 });
const STORAGE_KEY = "smart-terapy:atelier-estimate:v1";
const STORAGE_VERSION = 1;

function parseInteger(value) {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) ? value : null;
  }

  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) {
    return null;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

/**
 * Converts unknown or saved input into a safe selection for the form.
 * Participant counts are constrained to the selected workshop's real limits.
 */
export function normalizeSelection(value) {
  const candidate = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const type = Object.hasOwn(WORKSHOPS, candidate.type) ? candidate.type : DEFAULT_SELECTION.type;
  const workshop = WORKSHOPS[type];
  const rawParticipants = parseInteger(candidate.participants);
  const participants = rawParticipants === null
    ? Math.min(Math.max(DEFAULT_SELECTION.participants, workshop.min), workshop.max)
    : Math.min(Math.max(rawParticipants, workshop.min), workshop.max);
  const parsedSessions = parseInteger(candidate.sessions);
  const sessions = parsedSessions === 4 ? 4 : 1;

  return { type, participants, sessions };
}

/**
 * Returns a deterministic estimate. It never books a workshop or mutates state.
 */
export function calculateEstimate(selection) {
  const candidate = selection && typeof selection === "object" && !Array.isArray(selection)
    ? selection
    : {};
  const workshop = Object.hasOwn(WORKSHOPS, candidate.type) ? WORKSHOPS[candidate.type] : null;

  if (!workshop) {
    return { ok: false, code: "unknown-type", error: "Alege un tip de atelier disponibil." };
  }

  const participants = parseInteger(candidate.participants);
  if (participants === null) {
    return { ok: false, code: "invalid-participants", error: "Numărul de participanți trebuie să fie un număr întreg." };
  }

  if (participants < workshop.min || participants > workshop.max) {
    return {
      ok: false,
      code: "participants-out-of-range",
      error: `Pentru ${workshop.label.toLowerCase()}, alege între ${workshop.min} și ${workshop.max} ${workshop.unit === "copil" ? "copii" : "perechi"}.`,
      min: workshop.min,
      max: workshop.max,
    };
  }

  const sessions = parseInteger(candidate.sessions);
  if (sessions !== 1 && sessions !== 4) {
    return { ok: false, code: "invalid-sessions", error: "Alege o sesiune sau pachetul de 4 sesiuni." };
  }

  const discountRate = sessions === 4 ? 0.1 : 0;
  const unitPrice = workshop.rate * (1 - discountRate);
  const total = participants * sessions * unitPrice;

  return {
    ok: true,
    type: candidate.type,
    label: workshop.label,
    participants,
    sessions,
    unit: workshop.unit,
    baseUnitPrice: workshop.rate,
    unitPrice,
    discountRate,
    total,
    min: workshop.min,
    max: workshop.max,
  };
}

function setText(element, value) {
  if (element) element.textContent = value;
}

function setupNavigation() {
  const toggle = document.querySelector("#menu-toggle");
  const navigation = document.querySelector("#site-nav");
  const therapies = document.querySelector("#therapy-menu");
  const therapyToggle = document.querySelector("#therapy-menu-toggle");
  if (!toggle || !navigation) return;

  const closeTherapies = () => {
    if (therapies) therapies.open = false;
    therapyToggle?.setAttribute("aria-expanded", "false");
  };
  const setOpen = (isOpen) => {
    toggle.setAttribute("aria-expanded", String(isOpen));
    toggle.setAttribute("aria-label", isOpen ? "Închide meniul" : "Deschide meniul");
    navigation.classList.toggle("is-open", isOpen);
    if (!isOpen) closeTherapies();
  };

  setOpen(false);
  toggle.addEventListener("click", () => {
    setOpen(toggle.getAttribute("aria-expanded") !== "true");
  });
  therapies?.addEventListener("toggle", () => {
    therapyToggle?.setAttribute("aria-expanded", String(therapies.open));
  });
  therapies?.addEventListener("focusout", (event) => {
    if (event.relatedTarget && !therapies.contains(event.relatedTarget)) closeTherapies();
  });
  navigation.addEventListener("click", (event) => {
    if (event.target.closest("a")) setOpen(false);
  });
  document.addEventListener("click", (event) => {
    if (therapies?.open && !therapies.contains(event.target)) closeTherapies();
    if (toggle.getAttribute("aria-expanded") === "true" && !navigation.contains(event.target) && !toggle.contains(event.target)) setOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (therapies?.open) {
      event.preventDefault();
      closeTherapies();
      therapyToggle?.focus();
    } else if (toggle.getAttribute("aria-expanded") === "true") {
      event.preventDefault();
      setOpen(false);
      toggle.focus();
    }
  });
  window.matchMedia("(min-width: 901px)").addEventListener("change", () => setOpen(false));
}

function readSavedSelection(storage) {
  if (!storage) return DEFAULT_SELECTION;

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SELECTION;
    const saved = JSON.parse(raw);
    if (!saved || saved.version !== STORAGE_VERSION || !saved.selection) return DEFAULT_SELECTION;
    return normalizeSelection(saved.selection);
  } catch {
    return DEFAULT_SELECTION;
  }
}

function saveSelection(storage, selection) {
  if (!storage) return;

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({
      version: STORAGE_VERSION,
      selection: {
        type: selection.type,
        participants: selection.participants,
        sessions: selection.sessions,
      },
    }));
  } catch {
    // The estimate remains fully usable when private browsing blocks storage.
  }
}

function getStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function formatMoney(value) {
  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency: "RON",
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function buildRequestMessage(estimate) {
  const participantLabel = estimate.unit === "copil"
    ? `${estimate.participants} copii`
    : `${estimate.participants} perechi copil + adult`;
  const sessionLabel = estimate.sessions === 1 ? "1 sesiune" : "4 sesiuni";

  return [
    "Bună! Doresc detalii despre organizarea unui atelier Smart Terapy Educational.",
    `Program: ${estimate.label}`,
    `Grup: ${participantLabel}`,
    `Frecvență: ${sessionLabel}`,
    `Estimare orientativă: ${formatMoney(estimate.total)}`,
    "Știu că aceasta este o estimare, iar data, locația, disponibilitatea și oferta finală se confirmă separat.",
  ].join("\n");
}

function setupCalculator() {
  const form = document.querySelector("#atelier-form");
  if (!form) return;

  const typeInput = form.querySelector("#atelier-type");
  const participantsInput = form.querySelector("#participants");
  const sessionsInput = form.querySelector("#sessions");
  const totalOutput = document.querySelector("#estimate-total");
  const unitOutput = document.querySelector("#estimate-unit");
  const summaryOutput = document.querySelector("#estimate-summary");
  const errorOutput = document.querySelector("#estimate-error");
  const messageOutput = document.querySelector("#request-message");
  const copyButton = document.querySelector("#copy-request");
  const copyStatus = document.querySelector("#copy-status");
  const required = [typeInput, participantsInput, sessionsInput, totalOutput, unitOutput, summaryOutput, errorOutput, messageOutput];
  if (required.some((element) => !element)) return;

  const storage = getStorage();
  const saved = readSavedSelection(storage);
  typeInput.value = saved.type;
  participantsInput.value = String(saved.participants);
  sessionsInput.value = String(saved.sessions);

  const updateLimits = () => {
    const workshop = WORKSHOPS[typeInput.value];
    if (!workshop) return;
    participantsInput.min = String(workshop.min);
    participantsInput.max = String(workshop.max);
  };

  const render = () => {
    updateLimits();
    const result = calculateEstimate({
      type: typeInput.value,
      participants: participantsInput.value,
      sessions: sessionsInput.value,
    });

    setText(copyStatus, "");
    if (!result.ok) {
      setText(errorOutput, result.error);
      setText(totalOutput, "—");
      setText(unitOutput, "—");
      setText(summaryOutput, "Corectează opțiunile pentru a vedea estimarea orientativă.");
      messageOutput.value = "";
      if (copyButton) copyButton.disabled = true;
      return;
    }

    setText(errorOutput, "");
    setText(totalOutput, formatMoney(result.total));
    setText(unitOutput, `${formatMoney(result.unitPrice)} / ${result.unit} / sesiune`);
    const discountText = result.discountRate > 0 ? " Include reducerea de 10% pentru pachetul de 4 sesiuni." : "";
    setText(
      summaryOutput,
      `Estimare pentru ${result.participants} ${result.unit === "copil" ? "copii" : "perechi"} și ${result.sessions} ${result.sessions === 1 ? "sesiune" : "sesiuni"}.${discountText} Oferta finală se confirmă după stabilirea detaliilor.`,
    );
    messageOutput.value = buildRequestMessage(result);
    if (copyButton) copyButton.disabled = false;
    saveSelection(storage, result);
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    render();
  });
  form.addEventListener("input", render);
  form.addEventListener("change", render);

  if (copyButton) {
    copyButton.addEventListener("click", async () => {
      if (!messageOutput.value) {
        setText(copyStatus, "Completează opțiunile valide înainte de copiere.");
        return;
      }

      let copied = false;
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(messageOutput.value);
          copied = true;
        }
      } catch {
        copied = false;
      }

      if (!copied) {
        try {
          const messageDetails = messageOutput.closest("details");
          if (messageDetails) messageDetails.open = true;
          messageOutput.focus();
          messageOutput.select();
          messageOutput.setSelectionRange(0, messageOutput.value.length);
          copied = document.execCommand("copy");
        } catch {
          copied = false;
        }
      }

      setText(
        copyStatus,
        copied
          ? "Mesaj copiat. Îl poți trimite pe Instagram pentru confirmare."
          : "Copierea automată nu a funcționat. Selectează și copiază manual mesajul.",
      );
    });
  }

  render();
}

function setupContactForm() {
  const form = document.querySelector("#contact-form");
  if (!form) return;
  const fields = Object.fromEntries(["name", "email", "service", "message"].map(name => [name, form.elements.namedItem(name)]));
  const draft = document.querySelector("#contact-draft");
  const preview = document.querySelector("#contact-preview");
  const emailLink = document.querySelector("#contact-open-email");
  const status = document.querySelector("#contact-status");
  const copyStatus = document.querySelector("#contact-copy-status");
  const clearDraft = () => {
    draft.hidden = true;
    preview.value = "";
    emailLink.href = `mailto:${CONTACT_EMAIL}`;
    setText(status, "");
    setText(copyStatus, "");
  };
  form.noValidate = true;
  form.addEventListener("input", event => {
    clearDraft();
    const name = event.target.name;
    if (fields[name]) {
      fields[name].removeAttribute("aria-invalid");
      setText(document.querySelector(`#contact-${name}-error`), "");
    }
  });
  form.addEventListener("submit", event => {
    event.preventDefault();
    clearDraft();
    const result = buildContactMessage(Object.fromEntries(Object.entries(fields).map(([name, field]) => [name, field.value])));
    for (const [name, field] of Object.entries(fields)) {
      const error = result.ok ? "" : result.errors[name] || "";
      field.setAttribute("aria-invalid", String(Boolean(error)));
      setText(document.querySelector(`#contact-${name}-error`), error);
    }
    if (!result.ok) {
      fields[Object.keys(result.errors)[0]]?.focus();
      return;
    }
    emailLink.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(result.subject)}&body=${encodeURIComponent(result.body.replace(/\r?\n/g, "\r\n"))}`;
    preview.value = `Către: ${CONTACT_EMAIL}\nSubiect: ${result.subject}\n\n${result.body}`;
    draft.hidden = false;
    setText(status, "Mesajul este pregătit. Deschide aplicația de e-mail și trimite-l de acolo.");
    emailLink.focus({ preventScroll: true });
    draft.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
  document.querySelector("#contact-copy").addEventListener("click", async () => {
    if (!preview.value) return;
    let copied = false;
    try {
      await navigator.clipboard.writeText(preview.value);
      copied = true;
    } catch {
      preview.focus();
      preview.select();
      try { copied = document.execCommand("copy"); } catch { copied = false; }
    }
    setText(copyStatus, copied ? "Mesaj copiat. Îl poți lipi în e-mailul către echipă." : "Selectează și copiază manual mesajul de mai sus.");
  });
}

if (typeof document !== "undefined") {
  setupNavigation();
  setupCalculator();
  setupContactForm();
}

