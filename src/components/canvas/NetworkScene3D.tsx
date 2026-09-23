import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useNetworkStore } from '../../stores/networkStore';
import { useUIStore } from '../../stores/uiStore';
import { DEVICE_COLORS, PROTOCOL_COLORS } from '../../utils/colors';
import { Device, DeviceType } from '../../types';
import { maskToCidr, DEFAULT_MASK } from '../../utils/helpers';
import {
  makeGlowTexture, makeFlowTexture, createDeviceVisual, createPacketVisual,
  createLabelSprite, setLabel, flowColor, disposeObject, clamp, smoothstep,
  markTextureShared,
  DeviceVisual, PacketVisual, LabelLine, PORT_IDS, PortId,
} from '../../three/objects';

/* World mapping: React-Flow style store coords (px) → Three.js world units.
 * Nodes sit on the y=0 ground plane; links + packets float at LINK_Y. */
const WORLD_SCALE = 0.06;
const CENTER_X = 400;
const CENTER_Z = 240;
const LINK_Y = 2.4;

const toWorldXZ = (px: number, py: number) => ({
  x: (px - CENTER_X) * WORLD_SCALE,
  z: (py - CENTER_Z) * WORLD_SCALE,
});
const toStore = (wx: number, wz: number) => ({
  x: wx / WORLD_SCALE + CENTER_X,
  y: wz / WORLD_SCALE + CENTER_Z,
});
const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

interface LinkVisual {
  group: THREE.Group;
  casing: THREE.Mesh;
  core: THREE.Mesh;
  casingMat: THREE.MeshStandardMaterial;
  coreMat: THREE.MeshStandardMaterial;
  tex: THREE.Texture;
  label: THREE.Sprite;
  curve: THREE.CatmullRomCurve3;  // path the wire (and packets) follow
  sig: string;                    // endpoint signature; geometry rebuilds only when it changes
  length: number;                 // cached curve length
}

