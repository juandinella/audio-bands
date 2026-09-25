import * as THREE from 'three';

export function createSculpture(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.z = 5.4;
  const geometry = new THREE.IcosahedronGeometry(1, 3);
  const base = geometry.attributes.position.array.slice();
  const material = new THREE.MeshBasicMaterial({ color: '#c4ebad', wireframe: true, transparent: true, opacity: 0.6 });
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);
  function resize() {
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  return {
    draw({ scale, warp, spin }, time) {
      const position = geometry.attributes.position;
      for (let i = 0; i < position.count; i++) {
        const x = base[i * 3], y = base[i * 3 + 1], z = base[i * 3 + 2];
        const radius = 1 + Math.sin(y * 7 + time) * warp * 0.15;
        position.setXYZ(i, x * radius, y * radius, z * radius);
      }
      position.needsUpdate = true;
      mesh.scale.setScalar(0.7 + scale * 0.35);
      mesh.rotation.y = spin * Math.PI;
      mesh.rotation.x = 0.25;
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
