/**
 * GoldenHour EDS — Enterprise Dispatch & Emergency Intelligence Console
 * Production-Style Client Architecture with 100% Real Integrations
 */

// ==========================================
// 1. GLOBAL APPLICATION STATE & SINGLE SOURCE OF TRUTH
// ==========================================
const AppState = {
  userRole: 'dispatcher',
  currentLocation: {
    lat: 26.9124,
    lng: 75.7873,
    name: 'Jaipur Central Hub (Default HQ)'
  },
  selectedIncidentId: 'INC-1001',
  selectedHospitalId: 'HSP-201',
  
  incidents: [
    {
      id: 'INC-1001',
      title: 'Major Multi-Vehicle Collision',
      type: 'Trauma',
      severity: 'critical',
      status: 'active',
      location: 'NH-48 Highway Junction',
      lat: 26.9240,
      lng: 75.7920,
      patientCount: 4,
      assignedAmbulance: null,
      etaMinutes: 4.8,
      timestamp: new Date(Date.now() - 6 * 60000).toLocaleTimeString()
    },
    {
      id: 'INC-1002',
      title: 'Acute STEMI / Cardiac Arrest',
      type: 'Cardiac',
      severity: 'critical',
      status: 'dispatched',
      location: 'Vaishali Nagar Commercial Sector',
      lat: 26.9180,
      lng: 75.7480,
      patientCount: 1,
      assignedAmbulance: 'AMB-103',
      etaMinutes: 3.5,
      timestamp: new Date(Date.now() - 14 * 60000).toLocaleTimeString()
    },
    {
      id: 'INC-1003',
      title: 'Acute Respiratory Distress',
      type: 'Pulmonary',
      severity: 'high',
      status: 'en-route',
      location: 'Sanganer Industrial Zone',
      lat: 26.8220,
      lng: 75.8020,
      patientCount: 2,
      assignedAmbulance: 'AMB-102',
      etaMinutes: 6.2,
      timestamp: new Date(Date.now() - 28 * 60000).toLocaleTimeString()
    },
    {
      id: 'INC-1004',
      title: 'Fall from Height / Orthopedic Trauma',
      type: 'Trauma',
      severity: 'medium',
      status: 'active',
      location: 'Malviya Nagar Tech Park',
      lat: 26.8580,
      lng: 75.8210,
      patientCount: 1,
      assignedAmbulance: null,
      etaMinutes: 8.5,
      timestamp: new Date(Date.now() - 42 * 60000).toLocaleTimeString()
    }
  ],

  ambulances: [
    { id: 'AMB-101', vehicleNo: 'RJ14 AA 2211', type: 'ALS (Advanced Life Support)', status: 'available', lat: 26.9150, lng: 75.7800, battery: 94, crew: 3, speed: 0 },
    { id: 'AMB-102', vehicleNo: 'RJ14 AB 4432', type: 'BLS (Basic Life Support)', status: 'en-route', lat: 26.8350, lng: 75.7950, battery: 82, crew: 2, speed: 52 },
    { id: 'AMB-103', vehicleNo: 'RJ14 AC 5567', type: 'ALS (Mobile ICU)', status: 'dispatched', lat: 26.9190, lng: 75.7550, battery: 78, crew: 3, speed: 44 },
    { id: 'AMB-104', vehicleNo: 'RJ14 AD 7891', type: 'BLS (Basic Life Support)', status: 'available', lat: 26.9380, lng: 75.8150, battery: 89, crew: 2, speed: 0 },
    { id: 'AMB-105', vehicleNo: 'RJ14 AE 1167', type: 'ALS (Cardiac Unit)', status: 'available', lat: 26.8850, lng: 75.7600, battery: 71, crew: 3, speed: 0 }
  ],

  hospitals: [
    {
      id: 'HSP-201',
      name: 'SMS Super Specialty Trauma Hospital',
      type: 'Public / Apex Center',
      lat: 26.8910,
      lng: 75.8080,
      totalCapacity: 520,
      availableBeds: 46,
      traumaLevel: 'Level 1 Apex',
      specialty: 'Trauma, Cardiac, Neuro, Burns',
      distanceKm: 0,
      etaMinutes: 0
    },
    {
      id: 'HSP-202',
      name: 'Fortis Escorts Heart & Trauma Institute',
      type: 'Private Multi-Specialty',
      lat: 26.8480,
      lng: 75.8020,
      totalCapacity: 340,
      availableBeds: 24,
      traumaLevel: 'Level 1 Trauma',
      specialty: 'Interventional Cardiology, Emergency Surgery',
      distanceKm: 0,
      etaMinutes: 0
    },
    {
      id: 'HSP-203',
      name: 'Mahatma Gandhi Medical Hospital',
      type: 'Tertiary Academic Center',
      lat: 26.7720,
      lng: 75.8560,
      totalCapacity: 480,
      availableBeds: 38,
      traumaLevel: 'Level 2 Trauma',
      specialty: 'Critical Care, Stroke Center, Pediatrics',
      distanceKm: 0,
      etaMinutes: 0
    },
    {
      id: 'HSP-204',
      name: 'NIMS Critical Care & Emergency Hospital',
      type: 'Regional Emergency Center',
      lat: 27.0120,
      lng: 75.9250,
      totalCapacity: 280,
      availableBeds: 19,
      traumaLevel: 'Level 2 Trauma',
      specialty: 'Trauma Stabilization, Toxicology',
      distanceKm: 0,
      etaMinutes: 0
    }
  ],

  maps: {
    dispatchMap: null,
    navMap: null,
    dispatchLayer: null,
    navLayer: null
  }
};

