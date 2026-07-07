// lobby.js
// Alles rund um den Lobby-Bildschirm: Spielerliste pflegen, Startleben und
// Rundenende-Modus einstellen. Bekommt Cross-Screen-Aktionen (Runde starten)
// als Callback von main.js injiziert, damit dieses Modul kein game.js
// importieren muss (vermeidet zirkuläre Imports).

import { state, saveState, clearAll } from './state.js';
import { showScreen, setTopbarSubtitle } from './screens.js';

const livesValueEl = document.getElementById('lives-value');
const playerInput = document.getElementById('player-input');
const playerListEl = document.getElementById('player-list');
const startBtn = document.getElementById('start-btn');
const lobbyHint = document.getElementById('lobby-hint');
const lobbySecondaryBtns = document.getElementById('lobby-secondary-btns');

const modeToggle = document.getElementById('mode-toggle');
const modeLastBtn = document.getElementById('mode-last-btn');
const modeFirstOutBtn = document.getElementById('mode-firstout-btn');
const modeHint = document.getElementById('mode-hint');

function syncModeUI(){
  modeToggle.classList.toggle('mode-firstOut', state.mode === 'firstOut');
  modeLastBtn.classList.toggle('active', state.mode === 'last');
  modeFirstOutBtn.classList.toggle('active', state.mode === 'firstOut');
  modeHint.textContent = state.mode === 'last'
    ? 'Die Runde läuft weiter, bis nur noch ein Spieler Leben übrig hat. Der Rest kassiert je eine verlorene Runde.'
    : 'Sobald der erste Spieler bei 0 Leben landet, endet die Runde sofort. Nur dieser Spieler bekommt eine Niederlage, alle anderen einen Sieg.';
}

function setMode(newMode){
  state.mode = newMode;
  syncModeUI();
  saveState();
}

export function renderLobby(){
  livesValueEl.textContent = state.startLives;
  syncModeUI();

  playerListEl.innerHTML = '';
  state.roster.forEach(p=>{
    const li = document.createElement('li');
    li.className = 'ios-row';

    const span = document.createElement('span');
    span.className = 'ios-row-text';
    span.textContent = p.name;
    if((p.wins||0) + (p.losses||0) > 0){
      const tag = document.createElement('span');
      tag.className = 'played-tag';
      tag.textContent = '(' + p.wins + 'S / ' + p.losses + 'N)';
      span.appendChild(tag);
    }

    const btn = document.createElement('button');
    btn.className = 'minus-circle';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Entfernen: ' + p.name);
    btn.textContent = '−';
    btn.addEventListener('click', ()=>{
      state.roster = state.roster.filter(x=>x.id !== p.id);
      saveState();
      renderLobby();
    });

    li.appendChild(span);
    li.appendChild(btn);
    playerListEl.appendChild(li);
  });

  startBtn.disabled = state.roster.length < 2;
  const alreadyPlayed = state.roster.some(p=>(p.wins||0)+(p.losses||0) > 0);
  startBtn.textContent = alreadyPlayed ? 'Neue Runde starten' : 'Spiel starten';
  lobbyHint.textContent = state.roster.length < 2
    ? 'Mit Enter bestätigen. Mindestens 2 Spieler nötig.'
    : 'Änderungen möglich, bevor die Runde startet.';
  lobbySecondaryBtns.style.display = state.roster.length > 0 ? 'flex' : 'none';

  setTopbarSubtitle(state.roster.length > 0 ? state.roster.length + ' Spieler gespeichert' : 'Spieler & Regeln festlegen');
}

function addPlayerFromInput(){
  const name = playerInput.value.trim();
  if(!name) return;
  state.roster.push({ id: state.nextId++, name, wins:0, losses:0 });
  playerInput.value = '';
  saveState();
  renderLobby();
  playerInput.focus();
}

export function initLobby({ onStartRound }){
  document.getElementById('lives-minus').addEventListener('click', ()=>{
    state.startLives = Math.max(1, state.startLives - 1);
    livesValueEl.textContent = state.startLives;
    saveState();
  });
  document.getElementById('lives-plus').addEventListener('click', ()=>{
    state.startLives = Math.min(9, state.startLives + 1);
    livesValueEl.textContent = state.startLives;
    saveState();
  });

  modeLastBtn.addEventListener('click', ()=> setMode('last'));
  modeFirstOutBtn.addEventListener('click', ()=> setMode('firstOut'));

  document.getElementById('add-player-btn').addEventListener('click', addPlayerFromInput);
  playerInput.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter'){ e.preventDefault(); addPlayerFromInput(); }
  });

  startBtn.addEventListener('click', ()=>{
    if(state.roster.length < 2) return;
    onStartRound();
  });

  document.getElementById('lobby-reset-all-btn').addEventListener('click', ()=>{
    if(confirm('Alle Spieler und die gesamte Statistik unwiderruflich löschen?')){
      clearAll();
      renderLobby();
      showScreen('lobby');
    }
  });
}