export const NetworkScene3D: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    /* ─── Renderer / Scene / Camera ─── */
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'none';
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0e1a);
    scene.fog = new THREE.Fog(0x0a0e1a, 55, 165);

    const camera = new THREE.PerspectiveCamera(
      55, Math.max(1, mount.clientWidth) / Math.max(1, mount.clientHeight), 0.1, 2000,
    );
    camera.position.set(0, 58, 74);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    // Gentler, less twitchy navigation
    controls.rotateSpeed = 0.42;
    controls.zoomSpeed = 0.9;
    controls.panSpeed = 0.55;
    controls.maxPolarAngle = 1.48;
    controls.minDistance = 16;
    controls.maxDistance = 240;
    controls.target.set(0, 3, 0);
    // Pan across the ground plane (keeps a constant height) rather than the screen
    // plane — natural for a top-down board — and zoom toward the cursor, not the
    // scene centre, so pinch/scroll zoom lands where the user is pointing.
    controls.screenSpacePanning = false;
    controls.zoomToCursor = true;
    controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    // Touchscreen parity: one finger orbits, two fingers pinch-zoom + pan.
    controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    controls.update();

    /* ─── Lighting ─── */
    scene.add(new THREE.HemisphereLight(0xbcd0ff, 0x1a2340, 1.05));
    scene.add(new THREE.AmbientLight(0x2a3a5c, 0.7));
    const dir = new THREE.DirectionalLight(0xffffff, 1.15);
    dir.position.set(30, 55, 20);
    scene.add(dir);
    const rim = new THREE.DirectionalLight(0x60a5fa, 0.55);
    rim.position.set(-40, 24, -30);
    scene.add(rim);
    const fill = new THREE.DirectionalLight(0xffd9a0, 0.4);
    fill.position.set(20, 12, 40);
    scene.add(fill);

    /* ─── Ground + grid ─── */
    const grid = new THREE.GridHelper(220, 88, 0x243352, 0x151d31);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.55;
    grid.position.y = 0;
    scene.add(grid);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(600, 600),
      new THREE.MeshStandardMaterial({ color: 0x080b14, roughness: 1, metalness: 0 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    scene.add(ground);

    /* ─── Shared textures (scene-owned; freed only on unmount, never per-object) ─── */
    const glowTex = markTextureShared(makeGlowTexture());
    const flowTex = markTextureShared(makeFlowTexture());

    /* ─── Object registries ─── */
    const deviceMap = new Map<string, DeviceVisual>();
    const linkMap = new Map<string, LinkVisual>();
    const packetMap = new Map<string, PacketVisual>();

    /* ─── Connect-drag helper: a fat glowing cyan beam ─── */
    const connectTube = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 1, 14, 1, true),
      new THREE.MeshStandardMaterial({
        color: 0x22d3ee, emissive: 0x22d3ee, emissiveIntensity: 2.2,
        transparent: true, opacity: 0.9, metalness: 0.1, roughness: 0.4,
      }),
    );
    connectTube.frustumCulled = false;
    connectTube.visible = false;
    scene.add(connectTube);
    // Glowing tip that follows the dragged end so the target is obvious.
    const connectTip = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 18, 18),
      new THREE.MeshStandardMaterial({ color: 0x67e8f9, emissive: 0x22d3ee, emissiveIntensity: 2.2 }),
    );
    connectTip.frustumCulled = false;
    connectTip.visible = false;
    scene.add(connectTip);

    const orientCylinder = (mesh: THREE.Mesh, p1: THREE.Vector3, p2: THREE.Vector3, r: number) => {
      const d3 = new THREE.Vector3().subVectors(p2, p1);
      const len = Math.max(0.001, d3.length());
      mesh.position.copy(p1).add(p2).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d3.clone().normalize());
      mesh.scale.set(r, len, r);
    };

    /* ─── Raycasting ─── */
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const dom = renderer.domElement;

    const setPointer = (e: PointerEvent | DragEvent) => {
      const rect = dom.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const deviceById = () => {
      const s = useNetworkStore.getState();
      return new Map(s.devices.map(d => [d.id, d]));
    };
    const centerWorld = (id: string, map = deviceById(), out?: THREE.Vector3) => {
      const target = out ?? new THREE.Vector3();
      const d = map.get(id);
      if (!d) return target.set(0, LINK_Y, 0);
      const w = toWorldXZ(d.position.x, d.position.y);
      return target.set(w.x, LINK_Y, w.z);
    };

    const pickDevice = (): string | null => {
      raycaster.setFromCamera(pointer, camera);
      const arr: THREE.Object3D[] = [];
      deviceMap.forEach(v => v.meshes.forEach(m => arr.push(m)));
      const hit = raycaster.intersectObjects(arr, false)[0];
      return hit ? (hit.object.userData.deviceId as string) : null;
    };
    const pickConnectDot = (): { deviceId: string; port: PortId } | null => {
      raycaster.setFromCamera(pointer, camera);
      const arr: THREE.Object3D[] = [];
      deviceMap.forEach(v => v.portHit.forEach(h => arr.push(h)));
      const hit = raycaster.intersectObjects(arr, false)[0];
      if (!hit) return null;
      return { deviceId: hit.object.userData.deviceId as string, port: hit.object.userData.port as PortId };
    };
    // Exact port if a dot was hit; otherwise the node body (port resolved later).
    const pickConnectTarget = (): { deviceId: string; port: PortId | null } | null => {
      const dot = pickConnectDot();
      if (dot) return dot;
      const dev = pickDevice();
      return dev ? { deviceId: dev, port: null } : null;
    };
    const pickLink = (): string | null => {
      raycaster.setFromCamera(pointer, camera);
      const arr: THREE.Object3D[] = [];
      linkMap.forEach(v => { if (v.group.visible) { arr.push(v.casing); arr.push(v.core); } });
      const hit = raycaster.intersectObjects(arr, false)[0];
      return hit ? (hit.object.userData.linkId as string) : null;
    };
    const groundPoint = (): THREE.Vector3 | null => {
      raycaster.setFromCamera(pointer, camera);
      const t = new THREE.Vector3();
      return raycaster.ray.intersectPlane(groundPlane, t) ? t : null;
    };

    /* ─── Port geometry helpers ─── */
    const _wp = new THREE.Vector3();
    const portWorldById = (deviceId: string, port: PortId): THREE.Vector3 | null => {
      const v = deviceMap.get(deviceId);
      if (!v) return null;
      const idx = PORT_IDS.indexOf(port);
      const dot = idx >= 0 ? v.dots[idx] : undefined;
      return dot ? dot.getWorldPosition(new THREE.Vector3()) : null;
    };
    /* Resolve an endpoint to a concrete port: use the stored handle, otherwise pick the
     * port whose dot is closest to `toward` (dynamic nearest-face for preset/legacy links). */
    const resolvePort = (
      deviceId: string, handle: PortId | null | undefined, toward: THREE.Vector3,
      outPos: THREE.Vector3 = new THREE.Vector3(), outDir: THREE.Vector3 = new THREE.Vector3(),
    ): { pos: THREE.Vector3; dir: THREE.Vector3; port: PortId } | null => {
      const v = deviceMap.get(deviceId);
      if (!v || v.dots.length === 0) return null;
      let idx = handle ? PORT_IDS.indexOf(handle) : -1;
      if (idx < 0) {
        let bestD = Infinity;
        for (let i = 0; i < v.dots.length; i++) {
          const d = v.dots[i].getWorldPosition(_wp).distanceToSquared(toward);
          if (d < bestD) { bestD = d; idx = i; }
        }
      }
      if (idx < 0) idx = 0;
      const dot = v.dots[idx];
      // Write into caller-owned scratch vectors to keep the render loop alloc-free.
      dot.getWorldPosition(outPos);
      outDir.copy(dot.userData.portDir as THREE.Vector3);
      return { pos: outPos, dir: outDir, port: PORT_IDS[idx] };
    };

    /* ─── Interaction state ─── */
    const st = {
      draggingId: null as string | null,
      dragOffset: new THREE.Vector3(),
      connectSource: null as string | null,
      connectPort: null as PortId | null,
      connectFrom: new THREE.Vector3(),
      hoverDeviceId: null as string | null,   // target device the beam is currently snapping to
      hoverPort: null as PortId | null,        // the exact target port that will be used on drop
      downX: 0, downY: 0, moved: false, button: 0,
    };

    const beginConnect = (sourceId: string, port: PortId | null) => {
      st.connectSource = sourceId;
      st.connectPort = port;
      controls.enabled = false;
      const from = port ? portWorldById(sourceId, port) : null;
      st.connectFrom.copy(from ?? centerWorld(sourceId));
      connectTip.position.copy(st.connectFrom);
      connectTip.scale.setScalar(1);
      orientCylinder(connectTube, st.connectFrom, st.connectFrom, 0.22);
      connectTube.visible = true;
      connectTip.visible = true;
      dom.style.cursor = 'crosshair';
    };

    const onPointerDown = (e: PointerEvent) => {
      setPointer(e);
      st.downX = e.clientX; st.downY = e.clientY; st.moved = false; st.button = e.button;

      // A visible connection dot always starts a link from that exact port (any button).
      const dot = pickConnectDot();
      if (dot) {
        useNetworkStore.getState().selectDevice(dot.deviceId);
        beginConnect(dot.deviceId, dot.port);
        e.preventDefault();
        return;
      }

      const devId = pickDevice();
      if (devId) {
        useNetworkStore.getState().selectDevice(devId);
        if (e.shiftKey || e.button === 2) {
          // Shift-drag or right-drag from the body starts a link (port auto-picked on drop)
          beginConnect(devId, null);
          e.preventDefault();
        } else if (e.button === 0) {
          // Begin move drag
          st.draggingId = devId;
          controls.enabled = false;
          dom.style.cursor = 'grabbing';
          const gp = groundPoint();
          const v = deviceMap.get(devId);
          if (gp && v) st.dragOffset.set(v.group.position.x - gp.x, 0, v.group.position.z - gp.z);
          e.preventDefault();
        }
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (Math.abs(e.clientX - st.downX) + Math.abs(e.clientY - st.downY) > 4) st.moved = true;

      if (st.draggingId) {
        setPointer(e);
        const gp = groundPoint();
        const v = deviceMap.get(st.draggingId);
        if (gp && v) {
          const nx = gp.x + st.dragOffset.x;
          const nz = gp.z + st.dragOffset.z;
          v.group.position.x = nx;
          v.group.position.z = nz;
          const s = toStore(nx, nz);
          useNetworkStore.getState().updateDevicePosition(st.draggingId, s);
        }
      } else if (st.connectSource) {
        setPointer(e);
        // Snap the beam to a hovered target port/node, else follow the floor.
        const tgt = pickConnectTarget();
        let end: THREE.Vector3 | null = null;
        let snapped = false;
        st.hoverDeviceId = null;
        st.hoverPort = null;
        if (tgt && tgt.deviceId !== st.connectSource) {
          // Exact port when a handle proxy is hovered; otherwise pick the port nearest the
          // CURSOR (its floor projection), not the source — so aiming at a side chooses that port.
          const toward = tgt.port ? st.connectFrom : (groundPoint() ?? st.connectFrom);
          const rp = resolvePort(tgt.deviceId, tgt.port, toward);
          if (rp) {
            end = rp.pos;
            snapped = true;
            st.hoverDeviceId = tgt.deviceId;
            st.hoverPort = rp.port;
          }
        }
        if (!end) { const gp = groundPoint(); if (gp) end = new THREE.Vector3(gp.x, LINK_Y, gp.z); }
        if (end) {
          orientCylinder(connectTube, st.connectFrom, end, 0.22);
          connectTip.position.copy(end);
          connectTip.scale.setScalar(snapped ? 1.4 : 1);
        }
      } else if (e.target === dom) {
        // Passive hover: hand over anything interactive, arrow over empty space.
        setPointer(e);
        const over = pickConnectDot() || pickDevice();
        dom.style.cursor = over ? 'pointer' : 'default';
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (st.connectSource) {
        setPointer(e);
        const tgt = pickConnectTarget();
        if (tgt && tgt.deviceId !== st.connectSource) {
          const toward = tgt.port ? st.connectFrom : (groundPoint() ?? st.connectFrom);
          const rp = resolvePort(tgt.deviceId, tgt.port, toward);
          const targetPort = tgt.port ?? rp?.port;
          useNetworkStore.getState().addLink(
            st.connectSource, tgt.deviceId, st.connectPort ?? undefined, targetPort ?? undefined,
          );
        }
        st.connectSource = null;
        st.connectPort = null;
        st.hoverDeviceId = null;
        st.hoverPort = null;
        connectTube.visible = false;
        connectTip.visible = false;
        controls.enabled = true;
        dom.style.cursor = 'default';
        return;
      }
      if (st.draggingId) {
        st.draggingId = null;
        controls.enabled = true;
        dom.style.cursor = 'pointer';
        return;
      }
      // Treat as a click (select / deselect) only when the pointer barely moved
      if (!st.moved) {
        setPointer(e);
        const devId = pickDevice();
        if (devId) {
          useNetworkStore.getState().selectDevice(devId);
        } else {
          const linkId = pickLink();
          if (linkId) useNetworkStore.getState().selectLink(linkId);
          else {
            useNetworkStore.getState().selectDevice(null);
            useNetworkStore.getState().selectLink(null);
          }
        }
      }
    };

    const onDoubleClick = (e: MouseEvent) => {
      setPointer(e as unknown as PointerEvent);
      const devId = pickDevice();
      if (devId) { useNetworkStore.getState().removeDevice(devId); return; }
      const linkId = pickLink();
      if (linkId) useNetworkStore.getState().removeLink(linkId);
    };

    const onContextMenu = (e: MouseEvent) => e.preventDefault();
    const onPointerLeave = () => { if (!st.draggingId && !st.connectSource) dom.style.cursor = 'default'; };

    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer?.getData('application/deviceType') as DeviceType;
      if (!type) return;
      setPointer(e);
      const gp = groundPoint();
      if (!gp) return;
      const s = toStore(gp.x, gp.z);
      useNetworkStore.getState().addDevice(type, s);
    };

    /* ─── Trackpad / wheel navigation ───────────────────────────────────────
     * Laptop-first navigation: two-finger scroll pans the board, pinch (or
     * Ctrl+scroll) zooms toward the cursor, and a classic mouse wheel zooms.
     * OrbitControls only dollies on wheel, so pan gestures are intercepted in the
     * CAPTURE phase on the container (which sits above the canvas OrbitControls
     * listens on) and stopped before they reach it; zoom gestures fall through. */
    const PAN_DIR = -1; // flip to +1 to reverse two-finger scroll panning
    const _panRight = new THREE.Vector3();
    const _panFwd = new THREE.Vector3();
    const _panMove = new THREE.Vector3();
    const _camOffset = new THREE.Vector3();

    // Pan by a screen-space delta (pixels; right/down positive). Mirrors
    // OrbitControls' perspective pan math (screenSpacePanning = false) so the feel
    // is identical to a right-drag pan and scales correctly with zoom distance.
    const panScreen = (dxPx: number, dyPx: number) => {
      const dist = _camOffset.copy(camera.position).sub(controls.target).length();
      const targetDist = dist * Math.tan((camera.fov / 2) * Math.PI / 180);
      const h = dom.clientHeight || 1;
      const kx = (2 * dxPx * targetDist) / h;
      const ky = (2 * dyPx * targetDist) / h;
      _panRight.setFromMatrixColumn(camera.matrix, 0); // camera X (screen right)
      _panFwd.copy(camera.up).cross(_panRight);        // up × right → ground forward
      _panMove.set(0, 0, 0).addScaledVector(_panRight, -kx).addScaledVector(_panFwd, ky);
      // Translate camera + target together: OrbitControls.update() recomputes the
      // orbit offset from these live objects, so the pan survives damping intact.
      camera.position.add(_panMove);
      controls.target.add(_panMove);
      controls.update();
    };

    // A two-finger trackpad scroll and a mouse wheel both arrive as `wheel`, so we
    // classify the gesture and lock that choice for its duration — a fast swipe can
    // otherwise cross the size threshold mid-stream and flicker between modes.
    let wheelMode: 'pan' | 'zoom' | null = null;
    let wheelResetTimer = 0;
    const classifyWheel = (e: WheelEvent): 'pan' | 'zoom' => {
      if (e.ctrlKey) return 'zoom'; // trackpad pinch + Ctrl+scroll
      // Pixel-mode deltas that are small, fractional, or carry a horizontal
      // component are trackpad scrolls; chunky/line-mode deltas are a mouse wheel.
      const trackpad = e.deltaMode === 0 &&
        (e.deltaX !== 0 || !Number.isInteger(e.deltaY) || Math.abs(e.deltaY) < 45);
      return trackpad ? 'pan' : 'zoom';
    };
    const onWheelCapture = (e: WheelEvent) => {
      // Never navigate mid-drag/mid-connect; just swallow the scroll so the page
      // behind the canvas can't move.
      if (st.draggingId || st.connectSource) { e.preventDefault(); return; }
      if (wheelMode === null) wheelMode = classifyWheel(e);
      window.clearTimeout(wheelResetTimer);
      wheelResetTimer = window.setTimeout(() => { wheelMode = null; }, 220);

      if (wheelMode === 'pan') {
        e.preventDefault();
        e.stopPropagation(); // keep it away from OrbitControls' wheel → zoom
        panScreen(PAN_DIR * e.deltaX, PAN_DIR * e.deltaY);
      }
      // 'zoom' → fall through to OrbitControls (enableZoom + zoomToCursor).
    };

    // Capture phase so we can disable OrbitControls before it reacts to the same event.
    dom.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    dom.addEventListener('dblclick', onDoubleClick);
    dom.addEventListener('contextmenu', onContextMenu);
    dom.addEventListener('pointerleave', onPointerLeave);
    mount.addEventListener('dragover', onDragOver);
    mount.addEventListener('drop', onDrop);
    mount.addEventListener('wheel', onWheelCapture, { capture: true, passive: false });

    /* ─── Reconcile helpers ─── */
    const linkColor = new THREE.Color();
    // Rebuilt each frame: pairKey → the representative wire curve + which endpoint
    // is the curve's start, plus whether that link is disabled (so an active link
    // can take over the pair from a disabled one).
    const linkPathByPair = new Map<string, { curve: THREE.CatmullRomCurve3; srcId: string; disabled: boolean }>();

    const ensureDevice = (type: DeviceType, id: string): DeviceVisual => {
      let v = deviceMap.get(id);
      if (!v) {
        v = createDeviceVisual(type, DEVICE_COLORS[type], glowTex);
        v.group.userData.deviceId = id;
        v.group.userData.type = type;
        v.meshes.forEach(m => { m.userData.deviceId = id; });
        v.dots.forEach(dt => { dt.userData.deviceId = id; });
        v.portHit.forEach(h => { h.userData.deviceId = id; });
        scene.add(v.group);
        deviceMap.set(id, v);
      }
      return v;
    };

    const ensureLink = (id: string): LinkVisual => {
      let lv = linkMap.get(id);
      if (!lv) {
        const group = new THREE.Group();
        const casingMat = new THREE.MeshStandardMaterial({
          color: 0x223, emissive: 0x0a0e1a, emissiveIntensity: 0.2,
          metalness: 0.6, roughness: 0.35, transparent: true, opacity: 0.55,
        });
        // Placeholder geometry — replaced by a TubeGeometry along the wire curve on first update.
        const casing = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 16, 1, true), casingMat);
        const tex = flowTex.clone();
        tex.needsUpdate = true;
        const coreMat = new THREE.MeshStandardMaterial({
          color: 0x10b981, emissive: 0x10b981, emissiveIntensity: 1.4,
          map: tex, transparent: true, opacity: 0.95, metalness: 0.1, roughness: 0.4,
        });
        const core = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 14, 1, true), coreMat);
        casing.userData.linkId = id;
        core.userData.linkId = id;
        group.add(casing);
        group.add(core);
        scene.add(group);
        const label = createLabelSprite();
        scene.add(label);
        lv = {
          group, casing, core, casingMat, coreMat, tex, label,
          curve: new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(0, 0, 1)]),
          sig: '', length: 1,
        };
        linkMap.set(id, lv);
      }
      return lv;
    };

    // Wire radii are constant so tube geometry only rebuilds when an endpoint moves;
    // load is shown via colour / emissive / opacity instead of thickness.
    const CORE_R = 0.26;
    const CASING_R = 0.6;

    /* Smooth cable that leaves each port along its outward normal and bows upward. */
    const buildCurve = (pA: THREE.Vector3, dirA: THREE.Vector3, pB: THREE.Vector3, dirB: THREE.Vector3) => {
      const dist = pA.distanceTo(pB);
      const k = clamp(dist * 0.28, 1.6, 7);
      const lift = clamp(dist * 0.12, 0.6, 3.2);
      const cA = pA.clone().addScaledVector(dirA, k); cA.y += lift;
      const cB = pB.clone().addScaledVector(dirB, k); cB.y += lift;
      // Clone the endpoints: the curve is retained across frames, but pA/pB may
      // be reused scratch vectors owned by the render loop — the curve must not
      // alias them or it would deform as the scratch is overwritten next frame.
      return new THREE.CatmullRomCurve3([pA.clone(), cA, cB, pB.clone()], false, 'catmullrom', 0.5);
    };

    /* Rebuild the tube geometry only when the endpoint signature changes (rebuild-on-move). */
    const q20 = (n: number) => Math.round(n * 20);
    const updateLinkPath = (
      lv: LinkVisual, pA: THREE.Vector3, dirA: THREE.Vector3, pB: THREE.Vector3, dirB: THREE.Vector3,
    ) => {
      const sig = `${q20(pA.x)},${q20(pA.y)},${q20(pA.z)}|${q20(pB.x)},${q20(pB.y)},${q20(pB.z)}`;
      if (sig === lv.sig) return;
      lv.sig = sig;
      const curve = buildCurve(pA, dirA, pB, dirB);
      lv.curve = curve;
      lv.length = curve.getLength();
      const segs = clamp(Math.round(lv.length / 1.2), 14, 72);
      lv.casing.geometry.dispose();
      lv.casing.geometry = new THREE.TubeGeometry(curve, segs, CASING_R, 12, false);
      lv.core.geometry.dispose();
      lv.core.geometry = new THREE.TubeGeometry(curve, segs, CORE_R, 8, false);
      lv.tex.repeat.y = Math.max(1, Math.round(lv.length / 1.6));
      const mid = curve.getPoint(0.5);
      lv.label.position.set(mid.x, mid.y + 1.2, mid.z);
    };

    /* ─── Animation loop ─── */
    const clock = new THREE.Clock();
    let raf = 0;

    const travelDuration = (speed: number, latencyMult: number, reduced: boolean) => {
      if (reduced) return 0.25;
      const baseStepMs = 2500 / Math.max(0.01, speed);
      const latencyFactor = Math.max(0.8, latencyMult * 0.8);
      return Math.max(0.7, (baseStepMs * 0.82 * latencyFactor) / 1000);
    };

    // Per-frame scratch — reused every frame so the reconcile loop stays
    // allocation-free (these were previously reallocated on every animation tick).
    const devMap = new Map<string, Device>();
    const packetNodes = new Set<string>();
    const reverseDir = new Set<string>();
    const recentDrop = new Set<string>();
    const recentCorrupt = new Set<string>();
    const seenD = new Set<string>();
    const seenL = new Set<string>();
    const seenP = new Set<string>();
    const _cA = new THREE.Vector3();
    const _cB = new THREE.Vector3();
    const _posA = new THREE.Vector3();
    const _dirA = new THREE.Vector3();
    const _posB = new THREE.Vector3();
    const _dirB = new THREE.Vector3();

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const delta = Math.min(0.05, clock.getDelta());
      const elapsed = clock.elapsedTime;

      const state = useNetworkStore.getState();
      const reduced = useUIStore.getState().reducedMotion;
      const cong = state.simConfig.congestion ?? 0;
      devMap.clear();
      for (const d of state.devices) devMap.set(d.id, d);

      // Node set that currently hosts a packet (for glow), plus recent-fault sets for links
      packetNodes.clear();
      reverseDir.clear();
      for (const p of state.activePackets) {
        if (p.status !== 'in-transit' && p.status !== 'created') continue;
        packetNodes.add(p.path[p.currentHop]);
        if (p.currentHop < p.path.length - 1) reverseDir.add(`${p.path[p.currentHop]}>${p.path[p.currentHop + 1]}`);
      }
      const now = Date.now();
      recentDrop.clear();
      recentCorrupt.clear();
      for (const p of state.packetHistory) {
        if (p.status !== 'dropped' && p.status !== 'corrupted') continue;
        const tt = p.hopTimestamps[p.hopTimestamps.length - 1] ?? p.createdAt;
        if (now - tt > 2500 || p.currentHop >= p.path.length - 1) continue;
        const k = pairKey(p.path[p.currentHop], p.path[p.currentHop + 1]);
        if (p.status === 'dropped') recentDrop.add(k); else recentCorrupt.add(k);
      }

      /* ── Devices ── */
      seenD.clear();
      for (const d of state.devices) {
        seenD.add(d.id);
        const v = ensureDevice(d.type, d.id);
        const w = toWorldXZ(d.position.x, d.position.y);
        if (st.draggingId !== d.id) {
          v.group.position.x = w.x;
          v.group.position.z = w.z;
        }
        const disabled = d.status === 'disabled';
        const selected = state.selectedDeviceId === d.id;
        const atNode = packetNodes.has(d.id);

        const targetEmissive = disabled
          ? 0.05
          : 0.22 + d.load * 0.9 + (atNode ? 0.85 : 0) + (selected ? 0.35 : 0);
        for (const m of v.materials) {
          m.emissiveIntensity += (targetEmissive - m.emissiveIntensity) * 0.18;
        }
        v.materials[0].color.set(disabled ? 0x475569 : v.color.getHex());
        v.materials[0].opacity = disabled ? 0.5 : 1;
        v.materials[0].transparent = disabled;

        v.ring.visible = selected;
        if (selected) {
          const rp = 1 + Math.sin(elapsed * 3) * 0.05;
          v.ring.scale.set(rp, rp, rp);
        }
        const haloMat = v.halo.material as THREE.SpriteMaterial;
        const haloTarget = disabled ? 0 : clamp(0.1 + d.load * 0.6 + (atNode ? 0.55 : 0) + (selected ? 0.2 : 0), 0, 1);
        haloMat.opacity += (haloTarget - haloMat.opacity) * 0.18;
        const hb = (v.halo.userData.base as number) || 10;
        const hs = hb + d.load * 4 + (atNode ? 4 : 0);
        v.halo.scale.set(hs, hs, 1);

        // Connection dots — always visible; pulse, and swell while a link is being drawn.
        // The exact target port the beam will attach to is highlighted brighter/larger.
        const connecting = st.connectSource != null;
        for (let i = 0; i < v.dots.length; i++) {
          const dt = v.dots[i];
          dt.visible = !disabled;
          const isCand = connecting && st.hoverDeviceId === d.id && st.hoverPort === PORT_IDS[i];
          const base = isCand ? 2.15 : connecting ? 1.55 : 1.0;
          const amp = isCand ? 0.12 : connecting ? 0.28 : 0.13;
          const ds = base + Math.sin(elapsed * 4 + i * 1.3) * amp;
          dt.scale.setScalar(ds);
          const dm = dt.material as THREE.MeshStandardMaterial;
          dm.emissiveIntensity = isCand ? 3.6 : connecting ? 2.4 : 1.5;
        }

        const labelBorder = disabled ? 'rgba(239,68,68,0.4)' : selected ? 'rgba(34,211,238,0.75)' : `${DEVICE_COLORS[d.type]}66`;
        const cidr = maskToCidr(d.subnetMask || DEFAULT_MASK);
        const ipText = cidr !== null ? `${d.ip} /${cidr}` : d.ip;
        const lines: LabelLine[] = [
          { text: d.label, color: disabled ? '#64748b' : '#f8fafc', size: 26, bold: true },
          { text: ipText, color: disabled ? '#475569' : '#94a3b8', size: 20 },
        ];
        if (disabled) lines.push({ text: '● OFFLINE', color: '#ef4444', size: 18, bold: true });
        setLabel(v.label, lines, 1.5, labelBorder);
      }
      for (const [id, v] of deviceMap) {
        if (!seenD.has(id)) { scene.remove(v.group); disposeObject(v.group); deviceMap.delete(id); }
      }

      /* ── Links ── */
      seenL.clear();
      linkPathByPair.clear();
      for (const link of state.links) {
        const a = devMap.get(link.source);
        const b = devMap.get(link.target);
        const lv = ensureLink(link.id);
        if (!a || !b) { lv.group.visible = false; lv.label.visible = false; seenL.add(link.id); continue; }
        seenL.add(link.id);
        lv.group.visible = true;
        lv.label.visible = true;

        // Anchor each end to a port: stored handle, else nearest-face toward the other node.
        centerWorld(link.source, devMap, _cA);
        centerWorld(link.target, devMap, _cB);
        const rpA = resolvePort(link.source, link.sourceHandle as PortId | undefined, _cB, _posA, _dirA);
        const rpB = resolvePort(link.target, link.targetHandle as PortId | undefined, _cA, _posB, _dirB);
        if (rpA && rpB) {
          updateLinkPath(lv, rpA.pos, rpA.dir, rpB.pos, rpB.dir);
          // Packets route by device path, not link id, so every link between the
          // same node pair resolves to ONE representative curve. Prefer the first
          // active link's wire (only upgrade over a disabled placeholder) so
          // parallel/bidirectional links pick a stable, enabled cable rather than
          // whichever link happened to be reconciled last.
          const pk = pairKey(link.source, link.target);
          const existing = linkPathByPair.get(pk);
          if (!existing || (existing.disabled && link.status !== 'disabled')) {
            linkPathByPair.set(pk, { curve: lv.curve, srcId: link.source, disabled: link.status === 'disabled' });
          }
        }

        const disabled = link.status === 'disabled';
        const selected = state.selectedLinkId === link.id;
        const util = link.utilization ?? 0;
        const key = pairKey(link.source, link.target);
        const isFlowing = state.simState === 'running' && !disabled && (util > 0 || state.activePackets.length > 0);

        let colHex = disabled ? '#4b5563' : flowColor(util, cong);
        if (recentCorrupt.has(key)) colHex = '#d946ef';
        linkColor.set(colHex);

        // Core = bright animated flow highlight; stays clearly lit at idle (never near-black).
        lv.coreMat.color.copy(linkColor);
        lv.coreMat.emissive.copy(linkColor);
        lv.coreMat.emissiveIntensity = disabled ? 0.25 : isFlowing ? 2.1 : 1.4;
        lv.coreMat.opacity = disabled ? 0.35 : isFlowing ? 1.0 : 0.92;

        // Casing = always-visible neon sheath tinted by load, so the link reads at a glance.
        const dropped = recentDrop.has(key);
        if (disabled) {
          lv.casingMat.color.setHex(0x3a4358);
          lv.casingMat.emissive.setHex(0x11151f);
          lv.casingMat.emissiveIntensity = 0.2;
          lv.casingMat.opacity = 0.4;
        } else {
          const sheathHex = dropped ? 0xef4444 : selected ? 0x22d3ee : linkColor.getHex();
          lv.casingMat.color.setHex(sheathHex);
          lv.casingMat.emissive.setHex(sheathHex);
          lv.casingMat.emissiveIntensity = selected || dropped ? 0.95 : 0.55;
          lv.casingMat.opacity = selected ? 0.85 : 0.62;
        }

        // Flow scroll
        if (isFlowing && !reduced) {
          const rev = reverseDir.has(`${link.target}>${link.source}`);
          const speed = (0.35 + util * 0.9) * (rev ? 1 : -1);
          lv.tex.offset.y += speed * delta;
        }

        const latMs = (link.latency * state.simConfig.latencyMultiplier);
        const lblLines: LabelLine[] = disabled
          ? [{ text: '✕ DOWN', color: '#64748b', size: 20, bold: true }]
          : [{
              text: `${link.bandwidth}Mb · ${latMs.toFixed(0)}ms${util > 0 ? ` · ${(util * 100).toFixed(0)}%` : ''}`,
              color: util > 0 ? colHex : '#94a3b8', size: 20, bold: util > 0.6,
            }];
        setLabel(lv.label, lblLines, 1.1, disabled ? '#374151' : selected ? 'var(--accent-cyan)' : `${colHex}55`);
      }
      for (const [id, lv] of linkMap) {
        if (!seenL.has(id)) {
          scene.remove(lv.group); scene.remove(lv.label);
          disposeObject(lv.group); disposeObject(lv.label);
          linkMap.delete(id);
        }
      }

      /* ── Packets ── */
      const dur = travelDuration(state.simConfig.speed, state.simConfig.latencyMultiplier, reduced);
      seenP.clear();
      for (const p of state.activePackets) {
        if (p.status !== 'in-transit' && p.status !== 'created') continue;
        if (p.path.length < 2) continue; // degenerate single-node path — nothing to animate
        const toIdx = Math.min(p.path.length - 1, p.currentHop + 1);
        const fromId = p.path[p.currentHop];
        const toId = p.path[toIdx];
        if (!devMap.has(fromId) || !devMap.has(toId)) continue;
        seenP.add(p.id);

        const colHex = p.isAck ? '#10b981' : PROTOCOL_COLORS[p.protocol];
        let pv = packetMap.get(p.id);
        if (!pv) { pv = createPacketVisual(glowTex, colHex); scene.add(pv.group); packetMap.set(p.id, pv); }

        pv.material.color.set(colHex);
        pv.material.emissive.set(colHex);
        (pv.halo.material as THREE.SpriteMaterial).color.set(colHex);

        if (pv.lastHop !== p.currentHop) {
          pv.lastHop = p.currentHop;
          pv.t0 = elapsed;
        }
        const prog = dur > 0 ? clamp((elapsed - pv.t0) / dur, 0, 1) : 1;
        const eased = smoothstep(prog);

        // Ride the actual wire curve between these two devices when one exists.
        const path = linkPathByPair.get(pairKey(fromId, toId));
        if (path) {
          const t = path.srcId === fromId ? eased : 1 - eased;
          path.curve.getPoint(t, pv.group.position);
          // small lift so the packet sits just above the cable
          pv.group.position.y += 0.35 + Math.sin(prog * Math.PI) * 0.5;
        } else {
          pv.from.copy(centerWorld(fromId, devMap));
          pv.to.copy(centerWorld(toId, devMap));
          pv.group.position.lerpVectors(pv.from, pv.to, eased);
          pv.group.position.y = LINK_Y + Math.sin(prog * Math.PI) * 1.7;
        }

        pv.core.rotation.y += delta * 2.6;
        pv.core.rotation.x += delta * 1.8;
        const pulse = 3.1 + Math.sin(elapsed * 8 + p.seqNum) * 0.5;
        pv.halo.scale.set(pulse, pulse, 1);

        setLabel(
          pv.label,
          [{ text: p.isAck ? `ACK #${p.seqNum}` : `#${p.seqNum} ${p.protocol}`, color: '#f8fafc', size: 22, bold: true }],
          1.05,
          colHex,
        );
      }
      for (const [id, pv] of packetMap) {
        if (!seenP.has(id)) { scene.remove(pv.group); disposeObject(pv.group); packetMap.delete(id); }
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    /* ─── Resize ─── */
    const resize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    /* ─── Cleanup ─── */
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      dom.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      dom.removeEventListener('dblclick', onDoubleClick);
      dom.removeEventListener('contextmenu', onContextMenu);
      dom.removeEventListener('pointerleave', onPointerLeave);
      mount.removeEventListener('dragover', onDragOver);
      mount.removeEventListener('drop', onDrop);
      mount.removeEventListener('wheel', onWheelCapture, true);
      window.clearTimeout(wheelResetTimer);

      deviceMap.forEach(v => { scene.remove(v.group); disposeObject(v.group); });
      linkMap.forEach(lv => { scene.remove(lv.group); scene.remove(lv.label); disposeObject(lv.group); disposeObject(lv.label); });
      packetMap.forEach(pv => { scene.remove(pv.group); disposeObject(pv.group); });
      deviceMap.clear(); linkMap.clear(); packetMap.clear();

      glowTex.dispose(); flowTex.dispose();
      disposeObject(ground); disposeObject(connectTube); disposeObject(connectTip);
      grid.geometry.dispose(); (grid.material as THREE.Material).dispose();
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }} />;
};

export default NetworkScene3D;
