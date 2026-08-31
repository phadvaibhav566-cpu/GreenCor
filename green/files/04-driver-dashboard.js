/* ================================================================
   DRIVER DASHBOARD  (map + route logic reused from the original prototype)
   ================================================================ */
let mapDriverInited = false;
let map, originMarker=null, destMarker=null, routeLine=null, ambMarker=null, signalMarkers=[];
let animTimer=null, routeCoords=[], signals=[];
let liveOn = false, liveWatchId=null, liveDriverMarker=null;

function initDriverDash(){
  document.getElementById('drvName').textContent = CURRENT_USER.fullName;
  document.getElementById('drvId').textContent = CURRENT_USER.driverId || '—';
  document.getElementById('drvVehId').textContent = CURRENT_USER.vehicleId || '—';
  document.getElementById('drvReg').textContent = CURRENT_USER.regNo || '—';
  document.getElementById('drvType').textContent = (CURRENT_USER.vehicleType||'—').replace('_',' ');

  const originSel = document.getElementById('origin');
  const destSel = document.getElementById('destination');
  const isFireBrigade = CURRENT_USER.vehicleType === 'FIRE_BRIGADE';
  if(!originSel.options.length){
    ORIGIN_POINTS.forEach(l=>{ const o=document.createElement('option'); o.value=l.id; o.textContent=l.name; originSel.appendChild(o); });
    if(isFireBrigade){
      FIRE_INCIDENT_SITES.forEach(s=>{ const o=document.createElement('option'); o.value=s.id; o.textContent=s.name; destSel.appendChild(o); });
      document.getElementById('destLabel').textContent = '🔥 Fire Incident Location';
      originSel.value = FIRE_STATION.id; destSel.selectedIndex = 0;
    } else {
      HOSPITALS.forEach(h=>{ const o=document.createElement('option'); o.value=h.id; o.textContent=h.name; destSel.appendChild(o); });
      originSel.selectedIndex = 6; destSel.selectedIndex = 0;
    }
  }

  if(!mapDriverInited){
    map = L.map('map',{zoomControl:true}).setView(isFireBrigade ? [FIRE_STATION.lat,FIRE_STATION.lng] : [16.6980,74.2400], 14);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',{attribution:'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors',maxZoom:16}).addTo(map);
    /* Plot every known point of interest on the map immediately (before any trip starts)
       so the full Kolhapur city detail — fire station, hospitals, landmarks — is visible right away. */
    L.marker([FIRE_STATION.lat,FIRE_STATION.lng],{icon:makeDivIcon('loc-incident','🚒',24)}).addTo(map).bindPopup(`<b>${FIRE_STATION.name}</b>`);
    HOSPITALS.forEach(h=>L.marker([h.lat,h.lng],{icon:makeDivIcon('loc-hospital','🏥',18)}).addTo(map).bindPopup(`<b>${h.name}</b>`));
    LANDMARKS.forEach(l=>L.circleMarker([l.lat,l.lng],{radius:4,color:'#5B8CFF',weight:1,fillColor:'#5B8CFF',fillOpacity:0.7}).addTo(map).bindPopup(`<b>${l.name}</b>`));
    if(isFireBrigade) FIRE_INCIDENT_SITES.forEach(s=>L.circleMarker([s.lat,s.lng],{radius:5,color:'#F5A524',weight:1.5,fillColor:'#F5A524',fillOpacity:0.5}).addTo(map).bindPopup(`<b>${s.name}</b>`));
    mapDriverInited = true;
  } else {
    setTimeout(()=>map.invalidateSize(), 50);
  }

  document.getElementById('dispatchBtn').onclick = ()=>startEmergencyTrip();
  document.getElementById('stopTripBtn').onclick = stopEmergencyTrip;
  document.getElementById('cancelTripBtn').onclick = cancelEmergency;
  document.getElementById('shareLocBtn').onclick = toggleShareLocation;
  document.getElementById('requestCorridorBtn').onclick = requestGreenCorridor;
  document.getElementById('pickedUpBtn').onclick = pickedUpContinueToHospital;
  document.getElementById('sosBtn').onclick = triggerSOS;

  renderIncidentAlerts();
  refreshTripUIForDriver();
  restoreDriverTripVisuals();
}

