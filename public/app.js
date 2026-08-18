const state = {
  incidents: [],
  ambulances: [],
  hospitals: [],
  map: null,
  layers: {
    incidents: null,
    ambulances: null,
    hospitals: null,
    route: null
  }
};

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const result = await response.json();
  if (!response.ok || result.success === false) {
    throw new Error(result.error || 'Request failed');
  }
  return result;
}

function renderIncidentList(incidents) {
  const list = document.getElementById('incidentList');
  list.innerHTML = incidents.map((incident) => `
    <div class="incident-card" data-severity="${incident.severity}" data-id="${incident.id}">
      <div class="incident-head">
        <div class="incident-id">${incident.id}</div>
        <div class="severity ${incident.severity}">${incident.severity}</div>
      </div>
      <div class="incident-title">${incident.title}</div>
      <div class="incident-meta">
        <span>${incident.location}</span>
        <span>${incident.patient_count} pts</span>
      </div>
      <div class="incident-meta" style="margin-top: 8px;">
        <span>${incident.status}</span>
        <span class="incident-score ${incident.severity}">${incident.eta_minutes || 0}m</span>
      </div>
    </div>
  `).join('');
}

function renderHospitalList(hospitals) {
  const list = document.getElementById('hospitalList');
  const sorted = [...hospitals].sort((a, b) => b.available_beds - a.available_beds);
  list.innerHTML = sorted.map((hospital, index) => `
    <div class="hospital-row ${index === 0 ? 'recommended' : ''}">
      <div class="hospital-rank ${index === 0 ? 'top' : ''}">${index + 1}</div>
      <div style="flex: 1;">
        <div class="hospital-name">${hospital.name}</div>
        <div class="hospital-meta">${hospital.specialty}</div>
      </div>
      <div style="text-align: right;">
        <div class="hospital-bed">${hospital.available_beds}</div>
        <div class="hospital-meta">beds</div>
      </div>
    </div>
  `).join('');
}

