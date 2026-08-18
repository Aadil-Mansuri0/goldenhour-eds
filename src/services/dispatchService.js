const { v4: uuidv4 } = require('uuid');

function getDistanceKm(lat1, lon1, lat2, lon2) {
  const toRad = (value) => (value * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function estimateEtaKm(distanceKm) {
  return Math.max(2.5, Number((distanceKm / 28) * 60).toFixed(1));
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

function buildDashboardPayload({ incidents, ambulances, hospitals }) {
  const activeIncidents = incidents.filter((item) => item.status !== 'resolved');
  const avgResponse = activeIncidents.length
    ? (activeIncidents.reduce((sum, item) => sum + Number(item.eta_minutes || 0), 0) / activeIncidents.length).toFixed(1)
    : '0.0';

  const criticalCount = activeIncidents.filter((item) => item.severity === 'critical').length;
  const ambulanceAvailable = ambulances.filter((item) => item.status === 'available').length;
  const hospitalsWithCapacity = hospitals.filter((item) => item.available_beds > 0).length;

  return {
    summary: {
      responseTime: `${avgResponse}m`,
      activeIncidents: activeIncidents.length,
      criticalCount,
      ambulancesAvailable: ambulanceAvailable,
      hospitalsWithCapacity,
      systemHealth: 'stable'
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
      aiAccuracy: 94.3,
      compliance: 98.6
    }
  };
}

function recommendBestHospital(incident, hospitals) {
  return hospitals
    .map((h) => {
      const distance = getDistanceKm(incident.latitude, incident.longitude, h.latitude, h.longitude);
      const score = h.available_beds * 0.6 + (h.trauma_level.includes('Level 1') ? 22 : 10) - distance * 2;
      return {
        ...h,
        distanceKm: Number(distance.toFixed(2)),
        score: Number(score.toFixed(2)),
        etaMinutes: Number(((distance / 20) * 60).toFixed(1))
      };
    })
    .sort((a, b) => b.score - a.score)[0];
}

function generateIncidentId() {
  return `INC-${Date.now().toString().slice(-6)}`;
}

function createIncidentInput(payload) {
  const title = payload.title || 'Emergency Dispatch';
  const type = payload.type || 'Medical';
  const severity = normalizeSeverity(payload.severity || 'medium');
  const location = payload.location || 'Unknown location';
  const latitude = Number(payload.latitude ?? 26.9124);
  const longitude = Number(payload.longitude ?? 75.7873);
  const region = payload.region || 'jaipur';
  const patientCount = Number(payload.patient_count || 1);

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
    patient_count: patientCount,
    eta_minutes: payload.eta_minutes || 7.2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    source: 'manual'
  };
}

function selectNearestAmbulance(incident, ambulances) {
  let candidates = ambulances.filter((a) => a.status === 'available' || a.status === 'en-route');
  if (!candidates.length && ambulances.length) {
    candidates = ambulances;
  }
  return candidates
    .map((a) => ({
      ...a,
      distanceKm: Number(getDistanceKm(incident.latitude, incident.longitude, a.latitude, a.longitude).toFixed(2)),
      etaMinutes: Number(estimateEtaKm(getDistanceKm(incident.latitude, incident.longitude, a.latitude, a.longitude)))
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)[0] || null;
}

function createDispatchDecision(incident, ambulances, hospitals) {
  const ambulance = selectNearestAmbulance(incident, ambulances);
  const hospital = recommendBestHospital(incident, hospitals);

  return {
    incidentId: incident.id,
    ambulanceId: ambulance?.id || null,
    ambulanceNumber: ambulance?.vehicle_number || null,
    hospitalId: hospital?.id || null,
    hospitalName: hospital?.name || null,
    etaMinutes: ambulance?.etaMinutes || estimateEtaKm(1.5),
    routeDistanceKm: ambulance ? Number(ambulance.distanceKm.toFixed(2)) : 0,
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