/* Redraws an already-in-progress trip's route/markers/signals on the map from the
   saved TRIP object — used after a page refresh (or a fresh login on another
   device) so an ongoing trip doesn't just disappear. */
function restoreDriverTripVisuals(){
  if(!TRIP || !CURRENT_USER || TRIP.vehicleId!==CURRENT_USER.vehicleId) return;
  if(!TRIP.routeCoords || !TRIP.routeCoords.length) return;
  if(routeLine) return; // already drawn in this session
  routeCoords = TRIP.routeCoords; signals = TRIP.signals || [];
  const originData = {lat:routeCoords[0].lat, lng:routeCoords[0].lng, name:TRIP.originName};
  const destData = TRIP.destHospital;
  const isFireBrigade = TRIP.vehicleType === 'FIRE_BRIGADE';
  originMarker = L.marker([originData.lat,originData.lng],{icon:makeDivIcon('loc-incident','📍',26)}).addTo(map).bindPopup(`<b>Pickup:</b> ${originData.name}`);
  destMarker = L.marker([destData.lat,destData.lng],{icon:makeDivIcon(isFireBrigade?'loc-incident':'loc-hospital', isFireBrigade?'🔥':'🏥',26)}).addTo(map).bindPopup(`<b>Destination:</b> ${destData.name}`);
  routeLine = L.polyline(routeCoords.map(c=>[c.lat,c.lng]),{color:'#5B8CFF',weight:5,opacity:0.85}).addTo(map);
  const glow = L.polyline(routeCoords.map(c=>[c.lat,c.lng]),{color:'#5B8CFF',weight:12,opacity:0.15}).addTo(map);
  routeLine._glow = glow;
  map.fitBounds(routeLine.getBounds(),{padding:[40,40]});
  placeSignalMarkers();
  renderMetrics(); renderSignalList(); renderIotList(); renderRail();
  if(TRIP.liveGPS){
    ambMarker = L.marker([TRIP.liveGPS.lat,TRIP.liveGPS.lng],{icon:L.divIcon({className:'',html:'<div class="amb-icon">🚑</div>',iconSize:[22,22],iconAnchor:[11,11]})}).addTo(map);
  }
  drvLog('Ongoing trip restored.','l-blue');
}

/* List public accident/fire/rescue reports matched to THIS driver's vehicle (nearest-unit routing) */
function renderIncidentAlerts(){
  const box = document.getElementById('incidentAlertList');
  const countChip = document.getElementById('incidentAlertCount');
  if(!box || !CURRENT_USER) return;
  const mine = PUBLIC_INCIDENTS.filter(inc =>
    inc.assignedUsername === CURRENT_USER.username && (inc.status==='NEW' || inc.status==='ASSIGNED')
  );
  if(!mine.length){ box.innerHTML = '<div class="empty">No public accident/fire reports assigned to your vehicle right now.</div>'; countChip.style.display='none'; return; }
  countChip.style.display='inline-block'; countChip.textContent = mine.length;
  box.innerHTML = mine.map(inc => `
    <div class="signal-item" style="align-items:flex-start;">
      <div class="signal-dot" style="background:var(--red);box-shadow:0 0 6px var(--red);margin-top:4px;"></div>
      <div class="signal-info">
        <div class="signal-name">${INCIDENT_ICON[inc.type]||'🆘'} ${inc.typeLabel} — ${inc.locationName}</div>
        <div class="signal-sub">${inc.description ? inc.description.slice(0,70) : 'No further description provided'} · ${inc.time}</div>
        ${inc.status==='ASSIGNED' ? '<span class="badge amber" style="margin-top:4px;">DISPATCHED</span>' : `<button class="btn primary sm" style="margin-top:6px;" onclick="acceptIncident('${inc.id}')">🚑 ACCEPT & DISPATCH</button>`}
      </div>
    </div>`).join('');
}

function drvLog(msg,cls){
  const box = document.getElementById('drvLogBox');
  const line = document.createElement('div');
  line.innerHTML = `<span class="l-time">[${nowStr()}]</span> <span class="${cls||''}">${msg}</span>`;
  box.appendChild(line); box.scrollTop = box.scrollHeight;
}