function buildMap() {
  const center = [26.9124, 75.7873];
  state.map = L.map('map', { zoomControl: true }).setView(center, 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(state.map);

  state.layers.incidents = L.layerGroup().addTo(state.map);
  state.layers.ambulances = L.layerGroup().addTo(state.map);
  state.layers.hospitals = L.layerGroup().addTo(state.map);
  state.layers.route = L.layerGroup().addTo(state.map);
}

function markerColorForSeverity(severity) {
  const palette = {
    critical: '#ef4444',
    high: '#f59e0b',
    medium: '#fbbf24',
    low: '#10b981'
  };
  return palette[severity] || '#64748b';
}

function renderMap() {
  if (!state.map) return;

  state.layers.incidents.clearLayers();
  state.layers.ambulances.clearLayers();
  state.layers.hospitals.clearLayers();
  state.layers.route.clearLayers();

  const incidentMarkers = state.incidents.map((incident) => {
    const mr = L.circleMarker([incident.latitude, incident.longitude], {
      radius: 10,
      color: markerColorForSeverity(incident.severity),
      fillColor: markerColorForSeverity(incident.severity),
      fillOpacity: 0.9,
      weight: 2
    }).bindPopup(`<strong>${incident.title}</strong><br>${incident.location}<br>Severity: ${incident.severity.toUpperCase()}`);
    mr.addTo(state.layers.incidents);
    return mr;
  });

  state.ambulances.forEach((vehicle) => {
    const icon = L.divIcon({
      className: 'ambulance-marker',
      html: '<div style="background:#1d4ed8;border:2px solid white;border-radius:50%;width:16px;height:16px;display:flex;align-items:center;justify-content:center;color:white;font-size:10px;">🚑</div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });

    const marker = L.marker([vehicle.latitude, vehicle.longitude], { icon }).bindPopup(`<strong>${vehicle.vehicle_number}</strong><br>Status: ${vehicle.status}<br>Battery: ${vehicle.battery}%`);
    marker.addTo(state.layers.ambulances);
  });

  state.hospitals.forEach((hospital) => {
    const marker = L.circleMarker([hospital.latitude, hospital.longitude], {
      radius: 8,
      color: '#0f766e',
      fillColor: '#14b8a6',
      fillOpacity: 0.9,
      weight: 2
    }).bindPopup(`<strong>${hospital.name}</strong><br>Beds: ${hospital.available_beds}<br>Trauma: ${hospital.trauma_level}`);
    marker.addTo(state.layers.hospitals);
  });

  if (incidentMarkers.length > 0) {
    const first = incidentMarkers[0];
    const firstLatLng = first.getLatLng();
    const candidate = state.ambulances[0];
    if (candidate) {
      const route = L.polyline([
        [candidate.latitude, candidate.longitude],
        [firstLatLng.lat, firstLatLng.lng]
      ], {
        color: '#2563eb',
        weight: 4,
        opacity: 0.8
      }).addTo(state.layers.route);
      route.bindPopup('Recommended dispatch route');
    }
  }

  if (state.incidents.length && state.ambulances.length) {
    state.map.fitBounds([
      ...state.incidents.map((it) => [it.latitude, it.longitude]),
      ...state.ambulances.map((it) => [it.latitude, it.longitude]),
      ...state.hospitals.map((it) => [it.latitude, it.longitude])
    ], { padding: [40, 40] });
  }
}

function renderActionGrid() {
  const grid = document.getElementById('actionGrid');
  const actions = [
    ['ETA', `${(state.incidents[0]?.eta_minutes || 0)}m`],
    ['Fleet', `${state.ambulances.filter((a) => a.status === 'available').length} available`],
    ['Hospitals', `${state.hospitals.filter((h) => h.available_beds > 0).length} active`],
    ['AI', '94.3%'],
    ['SLA', '97.6%']
  ];

  grid.innerHTML = actions.map(([label, value]) => `
    <div class="action-card">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `).join('');
}

function renderSummaryMetrics() {
  const average = state.incidents.length
    ? (state.incidents.reduce((sum, inc) => sum + Number(inc.eta_minutes || 0), 0) / state.incidents.length).toFixed(1)
    : '0.0';

  document.getElementById('avgResponseVal').textContent = `${average}m`;
  document.getElementById('activeIncidentsVal').textContent = state.incidents.length;
  document.getElementById('fleetCount').textContent = state.ambulances.length;
  document.getElementById('availableAmbulances').textContent = state.ambulances.filter((a) => a.status === 'available').length;
  document.getElementById('hospitalCapacity').textContent = state.hospitals.reduce((sum, h) => sum + h.available_beds, 0);
  document.getElementById('aiAccuracy').textContent = '94%';

  const best = [...state.hospitals].sort((a, b) => b.available_beds - a.available_beds)[0];
  document.getElementById('bestHospitalName').textContent = best ? best.name : 'No hospital';
}

async function loadDashboard() {
  try {
    const response = await fetchJson('/api/dashboard');
    state.incidents = response.data.map.incidents || [];
    state.ambulances = response.data.map.ambulances || [];
    state.hospitals = response.data.map.hospitals || [];

    renderIncidentList(state.incidents);
    renderHospitalList(state.hospitals);
    renderSummaryMetrics();
    renderActionGrid();
    renderMap();
  } catch (error) {
    console.error(error);
    document.getElementById('incidentList').innerHTML = '<div class="incident-card"><strong>Failed to load incident data.</strong></div>';
  }
}

document.getElementById('refreshBtn').addEventListener('click', loadDashboard);
document.getElementById('newIncidentBtn').addEventListener('click', async () => {
  const incidentPayload = {
    title: 'Road Traffic Collision',
    type: 'Trauma',
    severity: 'critical',
    location: 'NH-48 Jaipur',
    latitude: 26.9124,
    longitude: 75.7873,
    region: 'jaipur',
    patient_count: 4
  };

  try {
    let token = localStorage.getItem('token');
    if (!token) {
      const loginRes = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'dispatcher', password: 'goldenhour@123' })
      });
      const loginData = await loginRes.json();
      if (loginData.token) {
        token = loginData.token;
        localStorage.setItem('token', token);
      }
    }

    const result = await fetchJson('/api/incidents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(incidentPayload)
    });
    document.getElementById('dispatchToast').textContent = `Created ${result.incident.id}`;
    await loadDashboard();
  } catch (error) {
    document.getElementById('dispatchToast').textContent = 'Creation failed: ' + error.message;
    console.error(error);
  }
});

buildMap();
loadDashboard();