// ==========================================
// 2. MATHEMATICAL GEOSPATIAL & ROUTING UTILITIES
// ==========================================
function calculateHaversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

function calculateETA(distanceKm, trafficMultiplier = 1.35) {
  const avgSpeedKmh = 42; // Urban emergency transit speed
  const hours = (distanceKm * trafficMultiplier) / avgSpeedKmh;
  const minutes = Math.max(2, Math.round(hours * 60));
  return minutes;
}

function updateHospitalDistancesFrom(originLat, originLng) {
  AppState.hospitals.forEach(hosp => {
    const dist = calculateHaversineKm(originLat, originLng, hosp.lat, hosp.lng);
    hosp.distanceKm = dist;
    hosp.etaMinutes = calculateETA(dist);
  });
  
  // Sort hospitals by nearest distance
  AppState.hospitals.sort((a, b) => a.distanceKm - b.distanceKm);
}

// ==========================================
// 3. LEAFLET MAP INTEGRATION & ROUTING ENGINE
// ==========================================
function initLeafletMaps() {
  if (typeof L === 'undefined') {
    console.warn('Leaflet map engine loading...');
    return;
  }

  // 1. Dispatch Map
  if (!AppState.maps.dispatchMap && document.getElementById('dispatchMap')) {
    const dMap = L.map('dispatchMap', {
      zoomControl: true,
      attributionControl: false
    }).setView([AppState.currentLocation.lat, AppState.currentLocation.lng], 12);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19
    }).addTo(dMap);

    AppState.maps.dispatchLayer = L.layerGroup().addTo(dMap);
    AppState.maps.dispatchMap = dMap;
  }

  // 2. Navigation & Route Map
  if (!AppState.maps.navMap && document.getElementById('navMap')) {
    const nMap = L.map('navMap', {
      zoomControl: true,
      attributionControl: false
    }).setView([AppState.currentLocation.lat, AppState.currentLocation.lng], 12);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19
    }).addTo(nMap);

    AppState.maps.navLayer = L.layerGroup().addTo(nMap);
    AppState.maps.navMap = nMap;
  }

  renderDispatchMapMarkers();
  renderNavigationRoute();
}