function haversine(a,b){
  const R=6371000, toRad=d=>d*Math.PI/180;
  const dLat=toRad(b.lat-a.lat), dLng=toRad(b.lng-a.lng);
  const s=Math.sin(dLat/2)**2 + Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(s));
}
async function fetchRoute(a,b){
  const url = `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson&steps=false`;
  const res = await fetch(url);
  if(!res.ok) throw new Error('routing error');
  const data = await res.json();
  if(!data.routes||!data.routes.length) throw new Error('no route');
  const r = data.routes[0];
  return {coords:r.geometry.coordinates.map(c=>({lat:c[1],lng:c[0]})), distance:r.distance};
}
const NORMAL_SPEED_MPS=5.0, CORRIDOR_SPEED_MPS=9.7, MAX_SIGNALS=7, SIGNAL_SPACING_M=550;
function nearestJunction(coord, usedCodes){
  let best=null, bestDist=Infinity;
  KOLHAPUR_JUNCTIONS.forEach(j=>{
    if(usedCodes.has(j.code)) return;
    const d = haversine(coord, j);
    if(d<bestDist){ bestDist=d; best=j; }
  });
  return best;
}
function buildSignals(coords,totalDist){
  const out=[]; let acc=0,lastMark=0,genericCount=0; const usedCodes=new Set();
  for(let i=1;i<coords.length;i++){
    acc += haversine(coords[i-1],coords[i]);
    if(acc-lastMark>=SIGNAL_SPACING_M && out.length<MAX_SIGNALS && acc<totalDist-150){
      lastMark=acc; genericCount++;
      const j = nearestJunction(coords[i], usedCodes);
      if(j){ usedCodes.add(j.code); out.push({distM:acc, coord:coords[i], name:j.name, code:j.code}); }
      else { out.push({distM:acc, coord:coords[i], name:`Signal Junction ${genericCount}`, code:`KOP-SIG-${String(genericCount).padStart(3,'0')}`}); }
    }
  }
  out.forEach(s=>{ s.etaCorridor = s.distM/CORRIDOR_SPEED_MPS; s.etaNormal = s.distM/NORMAL_SPEED_MPS; s.state='idle'; });
  return out;
}

function makeDivIcon(cls,emoji,size){
  return L.divIcon({className:'', html:`<div class="loc-icon ${cls}" style="width:${size}px;height:${size}px;"><span>${emoji}</span></div>`, iconSize:[size,size], iconAnchor:[size/2,size]});
}

