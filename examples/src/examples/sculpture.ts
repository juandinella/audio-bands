import * as THREE from 'three';
import type { Bands } from '@juandinella/audio-bands';

// The site's band colours, in sRGB for three.js.
const BASS = new THREE.Color('#4b8ff0');
const MID = new THREE.Color('#f2f2f2');
const HIGH = new THREE.Color('#ff6a2a');

// The examples' sculpture: the site's three-scene, recoloured by band.
export function createSculpture(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.z = 5.6; // room for the sphere at full bass (radius ~1.65)
  const count = 6000;
  const base = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const color = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const angle = i * Math.PI * (3 - Math.sqrt(5));
    base.set([Math.cos(angle) * r, y, Math.sin(angle) * r], i * 3);
    // Bass blue at the bottom, mid white at the waist, high orange at the top.
    const t = (y + 1) / 2;
    color.copy(t < 0.5 ? BASS.clone().lerp(MID, t * 2) : MID.clone().lerp(HIGH, (t - 0.5) * 2));
    colors.set([color.r, color.g, color.b], i * 3);
  }
  const positions = base.slice();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({ size: 0.015, vertexColors: true, transparent: true, opacity: 0.9 });
  const points = new THREE.Points(geometry, material);
  scene.add(points);
  function resize() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  return {
    draw(bands: Bands, time: number, delta: number) {
      for (let i = 0; i < count; i++) {
        const wave = Math.sin(base[i * 3 + 1] * 8 + time * 2);
        const radius = 1 + bands.bass * 0.65 + wave * bands.mid * 0.2 + Math.sin(i * 0.17 + time) * bands.high * 0.3;
        const twist = base[i * 3 + 1] * bands.mid * 2;
        const x = base[i * 3], z = base[i * 3 + 2];
        positions[i * 3] = (x * Math.cos(twist) - z * Math.sin(twist)) * radius;
        positions[i * 3 + 1] = base[i * 3 + 1] * radius;
        positions[i * 3 + 2] = (x * Math.sin(twist) + z * Math.cos(twist)) * radius;
      }
      geometry.attributes.position.needsUpdate = true;
      points.rotation.y += (0.08 + bands.mid * 0.7) * delta;
      points.rotation.z = bands.high * 0.12;
      renderer.render(scene, camera);
    },
    dispose() {
      observer.disconnect();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    },
  };
}
