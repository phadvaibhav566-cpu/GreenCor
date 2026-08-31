/* ================================================================
   TRAFFIC POLICE / RTO DASHBOARD
   ================================================================ */
let mapTPInited=false, mapTP, tpVehMarker=null, tpSignalMarkers=[];
function initTrafficDash(){
  if(!mapTPInited){
    mapTP = L.map('mapTP',{zoomControl:true}).setView([16.6980,74.2400],13);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',{attribution:'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors',maxZoom:16}).addTo(mapTP);
    HOSPITALS.forEach(h=> L.marker([h.lat,h.lng],{icon:makeDivIcon('loc-hospital','🏥',22)}).addTo(mapTP).bindPopup(`<b>${h.name}</b>`) );
    mapTPInited = true;
  } else { setTimeout(()=>mapTP.invalidateSize(),50); }

  document.getElementById('tpApproveBtn').onclick = ()=>{
    if(!TRIP) return;
    TRIP.corridorStatus='APPROVED'; audit('CORRIDOR_APPROVED', TRIP.emergencyCode);
    tpLog('Green Corridor <b>APPROVED</b> for '+TRIP.emergencyCode+'.','l-green');
    TRIP.corridorStatus='ACTIVE';
    runCorridorSimulation();
    renderTrafficDash();
  };
  document.getElementById('tpRejectBtn').onclick = ()=>{
    if(!TRIP) return;
    TRIP.corridorStatus='REJECTED'; audit('CORRIDOR_REJECTED', TRIP.emergencyCode);
    tpLog('Green Corridor <b>REJECTED</b> for '+TRIP.emergencyCode+'.','l-red');
    renderTrafficDash();
  };
  document.getElementById('tpPauseBtn').onclick = ()=>{
    if(!TRIP) return; TRIP.corridorStatus='PAUSED'; audit('CORRIDOR_PAUSED', TRIP.emergencyCode);
    tpLog('Corridor <b>PAUSED</b> by traffic control.','l-amber'); if(animTimer) cancelAnimationFrame(animTimer); renderTrafficDash();
  };
  document.getElementById('tpEndBtn').onclick = ()=>{
    if(!TRIP) return; TRIP.corridorStatus='CLOSED'; audit('CORRIDOR_ENDED', TRIP.emergencyCode);
    tpLog('Corridor <b>CLOSED</b> — normal signal cycle restored.','l-amber'); if(animTimer) cancelAnimationFrame(animTimer); renderTrafficDash();
  };
  document.getElementById('tpOverrideBtn').onclick = ()=>{
    if(!TRIP) return; audit('SYSTEM_OVERRIDE', TRIP.emergencyCode); tpLog('Manual <b>override</b> of system recommendation logged.','l-amber');
  };
  document.getElementById('tpAlertBtn').onclick = ()=>{
    audit('ALERT_SENT', TRIP ? TRIP.emergencyCode : 'general'); tpLog('Alert broadcast to field officers.','l-blue');
  };

  renderTrafficDash();
}
function tpLog(msg,cls){
  const box = document.getElementById('tpLogBox');
  const line=document.createElement('div'); line.innerHTML=`<span class="l-time">[${nowStr()}]</span> <span class="${cls||''}">${msg}</span>`;
  box.appendChild(line); box.scrollTop=box.scrollHeight;
}
function renderTrafficDash(){
  tpSignalMarkers.forEach(m=>mapTP.removeLayer(m)); tpSignalMarkers=[];
  if(tpVehMarker){ mapTP.removeLayer(tpVehMarker); tpVehMarker=null; }

  const card = document.getElementById('tpVehicleCard');
  const seq = document.getElementById('tpSignalSeq');
  const approveBtn=document.getElementById('tpApproveBtn'), rejectBtn=document.getElementById('tpRejectBtn'),
        pauseBtn=document.getElementById('tpPauseBtn'), endBtn=document.getElementById('tpEndBtn'), overrideBtn=document.getElementById('tpOverrideBtn');

  if(!TRIP){
    card.innerHTML = '<div class="empty">No active emergency vehicle right now.</div>';
    seq.innerHTML = '<div class="empty">Appears once a route is dispatched.</div>';
    [approveBtn,rejectBtn,pauseBtn,endBtn,overrideBtn].forEach(b=>b.disabled=true);
    return;
  }

  card.innerHTML = `
    <div class="kv"><span class="k">Vehicle ID</span><span class="v">${TRIP.vehicleId}</span></div>
    <div class="kv"><span class="k">Type</span><span class="v">${TRIP.vehicleType}</span></div>
    <div class="kv"><span class="k">Driver</span><span class="v">${TRIP.driverName}</span></div>
    <div class="kv"><span class="k">Destination</span><span class="v">${TRIP.destHospital.name}</span></div>
    <div class="kv"><span class="k">Distance</span><span class="v">${(TRIP.distance/1000).toFixed(2)} km</span></div>
    <div class="kv"><span class="k">ETA (corridor)</span><span class="v">${fmtTime(TRIP.etaCorridorSec)}</span></div>
    <div class="kv"><span class="k">Emergency Priority</span><span class="v">${TRIP.sosActive ? '<span class="badge red">SOS</span>' : '<span class="badge amber">HIGH</span>'}</span></div>
    <div class="kv"><span class="k">Corridor Status</span><span class="v"><span class="badge ${TRIP.corridorStatus==='ACTIVE'?'green':TRIP.corridorStatus==='REQUESTED'?'amber':TRIP.corridorStatus==='REJECTED'?'red':'grey'}">${TRIP.corridorStatus}</span></span></div>
    <div class="kv"><span class="k">Live GPS</span><span class="v">${TRIP.liveGPS ? TRIP.liveGPS.lat.toFixed(4)+', '+TRIP.liveGPS.lng.toFixed(4)+' · '+(TRIP.currentSpeedKmh||0)+' km/h' : '—'}</span></div>
  `;

  seq.innerHTML = TRIP.signals.map((s,i)=>{
    const status = TRIP.corridorStatus==='ACTIVE' ? (i===0?'GREEN':'PREPARE') : 'PENDING';
    return `<div class="kv"><span class="k">${s.code} — ${s.name}</span><span class="v"><span class="badge ${status==='GREEN'?'green':status==='PREPARE'?'amber':'grey'}">${status}</span></span></div>`;
  }).join('') || '<div class="empty">No intermediate signals on this route.</div>';

  L.marker([HOSPITALS[0].lat,HOSPITALS[0].lng]); // no-op keep hospitals rendered once (already added on init)
  TRIP.signals.forEach(s=>{ const m=L.circleMarker([s.coord.lat,s.coord.lng],{radius:5,color:'#F5A524',fillOpacity:0.8}).addTo(mapTP).bindPopup(s.name); tpSignalMarkers.push(m); });
  if(routeCoords.length){
    const line = L.polyline(routeCoords.map(c=>[c.lat,c.lng]),{color:'#5B8CFF',weight:4,opacity:0.7}).addTo(mapTP);
    tpSignalMarkers.push(line);
    mapTP.fitBounds(line.getBounds(),{padding:[30,30]});
  }
  const liveLat = TRIP.liveGPS ? TRIP.liveGPS.lat : (routeCoords[0]?.lat||16.698);
  const liveLng = TRIP.liveGPS ? TRIP.liveGPS.lng : (routeCoords[0]?.lng||74.24);
  tpVehMarker = L.marker([liveLat, liveLng],{icon:makeDivIcon('loc-incident','🚑',24)}).addTo(mapTP).bindPopup(`<b>${TRIP.vehicleId}</b><br>Live position · ${(TRIP.currentSpeedKmh||0)} km/h`);

  approveBtn.disabled = TRIP.corridorStatus!=='REQUESTED';
  rejectBtn.disabled = TRIP.corridorStatus!=='REQUESTED';
  pauseBtn.disabled = TRIP.corridorStatus!=='ACTIVE';
  endBtn.disabled = !(TRIP.corridorStatus==='ACTIVE'||TRIP.corridorStatus==='PAUSED');
  overrideBtn.disabled = false;
}

