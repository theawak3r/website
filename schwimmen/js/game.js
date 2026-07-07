// game.js
// Der Spielbildschirm: rendert die Spieler-Kacheln mit den Leben als
// gefächerte Karten, verwaltet Leben abziehen/zurückgeben und erkennt das
// Rundenende in beiden Modi.
//
// Wichtig für die Kartenfächer-Animation: die DOM-Knoten pro Kachel/Karte
// werden EINMAL gebaut und danach nur noch per Klassenwechsel aktualisiert
// (statt bei jedem Klick komplett neu gezeichnet zu werden). Nur so kann
// der Browser den Wechsel tatsächlich als Übergang animieren.

import { state, saveState } from './state.js';
import { MODE_LABELS } from './state.js';
import { showScreen, setTopbarSubtitle } from './screens.js';
import { openSheet, closeSheet } from './sheets.js';
import { renderLobby } from './lobby.js';

const tilesEl = document.getElementById('tiles');
const winnerSheet = document.getElementById('winner-sheet');
const winnerBackdrop = document.getElementById('winner-backdrop');
const winnerNameEl = document.getElementById('winner-name');
const winnerEyebrowEl = document.getElementById('winner-eyebrow');
const winnerSubEl = document.getElementById('winner-sub');

const SUITS = ['♠', '♥', '♦', '♣'];

// playerId -> { tileEl, cardEls:[], minusBtn, undoBtn, stampEl }
const tileRefs = new Map();

function applyFanTransform(cardEl, index, total){
  const step = total > 1 ? Math.min(10, 34 / (total - 1)) : 0;
  const half = step * (total - 1) / 2;
  const rotate = (index * step - half);
  const lift = -(half - Math.abs(rotate)) * 0.9;
  cardEl.style.setProperty('--fan-rotate', rotate.toFixed(2) + 'deg');
  cardEl.style.setProperty('--fan-lift', lift.toFixed(1) + 'px');
  cardEl.style.zIndex = index;
}

function createCard(index, total){
  const suit = SUITS[index % 4];
  const isRed = suit === '♥' || suit === '♦';
  const card = document.createElement('div');
  card.className = 'life-card ' + (isRed ? 'suit-red' : 'suit-black');
  card.innerHTML =
    '<span class="pip top">' + suit + '</span>' +
    '<span class="pip bottom">' + suit + '</span>';
  applyFanTransform(card, index, total);
  return card;
}

function createTile(rp, displayName){
  const tile = document.createElement('div');
  tile.className = 'tile';

  const top = document.createElement('div');
  top.className = 'tile-top';
  const nameEl = document.createElement('div');
  nameEl.className = 'tile-name';
  nameEl.textContent = displayName;

  const undoBtn = document.createElement('button');
  undoBtn.className = 'undo-btn';
  undoBtn.type = 'button';
  undoBtn.title = 'Letztes Leben zurückgeben';
  undoBtn.setAttribute('aria-label', 'Leben zurückgeben für ' + displayName);
  undoBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-2"/></svg>';
  undoBtn.addEventListener('click', ()=> undoLife(rp.id));

  top.appendChild(nameEl);
  top.appendChild(undoBtn);

  const cardsFan = document.createElement('div');
  cardsFan.className = 'cards-fan';
  const cardEls = [];
  for(let i=0; i<rp.maxLives; i++){
    const card = createCard(i, rp.maxLives);
    cardEls.push(card);
    cardsFan.appendChild(card);
  }

  const minusBtn = document.createElement('button');
  minusBtn.className = 'minus-btn';
  minusBtn.type = 'button';
  minusBtn.textContent = '− Leben abziehen';
  minusBtn.addEventListener('click', ()=> loseLife(rp.id));

  const stampEl = document.createElement('div');
  stampEl.className = 'stamp';
  stampEl.textContent = 'RAUS';

  tile.appendChild(top);
  tile.appendChild(cardsFan);
  tile.appendChild(minusBtn);
  tile.appendChild(stampEl);

  tileRefs.set(rp.id, { tileEl: tile, cardEls, minusBtn, undoBtn, stampEl });
  return tile;
}

function updateTileVisual(rp){
  const refs = tileRefs.get(rp.id);
  if(!refs) return;
  refs.tileEl.classList.toggle('out', rp.out);
  refs.cardEls.forEach((cardEl, i)=>{
    cardEl.classList.toggle('lost', i >= rp.lives);
  });
  refs.minusBtn.disabled = rp.out || state.round.finished;
  refs.undoBtn.disabled = rp.lives >= rp.maxLives || state.round.finished;
}

