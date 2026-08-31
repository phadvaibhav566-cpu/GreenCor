/* ================================================================
   ADMIN DASHBOARD
   ================================================================ */
function renderAdminDash(){
  document.getElementById('aStatTotal').textContent = TRIP ? 1 : 0;
  document.getElementById('aStatSaved').textContent = TRIP ? fmtTime(TRIP.etaNormalSec-TRIP.etaCorridorSec) : '0:00';
  document.getElementById('aStatSignals').textContent = TRIP ? TRIP.signals.length : 0;

  document.querySelectorAll('.tabs .tab').forEach(t=>{
    t.onclick = ()=>{
      document.querySelectorAll('.tabs .tab').forEach(x=>x.classList.remove('active'));
      t.classList.add('active');
      ['users','vehicles','reports','audit'].forEach(k=>{ document.getElementById('admin-'+k).style.display = (k===t.dataset.atab)?'block':'none'; });
    };
  });

  function renderUsers(){
    const q = document.getElementById('adminSearch').value.trim().toLowerCase();
    const rf = document.getElementById('adminRoleFilter').value;
    const rows = Object.entries(DB_USERS).filter(([uname,u])=>{
      if(rf && u.role!==rf) return false;
      if(q && !(uname.toLowerCase().includes(q) || u.fullName.toLowerCase().includes(q))) return false;
      return true;
    }).map(([uname,u])=>`<tr><td>${uname}</td><td>${u.fullName}</td><td><span class="badge blue">${u.role.replace('_',' ')}</span></td><td>${u.vehicleId||u.hospitalId||'—'}</td><td><span class="badge green">ACTIVE</span></td></tr>`).join('');
    document.getElementById('adminUserTbody').innerHTML = rows || '<tr><td colspan="5" class="empty">No matches.</td></tr>';
  }
  document.getElementById('adminSearch').oninput = renderUsers;
  document.getElementById('adminRoleFilter').onchange = renderUsers;
  renderUsers();

  document.getElementById('adminVehicleTbody').innerHTML = VEHICLES.map(v=>`
    <tr><td>${v.vehicleId}</td><td>${v.regNo}</td><td>${v.type}</td>
      <td><span class="badge ${TRIP && TRIP.vehicleId===v.vehicleId ? 'amber':'grey'}">${TRIP && TRIP.vehicleId===v.vehicleId ? 'ON_TRIP':'IDLE'}</span></td>
      <td><span class="badge green">${v.fitness}</span></td><td><span class="badge green">${v.insurance}</span></td>
      <td><span class="badge ${v.authorized?'green':'red'}">${v.authorized?'YES':'NO'}</span></td>
    </tr>`).join('');

  const counts = {AMBULANCE:0, FIRE_BRIGADE:0, POLICE_VEHICLE:0, NDRF:0};
  if(TRIP) counts[TRIP.vehicleType] = (counts[TRIP.vehicleType]||0)+1;
  const max = Math.max(1,...Object.values(counts));
  document.getElementById('reportBars').innerHTML = Object.entries(counts).map(([k,v])=>`
    <div style="margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--muted);margin-bottom:4px;"><span>${k.replace('_',' ')}</span><span>${v}</span></div>
      <div style="background:var(--bg);border:1px solid var(--border);border-radius:5px;height:10px;overflow:hidden;">
        <div style="width:${(v/max*100)}%;height:100%;background:linear-gradient(90deg,#5B8CFF,#2FD9A7);"></div>
      </div>
    </div>`).join('');

  renderAuditLog();
}

/* Periodic refresh so open dashboards stay in sync with TRIP state during simulation,
   AND (added) pulls the latest shared state so this device sees changes made on any
   other device — this is what keeps everyone's view in sync. */
let _gcLastAnimatedCode = null;
setInterval(async ()=>{
  await loadSharedState();
  if(!CURRENT_USER) return;
  if(CURRENT_USER.role==='MEDICAL_STAFF') renderMedicalDash();
  if(CURRENT_USER.role==='HOSPITAL') renderHospitalDash();
  if(CURRENT_USER.role==='TRAFFIC_POLICE' && document.getElementById('dash-TRAFFIC_POLICE').classList.contains('active')) renderTrafficDash();
  if(CURRENT_USER.role==='DRIVER' && document.getElementById('dash-DRIVER').classList.contains('active')){
    renderIncidentAlerts();
    refreshTripUIForDriver();
    restoreDriverTripVisuals();
    // If the corridor was approved from another device (e.g. Traffic Police on a
    // different phone/laptop), start the local animation on this driver's map too.
    if(TRIP && TRIP.vehicleId===CURRENT_USER.vehicleId && TRIP.corridorStatus==='ACTIVE'
       && !animTimer && routeCoords.length && _gcLastAnimatedCode!==TRIP.emergencyCode){
      _gcLastAnimatedCode = TRIP.emergencyCode;
      runCorridorSimulation();
    }
  }
  if(CURRENT_USER.role==='ADMIN'){ document.getElementById('aStatTotal').textContent = TRIP?1:0; renderAuditLog(); }
}, 2500);

