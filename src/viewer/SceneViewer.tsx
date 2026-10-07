import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { CHANDELIER } from "../asset/chandeliers";
import { fullWalkthrough } from "../asset/collision";
import { createHeritageBuilding } from "../asset/heritageBuilding";
import { ALL_LANTERN_MOUNTS, lanternFlamePosition } from "../asset/lanterns";
import { clearSharedGeometryCache } from "../asset/primitives";
import type { QAReport } from "../asset/qa";

export type ViewPreset = "three-quarter" | "front" | "side" | "rear" | "top";
export type ViewerMode = "orbit" | "walk";

export interface ViewerApi {
  exportGLB: (lod?: 0 | 1) => Promise<ArrayBuffer>;
  exportCollisionGLB: () => Promise<ArrayBuffer>;
  collisionJSON: () => object | null;
  optimizationJSON: () => object | null;
  qualityJSON: () => QAReport | null;
  nextTourStop: () => void;
  previousTourStop: () => void;
  setVirtualKey: (key: string, pressed: boolean) => void;
  resetCamera: () => void;
}

interface Props {
  preset: ViewPreset;
  mode: ViewerMode;
  roofVisible: boolean;
  upperVisible: boolean;
  nightMode: boolean;
  onReady: (qa: QAReport) => void;
  onTourStop: (stop: string) => void;
}

type Asset = ReturnType<typeof createHeritageBuilding>;

interface Runtime {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  asset: Asset;
  mode: ViewerMode;
  preset: ViewPreset;
  night: boolean;
  targetPosition: THREE.Vector3 | null;
  targetLook: THREE.Vector3 | null;
  sunlight: THREE.DirectionalLight;
  fill: THREE.DirectionalLight;
  ambient: THREE.AmbientLight;
  sky: THREE.HemisphereLight;
  lampLights: THREE.PointLight[];
  chandelierLights: { fixture: THREE.Group; light: THREE.PointLight }[];
  walk: {
    foot: { x: number; y: number; z: number };
    yaw: number;
    pitch: number;
    dragging: boolean;
    lastX: number;
    lastY: number;
    routeIndex: number;
    guide: { targetIndex: number; nextIndex: number; direction: 1 | -1 } | null;
  };
  keys: Set<string>;
  exporting: boolean;
  frame: number;
  lastTime: number;
}

const presetPositions: Record<ViewPreset, [number, number, number]> = {
  "three-quarter": [22, 15.5, 39],
  front: [0, 11.5, 47],
  side: [48, 12, 1],
  rear: [20, 15, -41],
  top: [.01, 54, .015],
};

function applyPreset(runtime: Runtime, mount: HTMLDivElement, preset: ViewPreset, immediate = false) {
  runtime.preset = preset;
  const target = preset === "top" ? new THREE.Vector3(0, 0, 0) : new THREE.Vector3(0, 5.35, 0);
  const [x, y, z] = presetPositions[preset];
  const aspect = mount.clientWidth / Math.max(1, mount.clientHeight);
  const mobileScale = aspect < 1.15 ? Math.min(2.1, 1.15 / aspect) : 1;
  const position = new THREE.Vector3(x * mobileScale, target.y + (y - target.y) * mobileScale, z * mobileScale);
  runtime.targetPosition = position;
  runtime.targetLook = target;
  if (immediate) {
    runtime.camera.position.copy(position);
    runtime.controls.target.copy(target);
    runtime.controls.update();
    runtime.targetPosition = null;
    runtime.targetLook = null;
  }
}

function enterWalk(runtime: Runtime) {
  runtime.controls.enabled = false;
  runtime.targetPosition = null;
  runtime.targetLook = null;
  runtime.keys.clear();
  runtime.walk = {
    foot: { x: 0, y: 0, z: 14.2 },
    yaw: Math.PI,
    pitch: 0,
    dragging: false,
    lastX: 0,
    lastY: 0,
    routeIndex: 0,
    guide: null,
  };
  runtime.camera.position.set(0, 1.7, 14.2);
  runtime.camera.fov = 68;
  runtime.camera.updateProjectionMatrix();
}

function shortestAngle(from: number, to: number) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

