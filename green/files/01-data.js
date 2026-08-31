/* ================================================================
   DEMO "DATABASE" — in a real deployment this lives server-side;
   here it's an in-memory mock so the whole system runs from one file.
   ================================================================ */
const DEMO_PASSWORD = 'Pass@123';

const HOSPITALS = [
  {id:'HOSP-KOP-001', name:'CPR Hospital (Govt. District Hospital)', lat:16.6951, lng:74.2320},
  {id:'HOSP-KOP-002', name:'Aster Aadhar Hospital', lat:16.6766, lng:74.2495},
  {id:'HOSP-KOP-003', name:'Sanjeevan Hospital', lat:16.7011, lng:74.2367},
  {id:'HOSP-KOP-004', name:"District Women's Hospital", lat:16.6940, lng:74.2352},
  {id:'HOSP-KOP-005', name:'Apple Saraswati Multispeciality Hospital', lat:16.6903, lng:74.2447},
  {id:'HOSP-KOP-006', name:'D. Y. Patil Hospital & Research Centre', lat:16.6668, lng:74.2596},
  {id:'HOSP-KOP-007', name:'Ashoka Superspeciality Hospital', lat:16.6875, lng:74.2461},
  {id:'HOSP-KOP-008', name:'Silver Cross Hospital', lat:16.6987, lng:74.2388},
];
const LANDMARKS = [
  {id:'railway', name:'Kolhapur Railway Station', lat:16.6816, lng:74.2433},
  {id:'airport', name:'Kolhapur Airport, Ujalaiwadi', lat:16.6659, lng:74.2887},
  {id:'university', name:'Shivaji University', lat:16.7099, lng:74.2436},
  {id:'rankala', name:'Rankala Lake', lat:16.6963, lng:74.2233},
  {id:'mahalaxmi', name:'Mahalaxmi Temple Area', lat:16.6929, lng:74.2264},
  {id:'bindu', name:'Bindu Chowk', lat:16.6980, lng:74.2333},
  {id:'cbs', name:'CBS Bus Stand', lat:16.6975, lng:74.2358},
  {id:'rajarampuri', name:'Rajarampuri', lat:16.6889, lng:74.2415},
  {id:'shahupuri', name:'Shahupuri', lat:16.7016, lng:74.2298},
  {id:'tarabai', name:'Tarabai Park', lat:16.7075, lng:74.2270},
];

/* Kolhapur Municipal Corporation Fire Brigade — Central Fire Station.
   Used as the default pickup point for FIRE_BRIGADE vehicles. */
const FIRE_STATION = {id:'firehq', name:'Kolhapur Fire Brigade Head Office (Central Fire Station)', lat:16.6928, lng:74.2288};
/* Origin choices shown to a driver = the fire station first, then the general city landmarks. */
const ORIGIN_POINTS = [FIRE_STATION, ...LANDMARKS];

/* Likely fire-incident sites across the city — shown as the "destination" for a
   FIRE_BRIGADE vehicle instead of a hospital list, so the route is
   Fire Brigade Office → actual fire location. */
const FIRE_INCIDENT_SITES = [
  {id:'fis-laxmipuri', name:'Laxmipuri Market Fire Site', lat:16.6940, lng:74.2410},
  {id:'fis-udyamnagar', name:'Shivaji Udyamnagar Industrial Estate', lat:16.6832, lng:74.2378},
  {id:'fis-gangavesh', name:'Gangavesh Old City Area', lat:16.6900, lng:74.2270},
  {id:'fis-apmc', name:'Shahu Market Yard (APMC)', lat:16.6790, lng:74.2280},
  {id:'fis-shahupuri', name:'Shahupuri Residential Zone', lat:16.7020, lng:74.2310},
  {id:'fis-bawada', name:'Kasba Bawada', lat:16.7100, lng:74.2200},
  {id:'fis-saneguruji', name:'Sane Guruji Vasahat', lat:16.6870, lng:74.2340},
  {id:'fis-rajarampuri', name:'Rajarampuri Fire Site', lat:16.6889, lng:74.2415},
];

/* Real named traffic junctions / chowks across Kolhapur city — used so the Green
   Corridor signal plan shows actual local junction names instead of generic labels. */
