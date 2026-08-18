const fs = require('fs');
const path = require('path');

console.log('Building enhanced MNC Production UI for public/index.html...');

let html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');

// 1. Inject Google Maps JS API script in head if not present
if (!html.includes('maps.googleapis.com/maps/api/js')) {
  const gmapsScript = `
    <!-- Google Maps JS API Platform Integration (with fallback) -->
    <script src="https://maps.googleapis.com/maps/api/js?key=AIzaSyDemoKeyForPrototypingOnly&libraries=places,marker,geometry,routes&v=weekly" async defer></script>
  `;
  html = html.replace('</head>', `${gmapsScript}\n</head>`);
}

// 2. Add Modal CSS Styles before </style>
const modalStyles = `
/* ════════════════════════════════════════════════════════════════
   MNC ENTERPRISE INTERACTIVE MODALS & DRAWERS
════════════════════════════════════════════════════════════════ */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(11, 17, 32, 0.78);
  backdrop-filter: blur(10px);
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  opacity: 0;
  pointer-events: none;
  transition: all 0.22s var(--ease);
}
.modal-overlay.active {
  opacity: 1;
  pointer-events: auto;
}
.modal-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  width: 100%;
  max-width: 540px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: var(--shadow-lg);
  padding: 24px;
  animation: modalPop 0.25s var(--spring);
}
.dark .modal-card {
  background: #111827;
  border-color: #1f2937;
  color: #f3f4f6;
}
@keyframes modalPop {
  from { transform: scale(0.92) translateY(12px); opacity: 0; }
  to { transform: scale(1) translateY(0); opacity: 1; }
}
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
}
.modal-title {
  font-size: 16px;
  font-weight: 800;
  color: var(--ink);
  display: flex;
  align-items: center;
  gap: 8px;
}
.dark .modal-title { color: #f9fafb; }
.modal-close {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--bg2);
  border: none;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ink3);
}
.modal-close:hover { background: var(--red-bg); color: var(--red); }

.form-group {
  margin-bottom: 14px;
}
.form-label {
  display: block;
  font-size: 11px;
  font-weight: 700;
  color: var(--ink3);
  text-transform: uppercase;
  letter-spacing: 0.8px;
  margin-bottom: 6px;
}
.dark .form-label { color: #9ca3af; }
.form-input, .form-select, .form-textarea {
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface2);
  font-family: var(--font);
  font-size: 12.5px;
  color: var(--ink);
  transition: all 0.15s;
}
.dark .form-input, .dark .form-select, .dark .form-textarea {
  background: #1f2937;
  border-color: #374151;
  color: #f3f4f6;
}
.form-input:focus, .form-select:focus {
  outline: none;
  border-color: var(--red);
  box-shadow: 0 0 0 3px rgba(214, 25, 47, 0.15);
}
.modal-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 20px;
  padding-top: 14px;
  border-top: 1px solid var(--border);
}
.btn-secondary-btn {
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg);
  font-weight: 600;
  cursor: pointer;
  color: var(--ink2);
}
.btn-primary-btn {
  padding: 8px 18px;
  border-radius: 8px;
  border: none;
  background: var(--red);
  color: white;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(214, 25, 47, 0.3);
}
.btn-primary-btn:hover { background: #b01124; }
`;

if (!html.includes('MNC ENTERPRISE INTERACTIVE MODALS')) {
  html = html.replace('</style>', `${modalStyles}\n</style>`);
}