function syncChandelierLighting(runtime: Runtime, refreshShadows = false) {
  for (const { fixture, light } of runtime.chandelierLights) {
    let visible = true;
    let ancestor: THREE.Object3D | null = fixture;
    while (ancestor) {
      visible = visible && ancestor.visible;
      ancestor = ancestor.parent;
    }
    if (refreshShadows || (visible && !light.visible)) light.shadow.needsUpdate = true;
    light.visible = visible;
    light.intensity = visible ? (runtime.night ? CHANDELIER.nightIntensity : CHANDELIER.dayIntensity) : 0;
  }
  runtime.asset.materials.chandelierOpal.emissiveIntensity = runtime.night ? .85 : .25;
  runtime.asset.materials.chandelierFlame.emissiveIntensity = runtime.night ? 4 : 1.8;
}

function updateWalk(runtime: Runtime, dt: number, onStop: (stop: string) => void) {
  const state = runtime.walk;
  if (state.guide) {
    const guide = state.guide;
    const destination = fullWalkthrough[guide.nextIndex];
    const dx = destination.x - state.foot.x;
    const dz = destination.z - state.foot.z;
    const distance = Math.hypot(dx, dz);
    if (distance < .035) {
      state.routeIndex = guide.nextIndex;
      if (state.routeIndex === guide.targetIndex) {
        state.guide = null;
        if (destination.stop) onStop(destination.stop);
      } else {
        guide.nextIndex += guide.direction;
      }
    } else {
      const length = Math.min(distance, dt * 3.0);
      const steps = Math.max(1, Math.ceil(length / .07));
      for (let i = 0; i < steps; i++) {
        const next = runtime.asset.collision.tryMove(state.foot, dx / distance * length / steps, dz / distance * length / steps);
        state.foot = next;
      }
      const wantedYaw = Math.atan2(dx, dz);
      state.yaw += shortestAngle(state.yaw, wantedYaw) * Math.min(1, dt * 5);
      state.pitch += (0 - state.pitch) * Math.min(1, dt * 3);
    }
  } else {
    const forward = Number(runtime.keys.has("w") || runtime.keys.has("arrowup")) - Number(runtime.keys.has("s") || runtime.keys.has("arrowdown"));
    const strafe = Number(runtime.keys.has("d") || runtime.keys.has("arrowright")) - Number(runtime.keys.has("a") || runtime.keys.has("arrowleft"));
    if (forward || strafe) {
      const magnitude = Math.hypot(forward, strafe);
      const speed = runtime.keys.has("shift") ? 4.1 : 2.65;
      const dx = (Math.sin(state.yaw) * forward + Math.cos(state.yaw) * strafe) / magnitude * speed * dt;
      const dz = (Math.cos(state.yaw) * forward - Math.sin(state.yaw) * strafe) / magnitude * speed * dt;
      const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .07));
      for (let i = 0; i < steps; i++) state.foot = runtime.asset.collision.tryMove(state.foot, dx / steps, dz / steps);
    }
  }
  const eyeY = state.foot.y + 1.66;
  runtime.camera.position.x = state.foot.x;
  runtime.camera.position.z = state.foot.z;
  runtime.camera.position.y += (eyeY - runtime.camera.position.y) * Math.min(1, dt * 13);
  const cosPitch = Math.cos(state.pitch);
  runtime.camera.lookAt(
    state.foot.x + Math.sin(state.yaw) * cosPitch,
    runtime.camera.position.y + Math.sin(state.pitch),
    state.foot.z + Math.cos(state.yaw) * cosPitch,
  );
}

