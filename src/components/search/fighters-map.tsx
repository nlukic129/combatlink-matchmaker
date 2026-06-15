import { useEffect, useLayoutEffect, useRef, useMemo, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useNavigate } from "@tanstack/react-router";
import { Crosshair, Plus, Minus } from "lucide-react";
import type { Fighter } from "@/types/database";
import {
  boundsForFeatures,
  featuresForCountries,
  loadCountryBoundaries,
} from "@/lib/geo/country-boundaries";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN as string;

const SOURCE_ID = "fighters";
const CLUSTER_LAYER = "fighter-clusters-hit";
const BOUNDARY_SOURCE = "country-boundaries";
const BOUNDARY_FILL = "country-boundary-fill";
const BOUNDARY_LINE = "country-boundary-line";

/** Brand red — borders only; fill stays very pale */
const REGION_COLOR = "#E8001D";
const REGION_FILL_OPACITY = 0.07;

const AVAILABILITY_COLOR: Record<string, string> = {
  available: "#4ade80",
  in_camp: "#fbbf24",
  unavailable: "#71717a",
};

const ORBIT_RADIUS = 72;
const ORBIT_MAX_VISIBLE = 8;
const HOVER_SHOW_MS = 120;
const HOVER_HIDE_MS = 220;

type FighterEntry = { fighter: Fighter; isNear: boolean };

type Props = {
  fighters: Fighter[];
  nearMatch?: Fighter[];
  cityLat?: number;
  cityLng?: number;
  radiusKm?: number;
  highlightCountries?: string[];
  regionLabel?: string;
  /** Raw URL filter key — changes on every region filter click */
  regionFilterKey: string;
  /** False when list view hides the map — triggers resize when shown again */
  visible?: boolean;
};

