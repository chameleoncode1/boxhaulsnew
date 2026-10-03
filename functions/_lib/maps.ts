/**
 * Address autocomplete, place lookup and driving distance.
 * Production: Google Places API (New) + Routes API with a server-side key (never sent to the browser).
 * Local development: when DEV_MOCK_MAPS=1 and no Google key is set, a deterministic mock is used so the booking
 * flow can be exercised end to end. The mock never runs in production (the key is set there).
 */
import type { Env } from './env';
import { HttpError } from './http';
import type { Place } from './quote';
import placeholders from '../../docs/placeholders.json';

const center = placeholders.SERVICE_CENTER as { lat: number; lng: number };
const radiusMiles = Number(placeholders.RADIUS);
const METERS_PER_MILE = 1609.344;

export interface Suggestion {
  placeId: string;
  text: string;
}

type Mode = 'google' | 'mock';

export function mapsMode(env: Env): Mode {
  if (env.GOOGLE_MAPS_API_KEY) return 'google';
  if (env.DEV_MOCK_MAPS === '1') return 'mock';
  throw new HttpError(503, 'maps_unavailable', 'Online quotes are temporarily unavailable.');
}

/** Straight-line distance in miles. */
export function haversineMiles(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 3958.8 * Math.asin(Math.sqrt(h));
}

/** Both addresses must be inside the service area: RADIUS miles of SERVICE_CENTER (docs/placeholders.json). */
export function assertInServiceArea(place: Place, label: string): void {
  if (haversineMiles(center, place) > radiusMiles) {
    throw new HttpError(422, 'outside_service_area', `The ${label} address is outside the Fresno and Clovis service area (${radiusMiles} miles).`);
  }
}

// ----- Google -----------------------------------------------------------------------------------------

async function google<T>(env: Env, url: string, init: RequestInit & { fieldMask?: string }): Promise<T> {
  const headers: Record<string, string> = { 'X-Goog-Api-Key': env.GOOGLE_MAPS_API_KEY!, 'Content-Type': 'application/json' };
  if (init.fieldMask) headers['X-Goog-FieldMask'] = init.fieldMask;
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    console.error('google maps error', res.status, await res.text());
    throw new HttpError(502, 'maps_error', "We couldn't look up that address. Please try again.");
  }
  return (await res.json()) as T;
}

async function googleAutocomplete(env: Env, input: string, sessionToken: string): Promise<Suggestion[]> {
  type R = { suggestions?: { placePrediction?: { placeId: string; text: { text: string } } }[] };
  const r = await google<R>(env, 'https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    body: JSON.stringify({
      input,
      sessionToken,
      includedRegionCodes: ['us'],
      locationRestriction: { circle: { center: { latitude: center.lat, longitude: center.lng }, radius: Math.min(50000, radiusMiles * METERS_PER_MILE) } },
    }),
  });
  return (r.suggestions ?? []).flatMap((s) => (s.placePrediction ? [{ placeId: s.placePrediction.placeId, text: s.placePrediction.text.text }] : []));
}

async function googlePlace(env: Env, placeId: string, sessionToken: string): Promise<Place> {
  type R = { formattedAddress: string; location: { latitude: number; longitude: number } };
  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?sessionToken=${encodeURIComponent(sessionToken)}`;
  const r = await google<R>(env, url, { method: 'GET', fieldMask: 'formattedAddress,location' });
  return { placeId, address: r.formattedAddress, lat: r.location.latitude, lng: r.location.longitude };
}

async function googleMiles(env: Env, a: Place, b: Place): Promise<number> {
  type R = { routes?: { distanceMeters?: number }[] };
  const r = await google<R>(env, 'https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    fieldMask: 'routes.distanceMeters',
    body: JSON.stringify({ origin: { placeId: a.placeId }, destination: { placeId: b.placeId }, travelMode: 'DRIVE', routingPreference: 'TRAFFIC_UNAWARE' }),
  });
  const meters = r.routes?.[0]?.distanceMeters;
  if (!meters) throw new HttpError(422, 'no_route', "We couldn't find a driving route between those addresses.");
  return meters / METERS_PER_MILE;
}

// ----- Mock (local development only) ------------------------------------------------------------------

const MOCK_PLACES: Place[] = [
  { placeId: 'mock-clovis', address: 'Mock address 1, Clovis, CA (test)', lat: 36.8252, lng: -119.7029 },
  { placeId: 'mock-fresno-downtown', address: 'Mock address 2, Fresno, CA (test)', lat: 36.7378, lng: -119.7871 },
  { placeId: 'mock-fresno-north', address: 'Mock address 3, North Fresno, CA (test)', lat: 36.8412, lng: -119.7799 },
  { placeId: 'mock-far', address: 'Mock address 4, Visalia, CA (test, outside the area)', lat: 36.3302, lng: -119.2921 },
];

// ----- Public API -------------------------------------------------------------------------------------

export async function autocomplete(env: Env, input: string, sessionToken: string): Promise<Suggestion[]> {
  if (mapsMode(env) === 'mock') return MOCK_PLACES.map((p) => ({ placeId: p.placeId, text: p.address }));
  return googleAutocomplete(env, input, sessionToken);
}

export async function lookupPlace(env: Env, placeId: string, sessionToken: string): Promise<Place> {
  if (mapsMode(env) === 'mock') {
    const p = MOCK_PLACES.find((m) => m.placeId === placeId);
    if (!p) throw new HttpError(422, 'bad_place', 'Please choose an address from the list.');
    return p;
  }
  return googlePlace(env, placeId, sessionToken);
}

export async function drivingMiles(env: Env, a: Place, b: Place): Promise<number> {
  // Mock: straight-line distance × 1.3, a typical road-to-crow ratio.
  if (mapsMode(env) === 'mock') return haversineMiles(a, b) * 1.3;
  return googleMiles(env, a, b);
}
