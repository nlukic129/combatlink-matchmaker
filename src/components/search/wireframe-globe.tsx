import { useEffect, useRef } from "react";
import type { GlobeInstance } from "globe.gl";
import type { Material } from "three";
import { cn } from "@/lib/utils";

const FIGHTER_MARKERS = [
  { lat: 40.71, lng: -74.01 },
  { lat: 34.05, lng: -118.24 },
  { lat: 51.51, lng: -0.13 },
  { lat: 48.86, lng: 2.35 },
  { lat: 35.68, lng: 139.69 },
  { lat: 55.76, lng: 37.62 },
  { lat: -23.55, lng: -46.63 },
  { lat: -33.87, lng: 151.21 },
  { lat: 25.2, lng: 55.27 },
  { lat: 1.35, lng: 103.82 },
  { lat: 19.43, lng: -99.13 },
  { lat: 52.37, lng: 4.9 },
  { lat: 41.9, lng: 12.5 },
  { lat: 59.33, lng: 18.07 },
  { lat: 6.52, lng: 3.38 },
  { lat: -26.2, lng: 28.04 },
  { lat: 30.04, lng: 31.24 },
  { lat: 13.76, lng: 100.5 },
  { lat: 45.5, lng: -73.57 },
  { lat: 53.35, lng: -6.26 },
  { lat: 50.11, lng: 8.68 },
  { lat: 43.65, lng: -79.38 },
] as const;

const NETWORK_ARCS = [
  { startLat: 40.71, startLng: -74.01, endLat: 51.51, endLng: -0.13, alt: 0.3, stroke: 0.38, dashLen: 0.4, dashGap: 0.18, animMs: 2600 },
  { startLat: 34.05, startLng: -118.24, endLat: 35.68, endLng: 139.69, alt: 0.36, stroke: 0.3, dashLen: 0.35, dashGap: 0.2, animMs: 3400 },
  { startLat: 51.51, startLng: -0.13, endLat: 25.2, endLng: 55.27, alt: 0.24, stroke: 0.32, dashLen: 0.42, dashGap: 0.16, animMs: 2200 },
  { startLat: 25.2, startLng: 55.27, endLat: 1.35, endLng: 103.82, alt: 0.22, stroke: 0.28, dashLen: 0.38, dashGap: 0.15, animMs: 2000 },
  { startLat: 1.35, startLng: 103.82, endLat: -33.87, endLng: 151.21, alt: 0.22, stroke: 0.28, dashLen: 0.36, dashGap: 0.18, animMs: 2100 },
  { startLat: -23.55, startLng: -46.63, endLat: 51.51, endLng: -0.13, alt: 0.38, stroke: 0.3, dashLen: 0.34, dashGap: 0.22, animMs: 3800 },
  { startLat: 55.76, startLng: 37.62, endLat: 35.68, endLng: 139.69, alt: 0.28, stroke: 0.26, dashLen: 0.4, dashGap: 0.18, animMs: 2800 },
  { startLat: 6.52, startLng: 3.38, endLat: 51.51, endLng: -0.13, alt: 0.26, stroke: 0.26, dashLen: 0.38, dashGap: 0.2, animMs: 2400 },
  { startLat: 40.71, startLng: -74.01, endLat: -23.55, endLng: -46.63, alt: 0.28, stroke: 0.28, dashLen: 0.36, dashGap: 0.18, animMs: 2600 },
  { startLat: 48.86, startLng: 2.35, endLat: 35.68, endLng: 139.69, alt: 0.34, stroke: 0.26, dashLen: 0.38, dashGap: 0.2, animMs: 3200 },
] as const;

const BRAND_RED = "#d44a3f";
const WIRE_RED = "#d44a3f";
const PIN_CORE = "#fff2ee";
const PIN_HOT = "#ff4a38";
const ARC_COLOR = "rgba(255, 95, 72, 0.40)";
const STROKE_CLR = "rgba(255, 148, 122, 0.92)";

const COUNTRIES_URL =
  "https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_110m_admin_0_countries.geojson";

let countriesCache: GeoJSON.Feature[] | null = null;
let countriesFetch: Promise<GeoJSON.Feature[]> | null = null;

function fetchCountries(signal?: AbortSignal): Promise<GeoJSON.Feature[]> {
  if (countriesCache) return Promise.resolve(countriesCache);
  if (countriesFetch) return countriesFetch;

  countriesFetch = fetch(COUNTRIES_URL, { signal })
    .then((r) => (r.ok ? r.json() : { features: [] }))
    .then((data: GeoJSON.FeatureCollection) => {
      countriesCache = (data.features ?? []).filter(
        (f) => f.geometry && (f.properties as { ADMIN?: string } | null)?.ADMIN !== "Antarctica"
      );
      countriesFetch = null;
      return countriesCache;
    })
    .catch((err: unknown) => {
      countriesFetch = null;
      if (err instanceof DOMException && err.name === "AbortError") throw err;
      return [];
    });

  return countriesFetch;
}

function destroyGlobe(globe: GlobeInstance, materials: Material[], container: HTMLElement) {
  globe.pauseAnimation();
  for (const mat of materials) mat.dispose();
  try {
    globe.renderer().dispose();
  } catch {
    // renderer may already be torn down
  }
  globe._destructor();
  container.replaceChildren();
}

type WireframeGlobeProps = { className?: string };