const KOLHAPUR_JUNCTIONS = [
  {code:'KOP-SIG-BND', name:'Bindu Chowk',              lat:16.6980, lng:74.2333},
  {code:'KOP-SIG-DBH', name:'Dabholkar Corner',          lat:16.6940, lng:74.2358},
  {code:'KOP-SIG-SHV', name:'Shivaji Chowk (Shivaji Peth)', lat:16.6906, lng:74.2371},
  {code:'KOP-SIG-RAJ', name:'Rajarampuri 3rd Lane Junction', lat:16.6887, lng:74.2413},
  {code:'KOP-SIG-KWL', name:'Kawala Naka',               lat:16.6961, lng:74.2296},
  {code:'KOP-SIG-SHP', name:'Shahupuri Corner',          lat:16.7014, lng:74.2300},
  {code:'KOP-SIG-MHD', name:'Mahadwar Road Junction',    lat:16.6957, lng:74.2280},
  {code:'KOP-SIG-YLM', name:'Yellamma Chowk',            lat:16.6928, lng:74.2299},
  {code:'KOP-SIG-UMT', name:'Uma Talkies Chowk',         lat:16.6899, lng:74.2352},
  {code:'KOP-SIG-PRK', name:'Parikh Pool Junction',      lat:16.6975, lng:74.2405},
  {code:'KOP-SIG-TRB', name:'Tararani Chowk',            lat:16.7048, lng:74.2276},
  {code:'KOP-SIG-GDH', name:'Gadhi Chowk, Udyamnagar',   lat:16.6832, lng:74.2378},
  {code:'KOP-SIG-RNK', name:'Rankala Chowk',             lat:16.6952, lng:74.2242},
  {code:'KOP-SIG-CBS', name:'CBS Naka',                  lat:16.6972, lng:74.2360},
  {code:'KOP-SIG-FLC', name:'Fule Chowk',                lat:16.6944, lng:74.2318},
  {code:'KOP-SIG-SSN', name:'Sasane Ground Junction',    lat:16.6862, lng:74.2400},
  {code:'KOP-SIG-RKC', name:'Ruikar Colony Junction',    lat:16.6805, lng:74.2418},
  {code:'KOP-SIG-UNV', name:'University Road Junction',  lat:16.7060, lng:74.2440},
];

function makeCrew(prefix, count, role, vtype, names){
  const out = {};
  for(let i=1;i<=count;i++){
    const n = String(i).padStart(2,'0');
    const username = `${prefix}2026${n}`;
    const base = LANDMARKS[(i-1 + {dv:0,fb:2,pv:4,nd:6}[prefix]||0) % LANDMARKS.length];
    out[username] = {
      password:DEMO_PASSWORD, role, fullName: names[i-1],
      driverId: role==='DRIVER' ? `${prefix.toUpperCase()}-2026-0${n}` : undefined,
      staffId: role==='MEDICAL_STAFF' ? `MO-2026-0${n}` : undefined,
      officerId: role==='TRAFFIC_POLICE' ? `TP-2026-0${n}` : undefined,
      zone: role==='TRAFFIC_POLICE' ? `Zone ${i}` : undefined,
      vehicleId: (role==='DRIVER') ? `${prefix.toUpperCase()}-2026-0${n}` : (role==='MEDICAL_STAFF' ? `DV-2026-0${n}` : undefined),
      vehicleType: vtype,
      regNo: (role==='DRIVER') ? `MH09-${prefix.toUpperCase()}-${1000+i}` : undefined,
      hospitalId: role==='HOSPITAL' ? HOSPITALS[i-1].id : undefined,
      // Standby / base station location — used to find the nearest unit to a public incident report.
      baseLat: role==='DRIVER' ? base.lat + (Math.random()-0.5)*0.004 : undefined,
      baseLng: role==='DRIVER' ? base.lng + (Math.random()-0.5)*0.004 : undefined,
      baseName: role==='DRIVER' ? base.name : undefined,
    };
  }
  return out;
}

const DB_USERS = Object.assign({},
  makeCrew('dv',4,'DRIVER','AMBULANCE', ['Vaibhav Jadhav','Suresh Patil','Anil Kamble','Ramesh Sawant']),
  makeCrew('mo',4,'MEDICAL_STAFF',null, ['Dr. Snehal Kore','Dr. Priya Deshmukh','Dr. Rahul Naik','Dr. Aarti Shinde']),
  makeCrew('tp',4,'TRAFFIC_POLICE',null, ['PSI Mahesh Bhosale','PSI Sunita Chavan','PSI Vikram More','PSI Ashwini Pawar']),
  makeCrew('fb',4,'DRIVER','FIRE_BRIGADE', ['Fire Op. Dinesh Patil','Fire Op. Santosh Yadav','Fire Op. Ganesh Koli','Fire Op. Mahadev Salunkhe']),
  makeCrew('pv',4,'DRIVER','POLICE_VEHICLE', ['Const. Rohit Mane','Const. Sandeep Bhoite','Const. Amol Gaikwad','Const. Nitin Powar']),
  makeCrew('nd',4,'DRIVER','NDRF', ['NDRF Havildar Kadam','NDRF Havildar Jagtap','NDRF Havildar Bhosale','NDRF Havildar Chougule']),
  makeCrew('hp',8,'HOSPITAL',null, ['CPR Hospital Desk','Aster Aadhar Desk','Sanjeevan Hospital Desk',"Women's Hospital Desk",'Apple Saraswati Desk','D. Y. Patil Hospital Desk','Ashoka Superspeciality Desk','Silver Cross Hospital Desk']),
  { admin2026: {password:DEMO_PASSWORD, role:'ADMIN', fullName:'System Administrator'} }
);

// Vehicle registry (RTO-style records used by Admin dashboard)
const VEHICLES = [];
['dv','fb','pv','nd'].forEach(pref=>{
  Object.entries(DB_USERS).forEach(([uname,u])=>{
    if(u.role==='DRIVER' && uname.startsWith(pref)){
      VEHICLES.push({vehicleId:u.vehicleId, regNo:u.regNo, type:u.vehicleType, status:'IDLE', fitness:'VALID', insurance:'VALID', authorized:true, username:uname});
    }
  });
});