const SceneViewer = forwardRef<ViewerApi, Props>(function SceneViewer({ preset, mode, roofVisible, upperVisible, nightMode, onReady, onTourStop }, ref) {
  const mountRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<Runtime | null>(null);
  const onReadyRef = useRef(onReady);
  const onStopRef = useRef(onTourStop);
  onReadyRef.current = onReady;
  onStopRef.current = onTourStop;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const smallScreen = window.matchMedia("(max-width: 820px)").matches;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#d1d6cf");
    scene.fog = new THREE.Fog("#d1d6cf", 64, 118);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, smallScreen ? 1.35 : 1.8));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.34;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.className = "three-canvas";
    renderer.domElement.setAttribute("aria-label", "Interactive three-dimensional Kerala heritage building");
    mount.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(36, mount.clientWidth / Math.max(1, mount.clientHeight), .07, 260);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = .075;
    controls.minDistance = 12;
    controls.maxDistance = 98;
    controls.maxPolarAngle = Math.PI * .495;
    controls.screenSpacePanning = true;
    controls.addEventListener("start", () => {
      const r = runtimeRef.current;
      if (r) { r.targetPosition = null; r.targetLook = null; }
    });

    const sky = new THREE.HemisphereLight(0xf4f3e9, 0x7e7560, 2.0);
    scene.add(sky);
    const ambient = new THREE.AmbientLight(0xffffff, .65);
    scene.add(ambient);
    const sunlight = new THREE.DirectionalLight(0xffedd0, 3.05);
    sunlight.position.set(-20, 34, 25);
    sunlight.castShadow = true;
    sunlight.shadow.mapSize.set(smallScreen ? 1024 : 2048, smallScreen ? 1024 : 2048);
    sunlight.shadow.camera.left = -35;
    sunlight.shadow.camera.right = 35;
    sunlight.shadow.camera.top = 35;
    sunlight.shadow.camera.bottom = -35;
    sunlight.shadow.camera.near = 1;
    sunlight.shadow.camera.far = 90;
    sunlight.shadow.bias = -.00018;
    sunlight.shadow.normalBias = .018;
    sunlight.target.position.set(0, 3, 0);
    scene.add(sunlight, sunlight.target);
    const fill = new THREE.DirectionalLight(0xdde8ed, .7);
    fill.position.set(18, 13, -23);
    scene.add(fill);

    // One warm point light per lantern, at the flame. Zero intensity in daylight, so the lamps only
    // cast in night mode. Viewer only, never exported with the asset.
    const lampLights: THREE.PointLight[] = ALL_LANTERN_MOUNTS.map((mount) => {
      const flame = lanternFlamePosition(mount);
      const light = new THREE.PointLight(0xffa23c, 0, 7.5, 2);
      light.position.set(flame.x, flame.y, flame.z);
      scene.add(light);
      return light;
    });

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(250, 250), new THREE.MeshStandardMaterial({ color: "#bfc6b8", roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -.012;
    ground.receiveShadow = true;
    ground.name = "Viewer environment ground / not in export";
    scene.add(ground);

    const asset = createHeritageBuilding();
    scene.add(asset.root);
    // Four aggregate emitters, not 32 bulb lights. Cached shadows keep the hall illumination
    // inside its walls and floor without re-rendering all cube maps every frame.
    const chandelierLights = asset.chandeliers.map((fixture) => {
      const light = new THREE.PointLight(CHANDELIER.colour, CHANDELIER.dayIntensity, CHANDELIER.lightRange, CHANDELIER.decay);
      light.name = `${fixture.name} / preview illumination`;
      light.position.copy(fixture.getWorldPosition(new THREE.Vector3()));
      light.position.y -= CHANDELIER.emitterDrop;
      light.castShadow = true;
      light.shadow.mapSize.set(smallScreen ? 256 : 512, smallScreen ? 256 : 512);
      light.shadow.camera.near = .12;
      light.shadow.camera.far = CHANDELIER.lightRange;
      light.shadow.camera.updateProjectionMatrix();
      light.shadow.bias = -.0001;
      light.shadow.normalBias = .018;
      light.shadow.autoUpdate = false;
      light.shadow.needsUpdate = true;
      scene.add(light);
      return { fixture, light };
    });
    const runtime: Runtime = {
      scene, renderer, camera, controls, asset, mode: "orbit", preset: "three-quarter", night: false,
      targetPosition: null, targetLook: null, sunlight, fill, ambient, sky, lampLights, chandelierLights,
      walk: { foot: { x: 0, y: 0, z: 14.2 }, yaw: Math.PI, pitch: 0, dragging: false, lastX: 0, lastY: 0, routeIndex: 0, guide: null },
      keys: new Set(), exporting: false, frame: 0, lastTime: performance.now(),
    };
    runtimeRef.current = runtime;
    applyPreset(runtime, mount, "three-quarter", true);
    onReadyRef.current(asset.qa);

    function onResize() {
      if (!runtimeRef.current) return;
      const width = Math.max(1, mount!.clientWidth);
      const height = Math.max(1, mount!.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    }
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(mount);

    const onPointerDown = (event: PointerEvent) => {
      if (runtime.mode !== "walk" || event.button > 0) return;
      runtime.walk.dragging = true;
      runtime.walk.guide = null;
      runtime.walk.lastX = event.clientX;
      runtime.walk.lastY = event.clientY;
      renderer.domElement.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!runtime.walk.dragging || runtime.mode !== "walk") return;
      runtime.walk.yaw -= (event.clientX - runtime.walk.lastX) * .004;
      runtime.walk.pitch = THREE.MathUtils.clamp(runtime.walk.pitch + (event.clientY - runtime.walk.lastY) * .003, -.95, .95);
      runtime.walk.lastX = event.clientX;
      runtime.walk.lastY = event.clientY;
    };
    const onPointerUp = () => { runtime.walk.dragging = false; };
    const onKeyDown = (event: KeyboardEvent) => {
      if (runtime.mode !== "walk" || event.target instanceof HTMLInputElement) return;
      const key = event.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift"].includes(key)) {
        runtime.keys.add(key);
        runtime.walk.guide = null;
        if (key.startsWith("arrow")) event.preventDefault();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => { runtime.keys.delete(event.key.toLowerCase()); };
    const onBlur = () => { runtime.keys.clear(); runtime.walk.dragging = false; };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);

    function animate(now: number) {
      const dt = Math.min(.05, (now - runtime.lastTime) / 1000);
      runtime.lastTime = now;
      if (runtime.mode === "walk") updateWalk(runtime, dt, (stop) => onStopRef.current(stop));
      else {
        if (runtime.targetPosition && runtime.targetLook) {
          camera.position.lerp(runtime.targetPosition, Math.min(1, dt * 3.3));
          controls.target.lerp(runtime.targetLook, Math.min(1, dt * 3.3));
          if (camera.position.distanceTo(runtime.targetPosition) < .025) {
            runtime.targetPosition = null;
            runtime.targetLook = null;
          }
        }
        controls.update();
      }
      if (!runtime.exporting) {
        const showDetail = runtime.mode === "walk" || camera.position.distanceTo(controls.target) < asset.optimization.nearDistance;
        for (const detail of asset.optimization.details) detail.visible = showDetail;
      }
      renderer.render(scene, camera);
      runtime.frame = requestAnimationFrame(animate);
    }
    runtime.frame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(runtime.frame);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      controls.dispose();
      chandelierLights.forEach(({ light }) => light.shadow.dispose());
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          geometries.add(obj.geometry);
          for (const material of Array.isArray(obj.material) ? obj.material : [obj.material]) materials.add(material);
        }
      });
      geometries.forEach((geometry) => geometry.dispose());
      clearSharedGeometryCache();
      materials.forEach((material) => {
        if (material instanceof THREE.MeshStandardMaterial) {
          material.map?.dispose();
          material.normalMap?.dispose();
        }
        material.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
      runtimeRef.current = null;
    };
  }, []);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.asset.layers.roof.visible = roofVisible;
    runtime.asset.layers.upper.forEach((part) => { part.visible = upperVisible; });
    runtime.asset.layers.openings.children.forEach((opening) => {
      opening.visible = upperVisible || opening.userData.level !== "upper";
    });
    syncChandelierLighting(runtime, true);
  }, [roofVisible, upperVisible]);

  // Night mode: dim the sun to a cool moon, drop the fill and ambient, darken the sky, then bring up
  // one warm point light per lantern and boost the emissive lamp glass so the fittings read lit.
  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.night = nightMode;
    const night = nightMode;
    runtime.sunlight.intensity = night ? .22 : 3.05;
    runtime.sunlight.color.set(night ? 0x9fb6d8 : 0xffedd0);
    runtime.fill.intensity = night ? .12 : .7;
    runtime.fill.color.set(night ? 0x5f7a9c : 0xdde8ed);
    runtime.ambient.intensity = night ? .17 : .65;
    runtime.ambient.color.set(night ? 0x2c3b52 : 0xffffff);
    runtime.sky.intensity = night ? .38 : 2.0;
    runtime.sky.color.set(night ? 0x2a3a55 : 0xf4f3e9);
    runtime.sky.groundColor.set(night ? 0x11161d : 0x7e7560);
    runtime.lampLights.forEach((light) => { light.intensity = night ? 3.4 : 0; });
    syncChandelierLighting(runtime, true);
    const lampGlass = runtime.asset.materials.lampGlass;
    if ("emissiveIntensity" in lampGlass) lampGlass.emissiveIntensity = night ? 1.5 : .55;
    runtime.scene.background = new THREE.Color(night ? 0x0a0f16 : 0xd1d6cf);
    runtime.scene.fog = night ? new THREE.Fog(0x0a0f16, 46, 132) : new THREE.Fog(0xd1d6cf, 64, 118);
    // Keep the same ground read in both modes.
    runtime.scene.traverse((obj) => {
      if (obj.name === "Viewer environment ground / not in export") {
        const material = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial;
        material.color.set(night ? 0x1b2430 : 0xbfc6b8);
      }
    });
  }, [nightMode]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    const mount = mountRef.current;
    if (!runtime || !mount) return;
    runtime.mode = mode;
    if (mode === "walk") {
      runtime.asset.layers.roof.visible = true;
      runtime.asset.layers.upper.forEach((part) => { part.visible = true; });
      runtime.asset.layers.openings.children.forEach((part) => { part.visible = true; });
      enterWalk(runtime);
      onStopRef.current("outside");
    } else {
      runtime.controls.enabled = true;
      runtime.camera.fov = 36;
      runtime.camera.updateProjectionMatrix();
      runtime.asset.layers.roof.visible = roofVisible;
      runtime.asset.layers.upper.forEach((part) => { part.visible = upperVisible; });
      runtime.asset.layers.openings.children.forEach((part) => { part.visible = upperVisible || part.userData.level !== "upper"; });
      applyPreset(runtime, mount, preset, false);
    }
    syncChandelierLighting(runtime, true);
  }, [mode]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    const mount = mountRef.current;
    if (runtime && mount && runtime.mode === "orbit") applyPreset(runtime, mount, preset);
  }, [preset]);

  useImperativeHandle(ref, () => ({
    async exportGLB(lod: 0 | 1 = 0) {
      const runtime = runtimeRef.current;
      if (!runtime) throw new Error("The 3D building is still loading.");
      const { asset } = runtime;
      runtime.exporting = true;
      const visibility = new Map<THREE.Object3D, boolean>();
      const keepVisible = [asset.layers.roof, ...asset.layers.upper, ...asset.layers.openings.children, ...asset.optimization.details];
      for (const part of keepVisible) { visibility.set(part, part.visible); part.visible = true; }
      if (lod === 1) asset.optimization.details.forEach((part) => { part.visible = false; });
      asset.collision.group.visible = false;
      try {
        const exporter = new GLTFExporter();
        const binary = await exporter.parseAsync(asset.root, { binary: true, onlyVisible: true, maxTextureSize: 1024 });
        if (!(binary instanceof ArrayBuffer)) throw new Error("The exporter did not return a binary GLB.");
        return binary;
      } finally {
        visibility.forEach((value, part) => { part.visible = value; });
        runtime.exporting = false;
      }
    },
    async exportCollisionGLB() {
      const runtime = runtimeRef.current;
      if (!runtime) throw new Error("The collision hierarchy is still loading.");
      const collisionCopy = runtime.asset.collision.group.clone(true);
      collisionCopy.visible = true;
      const binary = await new GLTFExporter().parseAsync(collisionCopy, { binary: true, onlyVisible: true });
      if (!(binary instanceof ArrayBuffer)) throw new Error("The collision exporter did not return a GLB.");
      return binary;
    },
    collisionJSON() { return runtimeRef.current?.asset.collision.serialize() ?? null; },
    optimizationJSON() { return runtimeRef.current?.asset.optimization.manifest ?? null; },
    qualityJSON() { return runtimeRef.current?.asset.qa ?? null; },
    nextTourStop() {
      const runtime = runtimeRef.current;
      if (!runtime || runtime.mode !== "walk") return;
      const index = fullWalkthrough.findIndex((p, i) => i > runtime.walk.routeIndex && !!p.stop);
      if (index < 0) return;
      runtime.walk.guide = { targetIndex: index, nextIndex: runtime.walk.routeIndex + 1, direction: 1 };
    },
    previousTourStop() {
      const runtime = runtimeRef.current;
      if (!runtime || runtime.mode !== "walk") return;
      let index = -1;
      for (let i = runtime.walk.routeIndex - 1; i >= 0; i--) if (fullWalkthrough[i].stop) { index = i; break; }
      if (index < 0) return;
      runtime.walk.guide = { targetIndex: index, nextIndex: runtime.walk.routeIndex - 1, direction: -1 };
    },
    setVirtualKey(key, pressed) {
      const runtime = runtimeRef.current;
      if (!runtime) return;
      if (pressed) { runtime.keys.add(key); runtime.walk.guide = null; }
      else runtime.keys.delete(key);
    },
    resetCamera() {
      const runtime = runtimeRef.current;
      const mount = mountRef.current;
      if (!runtime || !mount) return;
      if (runtime.mode === "walk") { enterWalk(runtime); onStopRef.current("outside"); }
      else applyPreset(runtime, mount, runtime.preset);
    },
  }), []);

  return <div ref={mountRef} className="viewer-canvas" />;
});

export default SceneViewer;