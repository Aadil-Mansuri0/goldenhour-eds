function scoreDispatchReadiness(incident, ambulance, hospital) {
  const base = 70;
  const severityBoost = incident.severity === 'critical' ? 18 : incident.severity === 'high' ? 10 : 5;
  const ambulanceHealth = ambulance ? ambulance.battery || 80 : 50;
  const hospitalCapacity = hospital ? hospital.available_beds || 10 : 0;
  const reliability = Math.min(100, base + severityBoost + Math.round(ambulanceHealth / 2) + Math.min(20, hospitalCapacity / 4));

  return Math.min(99, reliability);
}

function forecastDemand(region, timeOfDay) {
  const hour = Number(timeOfDay || 9);
  const base = region === 'jaipur' ? 62 : 54;
  const peak = hour >= 8 && hour <= 11 ? 18 : hour >= 17 && hour <= 20 ? 12 : 4;
  return Math.min(99, base + peak);
}

module.exports = {
  scoreDispatchReadiness,
  forecastDemand
};
