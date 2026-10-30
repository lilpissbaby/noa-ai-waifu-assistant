// El tiempo con Open-Meteo (https://open-meteo.com): gratis, sin clave y sin cuenta. La ciudad
// se busca con su geocodificador y se guarda con sus coordenadas.
import { net } from 'electron';

export const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
export const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

// Códigos WMO de Open-Meteo → texto en inglés (el modelo lo cuenta en el idioma del usuario).
const WMO = [
  [[0], 'clear sky'],
  [[1], 'mainly clear'],
  [[2], 'partly cloudy'],
  [[3], 'overcast'],
  [[45, 48], 'fog'],
  [[51, 53, 55], 'drizzle'],
  [[56, 57], 'freezing drizzle'],
  [[61, 63, 65], 'rain'],
  [[66, 67], 'freezing rain'],
  [[71, 73, 75, 77], 'snow'],
  [[80, 81, 82], 'rain showers'],
  [[85, 86], 'snow showers'],
  [[95], 'thunderstorm'],
  [[96, 99], 'thunderstorm with hail'],
];
export const sky = (code) => WMO.find(([codes]) => codes.includes(Number(code)))?.[1] || 'unknown';

async function getJson(url, fetchImpl, label) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetchImpl(url, { headers: { accept: 'application/json' }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`${label} ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// «Madrid», «Valencia, ES»… → { label, lat, lon, timezone } o null.
export async function geocode(name, { language = 'en', fetchImpl = net.fetch, baseUrl = GEOCODE_URL } = {}) {
  const q = String(name || '').trim();
  if (!q) return null;
  const [city, country] = q.split(',').map((s) => s.trim());
  const url = `${baseUrl}?name=${encodeURIComponent(city)}&count=10&language=${encodeURIComponent(language)}&format=json`;
  const data = await getJson(url, fetchImpl, 'Open-Meteo geocoding');
  let results = data?.results || [];
  if (country) {
    const c = country.toLowerCase();
    const match = results.filter((r) => String(r.country_code || '').toLowerCase() === c || String(r.country || '').toLowerCase().startsWith(c) || String(r.admin1 || '').toLowerCase().startsWith(c));
    if (match.length) results = match;
  }
  const r = results[0];
  if (!r) return null;
  return { label: [r.name, r.admin1, r.country].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', '), lat: r.latitude, lon: r.longitude, timezone: r.timezone || '' };
}

export async function forecast({ lat, lon }, { days = 3, units = 'metric', fetchImpl = net.fetch, baseUrl = FORECAST_URL } = {}) {
  const n = Math.max(1, Math.min(7, Number(days) || 3));
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,sunrise,sunset,uv_index_max',
    timezone: 'auto',
    forecast_days: String(n),
  });
  if (units === 'imperial') {
    params.set('temperature_unit', 'fahrenheit');
    params.set('wind_speed_unit', 'mph');
    params.set('precipitation_unit', 'inch');
  }
  return getJson(`${baseUrl}?${params}`, fetchImpl, 'Open-Meteo');
}

// Respuesta de Open-Meteo → algo compacto para el modelo.
export function summarize(raw, label = '') {
  const c = raw?.current || {};
  const cu = raw?.current_units || {};
  const d = raw?.daily || {};
  const du = raw?.daily_units || {};
  const u = (units, key) => (units[key] ? ` ${units[key]}` : '');
  return {
    location: label || `${raw?.latitude}, ${raw?.longitude}`,
    timezone: raw?.timezone,
    now: c.time
      ? {
          time: c.time,
          sky: sky(c.weather_code),
          temperature: `${c.temperature_2m}${u(cu, 'temperature_2m')}`,
          feelsLike: `${c.apparent_temperature}${u(cu, 'apparent_temperature')}`,
          humidity: `${c.relative_humidity_2m}${u(cu, 'relative_humidity_2m')}`,
          wind: `${c.wind_speed_10m}${u(cu, 'wind_speed_10m')}`,
          precipitation: `${c.precipitation}${u(cu, 'precipitation')}`,
          daylight: c.is_day === 1,
        }
      : undefined,
    days: (d.time || []).map((day, i) => ({
      date: day,
      sky: sky(d.weather_code?.[i]),
      min: `${d.temperature_2m_min?.[i]}${u(du, 'temperature_2m_min')}`,
      max: `${d.temperature_2m_max?.[i]}${u(du, 'temperature_2m_max')}`,
      rainChance: d.precipitation_probability_max?.[i] != null ? `${d.precipitation_probability_max[i]}%` : undefined,
      rain: d.precipitation_sum?.[i] != null ? `${d.precipitation_sum[i]}${u(du, 'precipitation_sum')}` : undefined,
      uvMax: d.uv_index_max?.[i],
      sunrise: d.sunrise?.[i]?.slice(11),
      sunset: d.sunset?.[i]?.slice(11),
    })),
  };
}
