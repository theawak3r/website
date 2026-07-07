// overview.js
// Das Statistik-Sheet: zeigt Siege/Niederlagen je Spieler und erlaubt das
// Zurücksetzen von Statistik bzw. allem.

import { state, saveState, clearAll } from './state.js';
import { showScreen } from './screens.js';
import { openSheet, closeSheet } from './sheets.js';
import { renderLobby } from './lobby.js';

const overviewSheet = document.getElementById('overview-sheet');
const overviewBackdrop = document.getElementById('overview-backdrop');
const statsTbody = document.getElementById('stats-tbody');
const statsEmptyHint = document.getElementById('stats-empty-hint');

export function renderOverview(){
  const sorted = [...state.roster].sort((a,b)=>{
    const bw = (b.wins||0) - (a.wins||0);
    if(bw !== 0) return bw;
    return (a.losses||0) - (b.losses||0);
  });

  statsTbody.innerHTML = '';
  if(sorted.length === 0){
    statsEmptyHint.style.display = 'block';
  } else {
    statsEmptyHint.style.display = 'none';
    sorted.forEach((p, idx)=>{
      const tr = document.createElement('tr');

      const nameTd = document.createElement('td');
      const badge = document.createElement('span');
      badge.className = 'rank-badge';
      badge.textContent = idx + 1;
      nameTd.appendChild(badge);
      nameTd.appendChild(document.createTextNode(p.name));

      const winsTd = document.createElement('td');
      winsTd.className = 'num win-count';
      winsTd.textContent = p.wins || 0;

      const lossTd = document.createElement('td');
      lossTd.className = 'num loss-count';
      lossTd.textContent = p.losses || 0;

      tr.appendChild(nameTd);
      tr.appendChild(winsTd);
      tr.appendChild(lossTd);
      statsTbody.appendChild(tr);
    });
  }
}

export function openOverview(){
  renderOverview();
  openSheet(overviewSheet, overviewBackdrop);
}

export function initOverview(){
  document.getElementById('nav-overview-btn').addEventListener('click', openOverview);
  document.getElementById('winner-overview-btn').addEventListener('click', ()=>{
    closeSheet(document.getElementById('winner-sheet'), document.getElementById('winner-backdrop'));
    openOverview();
  });

  document.getElementById('overview-close-btn').addEventListener('click', ()=>{
    closeSheet(overviewSheet, overviewBackdrop);
  });

  document.getElementById('overview-reset-stats-btn').addEventListener('click', ()=>{
    if(state.roster.length === 0) return;
    if(confirm('Siege und verlorene Runden für alle Spieler auf 0 zurücksetzen?')){
      state.roster.forEach(p=>{ p.wins = 0; p.losses = 0; });
      saveState();
      renderOverview();
      renderLobby();
    }
  });

  document.getElementById('overview-reset-all-btn').addEventListener('click', ()=>{
    if(confirm('Alle Spieler und die gesamte Statistik unwiderruflich löschen?')){
      clearAll();
      closeSheet(overviewSheet, overviewBackdrop);
      renderLobby();
      showScreen('lobby');
    }
  });
}