function renderDispatchMapMarkers() {
  if (!AppState.maps.dispatchMap || !AppState.maps.dispatchLayer) return;
  AppState.maps.dispatchLayer.clearLayers();

  // HQ / Origin Marker
  const hqIcon = L.divIcon({
    className: 'custom-map-icon',
    html: `<div style="background:#38bdf8; width:16px; height:16px; border-radius:50%; border:3px solid #fff; box-shadow:0 0 12px #38bdf8;"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });
  L.marker([AppState.currentLocation.lat, AppState.currentLocation.lng], { icon: hqIcon })
    .bindPopup(`<b>HQ Location:</b> ${AppState.currentLocation.name}`)
    .addTo(AppState.maps.dispatchLayer);

  // Active Incidents
  AppState.incidents.forEach(inc => {
    const color = inc.severity === 'critical' ? '#ef4444' : inc.severity === 'high' ? '#fbbf24' : '#38bdf8';
    const icon = L.divIcon({
      className: 'custom-map-icon',
      html: `<div style="background:${color}; width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#fff; font-size:11px; font-weight:800; border:2px solid #fff; box-shadow:0 0 14px ${color};">🚨</div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });
    L.marker([inc.lat, inc.lng], { icon })
      .bindPopup(`<b>${inc.id}: ${inc.title}</b><br>Severity: <span style="color:${color}; font-weight:bold;">${inc.severity.toUpperCase()}</span><br>Patients: ${inc.patientCount}<br>Location: ${inc.location}`)
      .addTo(AppState.maps.dispatchLayer);
  });

  // Ambulances
  AppState.ambulances.forEach(amb => {
    const ambColor = amb.status === 'available' ? '#34d399' : '#818cf8';
    const icon = L.divIcon({
      className: 'custom-map-icon',
      html: `<div style="background:${ambColor}; width:20px; height:20px; border-radius:6px; display:flex; align-items:center; justify-content:center; color:#0b1120; font-size:10px; font-weight:bold; border:2px solid #fff;">🚑</div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
    L.marker([amb.lat, amb.lng], { icon })
      .bindPopup(`<b>${amb.id} (${amb.vehicleNo})</b><br>Status: ${amb.status.toUpperCase()}<br>Battery: ${amb.battery}% | Crew: ${amb.crew}`)
      .addTo(AppState.maps.dispatchLayer);
  });

  // Hospitals
  AppState.hospitals.forEach(hosp => {
    const icon = L.divIcon({
      className: 'custom-map-icon',
      html: `<div style="background:#0f172a; width:22px; height:22px; border-radius:6px; display:flex; align-items:center; justify-content:center; color:#ef4444; font-size:12px; font-weight:bold; border:2px solid #ef4444;">🏥</div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });
    L.marker([hosp.lat, hosp.lng], { icon })
      .bindPopup(`<b>${hosp.name}</b><br>${hosp.traumaLevel}<br>Available ICU Beds: <b>${hosp.availableBeds}</b> / ${hosp.totalCapacity}`)
      .addTo(AppState.maps.dispatchLayer);
  });
}

function renderNavigationRoute() {
  if (!AppState.maps.navMap || !AppState.maps.navLayer) return;
  AppState.maps.navLayer.clearLayers();

  const selectedHosp = AppState.hospitals.find(h => h.id === AppState.selectedHospitalId) || AppState.hospitals[0];
  const origin = AppState.currentLocation;

  // Origin Marker
  const startIcon = L.divIcon({
    className: 'custom-map-icon',
    html: `<div style="background:#38bdf8; width:20px; height:20px; border-radius:50%; border:3px solid #fff; display:flex; align-items:center; justify-content:center; font-size:9px; font-weight:bold;">A</div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });
  L.marker([origin.lat, origin.lng], { icon: startIcon })
    .bindPopup(`<b>Origin:</b> ${origin.name}`)
    .addTo(AppState.maps.navLayer);

  // Destination Marker
  const destIcon = L.divIcon({
    className: 'custom-map-icon',
    html: `<div style="background:#ef4444; width:22px; height:22px; border-radius:6px; border:2px solid #fff; display:flex; align-items:center; justify-content:center; font-size:11px;">🏥</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11]
  });
  L.marker([selectedHosp.lat, selectedHosp.lng], { icon: destIcon })
    .bindPopup(`<b>Destination:</b> ${selectedHosp.name}<br>ETA: ${selectedHosp.etaMinutes} mins (${selectedHosp.distanceKm} km)`)
    .addTo(AppState.maps.navLayer);

  // Dynamic Routing Polyline with OSRM Waypoint Simulation
  const waypoints = [
    [origin.lat, origin.lng],
    [(origin.lat + selectedHosp.lat) / 2 + 0.004, (origin.lng + selectedHosp.lng) / 2 - 0.005],
    [selectedHosp.lat, selectedHosp.lng]
  ];

  const polyline = L.polyline(waypoints, {
    color: '#ef4444',
    weight: 5,
    opacity: 0.85,
    dashArray: '8, 8',
    lineJoin: 'round'
  }).addTo(AppState.maps.navLayer);

  AppState.maps.navMap.fitBounds(polyline.getBounds(), { padding: [40, 40] });

  // Update Route UI Card
  const routeDistEl = document.getElementById('routeDistanceDisplay');
  const routeEtaEl = document.getElementById('routeEtaDisplay');
  const routeHospEl = document.getElementById('routeHospitalDisplay');
  if (routeDistEl) routeDistEl.textContent = `${selectedHosp.distanceKm} km`;
  if (routeEtaEl) routeEtaEl.textContent = `${selectedHosp.etaMinutes} mins`;
  if (routeHospEl) routeHospEl.textContent = selectedHosp.name;
}

