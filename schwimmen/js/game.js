// game.js
// Der Spielbildschirm: rendert die Spieler-Kacheln mit den Leben als
// gefächerte Karten, verwaltet Leben abziehen/zurückgeben, das Absichern
// ("sicher raus, zählt als Sieg") und erkennt das Rundenende in beiden Modi.
//
// Wichtig für die Kartenfächer-Animation: die DOM-Knoten pro Kachel/Karte
// werden EINMAL gebaut und danach nur noch per Klassenwechsel aktualisiert
// (statt bei jedem Klick komplett neu gezeichnet zu werden). Nur so kann
// der Browser den Wechsel tatsächlich als Übergang animieren.
//
// Zum Rundenende-Modell: jeder Spieler in state.round.players hat zwei
// unabhängige Endzustände - "out" (0 Leben, hat verloren) und "safe"
// (freiwillig abgesichert, gewinnt in jedem Fall). Wer weder out noch safe
// ist, gilt als "aktiv" (spielt noch mit offenem Ausgang). Die Endauswertung
// braucht am Schluss nur noch: out -> Niederlage, alles andere -> Sieg.

import { state, saveState } from './state.js';
import { MODE_LABELS } from './state.js';
import { showScreen, setTopbarSubtitle } from './screens.js';
import { openSheet, closeSheet } from './sheets.js';
import { renderLobby } from './lobby.js';
import { enableWakeLock, disableWakeLock } from './wakelock.js';

const tilesEl = document.getElementById('tiles');
const winnerSheet = document.getElementById('winner-sheet');
const winnerBackdrop = document.getElementById('winner-backdrop');
const winnerNameEl = document.getElementById('winner-name');
const winnerEyebrowEl = document.getElementById('winner-eyebrow');
const winnerSubEl = document.getElementById('winner-sub');

const SUITS = ['♠', '♥', '♦', '♣'];
const SHIELD_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6l7-3z"/></svg>';

// playerId -> { tileEl, cardsFanEl, cardEls:[], minusBtn, undoBtn, safeBtn, safeBtnLabel, rausStampEl, safeStampEl }
const tileRefs = new Map();

function nameOf(playerId){
  const rosterPlayer = state.roster.find(r=>r.id === playerId);
  return rosterPlayer ? rosterPlayer.name : '?';
}

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

  const cardsFanEl = document.createElement('div');
  cardsFanEl.className = 'cards-fan';
  const cardEls = [];
  // Zu Rundenbeginn sind alle Leben noch da -> genau rp.lives Karten anlegen
  for(let i=0; i<rp.lives; i++){
    const card = createCard(i, rp.lives);
    cardEls.push(card);
    cardsFanEl.appendChild(card);
  }

  const minusBtn = document.createElement('button');
  minusBtn.className = 'minus-btn';
  minusBtn.type = 'button';
  minusBtn.textContent = '− Leben abziehen';
  minusBtn.addEventListener('click', ()=> loseLife(rp.id));

  const safeBtn = document.createElement('button');
  safeBtn.className = 'safe-btn';
  safeBtn.type = 'button';
  const safeBtnLabel = document.createElement('span');
  safeBtnLabel.textContent = 'Sicher raus (Sieg)';
  safeBtn.innerHTML = SHIELD_ICON;
  safeBtn.appendChild(safeBtnLabel);
  safeBtn.addEventListener('click', ()=> toggleSafe(rp.id));

  const rausStampEl = document.createElement('div');
  rausStampEl.className = 'stamp raus-stamp';
  rausStampEl.textContent = 'RAUS';

  const safeStampEl = document.createElement('div');
  safeStampEl.className = 'stamp safe-stamp';
  safeStampEl.textContent = 'SICHER';

  tile.appendChild(top);
  tile.appendChild(cardsFanEl);
  tile.appendChild(minusBtn);
  tile.appendChild(safeBtn);
  tile.appendChild(rausStampEl);
  tile.appendChild(safeStampEl);

  tileRefs.set(rp.id, { tileEl: tile, cardsFanEl, cardEls, minusBtn, undoBtn, safeBtn, safeBtnLabel, rausStampEl, safeStampEl });
  return tile;
}