export function WireframeGlobe({ className }: WireframeGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let globe: GlobeInstance | null = null;
    let materials: Material[] = [];
    let teardown: (() => void) | null = null;
    const abort = new AbortController();

    async function init() {
      const [{ default: Globe }, THREE] = await Promise.all([
        import("globe.gl"),
        import("three"),
      ]);

      if (disposed || !container) return;

      const countryPolygons = await fetchCountries(abort.signal).catch(() => [] as GeoJSON.Feature[]);

      if (disposed || !container) return;

      const points = FIGHTER_MARKERS.map((marker, i) => ({
        ...marker,
        color: i % 2 === 0 ? PIN_CORE : PIN_HOT,
        size: 0.5 + (i % 3) * 0.08,
        halo: 0.34 + (i % 2) * 0.06,
      }));

      const rings = FIGHTER_MARKERS.map((marker, i) => ({
        lat: marker.lat,
        lng: marker.lng,
        maxR: 2.8 + (i % 4) * 0.55,
        propagationSpeed: 2.0 + (i % 3) * 0.28,
        repeatPeriod: 650 + (i % 5) * 160,
      }));

      const globeMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(WIRE_RED),
        wireframe: true,
        transparent: true,
        opacity: 0.1,
      });
      const polygonMat = new THREE.MeshLambertMaterial({
        color: new THREE.Color(BRAND_RED),
        transparent: true,
        opacity: 0.26,
        side: THREE.DoubleSide,
      });
      materials = [globeMat, polygonMat];

      globe = new Globe(container, { animateIn: false })
        .backgroundColor("rgba(0,0,0,0)")
        // Prevent globe.gl from downloading default ~5 MB earth textures
        .globeImageUrl(null as unknown as string)
        .bumpImageUrl(null as unknown as string)
        .showGlobe(true)
        .showGraticules(true)
        .showAtmosphere(true)
        .atmosphereColor(BRAND_RED)
        .atmosphereAltitude(0.15)
        .globeCurvatureResolution(3.5)
        .globeMaterial(globeMat)
        .polygonsData(countryPolygons)
        .polygonCapMaterial(polygonMat)
        .polygonSideColor(() => "rgba(0,0,0,0)")
        .polygonStrokeColor(() => STROKE_CLR)
        .polygonAltitude(0.02)
        .polygonCapCurvatureResolution(6)
        .polygonsTransitionDuration(0)
        .pointsData(points)
        .pointAltitude(0.045)
        .pointRadius("size")
        .pointColor("color")
        .pointResolution(12)
        .labelsData(points)
        .labelLat("lat")
        .labelLng("lng")
        .labelText(() => "")
        .labelSize(0.01)
        .labelDotRadius("halo")
        .labelColor(() => "rgba(255, 155, 130, 0.95)")
        .labelAltitude(0.052)
        .labelResolution(2)
        .ringsData(rings)
        .ringColor(() => "rgba(255, 110, 85, 0.58)")
        .ringMaxRadius("maxR")
        .ringPropagationSpeed("propagationSpeed")
        .ringRepeatPeriod("repeatPeriod")
        .arcsData([...NETWORK_ARCS])
        .arcColor(() => ARC_COLOR)
        .arcAltitude("alt")
        .arcStroke("stroke")
        .arcDashLength("dashLen")
        .arcDashGap("dashGap")
        .arcDashAnimateTime("animMs")
        .enablePointerInteraction(false)
        .pointOfView({ lat: 28, lng: -5, altitude: 1.78 });

      if (disposed) {
        destroyGlobe(globe, materials, container);
        globe = null;
        materials = [];
        return;
      }

      globe.globeOffset([0, 0.01]);
      globe.renderer().setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

      const controls = globe.controls();
      controls.enableZoom = false;
      controls.enablePan = false;
      controls.enableRotate = false;

      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!reducedMotion) {
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.55;
      }

      const onVisibility = () => {
        if (document.hidden) {
          globe?.pauseAnimation();
          controls.autoRotate = false;
        } else {
          globe?.resumeAnimation();
          controls.autoRotate = !reducedMotion;
        }
      };
      document.addEventListener("visibilitychange", onVisibility);

      const onViewTransitionStart = () => instance.pauseAnimation();
      const onViewTransitionEnd = () => {
        if (!disposed) instance.resumeAnimation();
      };
      document.addEventListener("viewtransitionstart", onViewTransitionStart);
      document.addEventListener("viewtransitionend", onViewTransitionEnd);

      const syncSize = () => {
        if (!globe || !container) return;
        const { clientWidth, clientHeight } = container;
        if (clientWidth > 0 && clientHeight > 0) {
          globe.width(clientWidth).height(clientHeight);
        }
      };

      syncSize();
      const resizeObserver = new ResizeObserver(syncSize);
      resizeObserver.observe(container);

      const instance = globe;
      const mats = materials;
      teardown = () => {
        resizeObserver.disconnect();
        document.removeEventListener("visibilitychange", onVisibility);
        document.removeEventListener("viewtransitionstart", onViewTransitionStart);
        document.removeEventListener("viewtransitionend", onViewTransitionEnd);
        destroyGlobe(instance, mats, container);
      };

      if (disposed) {
        teardown();
        teardown = null;
        globe = null;
        materials = [];
        return;
      }

      requestAnimationFrame(() => {
        if (!disposed) container.classList.add("is-ready");
      });
    }

    void init();

    return () => {
      disposed = true;
      abort.abort();
      teardown?.();
      teardown = null;
      globe = null;
      materials = [];
    };
  }, []);

  return (
    <div className={cn("wireframe-globe relative h-full w-full overflow-hidden", className)}>
      <div ref={containerRef} className="globe-canvas-enter h-full w-full" />
    </div>
  );
}
