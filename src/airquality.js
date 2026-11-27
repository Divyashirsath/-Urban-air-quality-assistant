/**
 * Air quality data adapter seam.
 *
 * The local adapter ships deterministic winter-smog profiles so the assistant
 * workflow can run offline. A real implementation can replace these functions
 * with a provider such as AirNow, OpenWeather air-quality endpoints, or a local
 * sensor gateway without changing the agent workflow or the UI.
 */

const LOCAL_LOCATIONS = [
  {
    id: 'delhi',
    city: 'Delhi',
    region: 'Delhi NCR',
    country: 'India',
    pm25: 96,
    pm10: 158,
    aqi: 178,
    level: 'unhealthy_for_sensitive',
    dominantPollutant: 'PM2.5',
    season: 'winter',
    smogEpisode: true,
    backgroundPm25: 14,
    source: 'local-mock',
  },
  {
    id: 'beijing',
    city: 'Beijing',
    region: 'Beijing',
    country: 'China',
    pm25: 84,
    pm10: 132,
    aqi: 152,
    level: 'unhealthy_for_sensitive',
    dominantPollutant: 'PM2.5',
    season: 'winter',
    smogEpisode: true,
    backgroundPm25: 17,
    source: 'local-mock',
  },
  {
    id: 'london',
    city: 'London',
    region: 'Greater London',
    country: 'United Kingdom',
    pm25: 41,
    pm10: 61,
    aqi: 68,
    level: 'moderate',
    dominantPollutant: 'PM2.5',
    season: 'winter',
    smogEpisode: false,
    backgroundPm25: 12,
    source: 'local-mock',
  },
  {
    id: 'paris',
    city: 'Paris',
    region: 'Ile-de-France',
    country: 'France',
    pm25: 38,
    pm10: 54,
    aqi: 61,
    level: 'moderate',
    dominantPollutant: 'PM2.5',
    season: 'winter',
    smogEpisode: false,
    backgroundPm25: 11,
    source: 'local-mock',
  },
  {
    id: 'lahore',
    city: 'Lahore',
    region: 'Punjab',
    country: 'Pakistan',
    pm25: 132,
    pm10: 204,
    aqi: 214,
    level: 'very_unhealthy',
    dominantPollutant: 'PM2.5',
    season: 'winter',
    smogEpisode: true,
    backgroundPm25: 22,
    source: 'local-mock',
  },
  {
    id: 'karachi',
    city: 'Karachi',
    region: 'Sindh',
    country: 'Pakistan',
    pm25: 74,
    pm10: 121,
    aqi: 128,
    level: 'unhealthy_for_sensitive',
    dominantPollutant: 'PM2.5',
    season: 'winter',
    smogEpisode: true,
    backgroundPm25: 18,
    source: 'local-mock',
  },
  {
    id: 'los-angeles',
    city: 'Los Angeles',
    region: 'Southern California',
    country: 'United States',
    pm25: 62,
    pm10: 88,
    aqi: 104,
    level: 'unhealthy_for_sensitive',
    dominantPollutant: 'PM2.5',
    season: 'summer',
    smogEpisode: true,
    backgroundPm25: 9,
    source: 'local-mock',
  },
  {
    id: 'mexico-city',
    city: 'Mexico City',
    region: 'Mexico City',
    country: 'Mexico',
    pm25: 47,
    pm10: 76,
    aqi: 83,
    level: 'unhealthy_for_sensitive',
    dominantPollutant: 'PM2.5',
    season: 'winter',
    smogEpisode: true,
    backgroundPm25: 13,
    source: 'local-mock',
  },
];

const FALLBACK_CONTEXT = {
  id: 'local-region',
  city: 'Local region',
  region: 'Local region',
  country: 'Local region',
  pm25: 38,
  pm10: 55,
  aqi: 74,
  level: 'moderate',
  dominantPollutant: 'PM2.5',
  season: 'winter',
  smogEpisode: false,
  backgroundPm25: 12,
  source: 'regional-estimate',
  isEstimate: true,
};

function slug(value) {
  return String(value || 'local')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'local';
}

function resolveLocation(input = {}) {
  const rawKey = typeof input === 'string' ? input : (input.id || input.city || input.name || '');
  const key = slug(rawKey);
  const match = LOCAL_LOCATIONS.find((item) => item.id === key)
    || LOCAL_LOCATIONS.find((item) => item.city.toLowerCase() === String(rawKey || '').toLowerCase());
  if (match) {
    return {
      id: match.id,
      city: match.city,
      region: match.region,
      country: match.country,
      pm25: match.pm25,
      pm10: match.pm10,
      aqi: match.aqi,
      level: match.level,
      dominantPollutant: match.dominantPollutant,
      season: match.season,
      smogEpisode: match.smogEpisode,
      backgroundPm25: match.backgroundPm25,
      source: match.source,
      isEstimate: false,
    };
  }
  const city = String((input && input.city) || rawKey || 'Local region');
  const region = String((input && input.region) || city);
  const country = String((input && input.country) || 'Local region');
  return {
    id: slug(city),
    city,
    region,
    country,
    pm25: FALLBACK_CONTEXT.pm25,
    pm10: FALLBACK_CONTEXT.pm10,
    aqi: FALLBACK_CONTEXT.aqi,
    level: FALLBACK_CONTEXT.level,
    dominantPollutant: FALLBACK_CONTEXT.dominantPollutant,
    season: 'winter',
    smogEpisode: false,
    backgroundPm25: FALLBACK_CONTEXT.backgroundPm25,
    source: 'regional-estimate',
    isEstimate: true,
  };
}

function retrieveAirContext(input) {
  return resolveLocation(input);
}

function listLocations() {
  return LOCAL_LOCATIONS.map((item) => ({ ...item }));
}

function adapterStatus() {
  return {
    mode: 'local-mock',
    ready: true,
    provider: 'local-mock-sensor-profiles',
    pollutant: 'PM2.5',
    note: 'Deterministic offline profiles are used until a provider-backed retrieval is enabled.',
  };
}

module.exports = {
  FALLBACK_CONTEXT,
  LOCAL_LOCATIONS,
  adapterStatus,
  listLocations,
  resolveLocation,
  retrieveAirContext,
};
