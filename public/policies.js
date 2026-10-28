import { clearCalculatorPreferences, getBrowserStorage } from "./preferences.js";

document.querySelector("#clear-preferences")?.addEventListener("click", () => {
  const cleared = clearCalculatorPreferences(getBrowserStorage());
  document.querySelector("#preferences-status").textContent = cleared
    ? "Preferințele calculatorului au fost șterse. Salvarea este dezactivată până când o alegi din nou."
    : "Browserul nu permite accesul la stocare. Poți șterge datele acestui site din setările browserului.";
});
