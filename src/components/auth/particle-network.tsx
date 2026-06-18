import { useEffect, useRef } from "react";
import * as THREE from "three";

const PARTICLE_COUNT = 120;
const RED_RATIO = 0.18;
const MAX_SPEED = 1.0;
const DAMPING = 0.992;
const DRIFT_FORCE = 0.03;
const BRAND_RED = { r: 212 / 255, g: 74 / 255, b: 63 / 255 };

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  isRed: boolean;
};

export function ParticleNetwork() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let animId: number;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    let width = container.clientWidth;
    let height = container.clientHeight;
    renderer.setSize(width, height);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(
      -width / 2, width / 2, height / 2, -height / 2, 0.1, 100,
    );
    camera.position.z = 10;

    const mouse = { x: 0, y: 0 };
    let hasMouseMoved = false;

    const redCount = Math.floor(PARTICLE_COUNT * RED_RATIO);
    const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      x: (Math.random() - 0.5) * width,
      y: (Math.random() - 0.5) * height,
      vx: (Math.random() - 0.5) * 0.6,
      vy: (Math.random() - 0.5) * 0.6,
      isRed: i < redCount,
    }));

    // Shuffle so red and white are mixed
    for (let i = particles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [particles[i], particles[j]] = [particles[j], particles[i]];
    }

    // --- Points ---
    const pointPositions = new Float32Array(PARTICLE_COUNT * 3);
    const pointColors = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = particles[i];
      pointPositions[i * 3] = p.x;
      pointPositions[i * 3 + 1] = p.y;
      if (p.isRed) {
        pointColors[i * 3] = BRAND_RED.r;
        pointColors[i * 3 + 1] = BRAND_RED.g;
        pointColors[i * 3 + 2] = BRAND_RED.b;
      } else {
        pointColors[i * 3] = 1;
        pointColors[i * 3 + 1] = 1;
        pointColors[i * 3 + 2] = 1;
      }
    }

    const pointsGeo = new THREE.BufferGeometry();
    const pointPosAttr = new THREE.BufferAttribute(pointPositions, 3);
    pointPosAttr.setUsage(THREE.DynamicDrawUsage);
    pointsGeo.setAttribute("position", pointPosAttr);
    pointsGeo.setAttribute("color", new THREE.BufferAttribute(pointColors, 3));

    const pointsMat = new THREE.PointsMaterial({
      size: 3.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      sizeAttenuation: false,
    });
    scene.add(new THREE.Points(pointsGeo, pointsMat));

    // --- Lines ---
    const MAX_LINES = Math.floor((PARTICLE_COUNT * (PARTICLE_COUNT - 1)) / 2);
    const linePositions = new Float32Array(MAX_LINES * 6);
    const lineColors = new Float32Array(MAX_LINES * 6);

    const linesGeo = new THREE.BufferGeometry();
    const linePosAttr = new THREE.BufferAttribute(linePositions, 3);
    const lineColAttr = new THREE.BufferAttribute(lineColors, 3);
    linePosAttr.setUsage(THREE.DynamicDrawUsage);
    lineColAttr.setUsage(THREE.DynamicDrawUsage);
    linesGeo.setAttribute("position", linePosAttr);
    linesGeo.setAttribute("color", lineColAttr);

    const linesMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true });
    scene.add(new THREE.LineSegments(linesGeo, linesMat));

    function getConnectionDist() {
      return Math.min(width, height) * 0.19;
    }
    function getMouseRadius() {
      return Math.min(width, height) * 0.22;
    }

    function animate() {
      if (disposed) return;
      animId = requestAnimationFrame(animate);

      const connDist = getConnectionDist();
      const mouseRadius = getMouseRadius();
      const halfW = width / 2;
      const halfH = height / 2;

      for (const p of particles) {
        if (hasMouseMoved) {
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < mouseRadius && dist > 1) {
            const force = (1 - dist / mouseRadius) * 0.008;
            p.vx += (dx / dist) * force;
            p.vy += (dy / dist) * force;
          }
        }

        // Brownian drift — keeps particles wandering even without mouse
        p.vx += (Math.random() - 0.5) * DRIFT_FORCE;
        p.vy += (Math.random() - 0.5) * DRIFT_FORCE;

        p.vx *= DAMPING;
        p.vy *= DAMPING;

        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (speed > MAX_SPEED) {
          p.vx = (p.vx / speed) * MAX_SPEED;
          p.vy = (p.vy / speed) * MAX_SPEED;
        }

        p.x += p.vx;
        p.y += p.vy;

        if (p.x > halfW) p.x -= width;
        else if (p.x < -halfW) p.x += width;
        if (p.y > halfH) p.y -= height;
        else if (p.y < -halfH) p.y += height;
      }

      // Update point positions
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        linePosAttr; // referenced below
        pointPosAttr.setXY(i, particles[i].x, particles[i].y);
      }
      pointPosAttr.needsUpdate = true;

      // Update lines
      let lineCount = 0;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        for (let j = i + 1; j < PARTICLE_COUNT; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < connDist) {
            const alpha = (1 - dist / connDist) * 0.55;
            const isRedLine = particles[i].isRed || particles[j].isRed;
            const r = isRedLine ? BRAND_RED.r : 1;
            const g = isRedLine ? BRAND_RED.g : 1;
            const b = isRedLine ? BRAND_RED.b : 1;

            linePosAttr.setXYZ(lineCount * 2, particles[i].x, particles[i].y, 0);
            linePosAttr.setXYZ(lineCount * 2 + 1, particles[j].x, particles[j].y, 0);
            lineColAttr.setXYZ(lineCount * 2, r * alpha, g * alpha, b * alpha);
            lineColAttr.setXYZ(lineCount * 2 + 1, r * alpha, g * alpha, b * alpha);
            lineCount++;
          }
        }
      }

      linesGeo.setDrawRange(0, lineCount * 2);
      linePosAttr.needsUpdate = true;
      lineColAttr.needsUpdate = true;

      renderer.render(scene, camera);
    }

    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = e.clientX - rect.left - width / 2;
      mouse.y = -(e.clientY - rect.top - height / 2);
      hasMouseMoved = true;
    };

    const onMouseLeave = () => {
      hasMouseMoved = false;
    };

    const onResize = () => {
      width = container.clientWidth;
      height = container.clientHeight;
      renderer.setSize(width, height);
      camera.left = -width / 2;
      camera.right = width / 2;
      camera.top = height / 2;
      camera.bottom = -height / 2;
      camera.updateProjectionMatrix();
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseleave", onMouseLeave);
    const ro = new ResizeObserver(onResize);
    ro.observe(container);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reducedMotion) animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(animId);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseleave", onMouseLeave);
      ro.disconnect();
      pointsGeo.dispose();
      linesGeo.dispose();
      pointsMat.dispose();
      linesMat.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0"
      aria-hidden
    />
  );
}