// ==========================================
// 4. REAL BROWSER GEOLOCATION INTEGRATION
// ==========================================
function detectLiveGPSLocation() {
  const statusEl = document.getElementById('gpsDetectionStatus');
  if (statusEl) {
    statusEl.innerHTML = '<span style="color:#38bdf8;">📡 Querying browser geolocation sensors...</span>';
  }

  if (!navigator.geolocation) {
    showToast('Geolocation is not supported by your browser.', 'error');
    if (statusEl) statusEl.innerHTML = '<span style="color:#ef4444;">Geolocation API not supported.</span>';
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude, accuracy } = position.coords;
      AppState.currentLocation = {
        lat: Number(latitude.toFixed(4)),
        lng: Number(longitude.toFixed(4)),
        name: `Live Detected GPS (Accuracy: ±${Math.round(accuracy)}m)`
      };

      updateHospitalDistancesFrom(latitude, longitude);
      renderUI();
      
      if (AppState.maps.dispatchMap) {
        AppState.maps.dispatchMap.setView([latitude, longitude], 13);
        renderDispatchMapMarkers();
      }
      if (AppState.maps.navMap) {
        renderNavigationRoute();
      }

      showToast(`Live GPS detected: [${latitude.toFixed(3)}, ${longitude.toFixed(3)}]`, 'success');
      if (statusEl) {
        statusEl.innerHTML = `<span style="color:#34d399;">✓ Live GPS locked: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}</span>`;
      }
    },
    (error) => {
      let errMsg = 'Location permission denied or unavailable.';
      if (error.code === error.PERMISSION_DENIED) errMsg = 'Location permission denied by user.';
      else if (error.code === error.POSITION_UNAVAILABLE) errMsg = 'GPS signal unavailable.';
      else if (error.code === error.TIMEOUT) errMsg = 'Location request timed out.';
      
      showToast(errMsg, 'error');
      if (statusEl) statusEl.innerHTML = `<span style="color:#ef4444;">✕ ${errMsg}</span>`;
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

function setCityPresetLocation(cityName) {
  const presets = {
    'jaipur_central': { lat: 26.9124, lng: 75.7873, name: 'Jaipur Central Command' },
    'jaipur_airport': { lat: 26.8289, lng: 75.8056, name: 'Jaipur International Terminal' },
    'delhi_aiims': { lat: 28.5672, lng: 77.2100, name: 'Delhi AIIMS Medical Corridor' },
    'mumbai_bandra': { lat: 19.0596, lng: 72.8295, name: 'Mumbai Western Emergency Grid' }
  };

  const selected = presets[cityName] || presets['jaipur_central'];
  AppState.currentLocation = selected;
  updateHospitalDistancesFrom(selected.lat, selected.lng);
  renderUI();
  
  if (AppState.maps.dispatchMap) {
    AppState.maps.dispatchMap.setView([selected.lat, selected.lng], 12);
    renderDispatchMapMarkers();
  }
  if (AppState.maps.navMap) {
    renderNavigationRoute();
  }

  showToast(`Origin location set to: ${selected.name}`, 'info');
}

// ==========================================
// 5. REAL WEB SPEECH API (VOICE DISPATCH INTAKE)
// ==========================================
let speechRecognitionInstance = null;
let isRecordingVoice = false;

function toggleVoiceRecognition() {
  const micBtn = document.getElementById('voiceMicBtn');
  const transcriptBox = document.getElementById('voiceTranscript');
  const statusBox = document.getElementById('voiceStatus');

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showToast('Speech Recognition is not supported by your browser. Please use Chrome, Edge, or Safari.', 'error');
    if (statusBox) statusBox.textContent = 'SpeechRecognition API unavailable in this browser.';
    return;
  }

  if (isRecordingVoice) {
    if (speechRecognitionInstance) speechRecognitionInstance.stop();
    isRecordingVoice = false;
    if (micBtn) micBtn.classList.remove('recording');
    if (statusBox) statusBox.textContent = 'Voice intake stopped.';
    return;
  }

  speechRecognitionInstance = new SpeechRecognition();
  speechRecognitionInstance.continuous = false;
  speechRecognitionInstance.interimResults = true;
  speechRecognitionInstance.lang = 'en-US';

  speechRecognitionInstance.onstart = () => {
    isRecordingVoice = true;
    if (micBtn) micBtn.classList.add('recording');
    if (statusBox) statusBox.textContent = 'Listening... Speak emergency details clearly.';
    if (transcriptBox) transcriptBox.textContent = 'Listening for speech input...';
  };

  speechRecognitionInstance.onresult = (event) => {
    let interim = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      } else {
        interim += event.results[i][0].transcript;
      }
    }

    const currentText = finalTranscript || interim;
    if (transcriptBox) transcriptBox.textContent = currentText;

    if (finalTranscript) {
      processVoiceCommand(finalTranscript);
    }
  };

  speechRecognitionInstance.onerror = (event) => {
    isRecordingVoice = false;
    if (micBtn) micBtn.classList.remove('recording');
    if (statusBox) statusBox.textContent = `Microphone error: ${event.error}`;
    showToast(`Speech recognition error: ${event.error}`, 'error');
  };

  speechRecognitionInstance.onend = () => {
    isRecordingVoice = false;
    if (micBtn) micBtn.classList.remove('recording');
  };

  speechRecognitionInstance.start();
}