async function startEmergencyTrip(explicitOrigin, explicitDest, opts){
  opts = opts || {};
  if(TRIP && TRIP.status==='EN_ROUTE' && !opts.forceRestart){ drvLog('Trip already in progress.','l-amber'); return; }
  const originSel = document.getElementById('origin'), destSel = document.getElementById('destination');
  const isFireBrigade = CURRENT_USER.vehicleType === 'FIRE_BRIGADE';
  const originData = explicitOrigin || ORIGIN_POINTS.find(l=>l.id===originSel.value) || LANDMARKS.find(l=>l.id===originSel.value);
  const destData = explicitDest || (isFireBrigade ? FIRE_INCIDENT_SITES.find(s=>s.id===destSel.value) : HOSPITALS.find(h=>h.id===destSel.value));
  const btn = document.getElementById('dispatchBtn');
  btn.disabled = true; btn.textContent = '⏳ Computing route…';

  clearMapLayers();
  const destEmoji = opts.leg==='TO_INCIDENT' ? '🚨' : isFireBrigade ? '🔥' : '🏥';
  const destCls = opts.leg==='TO_INCIDENT' ? 'loc-incident' : isFireBrigade ? 'loc-incident' : 'loc-hospital';
  originMarker = L.marker([originData.lat,originData.lng],{icon:makeDivIcon('loc-incident','📍',26)}).addTo(map).bindPopup(`<b>Pickup:</b> ${originData.name}`);
  destMarker = L.marker([destData.lat,destData.lng],{icon:makeDivIcon(destCls,destEmoji,26)}).addTo(map).bindPopup(`<b>Destination:</b> ${destData.name}`);

  drvLog(`Emergency trip started: <b>${originData.name}</b> → <b>${destData.name}</b>`,'l-amber');

  let routeResult;
  try{
    routeResult = await fetchRoute(originData,destData);
    drvLog('Live road route received from routing engine.','l-green');
  }catch(e){
    drvLog('Routing service unavailable — using straight-line path.','l-red');
    routeResult = {coords:[{lat:originData.lat,lng:originData.lng},{lat:destData.lat,lng:destData.lng}], distance:haversine(originData,destData)};
  }
  routeCoords = routeResult.coords;
  const totalDist = routeResult.distance;
  routeLine = L.polyline(routeCoords.map(c=>[c.lat,c.lng]),{color:'#5B8CFF',weight:5,opacity:0.85}).addTo(map);
  const glow = L.polyline(routeCoords.map(c=>[c.lat,c.lng]),{color:'#5B8CFF',weight:12,opacity:0.15}).addTo(map);
  routeLine._glow = glow;
  map.fitBounds(routeLine.getBounds(),{padding:[40,40]});
  signals = buildSignals(routeCoords,totalDist);
  placeSignalMarkers();

  const etaNormal = totalDist/NORMAL_SPEED_MPS, etaCorridor = totalDist/CORRIDOR_SPEED_MPS;

  TRIP = {
    emergencyCode: opts.emergencyCode || ('EMG-2026-' + String(Math.floor(1000+Math.random()*8999))),
    vehicleId: CURRENT_USER.vehicleId, vehicleType: CURRENT_USER.vehicleType,
    driverName: CURRENT_USER.fullName, medicalStaffName: null,
    originName: originData.name, destHospital: destData,
    status: 'EN_ROUTE', corridorStatus: 'NONE',
    leg: opts.leg || 'DIRECT', incident: opts.incident || null,
    patientCase: opts.patientCase || {criticality:'STABLE', category:'OTHER', oxygen:false, notes:'', incomingSent:false, hospitalReady:false, hospAccepted:false, hospPreparing:false},
    distance: totalDist, etaNormalSec: etaNormal, etaCorridorSec: etaCorridor,
    signals, routeCoords, progressFrac: 0, currentSpeedKmh: 0, sosActive:false,
    liveGPS: {lat:originData.lat, lng:originData.lng, speedKmh:0, ts:Date.now()},
  };
  audit(opts.leg==='TO_INCIDENT' ? 'DISPATCHED_TO_INCIDENT' : 'TRIP_STARTED', `${TRIP.emergencyCode} ${originData.name} → ${destData.name}`);
  drvLog(`Route locked: ${(totalDist/1000).toFixed(2)} km, ${signals.length} signal junction(s) identified.`,'l-green');
  drvLog(opts.leg==='TO_INCIDENT' ? 'Notified traffic control of pickup response.' : 'Notified destination hospital and traffic control.','l-green');

  renderMetrics(); renderSignalList(); renderIotList(); renderRail();
  refreshTripUIForDriver();

  btn.textContent = '🚑 Trip En Route';

  if(opts.autoRequestCorridor){ requestGreenCorridor(); }
  renderIncidentAlerts();
}

/* Driver accepts a public incident report → pickup leg starts immediately with
   Green Corridor auto-requested (per policy, corridor coverage now includes pickup, not just hospital drop). */
function acceptIncident(incidentId){
  const inc = PUBLIC_INCIDENTS.find(x=>x.id===incidentId);
  if(!inc) return;
  if(TRIP && TRIP.status==='EN_ROUTE'){ alert('Finish or cancel your current trip before accepting a new incident.'); return; }
  inc.status = 'ASSIGNED'; inc.assignedUsername = CURRENT_USER.username;
  audit('INCIDENT_ASSIGNED', `${inc.id} → ${CURRENT_USER.username}`);
  const origin = {name: CURRENT_USER.baseName ? `${CURRENT_USER.baseName} (Vehicle Base)` : 'Vehicle Base', lat: CURRENT_USER.baseLat, lng: CURRENT_USER.baseLng};
  const dest = {name: `Incident Site — ${inc.locationName}`, lat: inc.lat, lng: inc.lng};
  startEmergencyTrip(origin, dest, {
    leg:'TO_INCIDENT', incident: inc, autoRequestCorridor:true,
    emergencyCode: 'EMG-2026-' + String(Math.floor(1000+Math.random()*8999)),
    patientCase: {criticality: inc.type==='FIRE'?'SERIOUS':'CRITICAL', category: inc.type, oxygen:false, notes: inc.description||'', incomingSent:false, hospitalReady:false, hospAccepted:false, hospPreparing:false},
  });
}

