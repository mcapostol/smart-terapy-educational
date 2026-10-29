export const ESTIMATE_KEY = "smart-terapy:atelier-estimate:v1";
export const REMEMBER_KEY = "smart-terapy:remember-estimate:v1";
export const CONSENT_KEY = "smart-terapy:consent:v1";
export const CONSENT_MAX_AGE = 180 * 24 * 60 * 60 * 1000;

export function getBrowserStorage() {
  try { return window.localStorage; } catch { return null; }
}

export function readConsent(storage, now = Date.now()) {
  try {
    const value = JSON.parse(storage?.getItem(CONSENT_KEY) || "null");
    if (value?.version !== 1 || typeof value.functional !== "boolean" || !Number.isFinite(value.updatedAt)) return null;
    if (value.updatedAt > now || now - value.updatedAt >= CONSENT_MAX_AGE) return null;
    return value;
  } catch { return null; }
}

export function hasRememberedChoice(storage) {
  return readConsent(storage)?.functional === true;
}

export function clearCalculatorPreferences(storage) {
  if (!storage) return false;
  try {
    storage.removeItem(ESTIMATE_KEY);
    storage.removeItem(REMEMBER_KEY);
    return true;
  } catch { return false; }
}

export function setRememberedChoice(storage, enabled) {
  if (!storage) return false;
  try {
    if (enabled) storage.setItem(REMEMBER_KEY, "yes");
    else if (!clearCalculatorPreferences(storage)) return false;
    storage.setItem(CONSENT_KEY, JSON.stringify({ version: 1, functional: Boolean(enabled), updatedAt: Date.now() }));
    if (typeof window !== "undefined") window.dispatchEvent(new Event("consentchange"));
    return true;
  } catch {
    clearCalculatorPreferences(storage);
    try { storage.removeItem(CONSENT_KEY); } catch { /* Storage can be blocked entirely. */ }
    if (typeof window !== "undefined") window.dispatchEvent(new Event("consentchange"));
    return false;
  }
}