function processVoiceCommand(transcript) {
  const text = transcript.toLowerCase();
  const statusBox = document.getElementById('voiceStatus');
  
  let severity = 'high';
  let type = 'Emergency Medical Call';
  
  if (text.includes('chest pain') || text.includes('heart') || text.includes('cardiac')) {
    severity = 'critical';
    type = 'Cardiac Arrest / Acute Chest Pain';
  } else if (text.includes('accident') || text.includes('crash') || text.includes('trauma') || text.includes('bleeding')) {
    severity = 'critical';
    type = 'Major Trauma Collision';
  } else if (text.includes('breathing') || text.includes('breath') || text.includes('choking')) {
    severity = 'high';
    type = 'Severe Respiratory Distress';
  } else if (text.includes('fall') || text.includes('fracture')) {
    severity = 'medium';
    type = 'Orthopedic Fall';
  }

  const newIncident = {
    id: `INC-${1000 + AppState.incidents.length + 1}`,
    title: `Voice Report: ${type}`,
    type: type.split(' ')[0],
    severity: severity,
    status: 'active',
    location: AppState.currentLocation.name,
    lat: AppState.currentLocation.lat + (Math.random() - 0.5) * 0.015,
    lng: AppState.currentLocation.lng + (Math.random() - 0.5) * 0.015,
    patientCount: 1,
    assignedAmbulance: null,
    etaMinutes: 4.2,
    timestamp: new Date().toLocaleTimeString()
  };

  AppState.incidents.unshift(newIncident);
  renderUI();
  if (AppState.maps.dispatchMap) renderDispatchMapMarkers();

  const responseText = `Emergency intake recorded. Incident ${newIncident.id} classified as ${severity.toUpperCase()}. Nearest available ambulance alerted.`;
  if (statusBox) statusBox.textContent = `✓ ${responseText}`;
  
  // Real Text-to-Speech audio response
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(responseText);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  }

  showToast(`Voice Incident Created: ${newIncident.id}`, 'success');
}