// 3. Add Modal HTML Structures right before </body>
const modalHTML = `
<!-- ================================================================ -->
<!-- MNC INTERACTIVE MODAL OVERLAYS                                   -->
<!-- ================================================================ -->

<!-- 1. NEW INCIDENT MODAL -->
<div id="modal-new-incident" class="modal-overlay" onclick="closeModalOnBg(event, 'modal-new-incident')">
  <div class="modal-card">
    <div class="modal-header">
      <div class="modal-title">🚨 Report New Emergency Incident</div>
      <button class="modal-close" onclick="closeModal('modal-new-incident')">✕</button>
    </div>
    <form onsubmit="submitNewIncidentForm(event)">
      <div class="form-group">
        <label class="form-label">Incident Title / Nature</label>
        <input type="text" id="incFormTitle" class="form-input" placeholder="e.g. Road Collision, Cardiac Event" required />
      </div>
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
        <div class="form-group">
          <label class="form-label">Emergency Type</label>
          <select id="incFormType" class="form-select">
            <option value="Trauma">Trauma / Accident</option>
            <option value="Cardiac">Cardiac Emergency</option>
            <option value="Pulmonary">Respiratory Distress</option>
            <option value="Stroke">Stroke / Neurological</option>
            <option value="MCI">Mass Casualty Incident (MCI)</option>
            <option value="Obstetric">Obstetric Emergency</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Triage Severity</label>
          <select id="incFormSeverity" class="form-select">
            <option value="critical">🔴 CRITICAL (NEWS2 ≥ 7)</option>
            <option value="high">🟠 HIGH (NEWS2 5-6)</option>
            <option value="medium">🟡 MEDIUM (NEWS2 1-4)</option>
            <option value="low">🟢 LOW (NEWS2 0)</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Location Address / Landmark</label>
        <input type="text" id="incFormLocation" class="form-input" placeholder="e.g. NH-48, Sindhi Camp, Jaipur" required />
      </div>
      <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px;">
        <div class="form-group">
          <label class="form-label">Latitude</label>
          <input type="number" step="any" id="incFormLat" class="form-input" value="26.9124" required />
        </div>
        <div class="form-group">
          <label class="form-label">Longitude</label>
          <input type="number" step="any" id="incFormLng" class="form-input" value="75.7873" required />
        </div>
        <div class="form-group">
          <label class="form-label">Patient Count</label>
          <input type="number" id="incFormPatients" class="form-input" value="1" min="1" required />
        </div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-secondary-btn" onclick="closeModal('modal-new-incident')">Cancel</button>
        <button type="submit" class="btn-primary-btn">🚨 Create & Dispatch</button>
      </div>
    </form>
  </div>
</div>

<!-- 2. INCIDENT DETAIL MODAL -->
<div id="modal-incident-detail" class="modal-overlay" onclick="closeModalOnBg(event, 'modal-incident-detail')">
  <div class="modal-card">
    <div class="modal-header">
      <div class="modal-title" id="incDetailTitle">Incident Details</div>
      <button class="modal-close" onclick="closeModal('modal-incident-detail')">✕</button>
    </div>
    <div id="incDetailContent">
      <!-- Dynamically populated -->
    </div>
    <div class="modal-actions" id="incDetailActions">
      <button class="btn-secondary-btn" onclick="closeModal('modal-incident-detail')">Close</button>
      <button class="btn-primary-btn" id="incDetailDispatchBtn">⚡ Execute AI Dispatch</button>
    </div>
  </div>
</div>

<!-- 3. AMBULANCE DETAIL MODAL -->
<div id="modal-ambulance-detail" class="modal-overlay" onclick="closeModalOnBg(event, 'modal-ambulance-detail')">
  <div class="modal-card">
    <div class="modal-header">
      <div class="modal-title" id="ambDetailTitle">🚑 Ambulance Fleet Unit</div>
      <button class="modal-close" onclick="closeModal('modal-ambulance-detail')">✕</button>
    </div>
    <form onsubmit="submitAmbulanceUpdate(event)">
      <input type="hidden" id="ambFormId" />
      <div class="form-group">
        <label class="form-label">Vehicle Registration Number</label>
        <input type="text" id="ambFormNumber" class="form-input" readonly />
      </div>
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
        <div class="form-group">
          <label class="form-label">Operational Status</label>
          <select id="ambFormStatus" class="form-select">
            <option value="available">🟢 Available (On Standby)</option>
            <option value="dispatched">🚨 Dispatched (To Incident)</option>
            <option value="en-route">⚡ En-Route (To Hospital)</option>
            <option value="at-scene">🏥 At Scene</option>
            <option value="maintenance">🛠 Maintenance</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Battery / Fuel Level (%)</label>
          <input type="number" id="ambFormBattery" class="form-input" min="0" max="100" />
        </div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-secondary-btn" onclick="closeModal('modal-ambulance-detail')">Cancel</button>
        <button type="submit" class="btn-primary-btn">💾 Save Ambulance Telemetry</button>
      </div>
    </form>
  </div>
</div>

<!-- 4. HOSPITAL BED MANAGEMENT MODAL -->
<div id="modal-hospital-detail" class="modal-overlay" onclick="closeModalOnBg(event, 'modal-hospital-detail')">
  <div class="modal-card">
    <div class="modal-header">
      <div class="modal-title" id="hospDetailTitle">🏥 Hospital Bed Allocation</div>
      <button class="modal-close" onclick="closeModal('modal-hospital-detail')">✕</button>
    </div>
    <form onsubmit="submitHospitalBeds(event)">
      <input type="hidden" id="hospFormId" />
      <div class="form-group">
        <label class="form-label">Hospital Name</label>
        <input type="text" id="hospFormName" class="form-input" readonly />
      </div>
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
        <div class="form-group">
          <label class="form-label">Total ICU Capacity</label>
          <input type="number" id="hospFormCapacity" class="form-input" readonly />
        </div>
        <div class="form-group">
          <label class="form-label">Available Emergency Beds</label>
          <input type="number" id="hospFormBeds" class="form-input" min="0" required />
        </div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-secondary-btn" onclick="closeModal('modal-hospital-detail')">Cancel</button>
        <button type="submit" class="btn-primary-btn">🏥 Update Bed Capacity</button>
      </div>
    </form>
  </div>
</div>

<!-- 5. VOICE RADIO MODAL -->
<div id="modal-radio" class="modal-overlay" onclick="closeModalOnBg(event, 'modal-radio')">
  <div class="modal-card">
    <div class="modal-header">
      <div class="modal-title">🎙️ Push-to-Talk Emergency Radio Channel</div>
      <button class="modal-close" onclick="closeModal('modal-radio')">✕</button>
    </div>
    <div style="text-align:center; padding: 20px 0;">
      <div style="font-family:var(--mono); font-size: 24px; font-weight: 800; color: var(--green); margin-bottom: 10px;">CH-01: DISPATCH BROADCAST</div>
      <div style="font-size: 12px; color: var(--ink3); margin-bottom: 20px;">Frequency: 154.280 MHz (Encrypted AES-256)</div>
      <button class="btn-primary-btn" style="padding: 16px 32px; font-size: 16px; border-radius: 99px;" onclick="playRadioChime()">
        🎙️ PUSH TO TALK (ANNOUNCE)
      </button>
    </div>
    <div style="background:var(--bg2); border-radius:8px; padding:12px; font-family:var(--mono); font-size:10px; height:120px; overflow-y:auto;" id="radioLog">
      <div>[154.280] DISPATCH: All units standby for emergency audio dispatch broadcast...</div>
    </div>
  </div>
</div>

<!-- 6. ROLE SWITCHER MODAL -->
<div id="modal-role" class="modal-overlay" onclick="closeModalOnBg(event, 'modal-role')">
  <div class="modal-card">
    <div class="modal-header">
      <div class="modal-title">👤 Switch Operating User Role</div>
      <button class="modal-close" onclick="closeModal('modal-role')">✕</button>
    </div>
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
      <button class="btn-secondary-btn" style="padding:14px; text-align:left;" onclick="switchUserRole('dispatcher', 'goldenhour@123')">
        <strong>🚨 Dispatcher</strong><br><span style="font-size:10px; color:var(--ink4);">Command & Control</span>
      </button>
      <button class="btn-secondary-btn" style="padding:14px; text-align:left;" onclick="switchUserRole('admin', 'admin@golden')">
        <strong>⚙️ Admin Lead</strong><br><span style="font-size:10px; color:var(--ink4);">Analytics & Audit</span>
      </button>
      <button class="btn-secondary-btn" style="padding:14px; text-align:left;" onclick="switchUserRole('hospital', 'hospital@2026')">
        <strong>🏥 Hospital Liaison</strong><br><span style="font-size:10px; color:var(--ink4);">Bed Capacity</span>
      </button>
      <button class="btn-secondary-btn" style="padding:14px; text-align:left;" onclick="switchUserRole('ambulance', 'ambulance@123')">
        <strong>🚑 Ambulance Crew</strong><br><span style="font-size:10px; color:var(--ink4);">GPS Fleet Unit</span>
      </button>
      <button class="btn-secondary-btn" style="padding:14px; text-align:left;" onclick="switchUserRole('citizen', 'citizen@123')">
        <strong>👤 Citizen Portal</strong><br><span style="font-size:10px; color:var(--ink4);">Emergency Report</span>
      </button>
      <button class="btn-secondary-btn" style="padding:14px; text-align:left;" onclick="switchUserRole('superadmin', 'superadmin@123')">
        <strong>👑 Super Admin</strong><br><span style="font-size:10px; color:var(--ink4);">Full System Governance</span>
      </button>
    </div>
  </div>
</div>
`;