export function FightersMap({
  fighters,
  nearMatch = [],
  cityLat,
  cityLng,
  radiusKm,
  highlightCountries,
  regionLabel,
  regionFilterKey,
  visible = true,
}: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const htmlMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const clusterMarkersRef = useRef<Map<number, mapboxgl.Marker>>(new Map());
  const stackMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const orbitOverlayRef = useRef<HTMLDivElement>(null);
  const fightersByIdRef = useRef<Map<string, FighterEntry>>(new Map());
  const hasInitialFitRef = useRef(false);
  const regionFitKeyRef = useRef("");
  const regionSyncGenRef = useRef(0);
  const highlightCountriesRef = useRef(highlightCountries);
  const regionFilterKeyRef = useRef(regionFilterKey);
  highlightCountriesRef.current = highlightCountries;
  regionFilterKeyRef.current = regionFilterKey;
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverStateRef = useRef({ marker: false, orbit: false });
  const orbitRequestRef = useRef(0);
  const activeOrbitRef = useRef<{ coords: [number, number]; key: string } | null>(null);
  const navigate = useNavigate({ from: "/search" });
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const mountedRef = useRef(true);

  const entries = useMemo(
    () =>
      [
        ...fighters.map((f) => ({ fighter: f, isNear: false })),
        ...nearMatch.map((f) => ({ fighter: f, isNear: true })),
      ].filter((e) => e.fighter.current_city_lat && e.fighter.current_city_lng),
    [fighters, nearMatch]
  );

  const geoJson = useMemo(() => buildGeoJSON(entries), [entries]);

  const stats = useMemo(() => {
    const all = [...fighters, ...nearMatch];
    return {
      total: all.length,
      available: all.filter(f => f.availability_status === 'available').length,
      inCamp: all.filter(f => f.availability_status === 'in_camp').length,
      unavailable: all.filter(f => f.availability_status === 'unavailable').length,
    };
  }, [fighters, nearMatch]);

  const syncRegionHighlights = useCallback(async (map: mapboxgl.Map) => {
    if (!mountedRef.current) return;
    const gen = ++regionSyncGenRef.current;
    const countries = highlightCountriesRef.current;
    const filterKey = regionFilterKeyRef.current;

    if (!countries?.length) {
      if (gen !== regionSyncGenRef.current) return;
      removeBoundaryLayers(map);
      regionFitKeyRef.current = "";
      return;
    }

    try {
      const world = await loadCountryBoundaries();
      if (gen !== regionSyncGenRef.current) return;

      const fc = featuresForCountries(world, countries);
      if (gen !== regionSyncGenRef.current) return;

      if (fc.features.length === 0) {
        console.warn("No boundary features matched:", countries);
        removeBoundaryLayers(map);
        return;
      }

      syncBoundaryLayers(map, fc);
      if (!mountedRef.current || gen !== regionSyncGenRef.current) return;

      if (regionFitKeyRef.current !== filterKey) {
        regionFitKeyRef.current = filterKey;
        const bounds = boundsForFeatures(fc.features);
        if (bounds) {
          map.fitBounds(bounds, {
            padding: { top: 80, bottom: 60, left: 60, right: 60 },
            maxZoom: 5,
            duration: 700,
          });
        }
      }
    } catch (err) {
      if (gen !== regionSyncGenRef.current) return;
      console.error("Failed to draw country boundaries", err);
      removeBoundaryLayers(map);
    }
  }, []);

  const syncRegionHighlightsRef = useRef(syncRegionHighlights);
  syncRegionHighlightsRef.current = syncRegionHighlights;

  const cancelHideTimer = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }, []);

  const hideOrbit = useCallback(() => {
    cancelHideTimer();
    orbitRequestRef.current += 1;
    hoverStateRef.current = { marker: false, orbit: false };
    activeOrbitRef.current = null;
    const overlay = orbitOverlayRef.current;
    if (overlay) {
      overlay.innerHTML = "";
      overlay.classList.remove("fm-orbit-overlay--visible");
    }
  }, [cancelHideTimer]);

  const fitAll = useCallback(() => {
    const map = mapRef.current;
    if (!map || entries.length === 0) return;
    const bounds = new mapboxgl.LngLatBounds();
    entries.forEach(({ fighter }) => {
      bounds.extend([fighter.current_city_lng!, fighter.current_city_lat!]);
    });
    map.fitBounds(bounds, { padding: 96, maxZoom: 9, duration: 700 });
  }, [entries]);

  const scheduleHideIfNeeded = useCallback(
    (key: string) => {
      cancelHideTimer();
      hoverTimerRef.current = setTimeout(() => {
        const { marker, orbit } = hoverStateRef.current;
        if (marker || orbit) return;
        if (activeOrbitRef.current?.key === key) hideOrbit();
      }, HOVER_HIDE_MS);
    },
    [cancelHideTimer, hideOrbit]
  );

  const onMarkerEnter = useCallback(
    (key: string, show: () => void) => {
      hoverStateRef.current.marker = true;
      cancelHideTimer();
      if (activeOrbitRef.current?.key === key) return;
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = setTimeout(show, HOVER_SHOW_MS);
    },
    [cancelHideTimer]
  );

  const onMarkerLeave = useCallback(
    (key: string) => {
      hoverStateRef.current.marker = false;
      scheduleHideIfNeeded(key);
    },
    [scheduleHideIfNeeded]
  );

  const positionOrbit = useCallback((coords: [number, number]) => {
    const map = mapRef.current;
    const overlay = orbitOverlayRef.current;
    if (!map || !overlay || !activeOrbitRef.current) return;

    const point = map.project(coords);
    overlay.style.left = `${point.x}px`;
    overlay.style.top = `${point.y}px`;
  }, []);

  const showOrbit = useCallback(
    (entries: FighterEntry[], coords: [number, number], key: string) => {
      const overlay = orbitOverlayRef.current;
      if (!overlay || entries.length === 0) return;

      // Already open for this pin — just reposition, don't rebuild (avoids animation loop)
      if (
        activeOrbitRef.current?.key === key &&
        overlay.classList.contains("fm-orbit-overlay--visible")
      ) {
        activeOrbitRef.current.coords = coords;
        positionOrbit(coords);
        return;
      }

      if (activeOrbitRef.current?.key !== key) {
        overlay.innerHTML = "";
        overlay.classList.remove("fm-orbit-overlay--visible");
      }

      activeOrbitRef.current = { coords, key };

      const visible = entries.slice(0, ORBIT_MAX_VISIBLE);
      const extra = entries.length - visible.length;

      const ring = document.createElement("div");
      ring.className = "fm-orbit-ring";

      const center = document.createElement("div");
      center.className = "fm-orbit-center";
      center.innerHTML = `<span class="fm-orbit-nucleus-count">${entries.length}</span><span class="fm-orbit-nucleus-label">fighters</span>`;

      overlay.appendChild(ring);
      overlay.appendChild(center);

      visible.forEach((entry, i) => {
        const { fighter, isNear } = entry;
        const angle = (i / visible.length) * 2 * Math.PI - Math.PI / 2;
        const x = Math.cos(angle) * ORBIT_RADIUS;
        const y = Math.sin(angle) * ORBIT_RADIUS;
        const fullName = [fighter.first_name, fighter.last_name].filter(Boolean).join(" ");
        const city = fighter.current_city?.trim();

        const wrap = document.createElement("div");
        wrap.className = "fm-orbit-item-wrap";
        wrap.style.setProperty("--ox", `${x}px`);
        wrap.style.setProperty("--oy", `${y}px`);
        wrap.style.animationDelay = `${i * 35}ms`;

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "fm-orbit-chip";
        btn.style.setProperty("--chip-color", AVAILABILITY_COLOR[fighter.availability_status] ?? AVAILABILITY_COLOR.unavailable);
        btn.title = city ? `${fullName} — ${city}` : fullName;
        if (isNear) btn.dataset.near = "true";

        if (fighter.photo_url) {
          btn.innerHTML = `<img src="${escapeHtml(fighter.photo_url)}" alt="" class="fm-orbit-photo" />`;
        } else {
          btn.textContent = fighter.first_name?.[0]?.toUpperCase() ?? "?";
        }

        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          hideOrbit();
          navigateRef.current({
            search: (p) => ({ ...p, fighter: fighter.id }),
            replace: true,
          });
        });

        const nameLabel = document.createElement("span");
        nameLabel.className = "fm-orbit-name";
        nameLabel.textContent = fighter.first_name ?? "?";

        wrap.appendChild(btn);
        wrap.appendChild(nameLabel);
        overlay.appendChild(wrap);
      });

      if (extra > 0) {
        const more = document.createElement("div");
        more.className = "fm-orbit-more";
        more.textContent = `+${extra} more`;
        overlay.appendChild(more);
      }

      overlay.classList.add("fm-orbit-overlay--visible");
      positionOrbit(coords);
    },
    [positionOrbit]
  );

  const showClusterOrbit = useCallback(
    (clusterId: number, coords: [number, number], count: number) => {
      const map = mapRef.current;
      if (!map) return;
      const source = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource;
      const key = `cluster-${clusterId}`;
      const requestId = ++orbitRequestRef.current;

      source.getClusterLeaves(clusterId, Math.min(count, 50), 0, (err, leaves) => {
        if (requestId !== orbitRequestRef.current) return;
        if (err || !leaves?.length) return;
        const list: FighterEntry[] = [];

        for (const leaf of leaves) {
          const id = leaf.properties?.id as string;
          const entry = fightersByIdRef.current.get(id);
          if (entry) list.push(entry);
        }

        if (list.length) showOrbit(list, coords, key);
      });
    },
    [showOrbit]
  );

  const clearAllMarkers = useCallback(() => {
    htmlMarkersRef.current.forEach((m) => m.remove());
    htmlMarkersRef.current.clear();
    clusterMarkersRef.current.forEach((m) => m.remove());
    clusterMarkersRef.current.clear();
    stackMarkersRef.current.forEach((m) => m.remove());
    stackMarkersRef.current.clear();
    hideOrbit();
  }, [hideOrbit]);

  const syncMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.getSource(SOURCE_ID)) return;

    // ── Cluster markers ──
    const clusterFeatures = map.querySourceFeatures(SOURCE_ID, {
      filter: ["has", "point_count"],
    });
    const seenClusters = new Set<number>();

    for (const feature of clusterFeatures) {
      const clusterId = feature.properties?.cluster_id as number | undefined;
      const count = feature.properties?.point_count as number | undefined;
      if (clusterId == null || count == null || seenClusters.has(clusterId)) continue;
      seenClusters.add(clusterId);

      const coords = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
      let marker = clusterMarkersRef.current.get(clusterId);

      if (!marker) {
        const el = createClusterElement(count);
        marker = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat(coords)
          .addTo(map);

        el.addEventListener("click", () => {
          const source = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource;
          source.getClusterExpansionZoom(clusterId, (err, zoom) => {
            if (err || zoom == null) return;
            map.easeTo({ center: coords, zoom });
          });
        });

        el.addEventListener("mouseenter", () => {
          onMarkerEnter(`cluster-${clusterId}`, () => {
            const lngLat = marker!.getLngLat();
            showClusterOrbit(clusterId, [lngLat.lng, lngLat.lat], count);
          });
        });
        el.addEventListener("mouseleave", () => onMarkerLeave(`cluster-${clusterId}`));

        clusterMarkersRef.current.set(clusterId, marker);
      } else {
        marker.setLngLat(coords);
        const countEl = marker.getElement().querySelector(".fm-cluster-count");
        if (countEl) countEl.textContent = String(count);
        const disk = marker.getElement().querySelector(".fm-cluster-disk");
        if (disk) {
          const root = marker.getElement();
          root.dataset.tier = count >= 25 ? 'lg' : count >= 10 ? 'md' : 'sm';
        }
      }
    }

    for (const [id, marker] of clusterMarkersRef.current) {
      if (!seenClusters.has(id)) {
        marker.remove();
        clusterMarkersRef.current.delete(id);
      }
    }

    // ── Unclustered points ──
    const pointFeatures = map.querySourceFeatures(SOURCE_ID, {
      filter: ["!", ["has", "point_count"]],
    });

    const byLocation = new Map<string, { ids: string[]; coords: [number, number] }>();
    const seenIds = new Set<string>();

    for (const feature of pointFeatures) {
      const id = feature.properties?.id as string | undefined;
      if (!id || seenIds.has(id)) continue;
      seenIds.add(id);

      const coords = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
      const key = locationKey(coords);
      const group = byLocation.get(key) ?? { ids: [], coords };
      group.ids.push(id);
      byLocation.set(key, group);
    }

    const visibleSingleIds = new Set<string>();
    const visibleStackKeys = new Set<string>();

    for (const [key, group] of byLocation) {
      if (group.ids.length > 1) {
        visibleStackKeys.add(key);
      } else {
        visibleSingleIds.add(group.ids[0]);
      }
    }

    // Stack markers (same city / same coords)
    for (const key of visibleStackKeys) {
      const group = byLocation.get(key)!;
      const stackEntries = group.ids
        .map((id) => fightersByIdRef.current.get(id))
        .filter(Boolean) as FighterEntry[];

      let marker = stackMarkersRef.current.get(key);

      if (!marker) {
        const cityName = stackEntries[0]?.fighter.current_city ?? '';
        const el = createStackElement(stackEntries.length, cityName);
        marker = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat(group.coords)
          .addTo(map);

        el.addEventListener("click", () => {
          showOrbit(stackEntries, group.coords, `stack-${key}`);
        });
        el.addEventListener("mouseenter", () => {
          onMarkerEnter(`stack-${key}`, () =>
            showOrbit(stackEntries, group.coords, `stack-${key}`)
          );
        });
        el.addEventListener("mouseleave", () => onMarkerLeave(`stack-${key}`));

        stackMarkersRef.current.set(key, marker);
      } else {
        marker.setLngLat(group.coords);
        const badgeEl = marker.getElement().querySelector(".fm-stack-badge");
        if (badgeEl) badgeEl.textContent = String(stackEntries.length);
      }
    }

    for (const [key, marker] of stackMarkersRef.current) {
      if (!visibleStackKeys.has(key)) {
        marker.remove();
        stackMarkersRef.current.delete(key);
      }
    }

    // Single fighter markers (with spiderfy offset when near stacks)
    for (const id of visibleSingleIds) {
      const entry = fightersByIdRef.current.get(id);
      if (!entry) continue;

      const feature = pointFeatures.find((f) => f.properties?.id === id);
      if (!feature) continue;

      const coords = (feature.geometry as GeoJSON.Point).coordinates as [number, number];

      const { fighter, isNear } = entry;
      const fullName = [fighter.first_name, fighter.last_name].filter(Boolean).join(" ");

      let marker = htmlMarkersRef.current.get(id);
      if (!marker) {
        const el = createMarkerElement(fighter, isNear);

        const statusLabel = { available: 'Available', in_camp: 'In camp', unavailable: 'Unavailable' }[fighter.availability_status] ?? '';
        const cityLine = [fighter.current_city, fighter.current_city_country].filter(Boolean).join(', ');
        const popup = new mapboxgl.Popup({
          offset: 24,
          closeButton: false,
          maxWidth: '240px',
          className: 'fm-popup',
        }).setHTML(`
          <div class="fm-popup-body">
            ${fighter.photo_url ? `<div class="fm-popup-photo" style="background-image:url('${escapeHtml(fighter.photo_url)}')"></div>` : `<div class="fm-popup-photo fm-popup-photo--initials"><span>${escapeHtml(fighter.first_name?.[0]?.toUpperCase() ?? '?')}</span></div>`}
            <div class="fm-popup-info">
              <p class="fm-popup-name">${escapeHtml(fullName)}</p>
              ${fighter.nickname ? `<p class="fm-popup-nick">&ldquo;${escapeHtml(fighter.nickname)}&rdquo;</p>` : ''}
              ${cityLine ? `<p class="fm-popup-loc">${escapeHtml(cityLine)}</p>` : ''}
              <span class="fm-popup-status" data-status="${fighter.availability_status ?? 'unavailable'}">${escapeHtml(statusLabel)}</span>
              ${isNear ? `<span class="fm-popup-near">Near match</span>` : ''}
            </div>
          </div>
        `);

        marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
          .setLngLat(coords)
          .setPopup(popup)
          .addTo(map);

        el.addEventListener("click", (e) => {
          e.stopPropagation();
          navigateRef.current({
            search: (p) => ({ ...p, fighter: fighter.id }),
            replace: true,
          });
        });

        htmlMarkersRef.current.set(id, marker);
      } else {
        marker.setLngLat(coords);
      }
    }

    for (const [id, marker] of htmlMarkersRef.current) {
      if (!visibleSingleIds.has(id)) {
        marker.remove();
        htmlMarkersRef.current.delete(id);
      }
    }
  }, [onMarkerEnter, onMarkerLeave, showClusterOrbit, showOrbit]);

  const syncMarkersRef = useRef(syncMarkers);
  syncMarkersRef.current = syncMarkers;
  const clearAllMarkersRef = useRef(clearAllMarkers);
  clearAllMarkersRef.current = clearAllMarkers;
  const positionOrbitRef = useRef(positionOrbit);
  positionOrbitRef.current = positionOrbit;

  // Init map — single Mapbox instance per mount; never recreated on data/filter updates
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    mountedRef.current = true;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: cityLng && cityLat ? [cityLng, cityLat] : [10, 30],
      zoom: cityLat ? 4 : 2,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");
    mapRef.current = map;

    const resize = () => {
      if (mountedRef.current) map.resize();
    };
    requestAnimationFrame(resize);

    const observer = new ResizeObserver(resize);
    observer.observe(containerRef.current);

    const onMove = () => {
      if (activeOrbitRef.current) {
        positionOrbitRef.current(activeOrbitRef.current.coords);
      }
    };
    const onMoveEnd = () => syncMarkersRef.current();
    const onZoomEnd = () => syncMarkersRef.current();
    const onSourceData = (e: mapboxgl.MapSourceDataEvent) => {
      if (e.sourceId === SOURCE_ID && e.isSourceLoaded) syncMarkersRef.current();
    };

    const onLoad = () => {
      if (!mountedRef.current) return;
      resize();

      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      });

      map.addLayer({
        id: CLUSTER_LAYER,
        type: "circle",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        paint: {
          "circle-radius": ["step", ["get", "point_count"], 22, 10, 26, 25, 30],
          "circle-opacity": 0,
        },
      });

      map.on("move", onMove);
      map.on("moveend", onMoveEnd);
      map.on("zoomend", onZoomEnd);
      map.on("sourcedata", onSourceData);

      void syncRegionHighlightsRef.current(map);

      // Atmospheric fog
      map.setFog({
        color: 'rgb(2, 2, 14)',
        'high-color': 'rgb(4, 4, 20)',
        'horizon-blend': 0.05,
        range: [0.8, 8],
        'space-color': 'rgb(2, 2, 14)',
        'star-intensity': 0,
      });
      // Hide visual noise (POI labels)
      ['poi-label', 'transit-label', 'airport-label', 'natural-point-label', 'water-point-label'].forEach(id => {
        try { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none'); } catch {}
      });
    };

    map.on("load", onLoad);

    const orbit = orbitOverlayRef.current;
    const onOrbitEnter = () => {
      hoverStateRef.current.orbit = true;
      cancelHideTimer();
    };
    const onOrbitLeave = () => {
      hoverStateRef.current.orbit = false;
      if (activeOrbitRef.current) scheduleHideIfNeeded(activeOrbitRef.current.key);
    };
    orbit?.addEventListener("mouseenter", onOrbitEnter);
    orbit?.addEventListener("mouseleave", onOrbitLeave);

    return () => {
      mountedRef.current = false;
      regionSyncGenRef.current += 1;
      cancelHideTimer();

      observer.disconnect();
      orbit?.removeEventListener("mouseenter", onOrbitEnter);
      orbit?.removeEventListener("mouseleave", onOrbitLeave);

      map.off("load", onLoad);
      map.off("move", onMove);
      map.off("moveend", onMoveEnd);
      map.off("zoomend", onZoomEnd);
      map.off("sourcedata", onSourceData);

      clearAllMarkersRef.current();
      removeBoundaryLayers(map);
      removeRadiusLayers(map);

      map.remove();
      mapRef.current = null;
      hasInitialFitRef.current = false;
      regionFitKeyRef.current = "";
    };
  }, []);

  // Update source data — setData only, never recreates the map
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mountedRef.current) return;

    fightersByIdRef.current = new Map(entries.map((e) => [e.fighter.id, e]));

    const apply = () => {
      if (!mountedRef.current) return;
      const source = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
      if (!source) return;

      hideOrbit();
      source.setData(geoJson);

      if (!hasInitialFitRef.current && entries.length > 0 && !highlightCountries?.length) {
        const bounds = new mapboxgl.LngLatBounds();
        entries.forEach(({ fighter }) => {
          bounds.extend([fighter.current_city_lng!, fighter.current_city_lat!]);
        });
        hasInitialFitRef.current = true;
        map.fitBounds(bounds, { padding: 80, maxZoom: 10, duration: 600 });
      }

      if (entries.length === 0) clearAllMarkers();
    };

    return runWhenMapReady(map, apply);
  }, [geoJson, entries, clearAllMarkers, hideOrbit, highlightCountries?.length]);

  // Country region borders — layer updates only
  useLayoutEffect(() => {
    const map = mapRef.current;
    if (!map || !mountedRef.current) return;

    return runWhenMapReady(map, () => {
      void syncRegionHighlightsRef.current(map);
    });
  }, [regionFilterKey]);

  // Radius overlay — layer updates only
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mountedRef.current) return;

    const draw = () => {
      if (!mountedRef.current) return;
      removeRadiusLayers(map);

      if (!cityLat || !cityLng || !radiusKm) return;

      const circle = createCircleGeoJSON([cityLng, cityLat], radiusKm);
      map.addSource("radius", { type: "geojson", data: circle });
      map.addLayer(
        {
          id: "radius-fill",
          type: "fill",
          source: "radius",
          paint: { "fill-color": "#E8001D", "fill-opacity": 0.07 },
        },
        CLUSTER_LAYER
      );
      map.addLayer(
        {
          id: "radius-stroke",
          type: "line",
          source: "radius",
          paint: { "line-color": "#E8001D", "line-opacity": 0.45, "line-width": 1.5 },
        },
        CLUSTER_LAYER
      );
    };

    const cancel = runWhenMapReady(map, draw);
    return () => {
      cancel();
      // Also remove radius in cleanup so switching city→clear never leaves stale layers
      const m = mapRef.current;
      if (m?.isStyleLoaded()) removeRadiusLayers(m);
    };
  }, [cityLat, cityLng, radiusKm]);

  // Resize when map becomes visible again after list view (container was display:none equivalent)
  useEffect(() => {
    if (!visible) return;
    const map = mapRef.current;
    if (!map) return;
    const id = requestAnimationFrame(() => map.resize());
    return () => cancelAnimationFrame(id);
  }, [visible]);

  return (
    <div ref={wrapperRef} className="fm-map-root relative h-full w-full min-h-[400px]">
      <div ref={containerRef} className="h-full w-full" />
      <div ref={orbitOverlayRef} className="fm-orbit-overlay" aria-hidden />

      {/* Region panel */}
      {highlightCountries && highlightCountries.length > 0 && (
        <div className="fm-region-panel" aria-live="polite">
          <div className="fm-region-panel-header">
            <span className="fm-region-dot" aria-hidden />
            <span className="fm-region-title">Selected region</span>
          </div>
          <p className="fm-region-label">{regionLabel ?? formatRegionLabel(highlightCountries)}</p>
          <p className="fm-region-count">
            {highlightCountries.length} {highlightCountries.length === 1 ? 'country highlighted' : 'countries highlighted'}
          </p>
        </div>
      )}

      {/* Stats HUD */}
      {stats.total > 0 && (
        <div className="fm-hud">
          <span className="fm-hud-total">{stats.total.toLocaleString()} fighters</span>
          <div className="fm-hud-divider" />
          <div className="fm-hud-row">
            <span className="fm-hud-dot" data-status="available" />
            <span className="fm-hud-num">{stats.available}</span>
            {stats.inCamp > 0 && (
              <>
                <span className="fm-hud-dot" data-status="in_camp" />
                <span className="fm-hud-num">{stats.inCamp}</span>
              </>
            )}
            {stats.unavailable > 0 && (
              <>
                <span className="fm-hud-dot" data-status="unavailable" />
                <span className="fm-hud-num">{stats.unavailable}</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Custom map controls */}
      <div className="fm-ctrl-group">
        <button
          type="button"
          className="fm-ctrl-btn"
          onClick={fitAll}
          title="Fit all fighters"
          disabled={entries.length === 0}
          aria-label="Fit all fighters on map"
        >
          <Crosshair className="h-3.5 w-3.5" />
        </button>
        <div className="fm-ctrl-sep" />
        <button
          type="button"
          className="fm-ctrl-btn"
          onClick={() => mapRef.current?.zoomIn({ duration: 250 })}
          title="Zoom in"
          aria-label="Zoom in"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="fm-ctrl-btn"
          onClick={() => mapRef.current?.zoomOut({ duration: 250 })}
          title="Zoom out"
          aria-label="Zoom out"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function formatRegionLabel(countries: string[]): string {
  if (countries.length <= 3) return countries.join(", ");
  return `${countries.slice(0, 3).join(", ")} +${countries.length - 3} more`;
}

/** Run fn when style is ready; returns cleanup that cancels a pending load listener. */
function runWhenMapReady(map: mapboxgl.Map, fn: () => void): () => void {
  if (map.isStyleLoaded()) {
    fn();
    return () => {};
  }
  const onLoad = () => fn();
  map.once("load", onLoad);
  return () => map.off("load", onLoad);
}

function removeRadiusLayers(map: mapboxgl.Map) {
  if (map.getLayer("radius-fill")) map.removeLayer("radius-fill");
  if (map.getLayer("radius-stroke")) map.removeLayer("radius-stroke");
  if (map.getSource("radius")) map.removeSource("radius");
}

function removeBoundaryLayers(map: mapboxgl.Map) {
  if (map.getLayer(BOUNDARY_LINE)) map.removeLayer(BOUNDARY_LINE);
  if (map.getLayer(BOUNDARY_FILL)) map.removeLayer(BOUNDARY_FILL);
  if (map.getSource(BOUNDARY_SOURCE)) map.removeSource(BOUNDARY_SOURCE);
}

function syncBoundaryLayers(map: mapboxgl.Map, data: GeoJSON.FeatureCollection) {
  if (!map.getSource(BOUNDARY_SOURCE)) {
    map.addSource(BOUNDARY_SOURCE, { type: "geojson", data });
  } else {
    (map.getSource(BOUNDARY_SOURCE) as mapboxgl.GeoJSONSource).setData(data);
  }

  const beforeId = map.getLayer(CLUSTER_LAYER) ? CLUSTER_LAYER : undefined;

  if (!map.getLayer(BOUNDARY_FILL)) {
    map.addLayer(
      {
        id: BOUNDARY_FILL,
        type: "fill",
        source: BOUNDARY_SOURCE,
        paint: {
          "fill-color": REGION_COLOR,
          "fill-opacity": REGION_FILL_OPACITY,
          "fill-antialias": true,
        },
      },
      beforeId
    );
  }

  if (!map.getLayer(BOUNDARY_LINE)) {
    map.addLayer(
      {
        id: BOUNDARY_LINE,
        type: "line",
        source: BOUNDARY_SOURCE,
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": REGION_COLOR,
          "line-opacity": 0.9,
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            3,
            1.25,
            6,
            1.75,
            10,
            2.5,
          ],
        },
      },
      beforeId
    );
  }

  map.setPaintProperty(BOUNDARY_FILL, "fill-color", REGION_COLOR);
  map.setPaintProperty(BOUNDARY_FILL, "fill-opacity", REGION_FILL_OPACITY);
  map.setLayoutProperty(BOUNDARY_LINE, "line-join", "round");
  map.setLayoutProperty(BOUNDARY_LINE, "line-cap", "round");
  map.setPaintProperty(BOUNDARY_LINE, "line-color", REGION_COLOR);
  map.setPaintProperty(BOUNDARY_LINE, "line-opacity", 0.9);
  map.setPaintProperty(
    BOUNDARY_LINE,
    "line-width",
    ["interpolate", ["linear"], ["zoom"], 3, 1.25, 6, 1.75, 10, 2.5]
  );
}

function locationKey(coords: [number, number]): string {
  return `${coords[0].toFixed(5)},${coords[1].toFixed(5)}`;
}

function buildGeoJSON(entries: FighterEntry[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: entries.map(({ fighter, isNear }) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [fighter.current_city_lng!, fighter.current_city_lat!],
      },
      properties: {
        id: fighter.id,
        isNear,
        availability: fighter.availability_status ?? "unavailable",
      },
    })),
  };
}