// Fächer-Winkel/Höhe aller aktuell vorhandenen Karten neu verteilen
// (nötig, weil sich die Gesamtzahl beim Entfernen/Hinzufügen ändert)
function refanCards(refs){
  const total = refs.cardEls.length;
  refs.cardEls.forEach((el, i)=> applyFanTransform(el, i, total));
}

// Letzte Karte animiert aus dem Fächer entfernen (Leben verloren)
function removeLastCard(refs){
  if(!refs) return;
  const el = refs.cardEls.pop();
  if(!el) return;
  refanCards(refs);
  el.classList.add('leaving');
  const cleanup = ()=>{ el.remove(); };
  el.addEventListener('transitionend', cleanup, { once:true });
  setTimeout(cleanup, 500); // Sicherheitsnetz, falls transitionend nicht feuert
}

// Neue Karte animiert einfügen (Leben zurückgegeben / Undo)
function addNewCard(refs){
  if(!refs) return;
  const index = refs.cardEls.length;
  const card = createCard(index, index + 1);
  card.classList.add('entering');
  refs.cardsFanEl.appendChild(card);
  refs.cardEls.push(card);
  refanCards(refs);
  requestAnimationFrame(()=>{
    requestAnimationFrame(()=> card.classList.remove('entering'));
  });
}

function updateTileControls(rp){
  const refs = tileRefs.get(rp.id);
  if(!refs) return;
  refs.tileEl.classList.toggle('out', rp.out);
  refs.tileEl.classList.toggle('safe', !!rp.safe && !rp.out);

  refs.minusBtn.disabled = rp.out || rp.safe || state.round.finished;
  refs.undoBtn.disabled = rp.lives >= rp.maxLives || rp.out || rp.safe || state.round.finished;

  refs.safeBtn.disabled = rp.out || state.round.finished;
  refs.safeBtn.classList.toggle('is-active', !!rp.safe);
  refs.safeBtnLabel.textContent = rp.safe ? 'Sicher-Status aufheben' : 'Sicher raus (Sieg)';
}

export function renderTiles(){
  tilesEl.innerHTML = '';
  tileRefs.clear();

  const roundMode = state.round.mode === 'firstOut' ? 'firstOut' : 'last';
  setTopbarSubtitle(computeStatusText(roundMode));

  state.round.players.forEach(rp=>{
    const displayName = nameOf(rp.id);
    const tile = createTile(rp, displayName);
    tilesEl.appendChild(tile);
    updateTileControls(rp);
  });
}

function loseLife(id){
  const rp = state.round.players.find(x=>x.id === id);
  if(!rp || rp.out || rp.safe || state.round.finished) return;
  rp.lives = Math.max(0, rp.lives - 1);
  let justEliminated = false;
  if(rp.lives === 0){ rp.out = true; justEliminated = true; }
  saveState();
  removeLastCard(tileRefs.get(id));
  updateTileControls(rp);
  refreshStatusText();
  maybeEndRound(justEliminated ? rp.id : null);
}

function undoLife(id){
  const rp = state.round.players.find(x=>x.id === id);
  if(!rp || rp.safe || state.round.finished) return;
  rp.lives = Math.min(rp.maxLives, rp.lives + 1);
  if(rp.lives > 0) rp.out = false;
  saveState();
  addNewCard(tileRefs.get(id));
  updateTileControls(rp);
  refreshStatusText();
}

function toggleSafe(id){
  const rp = state.round.players.find(x=>x.id === id);
  if(!rp || rp.out || state.round.finished) return;

  if(!rp.safe){
    const name = nameOf(id);
    const ok = confirm(name + ' für diese Runde absichern? ' + name + ' kann danach nicht mehr verlieren und wird am Rundenende automatisch als Sieger gewertet, unabhängig von den verbleibenden Leben.');
    if(!ok) return;
    rp.safe = true;
  } else {
    rp.safe = false;
  }

  saveState();
  updateTileControls(rp);
  refreshStatusText();
  maybeEndRound(null);
}

function computeStatusText(roundMode){
  const total = state.round.players.length;
  const activeCount = state.round.players.filter(p=>!p.out && !p.safe).length;
  const safeCount = state.round.players.filter(p=>p.safe && !p.out).length;
  const outCount = state.round.players.filter(p=>p.out).length;

  let text = activeCount + ' aktiv';
  if(safeCount > 0) text += ' · ' + safeCount + ' sicher';
  if(outCount > 0) text += ' · ' + outCount + ' raus';
  text += ' von ' + total + ' · ' + MODE_LABELS[roundMode].tag;
  return text;
}