/* Driver has reached the incident / picked up the patient → auto-continue to nearest hospital, corridor requested again for this leg. */
function pickedUpContinueToHospital(){
  if(!TRIP || TRIP.leg!=='TO_INCIDENT'){ return; }
  const incidentPoint = {lat:TRIP.destHospital.lat, lng:TRIP.destHospital.lng, name:TRIP.destHospital.name};
  let nearestHosp=null, bestD=Infinity;
  HOSPITALS.forEach(h=>{ const d=haversine(incidentPoint,h); if(d<bestD){ bestD=d; nearestHosp=h; } });
  drvLog('Patient picked up at incident site — continuing to nearest hospital.','l-green');
  audit('PATIENT_PICKED_UP', TRIP.emergencyCode);
  startEmergencyTrip(incidentPoint, nearestHosp, {
    leg:'TO_HOSPITAL', incident: TRIP.incident, autoRequestCorridor:true, forceRestart:true,
    emergencyCode: TRIP.emergencyCode, patientCase: TRIP.patientCase,
  });
}

function setGpsBanner(msg, kind){
  const b = document.getElementById('liveGpsBanner');
  if(!b) return;
  if(!msg){ b.style.display='none'; return; }
  const colors = {ok:['#123A32','#2FD9A7'], warn:['#4A3618','#F5A524'], err:['#4A2029','#EF4B54']};
  const [bg,fg] = colors[kind]||colors.warn;
  b.style.display='block'; b.style.background=bg; b.style.color=fg; b.style.border=`1px solid ${fg}44`;
  b.textContent = msg;
}

function toggleShareLocation(){
  const btn = document.getElementById('shareLocBtn');
  if(!navigator.geolocation){
    setGpsBanner('⚠ This browser/device does not support GPS location.','err');
    return;
  }
  if(liveOn){
    // turning OFF
    liveOn = false;
    document.getElementById('drvGps').textContent = 'OFF';
    btn.textContent = '📡 SHARE LIVE LOCATION';
    if(liveWatchId!==null){ navigator.geolocation.clearWatch(liveWatchId); liveWatchId=null; }
    if(liveDriverMarker){ map.removeLayer(liveDriverMarker); liveDriverMarker=null; }
    drvLog('Live GPS sharing stopped.','l-amber');
    setGpsBanner('','');
    return;
  }
  // turning ON — wait for an actual GPS fix before claiming success
  btn.textContent = '⏳ FETCHING GPS…';
  setGpsBanner('Fetching your live GPS position — allow the location permission if your browser asks for it…','warn');
  liveWatchId = navigator.geolocation.watchPosition(pos=>{
    liveOn = true;
    document.getElementById('drvGps').textContent = 'ON';
    btn.textContent = '📡 SHARING…';
    const ll = {lat:pos.coords.latitude, lng:pos.coords.longitude};
    if(!liveDriverMarker){
      liveDriverMarker = L.marker([ll.lat,ll.lng],{icon:L.divIcon({className:'',html:'<div class="drv-icon"><div class="core"></div></div>',iconSize:[20,20],iconAnchor:[10,10]})}).addTo(map);
    } else { liveDriverMarker.setLatLng([ll.lat,ll.lng]); }
    map.panTo([ll.lat,ll.lng]);
    setGpsBanner(`📍 Live location active (accuracy ±${Math.round(pos.coords.accuracy)}m).`,'ok');
    if(TRIP && TRIP.vehicleId===CURRENT_USER.vehicleId){
      TRIP.liveGPS = {lat:ll.lat, lng:ll.lng, speedKmh: pos.coords.speed ? Math.round(pos.coords.speed*3.6) : TRIP.currentSpeedKmh, ts: Date.now()};
    }
  }, err=>{
    liveOn = false;
    document.getElementById('drvGps').textContent = 'OFF';
    btn.textContent = '📡 SHARE LIVE LOCATION';
    if(liveWatchId!==null){ navigator.geolocation.clearWatch(liveWatchId); liveWatchId=null; }
    const reason = err && err.code===1 ? 'Location permission was denied — allow it in your browser\'s site settings and try again.'
      : err && err.code===2 ? 'Position unavailable — check that GPS/location is turned on for this device.'
      : err && err.code===3 ? 'GPS fix timed out — move to an open area and try again.'
      : 'GPS fix unavailable — check device location permissions.';
    drvLog(reason,'l-red');
    setGpsBanner('⚠ '+reason,'err');
  }, {enableHighAccuracy:true, timeout:15000, maximumAge:5000});
}

