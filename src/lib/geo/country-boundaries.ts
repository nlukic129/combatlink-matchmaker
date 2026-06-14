import { COUNTRIES, normalizeCountry } from "@/lib/geo/countries";

/** Natural Earth 10m — highest public resolution (~13 MB). */
const BOUNDARIES_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson";

/** Bump version when URL changes to invalidate stale browser cache entries. */
const BOUNDARIES_CACHE = "combatlink-country-boundaries-v2-10m";

type CountryFeature = GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;

let worldBoundaries: GeoJSON.FeatureCollection | null = null;
let loadPromise: Promise<GeoJSON.FeatureCollection> | null = null;
const geoNameToCanonical = new Map<string, string>();
const canonicalToFeatures = new Map<string, CountryFeature[]>();

const GEO_NAME_OVERRIDES: Record<string, string> = {
  "united states of america": "United States",
  "russian federation": "Russia",
  "republic of korea": "South Korea",
  "dem. rep. korea": "North Korea",
  "democratic republic of the congo": "Democratic Republic of the Congo",
  "republic of the congo": "Congo",
  "côte d'ivoire": "Ivory Coast",
  "cote d'ivoire": "Ivory Coast",
  "czech republic": "Czechia",
  "bosnia and herz.": "Bosnia and Herzegovina",
  "dominican rep.": "Dominican Republic",
  "eq. guinea": "Equatorial Guinea",
  "central african rep.": "Central African Republic",
  "s. sudan": "South Sudan",
  "solomon is.": "Solomon Islands",
  "united kingdom": "United Kingdom",
  "great britain": "United Kingdom",
  "macedonia": "North Macedonia",
  "swaziland": "Eswatini",
};

function registerGeoName(raw: string | undefined, canonical: string) {
  if (!raw || !canonical) return;
  geoNameToCanonical.set(raw.trim().toLowerCase(), canonical);
}

function canonicalFromGeoName(raw: string | undefined): string {
  if (!raw) return "";
  const key = raw.trim().toLowerCase();
  if (geoNameToCanonical.has(key)) return geoNameToCanonical.get(key)!;
  if (GEO_NAME_OVERRIDES[key]) return GEO_NAME_OVERRIDES[key];
  return normalizeCountry(raw);
}

function addFeatureForCountry(canonical: string, feature: CountryFeature) {
  const key = canonical.toLowerCase();
  const list = canonicalToFeatures.get(key) ?? [];
  const id = String(feature.properties?.NAME ?? feature.properties?.ADMIN ?? feature.id ?? key);
  if (!list.some((f) => String(f.properties?.NAME ?? f.properties?.ADMIN) === id)) {
    list.push(feature);
    canonicalToFeatures.set(key, list);
  }
}

function buildGeoNameIndex(features: CountryFeature[]) {
  geoNameToCanonical.clear();
  canonicalToFeatures.clear();

  for (const country of COUNTRIES) {
    registerGeoName(country, country);
  }

  for (const feature of features) {
    const props = feature.properties ?? {};
    const names = [props.ADMIN, props.NAME, props.BRK_NAME, props.FORMAL_EN, props.NAME_LONG].filter(
      Boolean
    );
    const canonicalNames = new Set<string>();

    for (const name of names) {
      const canonical = canonicalFromGeoName(String(name)) || normalizeCountry(String(name));
      if (canonical) {
        canonicalNames.add(canonical);
        registerGeoName(String(name), canonical);
      }
    }

    for (const canonical of canonicalNames) {
      addFeatureForCountry(canonical, feature);
    }
  }
}

async function fetchBoundariesGeoJSON(): Promise<GeoJSON.FeatureCollection> {
  if (typeof caches !== "undefined") {
    try {
      const cache = await caches.open(BOUNDARIES_CACHE);
      const cached = await cache.match(BOUNDARIES_URL);
      if (cached) {
        return cached.json() as Promise<GeoJSON.FeatureCollection>;
      }

      const res = await fetch(BOUNDARIES_URL);
      if (!res.ok) throw new Error("Failed to load country boundaries");
      await cache.put(BOUNDARIES_URL, res.clone());
      return res.json() as Promise<GeoJSON.FeatureCollection>;
    } catch {
      // Cache API unavailable — fall through to plain fetch
    }
  }

  const res = await fetch(BOUNDARIES_URL);
  if (!res.ok) throw new Error("Failed to load country boundaries");
  return res.json() as Promise<GeoJSON.FeatureCollection>;
}

export function loadCountryBoundaries(): Promise<GeoJSON.FeatureCollection> {
  if (worldBoundaries) return Promise.resolve(worldBoundaries);
  if (loadPromise) return loadPromise;

  loadPromise = fetchBoundariesGeoJSON()
    .then((data) => {
      worldBoundaries = data;
      buildGeoNameIndex(data.features as CountryFeature[]);
      return data;
    })
    .catch((err) => {
      loadPromise = null;
      throw err;
    });

  return loadPromise;
}

export function featuresForCountries(
  _world: GeoJSON.FeatureCollection,
  countryNames: string[]
): GeoJSON.FeatureCollection {
  const features: CountryFeature[] = [];
  const seen = new Set<string>();

  for (const name of countryNames) {
    const canonical = normalizeCountry(name) || name;
    const matches = canonicalToFeatures.get(canonical.toLowerCase()) ?? [];

    for (const feature of matches) {
      const id = String(feature.properties?.NAME ?? feature.properties?.ADMIN ?? feature.id);
      if (seen.has(id)) continue;
      seen.add(id);
      features.push(feature);
    }
  }

  return { type: "FeatureCollection", features };
}

export function boundsForFeatures(
  features: GeoJSON.Feature[]
): [[number, number], [number, number]] | null {
  if (!features.length) return null;

  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  function extendCoords(coords: GeoJSON.Position | GeoJSON.Position[] | GeoJSON.Position[][]) {
    if (typeof coords[0] === "number") {
      const [lng, lat] = coords as GeoJSON.Position;
      minLng = Math.min(minLng, lng);
      minLat = Math.min(minLat, lat);
      maxLng = Math.max(maxLng, lng);
      maxLat = Math.max(maxLat, lat);
      return;
    }
    for (const part of coords as GeoJSON.Position[] | GeoJSON.Position[][]) {
      extendCoords(part);
    }
  }

  for (const feature of features) {
    if (!feature.geometry) continue;
    if (feature.geometry.type === "Polygon") {
      extendCoords(feature.geometry.coordinates);
    } else if (feature.geometry.type === "MultiPolygon") {
      extendCoords(feature.geometry.coordinates);
    }
  }

  if (!Number.isFinite(minLng)) return null;
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}
