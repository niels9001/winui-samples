import * as THREE from "three";

export function initShowcaseStage(
  host: HTMLElement,
  interactionRoot: HTMLElement = host,
): () => void {
  let disposed = false;
  let visible = true;
  let frame = 0;
  let pointerX = 0;
  let pointerY = 0;
  let scrollProgress = 0.5;
  let focusedCard = -1;

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
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0.1, 8.4);
  const workspace = new THREE.Group();
  scene.add(workspace);

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const cardMeshes: THREE.Mesh[] = [];

  function createPanel(
    width: number,
    height: number,
    color: number,
    opacity: number,
  ): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(width, height, 0.04);
    const material = new THREE.MeshPhysicalMaterial({
      color,
      transparent: true,
      opacity,
      roughness: 0.32,
      metalness: 0.02,
      transmission: 0.32,
      thickness: 0.45,
      side: THREE.DoubleSide,
    });
    const panel = new THREE.Mesh(geometry, material);
    geometries.push(geometry);
    materials.push(material);
    return panel;
  }

  const backPanel = createPanel(5.8, 3.8, 0x24547d, 0.18);
  backPanel.position.set(0.45, 0.25, -0.65);
  backPanel.rotation.set(-0.02, -0.12, 0.035);
  workspace.add(backPanel);

  const sourcePanel = createPanel(4.5, 1.5, 0x2d6f9d, 0.16);
  sourcePanel.position.set(-0.4, -1.45, -0.2);
  sourcePanel.rotation.set(-0.08, 0.08, -0.025);
  workspace.add(sourcePanel);

  const colors = [0x4aa8f7, 0x8c78ff, 0x4fd7c2];
  for (let index = 0; index < 3; index += 1) {
    const card = createPanel(1.55, 1.32, colors[index] ?? 0x4aa8f7, 0.23);
    card.position.set((index - 1) * 1.72, 0.35, -0.02 + index * 0.05);
    card.rotation.set(0.02 * (index - 1), -0.05 * (index - 1), 0);
    workspace.add(card);
    cardMeshes.push(card);
  }

  const pointLight = new THREE.PointLight(0x8fd5ff, 34, 18);
  pointLight.position.set(0, 2, 4.5);
  scene.add(pointLight, new THREE.AmbientLight(0xffffff, 1.55));

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

    const targetRotationY = pointerX * 0.07;
    const targetRotationX = -pointerY * 0.045;
    const targetY = (0.5 - scrollProgress) * 0.18;
    workspace.rotation.y +=
      (targetRotationY - workspace.rotation.y) * 0.075;
    workspace.rotation.x +=
      (targetRotationX - workspace.rotation.x) * 0.075;
    workspace.position.y += (targetY - workspace.position.y) * 0.08;
    pointLight.position.x +=
      (pointerX * 3.1 - pointLight.position.x) * 0.1;
    pointLight.position.y +=
      (1.3 - pointerY * 2.2 - pointLight.position.y) * 0.1;

    let needsFrame =
      Math.abs(targetRotationY - workspace.rotation.y) > 0.0005 ||
      Math.abs(targetRotationX - workspace.rotation.x) > 0.0005 ||
      Math.abs(targetY - workspace.position.y) > 0.0005;

    cardMeshes.forEach((card, index) => {
      const targetScale = index === focusedCard ? 1.07 : 1;
      card.scale.x += (targetScale - card.scale.x) * 0.12;
      card.scale.y += (targetScale - card.scale.y) * 0.12;
      needsFrame ||= Math.abs(targetScale - card.scale.x) > 0.001;
    });

    renderer.render(scene, camera);
    if (needsFrame) frame = window.requestAnimationFrame(render);
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
  visibilityObserver.observe(interactionRoot);

  const onPointerMove = (event: PointerEvent) => {
    const rect = interactionRoot.getBoundingClientRect();
    pointerX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    pointerY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    resume();
  };
  const onScroll = () => {
    const rect = interactionRoot.getBoundingClientRect();
    const range = window.innerHeight + rect.height;
    scrollProgress = Math.min(
      1,
      Math.max(0, (window.innerHeight - rect.top) / range),
    );
    resume();
  };
  const onVisibility = () => (document.hidden ? pause() : resume());
  const cards = [
    ...interactionRoot.querySelectorAll<HTMLElement>("[data-stage-card]"),
  ];
  const cardListeners = cards.map((card, index) => {
    const enter = () => {
      focusedCard = index;
      resume();
    };
    const leave = () => {
      focusedCard = -1;
      resume();
    };
    card.addEventListener("pointerenter", enter);
    card.addEventListener("focus", enter);
    card.addEventListener("pointerleave", leave);
    card.addEventListener("blur", leave);
    return { card, enter, leave };
  });

  function dispose() {
    if (disposed) return;
    disposed = true;
    pause();
    resizeObserver.disconnect();
    visibilityObserver.disconnect();
    interactionRoot.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("scroll", onScroll);
    document.removeEventListener("visibilitychange", onVisibility);
    renderer.domElement.removeEventListener("webglcontextlost", dispose);
    for (const { card, enter, leave } of cardListeners) {
      card.removeEventListener("pointerenter", enter);
      card.removeEventListener("focus", enter);
      card.removeEventListener("pointerleave", leave);
      card.removeEventListener("blur", leave);
    }
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    renderer.dispose();
    renderer.domElement.remove();
  }

  interactionRoot.addEventListener("pointermove", onPointerMove, {
    passive: true,
  });
  window.addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);
  renderer.domElement.addEventListener("webglcontextlost", dispose, {
    once: true,
  });
  onScroll();
  resize();
  resume();
  return dispose;
}