function refreshStatusText(){
  const roundMode = state.round.mode === 'firstOut' ? 'firstOut' : 'last';
  setTopbarSubtitle(computeStatusText(roundMode));
}

// Prüft nach jeder Zustandsänderung (Leben verloren ODER Absichern), ob die
// Runde jetzt zu Ende ist. justEliminatedId ist nur im "firstOut"-Modus
// relevant und wird gesetzt, wenn genau jetzt jemand auf 0 Leben gefallen ist.
function maybeEndRound(justEliminatedId){
  if(state.round.finished) return;
  const roundMode = state.round.mode === 'firstOut' ? 'firstOut' : 'last';
  const activeCount = state.round.players.filter(p=>!p.out && !p.safe).length;

  if(roundMode === 'firstOut'){
    if(justEliminatedId != null){
      finalizeRound();
      return;
    }
    // Sonderfall: alle verbliebenen Spieler haben sich abgesichert, bevor
    // jemand auf 0 Leben fiel -> es kann niemand mehr verlieren, Runde vorbei
    if(activeCount === 0 && state.round.players.length > 1){
      finalizeRound();
    }
    return;
  }

  // 'last' Modus: Runde endet, sobald höchstens noch ein aktiver Spieler übrig ist
  if(activeCount <= 1 && state.round.players.length > 1){
    finalizeRound();
  }
}

function finalizeRound(){
  state.round.finished = true;
  state.round.players.forEach(rp=>{
    const rosterPlayer = state.roster.find(r=>r.id === rp.id);
    if(!rosterPlayer) return;
    if(rp.out){ rosterPlayer.losses = (rosterPlayer.losses || 0) + 1; }
    else { rosterPlayer.wins = (rosterPlayer.wins || 0) + 1; } // safe oder letzter Aktiver -> Sieg
  });
  saveState();
  state.round.players.forEach(updateTileControls);
  showWinnerOverlay();
}

function showWinnerOverlay(){
  const roundMode = state.round.mode === 'firstOut' ? 'firstOut' : 'last';
  const winners = state.round.players.filter(rp=>!rp.out);
  const losers = state.round.players.filter(rp=>rp.out);

  if(roundMode === 'firstOut' && losers.length === 1){
    // Klassischer Fall: genau einer ist zuerst raus, alle anderen gewinnen
    winnerSheet.classList.add('loss-style');
    winnerEyebrowEl.textContent = 'Zuerst ohne Leben';
    winnerNameEl.textContent = nameOf(losers[0].id);
    winnerSubEl.textContent = winners.length > 1
      ? 'Die anderen ' + winners.length + ' Spieler gewinnen die Runde.'
      : 'Der andere Spieler gewinnt die Runde.';
  } else {
    // 'last'-Modus, oder der Sonderfall im firstOut-Modus ganz ohne Verlierer
    winnerSheet.classList.remove('loss-style');
    winnerEyebrowEl.textContent = winners.length > 1 ? 'Rundensieger' : 'Letzter am Tisch';
    winnerNameEl.textContent = winners.map(rp=>nameOf(rp.id)).join(' & ') || '—';
    if(losers.length === 1){
      winnerSubEl.textContent = nameOf(losers[0].id) + ' hat die Runde verloren.';
    } else if(losers.length > 1){
      winnerSubEl.textContent = losers.length + ' Spieler haben die Runde verloren.';
    } else {
      winnerSubEl.textContent = '';
    }
  }
  openSheet(winnerSheet, winnerBackdrop);
}

export function goToGame(){
  closeSheet(winnerSheet, winnerBackdrop);
  renderTiles();
  showScreen('game');
  if(state.round.finished) showWinnerOverlay();
  enableWakeLock();
}

export function startRound(){
  state.round = {
    active: true,
    finished: false,
    mode: state.mode,
    players: state.roster.map(r => ({ id:r.id, lives:state.startLives, maxLives:state.startLives, out:false, safe:false }))
  };
  saveState();
  goToGame();
}

function backToLobby(){
  closeSheet(winnerSheet, winnerBackdrop);
  disableWakeLock();
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
