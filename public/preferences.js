export const ESTIMATE_KEY = "smart-terapy:atelier-estimate:v1";
export const REMEMBER_KEY = "smart-terapy:remember-estimate:v1";

export function getBrowserStorage() {
  try { return window.localStorage; } catch { return null; }
}

export function hasRememberedChoice(storage) {
  try { return storage?.getItem(REMEMBER_KEY) === "yes"; } catch { return false; }
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
  if (!enabled) return clearCalculatorPreferences(storage);
  if (!storage) return false;
  try { storage.setItem(REMEMBER_KEY, "yes"); return true; } catch { return false; }
}