export function renderTiles(){
  tilesEl.innerHTML = '';
  tileRefs.clear();

  const aliveCount = state.round.players.filter(p=>!p.out).length;
  const roundMode = state.round.mode === 'firstOut' ? 'firstOut' : 'last';
  setTopbarSubtitle(aliveCount + ' von ' + state.round.players.length + ' im Spiel · ' + MODE_LABELS[roundMode].tag);

  state.round.players.forEach(rp=>{
    const rosterPlayer = state.roster.find(r=>r.id === rp.id);
    const displayName = rosterPlayer ? rosterPlayer.name : '?';
    const tile = createTile(rp, displayName);
    tilesEl.appendChild(tile);
    updateTileVisual(rp);
  });
}

function loseLife(id){
  const rp = state.round.players.find(x=>x.id === id);
  if(!rp || rp.out || state.round.finished) return;
  rp.lives = Math.max(0, rp.lives - 1);
  let justEliminated = false;
  if(rp.lives === 0){ rp.out = true; justEliminated = true; }
  saveState();
  updateTileVisual(rp);
  refreshAliveCount();
  if(justEliminated) checkRoundEnd(rp.id);
}

function undoLife(id){
  const rp = state.round.players.find(x=>x.id === id);
  if(!rp || state.round.finished) return;
  rp.lives = Math.min(rp.maxLives, rp.lives + 1);
  if(rp.lives > 0) rp.out = false;
  saveState();
  updateTileVisual(rp);
  refreshAliveCount();
}

function refreshAliveCount(){
  const aliveCount = state.round.players.filter(p=>!p.out).length;
  const roundMode = state.round.mode === 'firstOut' ? 'firstOut' : 'last';
  setTopbarSubtitle(aliveCount + ' von ' + state.round.players.length + ' im Spiel · ' + MODE_LABELS[roundMode].tag);
}

function checkRoundEnd(justOutId){
  if(state.round.finished) return;
  const roundMode = state.round.mode === 'firstOut' ? 'firstOut' : 'last';

  if(roundMode === 'firstOut'){
    state.round.finished = true;
    state.round.specialId = justOutId;
    state.round.players.forEach(rp=>{
      const rosterPlayer = state.roster.find(r=>r.id === rp.id);
      if(!rosterPlayer) return;
      if(rp.id === justOutId){ rosterPlayer.losses = (rosterPlayer.losses || 0) + 1; }
      else { rosterPlayer.wins = (rosterPlayer.wins || 0) + 1; }
    });
    saveState();
    state.round.players.forEach(updateTileVisual);
    showWinnerOverlay();
    return;
  }

  const alive = state.round.players.filter(p=>!p.out);
  if(alive.length === 1 && state.round.players.length > 1){
    state.round.finished = true;
    state.round.specialId = alive[0].id;
    state.round.players.forEach(rp=>{
      const rosterPlayer = state.roster.find(r=>r.id === rp.id);
      if(!rosterPlayer) return;
      if(rp.id === state.round.specialId){ rosterPlayer.wins = (rosterPlayer.wins || 0) + 1; }
      else { rosterPlayer.losses = (rosterPlayer.losses || 0) + 1; }
    });
    saveState();
    state.round.players.forEach(updateTileVisual);
    showWinnerOverlay();
  }
}

function showWinnerOverlay(){
  const roundMode = state.round.mode === 'firstOut' ? 'firstOut' : 'last';
  const rosterPlayer = state.roster.find(r=>r.id === state.round.specialId);
  const displayName = rosterPlayer ? rosterPlayer.name : '—';

  if(roundMode === 'firstOut'){
    winnerSheet.classList.add('loss-style');
    winnerEyebrowEl.textContent = 'Zuerst ohne Leben';
    winnerNameEl.textContent = displayName;
    const others = state.round.players.length - 1;
    winnerSubEl.textContent = others > 1
      ? 'Die anderen ' + others + ' Spieler gewinnen die Runde.'
      : 'Der andere Spieler gewinnt die Runde.';
  } else {
    winnerSheet.classList.remove('loss-style');
    winnerEyebrowEl.textContent = 'Letzter am Tisch';
    winnerNameEl.textContent = displayName;
    winnerSubEl.textContent = '';
  }
  openSheet(winnerSheet, winnerBackdrop);
}

export function goToGame(){
  closeSheet(winnerSheet, winnerBackdrop);
  renderTiles();
  showScreen('game');
  if(state.round.finished) showWinnerOverlay();
}

export function startRound(){
  state.round = {
    active: true,
    finished: false,
    mode: state.mode,
    specialId: null,
    players: state.roster.map(r => ({ id:r.id, lives:state.startLives, maxLives:state.startLives, out:false }))
  };
  saveState();
  goToGame();
}

function backToLobby(){
  closeSheet(winnerSheet, winnerBackdrop);
  renderLobby();
  showScreen('lobby');
}

export function initGame(){
  document.getElementById('nav-newround-btn').addEventListener('click', ()=>{
    const proceed = state.round.finished || confirm('Aktuelle Runde abbrechen und zurück zur Spielerliste?');
    if(!proceed) return;
    backToLobby();
  });

  document.getElementById('winner-newround-btn').addEventListener('click', backToLobby);
}