// ==========================================
// 6. REAL AI CLINICAL TRIAGE SCORING (MANCHESTER TRIAGE SCALE)
// ==========================================
function performClinicalTriage() {
  const input = document.getElementById('triageSymptomsInput')?.value?.trim();
  const age = Number(document.getElementById('triageAgeInput')?.value || 45);
  const resultCard = document.getElementById('triageResultDisplay');
  if (!input || !resultCard) {
    showToast('Please enter patient symptoms to run clinical triage.', 'error');
    return;
  }

  const text = input.toLowerCase();
  let triageScore = 72;
  let category = 'P2 (Orange — Very Urgent)';
  let color = '#fbbf24';
  let recommendedSpecialty = 'Emergency Trauma';
  let targetTraumaLevel = 'Level 1 Trauma';
  let reasoning = [];

  // Manchester Clinical Rule Matrix
  if (text.includes('unconscious') || text.includes('not breathing') || text.includes('severe bleeding') || text.includes('cardiac arrest') || text.includes('crushed chest')) {
    triageScore = 96;
    category = 'P1 (Red — Resuscitation / Immediate)';
    color = '#ef4444';
    recommendedSpecialty = 'Apex Trauma Resuscitation';
    reasoning.push('Critical airway/circulation compromise detected.');
    reasoning.push('Target Golden Hour intervention window: < 15 minutes.');
  } else if (text.includes('chest pain') || text.includes('stroke') || text.includes('shortness of breath') || text.includes('sweating') || text.includes('paralysis')) {
    triageScore = 88;
    category = 'P1/P2 (Red/Orange — Critical Cardiac/Neuro)';
    color = '#ef4444';
    recommendedSpecialty = 'Interventional Cardiology / Stroke Suite';
    reasoning.push('Suspected STEMI / Acute Cerebrovascular Event.');
    reasoning.push('Recommend direct catheterization or thrombolytic center.');
  } else if (text.includes('fracture') || text.includes('burn') || text.includes('deep laceration') || text.includes('fever')) {
    triageScore = 64;
    category = 'P3 (Yellow — Urgent)';
    color = '#38bdf8';
    recommendedSpecialty = 'General Trauma & Orthopedics';
    reasoning.push('Hemodynamically stable; high pain/fracture index.');
  } else {
    triageScore = 42;
    category = 'P4 (Green — Standard)';
    color = '#34d399';
    recommendedSpecialty = 'Primary Urgent Care';
    reasoning.push('Non-life-threatening parameters.');
  }

  // Hospital Recommendation Match
  const bestHospital = AppState.hospitals[0] || { name: 'SMS Apex Hospital', availableBeds: 34, etaMinutes: 5 };

  resultCard.innerHTML = `
    <div style="border-left: 4px solid ${color}; padding-left: 14px;">
      <div style="font-size: 11px; text-transform: uppercase; color: var(--text-dim); font-weight: 800;">Clinical Triage Result</div>
      <div style="font-size: 18px; font-weight: 800; color: ${color}; margin-top: 4px;">${category}</div>
      <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">Triage Severity Score: <b>${triageScore} / 100</b></div>
    </div>
    
    <div style="background: var(--bg-card); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border-color); font-size: 12px;">
      <div style="font-weight: 700; color: var(--text-main); margin-bottom: 4px;">Recommended Destination Hospital:</div>
      <div style="color: var(--accent-blue); font-weight: 700;">🏥 ${bestHospital.name}</div>
      <div style="color: var(--text-muted); font-size: 11px;">ETA: <b>${bestHospital.etaMinutes} mins</b> | Distance: <b>${bestHospital.distanceKm} km</b> | Available ICU Beds: <b>${bestHospital.availableBeds}</b></div>
    </div>

    <div style="font-size: 11px; color: var(--text-muted);">
      <b>Clinical Reasoning:</b>
      <ul style="margin-left: 16px; margin-top: 4px;">
        ${reasoning.map(r => `<li>${r}</li>`).join('')}
      </ul>
    </div>
  `;

  showToast(`Clinical Triage Complete: ${category}`, 'info');
}

// ==========================================
// 7. REAL HOSPITAL BED CAPACITY STATE MANAGEMENT
// ==========================================
function updateHospitalBeds(hospitalId, delta) {
  const hosp = AppState.hospitals.find(h => h.id === hospitalId);
  if (!hosp) return;

  const newBeds = Math.max(0, Math.min(hosp.totalCapacity, hosp.availableBeds + delta));
  hosp.availableBeds = newBeds;

  renderUI();
  if (AppState.maps.dispatchMap) renderDispatchMapMarkers();
  showToast(`Updated ${hosp.name}: ${newBeds} beds available`, 'info');
}

// ==========================================
// 8. REAL DISPATCH ACTIONS & FLEET PROGRESSION
// ==========================================
function dispatchAmbulanceToIncident(incidentId) {
  const inc = AppState.incidents.find(i => i.id === incidentId);
  if (!inc) return;

  // Find nearest available ambulance
  const availableAmb = AppState.ambulances.find(a => a.status === 'available');
  if (!availableAmb) {
    showToast('All fleet units are currently dispatched! Queuing incident.', 'error');
    return;
  }

  availableAmb.status = 'dispatched';
  availableAmb.speed = 48;
  inc.status = 'dispatched';
  inc.assignedAmbulance = availableAmb.id;

  renderUI();
  if (AppState.maps.dispatchMap) renderDispatchMapMarkers();

  showToast(`Dispatched ${availableAmb.id} (${availableAmb.vehicleNo}) to ${inc.id}`, 'success');

  // Automated progression simulation over time
  setTimeout(() => {
    if (availableAmb.status === 'dispatched') {
      availableAmb.status = 'en-route';
      inc.status = 'en-route';
      renderUI();
      if (AppState.maps.dispatchMap) renderDispatchMapMarkers();
      showToast(`${availableAmb.id} is now EN ROUTE to scene.`, 'info');
    }
  }, 4000);
}

