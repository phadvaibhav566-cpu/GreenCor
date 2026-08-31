/* ================================================================
   MEDICAL STAFF DASHBOARD
   ================================================================ */
function renderMedicalDash(){
  const has = TRIP && TRIP.vehicleId === CURRENT_USER.vehicleId;
  document.getElementById('medCaseId').textContent = has ? TRIP.emergencyCode.replace('EMG','CASE') : '—';
  document.getElementById('medVehId').textContent = has ? TRIP.vehicleId : (CURRENT_USER.vehicleId||'—');
  document.getElementById('medDriver').textContent = has ? TRIP.driverName : '—';
  document.getElementById('medDest').textContent = has ? TRIP.destHospital.name : '—';
  document.getElementById('medDist').textContent = has ? ((TRIP.distance*(1-TRIP.progressFrac))/1000).toFixed(2)+' km' : '—';
  document.getElementById('medEta').textContent = has ? fmtTime(TRIP.etaCorridorSec*(1-TRIP.progressFrac)) : '—';
  const cb = document.getElementById('medCorridorBadge');
  cb.textContent = has ? TRIP.corridorStatus : 'NO ACTIVE TRIP';
  cb.className = 'badge ' + (has && TRIP.corridorStatus==='ACTIVE' ? 'green' : has && TRIP.corridorStatus==='REQUESTED' ? 'amber' : 'grey');
  const hb = document.getElementById('medHospBadge');
  hb.textContent = has && TRIP.patientCase.hospitalReady ? 'READY TO RECEIVE' : has ? 'AWAITING PREP' : '—';
  hb.className = 'badge ' + (has && TRIP.patientCase.hospitalReady ? 'green':'grey');

  if(has){
    document.getElementById('medCriticality').value = TRIP.patientCase.criticality;
    document.getElementById('medCategory').value = TRIP.patientCase.category;
    document.getElementById('medOxygen').checked = TRIP.patientCase.oxygen;
    document.getElementById('medNotes').value = TRIP.patientCase.notes;
  }

  const updateBtn = document.getElementById('medUpdateBtn');
  const incomingBtn = document.getElementById('medIncomingBtn');
  updateBtn.disabled = !has; incomingBtn.disabled = !has;
  updateBtn.title = has ? '' : 'No active trip yet — this enables once a vehicle starts an emergency trip.';
  incomingBtn.title = updateBtn.title;

  updateBtn.onclick = ()=>{
    if(!TRIP || TRIP.vehicleId !== CURRENT_USER.vehicleId) return; // buttons are disabled in this state, but guard anyway
    TRIP.patientCase.criticality = document.getElementById('medCriticality').value;
    TRIP.patientCase.category = document.getElementById('medCategory').value;
    TRIP.patientCase.oxygen = document.getElementById('medOxygen').checked;
    TRIP.patientCase.notes = document.getElementById('medNotes').value;
    TRIP.medicalStaffName = CURRENT_USER.fullName;
    audit('PATIENT_CASE_UPDATED', TRIP.emergencyCode);
    renderMedicalDash();
  };
  incomingBtn.onclick = ()=>{
    if(!TRIP) return;
    TRIP.patientCase.incomingSent = true;
    audit('PATIENT_INCOMING_SENT', TRIP.emergencyCode + ' → ' + TRIP.destHospital.name);
    renderMedicalDash();
  };
}

