/* ================================================================
   LOGIN
   ================================================================ */
document.getElementById('loginBtn').addEventListener('click', doLogin);
document.getElementById('loginPass').addEventListener('keydown', e=>{ if(e.key==='Enter') doLogin(); });

function doLogin(){
  const u = document.getElementById('loginUser').value.trim();
  const p = document.getElementById('loginPass').value.trim();
  const errBox = document.getElementById('loginError');
  const record = DB_USERS[u];
  // Role is NEVER chosen by the user — it comes only from the DB record below.
  if(!record || record.password !== p){
    errBox.style.display='block';
    errBox.textContent = 'Invalid username or password.';
    return;
  }
  errBox.style.display='none';
  CURRENT_USER = Object.assign({username:u}, record);
  audit('LOGIN', `role=${CURRENT_USER.role}`);
  saveSession(u);
  document.getElementById('loginWrap').style.display='none';
  document.getElementById('app').classList.add('active');
  openDashboardForRole(CURRENT_USER.role);
}

document.getElementById('logoutBtn').addEventListener('click', ()=>{
  audit('LOGOUT');
  CURRENT_USER = null;
  clearSession();
  document.getElementById('app').classList.remove('active');
  document.getElementById('loginWrap').style.display='flex';
  document.getElementById('loginUser').value=''; document.getElementById('loginPass').value='';
  document.querySelectorAll('.dash').forEach(d=>d.classList.remove('active'));
});

/* ================================================================
   PUBLIC EMERGENCY REPORT SCREEN — no username/password required.
   ================================================================ */
(function initPublicReportScreen(){
  const pubLocSel = document.getElementById('pubLocation');
  LANDMARKS.forEach(l=>{ const o=document.createElement('option'); o.value=l.id; o.textContent=l.name; pubLocSel.appendChild(o); });
  let pubGpsCoord = null;

  document.getElementById('publicReportBtn').addEventListener('click', ()=>{
    document.getElementById('loginWrap').style.display='none';
    document.getElementById('publicWrap').style.display='flex';
    document.getElementById('pubSuccess').style.display='none';
  });
  document.getElementById('pubBackBtn').addEventListener('click', (e)=>{
    e.preventDefault();
    document.getElementById('publicWrap').style.display='none';
    document.getElementById('loginWrap').style.display='flex';
  });
  document.getElementById('pubUseGpsBtn').addEventListener('click', ()=>{
    const status = document.getElementById('pubGpsStatus');
    if(!navigator.geolocation){ status.textContent='GPS not available on this device.'; return; }
    status.textContent = 'Fetching your live location…';
    navigator.geolocation.getCurrentPosition(pos=>{
      pubGpsCoord = {lat:pos.coords.latitude, lng:pos.coords.longitude};
      status.textContent = `📍 Using your live GPS location (accuracy ±${Math.round(pos.coords.accuracy)}m).`;
    }, ()=>{ status.textContent = 'Could not fetch GPS — please choose a landmark instead.'; }, {enableHighAccuracy:true});
  });

  document.getElementById('pubSubmitBtn').addEventListener('click', ()=>{
    const type = document.getElementById('pubType').value;
    const landmark = LANDMARKS.find(l=>l.id===pubLocSel.value);
    const loc = pubGpsCoord || landmark;
    const locName = pubGpsCoord ? `Live GPS Pin near ${landmark.name}` : landmark.name;
    const description = document.getElementById('pubDesc').value.trim();
    const contact = document.getElementById('pubContact').value.trim();

    const vtype = INCIDENT_TYPE_TO_VEHICLE[type];
    const nearest = findNearestUnit(vtype, loc.lat, loc.lng);

    const incident = {
      id: 'INC-' + Date.now(), type, typeLabel: INCIDENT_LABEL[type],
      lat: loc.lat, lng: loc.lng, locationName: locName, description, contact,
      time: nowStr(), status:'NEW', assignedUsername: nearest ? nearest.username : null,
    };
    PUBLIC_INCIDENTS.unshift(incident);
    audit('PUBLIC_INCIDENT_REPORTED', `${incident.id} (${incident.typeLabel}) @ ${locName}${nearest ? ' → routed to '+nearest.username : ' — no unit available'}`);

    const successBox = document.getElementById('pubSuccess');
    successBox.style.display='block';
    successBox.innerHTML = nearest
      ? `✅ Report received. Nearest ${vtype.replace('_',' ')} unit (<b>${nearest.vehicleId}</b> — ${nearest.fullName}) has been alerted and will respond.`
      : `✅ Report received and logged with Traffic Control. No unit of the required type is currently available to auto-assign.`;

    document.getElementById('pubDesc').value=''; document.getElementById('pubContact').value='';
    pubGpsCoord = null; document.getElementById('pubGpsStatus').textContent='';
    if(CURRENT_USER && CURRENT_USER.role==='DRIVER') renderIncidentAlerts();
  });
})();

const ROLE_LABELS = {DRIVER:'Emergency Vehicle Driver', MEDICAL_STAFF:'Medical Staff', TRAFFIC_POLICE:'Traffic Police / RTO', HOSPITAL:'Hospital', ADMIN:'System Admin'};

function openDashboardForRole(role){
  document.querySelectorAll('.dash').forEach(d=>d.classList.remove('active'));
  document.getElementById('dash-'+role).classList.add('active');
  document.getElementById('roleChipText').textContent = `${CURRENT_USER.fullName} · ${ROLE_LABELS[role]}`;

  if(role==='DRIVER') initDriverDash();
  if(role==='MEDICAL_STAFF') renderMedicalDash();
  if(role==='TRAFFIC_POLICE') initTrafficDash();
  if(role==='HOSPITAL') renderHospitalDash();
  if(role==='ADMIN') renderAdminDash();
}

