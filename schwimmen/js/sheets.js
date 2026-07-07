// sheets.js
// Generische Helfer für die Bottom-Sheets (Übersicht, Gewinner-Meldung).
// Kennt nichts vom Spielzustand - reine UI-Mechanik.

export function openSheet(sheet, backdrop){
  backdrop.classList.add('open');
  sheet.classList.add('open');
}

export function closeSheet(sheet, backdrop){
  backdrop.classList.remove('open');
  sheet.classList.remove('open');
}
