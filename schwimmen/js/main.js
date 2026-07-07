// main.js
// Einstiegspunkt der App. Verdrahtet die einzelnen Module miteinander (z.B.
// "Runde starten" aus der Lobby -> game.js) und kümmert sich um den
// Programmstart sowie die Service-Worker-Registrierung.

import { state, loadLocalState } from './state.js';
import { showScreen } from './screens.js';
import { openSheet, closeSheet } from './sheets.js';
import { renderLobby, initLobby } from './lobby.js';
import { renderTiles, goToGame, startRound, initGame } from './game.js';
import { initOverview } from './overview.js';

const overviewBackdrop = document.getElementById('overview-backdrop');
const overviewSheet = document.getElementById('overview-sheet');
const winnerBackdrop = document.getElementById('winner-backdrop');
const winnerSheet = document.getElementById('winner-sheet');

overviewBackdrop.addEventListener('click', ()=> closeSheet(overviewSheet, overviewBackdrop));
winnerBackdrop.addEventListener('click', ()=> closeSheet(winnerSheet, winnerBackdrop));

initLobby({ onStartRound: startRound });
initGame();
initOverview();

// ---------- Programmstart ----------
const restored = loadLocalState();
if(restored && state.round.active && state.round.players.length > 0){
  renderLobby();
  goToGame();
} else {
  renderLobby();
  showScreen('lobby');
}

// ---------- PWA: Service Worker ----------
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('./sw.js').catch(()=>{});
  });
}