if (!html.includes('id="modal-new-incident"')) {
  html = html.replace('</body>', `${modalHTML}\n</body>`);
}

// 4. Inject Interactive Modal JS Handlers
const scriptJS = `
/* ════════════════════════════════════════════════════════════════
   MNC ENTERPRISE INTERACTIVE MODALS & EVENT HANDLERS
════════════════════════════════════════════════════════════════ */

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('active');
}

function closeModalOnBg(event, id) {
  if (event.target.id === id) closeModal(id);
}

// 1. OPEN NEW INCIDENT MODAL
function openNewIncidentModal() {
  openModal('modal-new-incident');
}

// Bind button clicks
document.addEventListener('DOMContentLoaded', () => {
  const newBtns = document.querySelectorAll('.btn-new');
  newBtns.forEach(btn => btn.addEventListener('click', openNewIncidentModal));

  const userChips = document.querySelectorAll('.user-chip');
  userChips.forEach(chip => chip.addEventListener('click', () => openModal('modal-role')));
});

async function submitNewIncidentForm(e) {
  e.preventDefault();
  const title = document.getElementById('incFormTitle').value;
  const type = document.getElementById('incFormType').value;
  const severity = document.getElementById('incFormSeverity').value;
  const location = document.getElementById('incFormLocation').value;
  const latitude = parseFloat(document.getElementById('incFormLat').value);
  const longitude = parseFloat(document.getElementById('incFormLng').value);
  const patient_count = parseInt(document.getElementById('incFormPatients').value);

  try {
    let token = localStorage.getItem('token');
    if (!token) {
      const loginRes = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'dispatcher', password: 'goldenhour@123' })
      });
      const loginData = await loginRes.json();
      token = loginData.token;
      if (token) localStorage.setItem('token', token);
    }

    const res = await fetch('/api/incidents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ title, type, severity, location, latitude, longitude, patient_count })
    });
    const data = await res.json();
    if (data.success) {
      closeModal('modal-new-incident');
      showToast('🚨', 'Incident Reported', \`Created \${data.incident.id} at \${location}\`, 'g', 5000);
      if (typeof syncWithBackend === 'function') syncWithBackend();
    } else {
      alert('Failed: ' + data.error);
    }
  } catch (err) {
    alert('Error submitting incident: ' + err.message);
  }
}

// 2. OPEN INCIDENT DETAIL MODAL
function openIncidentDetail(id) {
  const inc = incidents.find(i => i.id === id);
  if (!inc) return;

  document.getElementById('incDetailTitle').textContent = \`🚨 \${inc.id} — \${inc.title}\`;
  document.getElementById('incDetailContent').innerHTML = \`
    <div style="background:var(--bg2); padding:12px; border-radius:8px; margin-bottom:12px;">
      <div style="font-size:11px; font-family:var(--mono); color:var(--ink3);">SEVERITY: <strong style="color:var(--red);">\${(inc.severity||'').toUpperCase()}</strong></div>
      <div style="font-size:14px; font-weight:800; margin:4px 0;">\${inc.location}</div>
      <div style="font-size:11px; color:var(--ink4);">Patient Count: \${inc.patients || inc.patient_count || 1} | Status: \${inc.status}</div>
    </div>
    <div style="font-size:12px; margin-bottom:8px;"><strong>Estimated ETA:</strong> \${inc.eta || 5.8} min</div>
  \`;

  const dispatchBtn = document.getElementById('incDetailDispatchBtn');
  dispatchBtn.onclick = async () => {
    selId = inc.id;
    await window.executeDispatch();
    closeModal('modal-incident-detail');
  };

  openModal('modal-incident-detail');
}

// 3. OPEN AMBULANCE TELEMETRY MODAL
function openAmbulanceDetail(id) {
  const amb = (typeof state !== 'undefined' && state.ambulances) ? state.ambulances.find(a => a.id === id) : null;
  const num = amb ? amb.vehicle_number : id;
  const bat = amb ? amb.battery : 85;

  document.getElementById('ambFormId').value = id;
  document.getElementById('ambFormNumber').value = num;
  document.getElementById('ambFormBattery').value = bat;

  openModal('modal-ambulance-detail');
}

async function submitAmbulanceUpdate(e) {
  e.preventDefault();
  const id = document.getElementById('ambFormId').value;
  const status = document.getElementById('ambFormStatus').value;
  const battery = parseInt(document.getElementById('ambFormBattery').value);

  try {
    let token = localStorage.getItem('token');
    const res = await fetch(\`/api/ambulances/\${id}\`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ status, battery })
    });
    const data = await res.json();
    if (data.success) {
      closeModal('modal-ambulance-detail');
      showToast('🚑', 'Ambulance Updated', \`Unit \${id} status: \${status.toUpperCase()}\`, 'g', 4000);
      if (typeof syncWithBackend === 'function') syncWithBackend();
    }
  } catch (err) {
    alert('Error updating ambulance: ' + err.message);
  }
}

// 4. OPEN HOSPITAL BED MANAGEMENT MODAL
function openHospitalDetail(id, name, capacity, beds) {
  document.getElementById('hospFormId').value = id;
  document.getElementById('hospFormName').value = name || id;
  document.getElementById('hospFormCapacity').value = capacity || 400;
  document.getElementById('hospFormBeds').value = beds || 25;

  openModal('modal-hospital-detail');
}

async function submitHospitalBeds(e) {
  e.preventDefault();
  const id = document.getElementById('hospFormId').value;
  const beds = parseInt(document.getElementById('hospFormBeds').value);

  try {
    let token = localStorage.getItem('token');
    const res = await fetch(\`/api/hospitals/\${id}\`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ available_beds: beds })
    });
    const data = await res.json();
    if (data.success) {
      closeModal('modal-hospital-detail');
      showToast('🏥', 'Hospital Beds Updated', \`\${id} available beds: \${beds}\`, 'g', 4000);
      if (typeof syncWithBackend === 'function') syncWithBackend();
    }
  } catch (err) {
    alert('Error updating hospital: ' + err.message);
  }
}

// 5. VOICE RADIO PTT SIMULATOR
function openRadioModal() {
  openModal('modal-radio');
}

function playRadioChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);

    const log = document.getElementById('radioLog');
    if (log) {
      const time = new Date().toISOString().slice(11,19);
      log.innerHTML += \`<div>[\${time}] 🎙️ VOICE DISPATCH BROADCAST ACTIVE — Unit dispatched</div>\`;
      log.scrollTop = log.scrollHeight;
    }
  } catch (e) {
    console.log('Audio chime:', e);
  }
}

// 6. SWITCH USER ROLE
async function switchUserRole(role, password) {
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: role, password })
    });
    const data = await res.json();
    if (data.success) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('role', data.user.role);
      localStorage.setItem('username', data.user.username);

      closeModal('modal-role');
      showToast('👤', 'Role Switched', \`Logged in as \${data.user.name} (\${data.user.role.toUpperCase()})\`, 'g', 4000);
    }
  } catch (e) {
    alert('Role switch failed: ' + e.message);
  }
}
`;

if (!html.includes('function openNewIncidentModal()')) {
  html = html.replace('</script>', `${scriptJS}\n</script>`);
}

fs.writeFileSync(path.join(__dirname, '../public/index.html'), html);
console.log('public/index.html successfully updated with MNC Interactive Modals & Handlers!');
