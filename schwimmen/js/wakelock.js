// wakelock.js
// Hält den Bildschirm während einer laufenden Runde wach (Screen Wake Lock
// API). Degradiert lautlos, wenn der Browser das nicht unterstützt (z.B.
// ältere iOS-Versionen vor 16.4) - dann läuft die App einfach wie zuvor.
//
// Ein Wake Lock wird vom Browser automatisch aufgehoben, sobald der Tab in
// den Hintergrund geht (App gewechselt, Bildschirm gesperrt). Deshalb merken
// wir uns die Absicht ("soll gerade wach gehalten werden") separat und holen
// den Wake Lock beim Zurückkommen automatisch wieder.

let wakeLock = null;
let wantWakeLock = false;

async function requestWakeLock(){
  if(!('wakeLock' in navigator)) return;
  try{
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', ()=>{ wakeLock = null; });
  }catch(e){
    // z.B. Tab gerade nicht sichtbar oder vom System abgelehnt - kein Problem,
    // die App funktioniert auch ohne Wake Lock ganz normal weiter.
    wakeLock = null;
  }
}

async function releaseWakeLockNow(){
  if(wakeLock){
    try{ await wakeLock.release(); }catch(e){}
    wakeLock = null;
  }
}

export async function enableWakeLock(){
  wantWakeLock = true;
  await requestWakeLock();
}

export async function disableWakeLock(){
  wantWakeLock = false;
  await releaseWakeLockNow();
}

document.addEventListener('visibilitychange', ()=>{
  if(wantWakeLock && document.visibilityState === 'visible' && !wakeLock){
    requestWakeLock();
  }
});
