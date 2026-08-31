/* ================================================================
   HOSPITAL DASHBOARD
   ================================================================ */
let mapHospInited=false, mapHosp, hospVehMarker=null, hospHospitalMarker=null;
function initHospitalMap(hospital){
  if(!mapHospInited){
    mapHosp = L.map('mapHosp',{zoomControl:true}).setView([hospital?hospital.lat:16.6980, hospital?hospital.lng:74.2400],13);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',{attribution:'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors',maxZoom:16}).addTo(mapHosp);
    mapHospInited = true;
  } else { setTimeout(()=>mapHosp.invalidateSize(),50); }
  if(hospital && !hospHospitalMarker){
    hospHospitalMarker = L.marker([hospital.lat,hospital.lng],{icon:makeDivIcon('loc-hospital','🏥',24)}).addTo(mapHosp).bindPopup(`<b>${hospital.name}</b> (this hospital)`);
  }
}
function renderHospitalDash(){
  const hospital = HOSPITALS.find(h=>h.id===CURRENT_USER.hospitalId);
  document.getElementById('hHospName').textContent = hospital ? hospital.name : '—';
  const has = TRIP && TRIP.destHospital.id === CURRENT_USER.hospitalId && TRIP.status!=='CANCELLED';

  document.getElementById('hCardAmb').textContent = has && TRIP.vehicleType==='AMBULANCE' ? 1 : 0;
  document.getElementById('hCardCritical').textContent = has && TRIP.patientCase.criticality==='CRITICAL' ? 1 : 0;
  document.getElementById('hCardEta5').textContent = has && TRIP.etaCorridorSec < 300 ? 1 : 0;
  document.getElementById('hCardCorridor').textContent = has && TRIP.corridorStatus==='ACTIVE' ? 1 : 0;

  initHospitalMap(hospital);
  const liveBadge = document.getElementById('hLiveBadge');
  if(has && TRIP.liveGPS){
    liveBadge.textContent = `LIVE · ${TRIP.vehicleId} · ${TRIP.currentSpeedKmh||0} km/h`;
    liveBadge.className = 'badge green';
    if(!hospVehMarker){ hospVehMarker = L.marker([TRIP.liveGPS.lat,TRIP.liveGPS.lng],{icon:makeDivIcon('loc-incident','🚑',24)}).addTo(mapHosp); }
    else { hospVehMarker.setLatLng([TRIP.liveGPS.lat,TRIP.liveGPS.lng]); }
    hospVehMarker.bindPopup(`<b>${TRIP.vehicleId}</b><br>${TRIP.driverName} · ${TRIP.currentSpeedKmh||0} km/h`);
  } else {
    liveBadge.textContent = 'NO ACTIVE TRIP'; liveBadge.className = 'badge grey';
    if(hospVehMarker){ mapHosp.removeLayer(hospVehMarker); hospVehMarker=null; }
  }

  const list = document.getElementById('hospitalList');
  if(!has){ list.innerHTML = '<div class="empty">No incoming emergency vehicles.</div>'; return; }

  list.innerHTML = `
    <table>
      <thead><tr><th>Vehicle</th><th>Driver</th><th>Patient</th><th>Location / Route</th><th>Distance</th><th>ETA</th><th>Speed</th><th>Corridor</th><th>Actions</th></tr></thead>
      <tbody>
        <tr>
          <td>${TRIP.vehicleId}</td>
          <td>${TRIP.driverName}</td>
          <td><span class="badge ${TRIP.patientCase.criticality==='CRITICAL'?'red':TRIP.patientCase.criticality==='SERIOUS'?'amber':'grey'}">${TRIP.patientCase.criticality}</span></td>
          <td>${TRIP.originName} → ${TRIP.destHospital.name}</td>
          <td>${((TRIP.distance*(1-TRIP.progressFrac))/1000).toFixed(2)} km</td>
          <td>${fmtTime(TRIP.etaCorridorSec*(1-TRIP.progressFrac))}</td>
          <td>${TRIP.currentSpeedKmh||0} km/h</td>
          <td><span class="badge ${TRIP.corridorStatus==='ACTIVE'?'green':'grey'}">${TRIP.corridorStatus}</span></td>
          <td>
            <button class="btn ghost sm" onclick="hospAccept()" ${TRIP.patientCase.hospAccepted?'disabled':''}>${TRIP.patientCase.hospAccepted?'✓ Accepted':'Accept'}</button>
            <button class="btn ghost sm" onclick="hospPrepare()" ${TRIP.patientCase.hospPreparing?'disabled':''}>${TRIP.patientCase.hospPreparing?'✓ ED Preparing':'Prepare ED'}</button>
            <button class="btn green sm" onclick="hospReady()" ${TRIP.patientCase.hospitalReady?'disabled':''}>${TRIP.patientCase.hospitalReady?'✓ Ready':'Ready to Receive'}</button>
          </td>
        </tr>
      </tbody>
    </table>
    ${TRIP.patientCase.hospAccepted ? '<div class="footer-note" style="padding:10px 0 0;">✅ Hospital has accepted this incoming case.</div>' : ''}
    ${TRIP.patientCase.hospPreparing ? '<div class="footer-note" style="padding:2px 0 0;">🛏️ Emergency Department is being prepared.</div>' : ''}
    ${TRIP.patientCase.hospitalReady ? '<div class="footer-note" style="padding:2px 0 0;">🟢 Hospital marked as Ready to Receive.</div>' : ''}
    ${TRIP.patientCase.incomingSent ? '<div class="footer-note" style="padding:10px 0 0;">📨 "Patient Incoming" notification received from medical staff.</div>' : ''}
    ${TRIP.patientCase.notes ? `<div class="card" style="margin-top:10px;"><h3>Clinical Notes from Medical Staff</h3><div style="font-size:12.5px;white-space:pre-wrap;">${TRIP.patientCase.notes}</div></div>` : ''}
  `;
}
function hospAccept(){ if(!TRIP) return; TRIP.patientCase.hospAccepted = true; audit('HOSPITAL_ACCEPTED', TRIP.emergencyCode); renderHospitalDash(); }
function hospPrepare(){ if(!TRIP) return; TRIP.patientCase.hospPreparing = true; audit('HOSPITAL_PREPARING_ED', TRIP.emergencyCode); renderHospitalDash(); }
function hospReady(){ if(!TRIP) return; TRIP.patientCase.hospitalReady = true; audit('HOSPITAL_READY_TO_RECEIVE', TRIP.emergencyCode); renderHospitalDash(); renderMedicalDash(); }