function requestGreenCorridor(){
  if(!TRIP){ return; }
  TRIP.corridorStatus = 'REQUESTED';
  audit('CORRIDOR_REQUESTED', TRIP.emergencyCode);
  drvLog('Green Corridor requested — awaiting Traffic Police / RTO approval. Drivers cannot control signals directly.','l-amber');
  document.getElementById('railStatus').textContent = 'CORRIDOR REQUESTED';
  document.getElementById('railStatus').style.color = 'var(--amber)';
  refreshTripUIForDriver();
}

function stopEmergencyTrip(){
  if(!TRIP) return;
  if(animTimer) cancelAnimationFrame(animTimer);
  TRIP.status = 'ARRIVED';
  audit('TRIP_STOPPED', TRIP.emergencyCode);
  drvLog('Emergency trip stopped by driver.','l-amber');
  refreshTripUIForDriver();
}

function cancelEmergency(){
  if(!TRIP) return;
  audit('TRIP_CANCELLED', TRIP.emergencyCode);
  drvLog('Emergency cancelled. Corridor released, resources freed.','l-red');
  if(TRIP.leg==='TO_INCIDENT' && TRIP.incident){
    TRIP.incident.status='NEW'; TRIP.incident.assignedUsername=null;
    audit('INCIDENT_REOPENED', TRIP.incident.id);
  }
  if(animTimer) cancelAnimationFrame(animTimer);
  TRIP = null;
  clearMapLayers();
  document.getElementById('metricsBox').innerHTML = '<div class="empty">Select pickup + hospital, then start emergency trip.</div>';
  document.getElementById('signalList').innerHTML = '<div class="empty">Signal coordination plan appears after route is computed.</div>';
  document.getElementById('iotList').innerHTML = '<div class="empty">Connected controllers report ON/OFF state during a dispatch.</div>';
  document.getElementById('railTrack').innerHTML = '<div class="rail-empty">Corridor timeline activates once a trip starts.</div>';
  document.getElementById('railStatus').textContent='STANDBY'; document.getElementById('railStatus').style.color='var(--muted-2)';
  document.getElementById('dispatchBtn').textContent = '🚨 START EMERGENCY TRIP'; document.getElementById('dispatchBtn').disabled=false;
  refreshTripUIForDriver();
  renderIncidentAlerts();
}

function triggerSOS(){
  if(TRIP) TRIP.sosActive = true;
  audit('SOS_TRIGGERED', TRIP ? TRIP.emergencyCode : CURRENT_USER.vehicleId);
  drvLog('🆘 EMERGENCY SOS TRIGGERED — highest priority alert sent to Traffic Control and Hospital.','l-red');
}

function clearMapLayers(){
  if(animTimer) cancelAnimationFrame(animTimer);
  [originMarker,destMarker,ambMarker].forEach(m=>{ if(m) map.removeLayer(m); });
  if(routeLine){ if(routeLine._glow) map.removeLayer(routeLine._glow); map.removeLayer(routeLine); }
  signalMarkers.forEach(m=>map.removeLayer(m)); signalMarkers=[];
  originMarker=destMarker=ambMarker=routeLine=null; routeCoords=[]; signals=[];
}

