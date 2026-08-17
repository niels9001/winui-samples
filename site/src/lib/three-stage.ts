import * as THREE from "three";

export function initShowcaseStage(host: HTMLElement): () => void {
  let disposed = false;
  let visible = true;
  let pointerX = 0;
  let pointerY = 0;
  let frame = 0;
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearAlpha(0);
  renderer.domElement.setAttribute("aria-hidden", "true");
  renderer.domElement.tabIndex = -1;
  host.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 0.1, 8.5);
  const group = new THREE.Group();
  scene.add(group);

  const colors = [0x69bfff, 0x9e8cff, 0x5ce1c2];
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  for (let index = 0; index < 7; index += 1) {
    const width = index % 3 === 0 ? 2.7 : 2.05;
    const geometry = new THREE.BoxGeometry(width, 1.35, 0.08);
    const material = new THREE.MeshPhysicalMaterial({
      color: colors[index % colors.length],
      transparent: true,
      opacity: 0.25,
      roughness: 0.25,
      metalness: 0.05,
      transmission: 0.35,
      thickness: 0.4,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    const column = index % 3;
    mesh.position.set((column - 1) * 2.15, 1.45 - Math.floor(index / 3) * 1.65, -index * 0.12);
    mesh.rotation.set((index % 2 ? -1 : 1) * 0.08, (column - 1) * -0.14, (column - 1) * 0.045);
    group.add(mesh);
    geometries.push(geometry);
    materials.push(material);
  }

  const light = new THREE.PointLight(0x8bd5ff, 28, 20);
  light.position.set(0, 2, 5);
  scene.add(light, new THREE.AmbientLight(0xffffff, 1.8));

  function resize() {
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (width === 0 || height === 0) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    resume();
  }

  function render() {
    frame = 0;
    if (disposed || !visible || document.hidden) return;
    const targetY = pointerX * 0.14;
    const targetX = -pointerY * 0.08;
    group.rotation.y += (targetY - group.rotation.y) * 0.08;
    group.rotation.x += (targetX - group.rotation.x) * 0.08;
    renderer.render(scene, camera);
    if (
      Math.abs(targetY - group.rotation.y) > 0.0005 ||
      Math.abs(targetX - group.rotation.x) > 0.0005
    ) {
      frame = window.requestAnimationFrame(render);
    }
  }

  function resume() {
    if (!frame && visible && !document.hidden && !disposed) {
      frame = window.requestAnimationFrame(render);
    }
  }

  function pause() {
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  const visibilityObserver = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? false;
    visible ? resume() : pause();
  });
  visibilityObserver.observe(host);
  const onPointerMove = (event: PointerEvent) => {
    const rect = host.getBoundingClientRect();
    pointerX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    pointerY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    resume();
  };
  const onVisibility = () => (document.hidden ? pause() : resume());

  function dispose() {
    if (disposed) return;
    disposed = true;
    pause();
    resizeObserver.disconnect();
    visibilityObserver.disconnect();
    host.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("visibilitychange", onVisibility);
    renderer.domElement.removeEventListener("webglcontextlost", dispose);
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    renderer.dispose();
    renderer.domElement.remove();
  }

  host.addEventListener("pointermove", onPointerMove, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);
  renderer.domElement.addEventListener("webglcontextlost", dispose, { once: true });
  resize();
  resume();
  return dispose;
}
