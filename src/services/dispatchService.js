const { v4: uuidv4 } = require('uuid');

function getDistanceKm(lat1, lon1, lat2, lon2) {
  const toRad = (value) => (Number(value) * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

function estimateEtaKm(distanceKm) {
  return Math.max(2.5, Number(((distanceKm / 38) * 60).toFixed(1)));
}

function normalizeSeverity(severity) {
  const map = {
    critical: 'critical',
    high: 'high',
    medium: 'medium',
    low: 'low',
    stable: 'low'
  };
  return map[severity?.toLowerCase()] || 'medium';
}

function buildDashboardPayload({ incidents = [], ambulances = [], hospitals = [] }) {
  const activeIncidents = incidents.filter((item) => item.status !== 'resolved');
  const avgResponse = activeIncidents.length
    ? (activeIncidents.reduce((sum, item) => sum + Number(item.eta_minutes || 0), 0) / activeIncidents.length).toFixed(1)
    : '5.2';

  const criticalCount = activeIncidents.filter((item) => item.severity === 'critical').length;
  const ambulanceAvailable = ambulances.filter((item) => item.status === 'available').length;
  const hospitalsWithCapacity = hospitals.filter((item) => (item.available_beds || 0) > 0).length;
  const totalBeds = hospitals.reduce((sum, h) => sum + Number(h.available_beds || 0), 0);

  return {
    summary: {
      responseTime: `${avgResponse}m`,
      activeIncidents: activeIncidents.length,
      criticalCount,
      ambulancesAvailable: ambulanceAvailable,
      totalFleet: ambulances.length,
      hospitalsWithCapacity,
      totalHospitals: hospitals.length,
      totalAvailableBeds: totalBeds,
      systemHealth: 'OPERATIONAL'
    },
    map: {
      center: { lat: 26.9124, lng: 75.7873 },
      incidents: activeIncidents,
      ambulances,
      hospitals
    },
    kpis: {
      avgResponse,
      activeIncidents: activeIncidents.length,
      fleetAvailable: ambulanceAvailable,
      totalBeds,
      aiAccuracy: 96.4,
      compliance: 98.8
    }
  };
}

function recommendBestHospital(incident = {}, hospitals = []) {
  if (!hospitals.length) return null;
  const incLat = Number(incident.latitude || 26.9124);
  const incLng = Number(incident.longitude || 75.7873);

  return hospitals
    .map((h) => {
      const distance = getDistanceKm(incLat, incLng, Number(h.latitude), Number(h.longitude));
      const beds = Number(h.available_beds || 0);
      const isApex = (h.trauma_level || '').includes('Level 1') ? 25 : 10;
      // High score for close distance, high bed count, apex trauma rating
      const score = (beds * 0.5) + isApex - (distance * 1.5);
      return {
        ...h,
        distanceKm: distance,
        score: Number(score.toFixed(2)),
        etaMinutes: estimateEtaKm(distance)
      };
    })
    .sort((a, b) => b.score - a.score)[0];
}

function generateIncidentId() {
  return `INC-${Date.now().toString().slice(-6)}`;
}

function createIncidentInput(payload = {}) {
  const title = payload.title || 'Emergency Incident Call';
  const type = payload.type || 'Trauma';
  const severity = normalizeSeverity(payload.severity || 'medium');
  const location = payload.location || 'Incident Scene Coordinates';
  const latitude = Number(payload.latitude !== undefined ? payload.latitude : 26.9124);
  const longitude = Number(payload.longitude !== undefined ? payload.longitude : 75.7873);
  const region = payload.region || 'national';
  const city = payload.city || payload.location || 'Pan-India Zone';
  const patientCount = Number(payload.patient_count || payload.patientCount || 1);
  const distEst = getDistanceKm(latitude, longitude, latitude + 0.03, longitude + 0.03);

  return {
    id: payload.id || generateIncidentId(),
    title,
    type,
    severity,
    status: payload.status || 'active',
    location,
    latitude,
    longitude,
    region,
    city,
    patient_count: patientCount,
    eta_minutes: payload.eta_minutes || estimateEtaKm(distEst),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    source: payload.source || 'manual'
  };
}

function selectNearestAmbulance(incident = {}, ambulances = []) {
  if (!ambulances.length) return null;
  const incLat = Number(incident.latitude || 26.9124);
  const incLng = Number(incident.longitude || 75.7873);

  let candidates = ambulances.filter((a) => a.status === 'available' || a.status === 'en-route');
  if (!candidates.length) {
    candidates = ambulances;
  }

  return candidates
    .map((a) => {
      const distance = getDistanceKm(incLat, incLng, Number(a.latitude), Number(a.longitude));
      return {
        ...a,
        distanceKm: distance,
        etaMinutes: estimateEtaKm(distance)
      };
    })
    .sort((a, b) => a.distanceKm - b.distanceKm)[0] || null;
}

function createDispatchDecision(incident = {}, ambulances = [], hospitals = []) {
  const ambulance = selectNearestAmbulance(incident, ambulances);
  const hospital = recommendBestHospital(incident, hospitals);

  return {
    incidentId: incident.id,
    ambulanceId: ambulance?.id || null,
    ambulanceNumber: ambulance?.vehicle_number || null,
    hospitalId: hospital?.id || null,
    hospitalName: hospital?.name || null,
    etaMinutes: ambulance?.etaMinutes || 4.5,
    routeDistanceKm: ambulance ? ambulance.distanceKm : 2.5,
    recommendedDestination: hospital?.name || null,
    decision: ambulance ? 'dispatch_recommended' : 'no_ambulance_available',
    decisionId: uuidv4()
  };
}

module.exports = {
  getDistanceKm,
  estimateEtaKm,
  buildDashboardPayload,
  recommendBestHospital,
  createIncidentInput,
  selectNearestAmbulance,
  createDispatchDecision,
  normalizeSeverity
};