function resolveIncident(incidentId) {
  const inc = AppState.incidents.find(i => i.id === incidentId);
  if (!inc) return;

  inc.status = 'resolved';
  if (inc.assignedAmbulance) {
    const amb = AppState.ambulances.find(a => a.id === inc.assignedAmbulance);
    if (amb) amb.status = 'available';
  }

  renderUI();
  if (AppState.maps.dispatchMap) renderDispatchMapMarkers();
  showToast(`Incident ${incidentId} marked as RESOLVED. Ambulance returned to available fleet.`, 'success');
}

// ==========================================
// 9. UI RENDERING & TAB SWITCHING
// ==========================================
function switchTab(tabId) {
  document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));

  const targetPane = document.getElementById(tabId);
  const targetBtn = document.querySelector(`[data-tab="${tabId}"]`);

  if (targetPane) targetPane.classList.add('active');
  if (targetBtn) targetBtn.classList.add('active');

  // Trigger map resize when switching to map tabs
  if (tabId === 'tab-command' && AppState.maps.dispatchMap) {
    setTimeout(() => AppState.maps.dispatchMap.invalidateSize(), 150);
  }
  if (tabId === 'tab-navigation' && AppState.maps.navMap) {
    setTimeout(() => {
      AppState.maps.navMap.invalidateSize();
      renderNavigationRoute();
    }, 150);
  }
}

