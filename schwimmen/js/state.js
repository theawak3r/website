// state.js
// Zentraler Datenspeicher der App + Persistenz in localStorage.
// Andere Module importieren `state` und mutieren dessen Felder direkt
// (state.roster.push(...) usw.) statt eigene Kopien zu halten.

export const STORAGE_KEY = 'schwimmen-state-v2';

export const MODE_LABELS = {
  last: { tag: 'Letzter übrig gewinnt' },
  firstOut: { tag: 'Erster ohne Leben beendet die Runde' }
};

export const state = {
  roster: [],           // [{ id, name, wins, losses }]
  startLives: 3,
  mode: 'last',          // 'last' | 'firstOut'
  round: {
    active: false,
    finished: false,
    mode: 'last',
    specialId: null,     // Gewinner (mode 'last') oder Verlierer (mode 'firstOut')
    players: []          // [{ id, lives, maxLives, out }]
  },
  nextId: 1,
  currentScreen: 'lobby'
};

export function saveState(){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      roster: state.roster,
      startLives: state.startLives,
      mode: state.mode,
      round: state.round,
      nextId: state.nextId
    }));
  }catch(e){ /* localStorage evtl. nicht verfügbar, still ignorieren */ }
}

export function loadLocalState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return false;
    const data = JSON.parse(raw);
    if(data && Array.isArray(data.roster)){
      state.roster = data.roster;
      state.startLives = data.startLives || 3;
      state.mode = data.mode === 'firstOut' ? 'firstOut' : 'last';
      state.round = data.round || { active:false, finished:false, mode:'last', specialId:null, players:[] };
      state.nextId = data.nextId || (state.roster.length + 1);
      return true;
    }
  }catch(e){ /* ignorieren */ }
  return false;
}

export function clearAll(){
  state.roster = [];
  state.round = { active:false, finished:false, mode:'last', specialId:null, players:[] };
  state.startLives = 3;
  state.mode = 'last';
  try{ localStorage.removeItem(STORAGE_KEY); }catch(e){}
}
