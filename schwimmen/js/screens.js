// screens.js
// Schaltet zwischen den beiden Hauptbildschirmen (Lobby / Spiel) um und
// pflegt die kleinen, davon abhängigen Topbar-Elemente. Kennt nichts vom
// eigentlichen Spielzustand - bekommt alles über Funktionsargumente.

import { state } from './state.js';

const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
const navNewRoundBtn = document.getElementById('nav-newround-btn');
const topbarSubtitleEl = document.getElementById('topbar-subtitle');

export function setTopbarSubtitle(text){
  topbarSubtitleEl.textContent = text;
}

export function showScreen(name){
  state.currentScreen = name;
  lobbyScreen.style.display = name === 'lobby' ? 'block' : 'none';
  gameScreen.style.display = name === 'game' ? 'block' : 'none';
  navNewRoundBtn.style.display = name === 'game' ? 'flex' : 'none';
}