function placeSignalMarkers(){
  signals.forEach((s,i)=>{
    const m = L.marker([s.coord.lat,s.coord.lng],{icon:L.divIcon({className:'',html:`<div class="sig-marker" id="sig-map-${i}"></div>`,iconSize:[14,14],iconAnchor:[7,7]})}).addTo(map).bindPopup(`<b>${s.name}</b> (${s.code})`);
    signalMarkers.push(m);
  });
}

function renderMetrics(){
  const box = document.getElementById('metricsBox');
  if(!TRIP){ box.innerHTML='<div class="empty">Select pickup + hospital, then start emergency trip.</div>'; return; }
  box.innerHTML = `<div class="metric-grid">
    <div class="metric"><div class="val">${(TRIP.distance/1000).toFixed(2)} km</div><div class="lbl">DISTANCE</div></div>
    <div class="metric"><div class="val">${fmtTime(TRIP.etaCorridorSec)}</div><div class="lbl">CORRIDOR ETA</div></div>
    <div class="metric"><div class="val">${fmtTime(TRIP.etaNormalSec)}</div><div class="lbl">NORMAL ETA</div></div>
    <div class="metric save"><div class="val">${fmtTime(TRIP.etaNormalSec-TRIP.etaCorridorSec)}</div><div class="lbl">TIME SAVED</div></div>
  </div>`;
}
function renderSignalList(){
  const box = document.getElementById('signalList');
  if(!signals.length){ box.innerHTML='<div class="empty">No signal junctions on this route.</div>'; return; }
  box.innerHTML = signals.map((s,i)=>`<div class="signal-item" id="sig-row-${i}">
    <div class="signal-dot" id="sig-dot-${i}"></div>
    <div class="signal-info"><div class="signal-name">${s.name}</div><div class="signal-sub">${(s.distM/1000).toFixed(2)} km · ${s.code}</div></div>
    <div class="signal-eta">${fmtTime(s.etaCorridor)}</div>
  </div>`).join('');
}
function renderIotList(){
  const box = document.getElementById('iotList');
  if(!signals.length){ box.innerHTML='<div class="empty">No connected controllers on this route.</div>'; return; }
  box.innerHTML = signals.map((s,i)=>`<div class="iot-item"><div><div>${s.name}</div><span class="iot-id">CTRL-ID: ${s.code}</span></div><div class="iot-chip" id="iot-chip-${i}">OFF</div></div>`).join('');
}
function renderRail(){
  const track = document.getElementById('railTrack');
  if(!signals.length){ track.innerHTML='<div class="rail-empty">No intermediate signals on this route.</div>'; return; }
  const lastFrac = 96;
  track.innerHTML = `<div class="rail-line"></div><div class="rail-line-fill" id="railFill"></div>
    ${signals.map((s,i)=>{ const pct=6+(s.distM/(signals[signals.length-1].distM||1))*(lastFrac-6);
      return `<div class="rail-node" id="rail-node-${i}" style="left:${pct}%;"><div class="dot"></div><div class="rn-label">${s.name}</div></div>`; }).join('')}
    <div class="rail-veh" id="railVeh" style="left:6%;">🚑</div>`;
}

function refreshTripUIForDriver(){
  const reqBtn = document.getElementById('requestCorridorBtn'), stopBtn = document.getElementById('stopTripBtn'), cancelBtn = document.getElementById('cancelTripBtn');
  const active = !!(TRIP && TRIP.status==='EN_ROUTE');
  reqBtn.disabled = !active || TRIP.corridorStatus!=='NONE';
  stopBtn.disabled = !active; cancelBtn.disabled = !active;
  const pickedUpBtn = document.getElementById('pickedUpBtn');
  if(pickedUpBtn) pickedUpBtn.style.display = (active && TRIP.leg==='TO_INCIDENT') ? 'block' : 'none';
}