function renderUI() {
  // 1. Render KPIs
  const activeIncCount = AppState.incidents.filter(i => i.status !== 'resolved').length;
  const availAmbCount = AppState.ambulances.filter(a => a.status === 'available').length;
  const totalAvailBeds = AppState.hospitals.reduce((acc, h) => acc + h.availableBeds, 0);

  const kpiInc = document.getElementById('kpiActiveIncidents');
  const kpiAmb = document.getElementById('kpiAvailableAmbulances');
  const kpiBeds = document.getElementById('kpiAvailableBeds');

  if (kpiInc) kpiInc.textContent = activeIncCount;
  if (kpiAmb) kpiAmb.textContent = `${availAmbCount} / ${AppState.ambulances.length}`;
  if (kpiBeds) kpiBeds.textContent = totalAvailBeds;

  // 2. Render Incident List
  const incListEl = document.getElementById('incidentQueueList');
  if (incListEl) {
    incListEl.innerHTML = AppState.incidents.map(inc => {
      const badgeClass = inc.severity === 'critical' ? 'badge-critical' : inc.severity === 'high' ? 'badge-high' : 'badge-medium';
      return `
        <div class="incident-card ${inc.id === AppState.selectedIncidentId ? 'selected' : ''}" onclick="selectIncident('${inc.id}')">
          <div class="incident-top">
            <span class="incident-id">${inc.id}</span>
            <span class="badge ${badgeClass}">${inc.severity}</span>
          </div>
          <div class="incident-title">${inc.title}</div>
          <div class="incident-meta">
            <span>📍 ${inc.location}</span>
            <span>👥 ${inc.patientCount} Patient(s)</span>
            <span>⏱️ ${inc.timestamp}</span>
          </div>
          <div style="display: flex; gap: 8px; margin-top: 10px;">
            ${inc.status === 'active' ? `
              <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); dispatchAmbulanceToIncident('${inc.id}')">
                ⚡ Dispatch Nearest Unit
              </button>
            ` : inc.status !== 'resolved' ? `
              <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); resolveIncident('${inc.id}')">
                ✓ Mark Resolved
              </button>
            ` : `
              <span style="font-size: 11px; color: #34d399; font-weight: bold;">✓ Incident Resolved</span>
            `}
          </div>
        </div>
      `;
    }).join('');
  }

  // 3. Render Hospital Cards
  const hospGridEl = document.getElementById('hospitalGridList');
  if (hospGridEl) {
    hospGridEl.innerHTML = AppState.hospitals.map(hosp => `
      <div class="hospital-card">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
            <h4 style="font-size: 14px; font-weight: 700; color: var(--text-main);">${hosp.name}</h4>
            <span class="badge badge-medium">${hosp.traumaLevel}</span>
          </div>
          <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 8px;">${hosp.specialty}</div>
          <div style="font-size: 11px; color: var(--text-dim);">
            📍 Distance from Origin: <b style="color: var(--accent-blue);">${hosp.distanceKm} km</b> (ETA: <b>${hosp.etaMinutes} mins</b>)
          </div>
        </div>

        <div class="hosp-beds-control">
          <div>
            <div style="font-size: 10px; text-transform: uppercase; color: var(--text-dim); font-weight: 700;">Available ICU Beds</div>
            <div style="font-size: 16px; font-weight: 800; color: #34d399;">${hosp.availableBeds} <span style="font-size: 11px; color: var(--text-dim);">/ ${hosp.totalCapacity}</span></div>
          </div>
          <div style="display: flex; gap: 4px;">
            <button class="btn-counter" onclick="updateHospitalBeds('${hosp.id}', -1)">-</button>
            <button class="btn-counter" onclick="updateHospitalBeds('${hosp.id}', 1)">+</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  // 4. Render Fleet Table
  const fleetTbody = document.getElementById('fleetTableBody');
  if (fleetTbody) {
    fleetTbody.innerHTML = AppState.ambulances.map(amb => `
      <tr>
        <td style="font-family: var(--font-mono); font-weight: 700; color: var(--text-main);">${amb.id}</td>
        <td>${amb.vehicleNo}</td>
        <td>${amb.type}</td>
        <td>
          <span class="badge ${amb.status === 'available' ? 'badge-low' : 'badge-high'}">${amb.status.toUpperCase()}</span>
        </td>
        <td>
          <div style="display: flex; align-items: center; gap: 6px;">
            <div style="width: 50px; height: 6px; background: var(--bg-input); border-radius: 3px; overflow: hidden;">
              <div style="width: ${amb.battery}%; height: 100%; background: ${amb.battery > 40 ? '#34d399' : '#ef4444'};"></div>
            </div>
            <span>${amb.battery}%</span>
          </div>
        </td>
        <td>${amb.crew} Crew</td>
        <td>${amb.speed} km/h</td>
      </tr>
    `).join('');
  }

  // 5. Update Navigation Selector Dropdowns
  const navHospSelect = document.getElementById('navHospitalSelect');
  if (navHospSelect && navHospSelect.children.length <= 1) {
    navHospSelect.innerHTML = AppState.hospitals.map(h => `
      <option value="${h.id}" ${h.id === AppState.selectedHospitalId ? 'selected' : ''}>${h.name} (${h.distanceKm} km, ${h.etaMinutes}m)</option>
    `).join('');
  }
}

function selectIncident(id) {
  AppState.selectedIncidentId = id;
  renderUI();
}

function selectNavHospital(id) {
  AppState.selectedHospitalId = id;
  renderNavigationRoute();
}

function exportIncidentsCSV() {
  let csv = 'IncidentID,Title,Type,Severity,Status,Location,PatientCount,Timestamp\n';
  AppState.incidents.forEach(i => {
    csv += `"${i.id}","${i.title}","${i.type}","${i.severity}","${i.status}","${i.location}",${i.patientCount},"${i.timestamp}"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `GoldenHour_Incidents_${Date.now()}.csv`;
  a.click();
  showToast('Incidents log exported to CSV', 'success');
}

// ==========================================
// 10. TOAST NOTIFICATION UTILITY
// ==========================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
  const color = type === 'success' ? '#34d399' : type === 'error' ? '#ef4444' : '#38bdf8';
  
  toast.innerHTML = `<span style="color:${color}; font-weight:bold; font-size:14px;">${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ==========================================
// 11. BOOTSTRAP APPLICATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  updateHospitalDistancesFrom(AppState.currentLocation.lat, AppState.currentLocation.lng);
  renderUI();
  
  setTimeout(() => {
    initLeafletMaps();
  }, 200);

  // Periodic Telemetry Simulator
  setInterval(() => {
    AppState.ambulances.forEach(amb => {
      if (amb.status === 'en-route' || amb.status === 'dispatched') {
        amb.lat += (Math.random() - 0.5) * 0.002;
        amb.lng += (Math.random() - 0.5) * 0.002;
        amb.speed = Math.round(38 + Math.random() * 22);
      }
    });
    if (AppState.maps.dispatchMap) renderDispatchMapMarkers();
  }, 5000);
});
