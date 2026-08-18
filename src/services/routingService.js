class RoutingService {
  constructor() {
    this.providers = {
      osrm: { name: 'OSRM', enabled: true },
      graphhopper: { name: 'GraphHopper', enabled: true },
      mapbox: { name: 'Mapbox', enabled: false },
      google: { name: 'Google Maps', enabled: false }
    };
  }

  getPreferredProvider() {
    return Object.values(this.providers).find((provider) => provider.enabled) || this.providers.osrm;
  }

  buildRoute(from, to, options = {}) {
    const startLat = Number(from.latitude || from.lat || 0);
    const startLng = Number(from.longitude || from.lng || 0);
    const endLat = Number(to.latitude || to.lat || 0);
    const endLng = Number(to.longitude || to.lng || 0);

    const distanceKm = this.calculateDistanceKm(startLat, startLng, endLat, endLng);
    const baseMinutes = Math.max(3, Math.round(distanceKm * 1.8 + (options.trafficFactor || 1) * 2));

    return {
      provider: this.getPreferredProvider().name,
      distanceKm: Number(distanceKm.toFixed(2)),
      durationMinutes: baseMinutes,
      etaMinutes: baseMinutes,
      route: [
        [startLat, startLng],
        [endLat, endLng]
      ],
      trafficMode: options.trafficMode || 'balanced',
      rerouteSupported: true,
      optimized: true
    };
  }

  calculateDistanceKm(lat1, lon1, lat2, lon2) {
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

  simulateLiveTracking(vehicle, incident) {
    const route = this.buildRoute(vehicle, incident, { trafficMode: 'live' });
    return {
      vehicleId: vehicle.id,
      status: 'moving',
      speedKmh: 38 + Math.round(Math.random() * 24),
      progress: 25 + Math.round(Math.random() * 60),
      etaMinutes: route.etaMinutes,
      lastUpdated: new Date().toISOString(),
      route
    };
  }
}

module.exports = new RoutingService();
