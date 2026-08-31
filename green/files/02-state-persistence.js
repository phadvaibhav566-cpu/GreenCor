/* ================================================================
   PUBLIC EMERGENCY REPORTS — submitted with no login/password.
   Routed automatically to the nearest matching vehicle's driver login.
   ================================================================ */
const PUBLIC_INCIDENTS = [];
const INCIDENT_TYPE_TO_VEHICLE = {ACCIDENT:'AMBULANCE', MEDICAL:'AMBULANCE', FIRE:'FIRE_BRIGADE', RESCUE:'NDRF'};
const INCIDENT_ICON = {ACCIDENT:'🚗', FIRE:'🔥', MEDICAL:'🩺', RESCUE:'🌊'};
const INCIDENT_LABEL = {ACCIDENT:'Road Accident', FIRE:'Fire', MEDICAL:'Medical Emergency', RESCUE:'Rescue / Disaster'};
function findNearestUnit(vtype, lat, lng){
  let best=null, bestDist=Infinity;
  Object.entries(DB_USERS).forEach(([uname,u])=>{
    if(u.role==='DRIVER' && u.vehicleType===vtype){
      const d = haversine({lat,lng},{lat:u.baseLat,lng:u.baseLng});
      if(d<bestDist){ bestDist=d; best={username:uname, ...u}; }
    }
  });
  return best ? {...best, distanceM:bestDist} : null;
}

let CURRENT_USER = null; // {username, ...DB_USERS[username]}
const AUDIT_LOG = [];

/* Shared "active trip" state — the single source of truth every dashboard reads from */
let TRIP = null;
/*
TRIP = {
  emergencyCode, vehicleId, vehicleType, driverName, medicalStaffName,
  originName, destHospital, status, corridorStatus,
  patientCase:{criticality,category,oxygen,notes,incomingSent,hospitalReady},
  distance, etaNormalSec, etaCorridorSec, signals[], routeCoords[],
  progressFrac, currentSpeedKmh, sosActive
}
*/

/* ================================================================
   PERSISTENCE — keeps data alive across page refreshes and keeps
   every device in sync (uses the artifact's built-in storage API).
   Fails silently (app just behaves as before) if storage isn't available.
   ================================================================ */
const GC_STORAGE_OK = (typeof window!=='undefined' && window.storage && typeof window.storage.get==='function');
const GC_SHARED_KEY = 'gc_shared_state_v1';
const GC_SESSION_KEY = 'gc_session_user_v1';
let _gcLastSaveAt = 0, _gcSaveQueued = false, _gcSaving = false;

async function _gcDoSave(){
  if(!GC_STORAGE_OK) return;
  _gcSaving = true; _gcLastSaveAt = Date.now();
  try{
    const payload = { TRIP, PUBLIC_INCIDENTS, AUDIT_LOG };
    await window.storage.set(GC_SHARED_KEY, JSON.stringify(payload), true);
  }catch(e){ /* storage unavailable — ignore, app keeps working locally */ }
  _gcSaving = false;
  if(_gcSaveQueued){ _gcSaveQueued=false; setTimeout(_gcDoSave, 800); }
}
function saveSharedState(){
  if(!GC_STORAGE_OK) return;
  if(_gcSaving || Date.now()-_gcLastSaveAt<800){ _gcSaveQueued=true; return; }
  _gcDoSave();
}
async function loadSharedState(){
  if(!GC_STORAGE_OK) return false;
  try{
    const res = await window.storage.get(GC_SHARED_KEY, true);
    if(!res || !res.value) return false;
    const payload = JSON.parse(res.value);
    TRIP = payload.TRIP || null;
    PUBLIC_INCIDENTS.length = 0; (payload.PUBLIC_INCIDENTS||[]).forEach(x=>PUBLIC_INCIDENTS.push(x));
    AUDIT_LOG.length = 0; (payload.AUDIT_LOG||[]).forEach(x=>AUDIT_LOG.push(x));
    return true;
  }catch(e){ return false; }
}
async function saveSession(username){
  if(!GC_STORAGE_OK) return;
  try{ await window.storage.set(GC_SESSION_KEY, username, false); }catch(e){}
}
async function clearSession(){
  if(!GC_STORAGE_OK) return;
  try{ await window.storage.delete(GC_SESSION_KEY, false); }catch(e){}
}
async function loadSession(){
  if(!GC_STORAGE_OK) return null;
  try{ const res = await window.storage.get(GC_SESSION_KEY, false); return res ? res.value : null; }catch(e){ return null; }
}

function pad(n){return n.toString().padStart(2,'0');}
function nowStr(){const d=new Date();return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;}
function fmtTime(sec){sec=Math.max(0,Math.round(sec));const m=Math.floor(sec/60),s=sec%60;return `${pad(m)}:${pad(s)}`;}
setInterval(()=>{ const c=document.getElementById('clock'); if(c) c.textContent = nowStr(); },1000);

function audit(action, meta){
  AUDIT_LOG.unshift({time: nowStr(), user: CURRENT_USER ? CURRENT_USER.username : 'system', action, meta: meta||''});
  renderAuditLog();
  saveSharedState();
}
function renderAuditLog(){
  const box = document.getElementById('adminLogBox');
  if(!box) return;
  if(!AUDIT_LOG.length){ box.innerHTML = '<div><span class="l-time">[--:--:--]</span> No audit events yet.</div>'; return; }
  box.innerHTML = AUDIT_LOG.slice(0,80).map(e=>`<div><span class="l-time">[${e.time}]</span> <b>${e.user}</b> → ${e.action}${e.meta?' — '+e.meta:''}</div>`).join('');
}