function createClusterElement(count: number): HTMLElement {
  const root = document.createElement("div");
  root.className = "fm-cluster";
  const tier = count >= 25 ? "lg" : count >= 10 ? "md" : "sm";
  root.dataset.tier = tier;
  root.innerHTML = `
    <div class="fm-cluster-disk">
      <span class="fm-cluster-count">${count}</span>
    </div>
  `;
  return root;
}

function createStackElement(count: number, cityName: string): HTMLElement {
  const root = document.createElement("div");
  root.className = "fm-stack";
  root.innerHTML = `
    <div class="fm-stack-pill">
      <span class="fm-stack-badge">${count}</span>
      <span class="fm-stack-sep"></span>
      <span class="fm-stack-city">${escapeHtml(cityName.split(',')[0].trim())}</span>
    </div>
    <div class="fm-stack-tip"></div>
  `;
  return root;
}

function createMarkerElement(fighter: Fighter, isNear: boolean): HTMLElement {
  const status = fighter.availability_status ?? "unavailable";
  const root = document.createElement("div");
  root.className = "fm-pin";
  root.dataset.status = isNear ? "near" : status;

  // Pulse ring (available only)
  if (status === "available" && !isNear) {
    const pulse = document.createElement("div");
    pulse.className = "fm-pin-pulse";
    root.appendChild(pulse);
  }

  const disk = document.createElement("div");
  disk.className = "fm-pin-disk";

  if (fighter.photo_url) {
    const img = document.createElement("img");
    img.src = fighter.photo_url;
    img.alt = "";
    img.className = "fm-pin-photo";
    img.draggable = false;
    disk.appendChild(img);
  } else {
    const ini = document.createElement("span");
    ini.className = "fm-pin-initials";
    ini.textContent = fighter.first_name?.[0]?.toUpperCase() ?? "?";
    disk.appendChild(ini);
  }

  const dot = document.createElement("span");
  dot.className = "fm-pin-dot";
  disk.appendChild(dot);

  const tip = document.createElement("div");
  tip.className = "fm-pin-tip";

  root.appendChild(disk);
  root.appendChild(tip);
  return root;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function createCircleGeoJSON(center: [number, number], radiusKm: number) {
  const points = 64;
  const coords: [number, number][] = [];
  const distRad = radiusKm / 6371;

  for (let i = 0; i < points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    const lat = Math.asin(
      Math.sin((center[1] * Math.PI) / 180) * Math.cos(distRad) +
        Math.cos((center[1] * Math.PI) / 180) * Math.sin(distRad) * Math.cos(angle)
    );
    const lng =
      (center[0] * Math.PI) / 180 +
      Math.atan2(
        Math.sin(angle) * Math.sin(distRad) * Math.cos((center[1] * Math.PI) / 180),
        Math.cos(distRad) - Math.sin((center[1] * Math.PI) / 180) * Math.sin(lat)
      );
    coords.push([(lng * 180) / Math.PI, (lat * 180) / Math.PI]);
  }
  coords.push(coords[0]);

  return {
    type: "Feature" as const,
    geometry: { type: "Polygon" as const, coordinates: [coords] },
    properties: {},
  };
}