/* Runs once Traffic Police approves the corridor — animates vehicle + signal ON/OFF */
function runCorridorSimulation(){
  if(!TRIP || !routeCoords.length) return;
  document.getElementById('railStatus').textContent='CORRIDOR ACTIVE'; document.getElementById('railStatus').style.color='var(--green)';
  drvLog('Corridor approved by Traffic Control — vehicle en route with cleared signals.','l-green');
  if(ambMarker) map.removeLayer(ambMarker);
  ambMarker = L.marker([routeCoords[0].lat,routeCoords[0].lng],{icon:L.divIcon({className:'',html:'<div class="amb-icon">🚑</div>',iconSize:[22,22],iconAnchor:[11,11]})}).addTo(map);
  const totalPoints = routeCoords.length, durationMs=14000, startTime=performance.now();
  const signalTriggered=new Array(signals.length).fill(false), iotOn=new Array(signals.length).fill(false), iotOffLogged=new Array(signals.length).fill(false);
  const PASS_MARGIN_M=200;
  const fullDist = routeCoords.reduce((acc,c,i)=> i===0?0:acc+haversine(routeCoords[i-1],c),0);

  function step(t){
    const elapsed=t-startTime; let frac=Math.min(1,elapsed/durationMs);
    const idx=Math.min(totalPoints-1, Math.floor(frac*(totalPoints-1)));
    const pt = routeCoords[idx]; ambMarker.setLatLng([pt.lat,pt.lng]);
    TRIP.progressFrac = frac; TRIP.currentSpeedKmh = Math.round(CORRIDOR_SPEED_MPS*3.6);
    TRIP.liveGPS = {lat:pt.lat, lng:pt.lng, speedKmh:TRIP.currentSpeedKmh, ts:Date.now()};
    saveSharedState();

    const railFill=document.getElementById('railFill'); if(railFill) railFill.style.width=(frac*94+6)+'%';
    const railVeh=document.getElementById('railVeh'); if(railVeh) railVeh.style.left=(frac*90+6)+'%';
    const distCovered = frac*fullDist;

    signals.forEach((s,i)=>{
      const dot=document.getElementById(`sig-dot-${i}`), mapDot=document.getElementById(`sig-map-${i}`), railNode=document.getElementById(`rail-node-${i}`);
      const remaining = s.distM-distCovered; let state='idle';
      if(remaining<0) state='green'; else if(remaining<300) state='amber';
      if(dot) dot.className='signal-dot '+(state==='idle'?'':state);
      if(mapDot){ mapDot.style.background = state==='green'?'var(--green)':state==='amber'?'var(--amber)':'var(--muted-2)'; mapDot.style.boxShadow = state!=='idle' ? '0 0 8px currentColor':'none'; }
      if(railNode) railNode.className='rail-node '+(state==='idle'?'':state);
      if(state==='green' && !signalTriggered[i]){
        signalTriggered[i]=true; iotOn[i]=true;
        const chip=document.getElementById(`iot-chip-${i}`); if(chip){ chip.textContent='ON'; chip.classList.add('on'); }
        drvLog(`IoT → ${s.code}: SET GREEN <b>(ON)</b> for ${s.name}.`,'l-green');
      }
      if(iotOn[i] && !iotOffLogged[i] && (distCovered-s.distM)>PASS_MARGIN_M){
        iotOffLogged[i]=true; iotOn[i]=false;
        const chip=document.getElementById(`iot-chip-${i}`); if(chip){ chip.textContent='OFF'; chip.classList.remove('on'); }
        if(dot) dot.className='signal-dot'; if(mapDot){ mapDot.style.background='var(--muted-2)'; mapDot.style.boxShadow='none'; } if(railNode) railNode.className='rail-node';
        drvLog(`IoT → ${s.code}: RESTORED NORMAL CYCLE <b>(OFF)</b>.`,'l-amber');
      }
    });

    if(frac<1){ animTimer=requestAnimationFrame(step); }
    else{
      document.getElementById('railStatus').textContent='ARRIVED'; document.getElementById('railStatus').style.color='var(--blue)';
      drvLog('Vehicle has arrived at destination hospital. Corridor released.','l-green');
      TRIP.status='ARRIVED'; TRIP.corridorStatus='CLOSED';
      audit('TRIP_ARRIVED', TRIP.emergencyCode);
      refreshTripUIForDriver();
    }
  }
  animTimer = requestAnimationFrame(step);
}

