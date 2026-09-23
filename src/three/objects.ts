import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { DeviceType } from '../types';

/* ─────────────────────────────────────────────────────────────
 * objects.ts — pure Three.js factory + texture helpers used by the
 * 3D network scene. No React, no store access: just geometry, materials,
 * textures and sprite labels that the scene reconciler wires together.
 * ───────────────────────────────────────────────────────────── */

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const smoothstep = (t: number) => t * t * (3 - 2 * t);

/** Soft radial glow texture (white → transparent). Tinted per-sprite via material.color. */
export function makeGlowTexture(): THREE.Texture {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  return t;
}

/** Repeating flow highlight strip used to animate direction of travel inside link tubes. */
export function makeFlowTexture(): THREE.Texture {
  const w = 128, h = 8;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0.0, 'rgba(255,255,255,0)');
  g.addColorStop(0.42, 'rgba(255,255,255,0)');
  g.addColorStop(0.5, 'rgba(255,255,255,1)');
  g.addColorStop(0.58, 'rgba(255,255,255,0)');
  g.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
}

/* ─── Device visuals ─── */

/* Connection ports, in a fixed order. PORT_IDS[i] is anchored along PORT_DIRS[i]
 * (a local XZ normal). Dots are created in this same order, so DeviceVisual.dots[i]
 * corresponds to PORT_IDS[i]. Ids are axis-based to stay unambiguous under a top-down view:
 *   s = +Z (south/front), e = +X (east/right), n = -Z (north/back), w = -X (west/left) */
export const PORT_IDS = ['s', 'e', 'n', 'w'] as const;
export const PORT_DIRS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 0], [0, -1], [-1, 0],
];
export type PortId = (typeof PORT_IDS)[number];

export interface DeviceVisual {
  group: THREE.Group;
  meshes: THREE.Mesh[];          // pickable shape meshes (move / select)
  dots: THREE.Mesh[];            // connection port dots (start a link) — visible neon handles
  portHit: THREE.Mesh[];         // invisible, larger raycast proxies (one per dot, same order)
  materials: THREE.MeshStandardMaterial[];
  ring: THREE.Mesh;              // selection ring on the ground
  halo: THREE.Sprite;           // additive glow halo
  label: THREE.Sprite;
  color: THREE.Color;
  topY: number;                  // height at which the label floats
  haloY: number;
  dotY: number;                  // height of the connection dots
}

export function createDeviceVisual(
  type: DeviceType,
  colorHex: string,
  glowTex: THREE.Texture,
): DeviceVisual {
  const color = new THREE.Color(colorHex);
  const group = new THREE.Group();
  const meshes: THREE.Mesh[] = [];
  const dots: THREE.Mesh[] = [];
  const portHit: THREE.Mesh[] = [];
  const materials: THREE.MeshStandardMaterial[] = [];

  // [0] Accent material — vivid device colour, glows, greys out when disabled.
  const bodyMat = new THREE.MeshStandardMaterial({
    color: color.clone(),
    metalness: 0.45,
    roughness: 0.26,
    emissive: color.clone(),
    emissiveIntensity: 0.55,
  });
  materials.push(bodyMat);

  // Coloured metal shell (NOT black) — a rich, darker tint of the device colour.
  const shellMat = () => {
    const m = new THREE.MeshStandardMaterial({
      color: color.clone().multiplyScalar(0.6).lerp(new THREE.Color(0x2a3550), 0.35),
      metalness: 0.7, roughness: 0.34,
      emissive: color.clone().multiplyScalar(0.18),
      emissiveIntensity: 0.5,
    });
    materials.push(m);
    return m;
  };
  const metalMat = () => new THREE.MeshStandardMaterial({
    color: 0x8fa2c4, metalness: 0.85, roughness: 0.3,
  });
  const led = (c: THREE.ColorRepresentation, s = 0.16) => {
    const m = new THREE.MeshStandardMaterial({
      color: 0x0a0e1a, emissive: new THREE.Color(c), emissiveIntensity: 1.3,
      metalness: 0.1, roughness: 0.5,
    });
    materials.push(m);
    return new THREE.Mesh(new THREE.BoxGeometry(s, s, s * 0.6), m);
  };

  let topY = 4.4;
  let haloY = 2.0;
  let ringR = 3.2;
  let dotY = 1.5;

  if (type === 'router') {
    // Disc base
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.9, 0.8, 40), shellMat());
    base.position.y = 0.4;
    group.add(base); meshes.push(base);
    // Glowing core orb
    const orb = new THREE.Mesh(new THREE.SphereGeometry(2.0, 40, 28), bodyMat);
    orb.position.y = 2.4;
    group.add(orb); meshes.push(orb);
    // Equator ring
    const eq = new THREE.Mesh(new THREE.TorusGeometry(2.35, 0.14, 14, 56), bodyMat);
    eq.rotation.x = Math.PI / 2;
    eq.position.y = 2.4;
    group.add(eq);
    // Antennas
    const tipMat = new THREE.MeshStandardMaterial({
      color: 0x0a0e1a, emissive: color.clone(), emissiveIntensity: 1.2, roughness: 0.4,
    });
    materials.push(tipMat);
    const antX = [-1.7, 0, 1.7];
    for (let i = 0; i < antX.length; i++) {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.8, 12), metalMat());
      rod.position.set(antX[i], 4.4, -1.3);
      rod.rotation.z = (i - 1) * 0.18;
      group.add(rod); meshes.push(rod);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 14), tipMat);
      tip.position.set(antX[i] + (i - 1) * 0.25, 5.85, -1.3);
      group.add(tip);
    }
    topY = 5.2; haloY = 2.4; ringR = 3.2; dotY = 2.4;
  } else if (type === 'switch') {
    // Wide rounded chassis
    const chassis = new THREE.Mesh(new RoundedBoxGeometry(8.0, 1.7, 3.8, 6, 0.42), shellMat());
    chassis.position.y = 0.9;
    group.add(chassis); meshes.push(chassis);
    // Glowing top inlay
    const inlay = new THREE.Mesh(new RoundedBoxGeometry(7.0, 0.16, 2.9, 4, 0.08), bodyMat);
    inlay.position.y = 1.78;
    group.add(inlay);
    // Port bank + activity LEDs
    for (let i = 0; i < 12; i++) {
      const port = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.22), metalMat());
      port.position.set(-3.3 + i * 0.6, 0.75, 1.96);
      group.add(port);
      const l = led(i % 3 === 0 ? 0x34d399 : colorHex, 0.13);
      l.position.set(-3.3 + i * 0.6, 1.2, 1.98);
      group.add(l);
    }
    topY = 3.0; haloY = 0.9; ringR = 4.4; dotY = 1.2;
  } else if (type === 'server') {
    // Tall rounded tower
    const chassis = new THREE.Mesh(new RoundedBoxGeometry(4.0, 6.6, 4.0, 6, 0.36), shellMat());
    chassis.position.y = 3.3;
    group.add(chassis); meshes.push(chassis);
    // Vertical glowing light strips
    for (const sx of [-1.1, 1.1]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.2, 5.4, 0.12), bodyMat);
      strip.position.set(sx, 3.3, 2.02);
      group.add(strip);
    }
    // Drive bays + LEDs
    for (let i = 0; i < 6; i++) {
      const bay = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.66, 0.14), metalMat());
      bay.position.set(0, 1.1 + i * 0.9, 2.0);
      group.add(bay);
      const l = led(i % 2 === 0 ? 0x34d399 : colorHex, 0.18);
      l.position.set(1.3, 1.1 + i * 0.9, 2.04);
      group.add(l);
    }
    // Glowing top cap
    const cap = new THREE.Mesh(new RoundedBoxGeometry(3.4, 0.4, 3.4, 4, 0.16), bodyMat);
    cap.position.y = 6.7;
    group.add(cap);
    topY = 7.2; haloY = 3.2; ringR = 3.4; dotY = 2.0;
  } else {
    // pc — big monitor + stand + tower
    const bezel = new THREE.Mesh(new RoundedBoxGeometry(4.8, 3.1, 0.4, 5, 0.16), shellMat());
    bezel.position.set(-0.4, 3.5, 0);
    group.add(bezel); meshes.push(bezel);
    // Glowing screen
    const screen = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.55, 0.08), bodyMat);
    screen.position.set(-0.4, 3.55, 0.22);
    group.add(screen);
    // Stand
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.32, 1.6, 18), metalMat());
    neck.position.set(-0.4, 1.4, 0);
    group.add(neck); meshes.push(neck);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.2, 28), metalMat());
    base.position.set(-0.4, 0.15, 0);
    group.add(base); meshes.push(base);
    // Mini tower
    const tower = new THREE.Mesh(new RoundedBoxGeometry(1.4, 3.2, 2.2, 4, 0.12), shellMat());
    tower.position.set(3.0, 1.6, 0);
    group.add(tower); meshes.push(tower);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.4, 0.1), bodyMat);
    stripe.position.set(3.0 - 0.72, 1.6, 1.06);
    group.add(stripe);
    const pwr = led(0x34d399, 0.16);
    pwr.position.set(3.0, 2.9, 1.12);
    group.add(pwr);
    topY = 5.6; haloY = 3.2; ringR = 3.4; dotY = 1.9;
  }

  // Connection port dots — the visible neon "connect here" handles.
  // Order MUST match PORT_IDS / PORT_DIRS defined above.
  const dotGeo = new THREE.SphereGeometry(0.58, 20, 20);
  // Invisible hit proxies (shared geo/mat) — far larger than the visible dot so a port is
  // easy to grab without pixel-perfect aim. Raycaster tests these; they never render.
  const hitGeo = new THREE.SphereGeometry(1.7, 12, 12);
  const hitMat = new THREE.MeshBasicMaterial();
  for (let pi = 0; pi < PORT_DIRS.length; pi++) {
    const [dx, dz] = PORT_DIRS[pi];
    // Bright cyan fill (NOT the background colour) so the handle is never lost on the dark grid.
    const dotMat = new THREE.MeshStandardMaterial({
      color: 0x67e8f9, emissive: new THREE.Color(0x22d3ee), emissiveIntensity: 1.9,
      metalness: 0.1, roughness: 0.3,
    });
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.position.set(dx * ringR, dotY, dz * ringR);
    dot.userData.port = PORT_IDS[pi];
    dot.userData.portDir = new THREE.Vector3(dx, 0, dz);
    // Additive glow so each handle reads as a neon point from any distance.
    const dotGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: new THREE.Color(0x22d3ee), transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    dotGlow.scale.set(2.6, 2.6, 1);
    dotGlow.raycast = () => {};
    dot.add(dotGlow);
    group.add(dot);
    dots.push(dot);

    // Large invisible pick target co-located with the dot.
    const hit = new THREE.Mesh(hitGeo, hitMat);
    hit.position.set(dx * ringR, dotY, dz * ringR);
    hit.visible = false;
    hit.userData.port = PORT_IDS[pi];
    group.add(hit);
    portHit.push(hit);
  }

  // Selection ring flat on the ground
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(ringR, 0.16, 12, 80),
    new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.95 }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  ring.visible = false;
  ring.raycast = () => {};
  group.add(ring);

  // Additive glow halo
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: color.clone(), transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  const haloBase = ringR * 3.0;
  halo.userData.base = haloBase;
  halo.scale.set(haloBase, haloBase, 1);
  halo.position.y = haloY;
  halo.raycast = () => {};
  group.add(halo);

  // Floating text label
  const label = createLabelSprite();
  label.position.y = topY + 1.2;
  group.add(label);

  return { group, meshes, dots, portHit, materials, ring, halo, label, color, topY, haloY, dotY };
}

/* ─── Sprite text labels (canvas-textured) ─── */

export interface LabelLine {
  text: string;
  color?: string;
  size?: number;   // px font size at DPR 1
  bold?: boolean;
}

export function createLabelSprite(): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({
    map: texture, transparent: true, depthWrite: false, depthTest: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.userData.canvas = canvas;
  sprite.userData.texture = texture;
  sprite.userData.key = '';
  sprite.renderOrder = 999;
  sprite.raycast = () => {};
  return sprite;
}

/**
 * Draw multi-line text onto a label sprite. `worldHeight` is the height of a
 * single line in world units — the sprite scale is derived from the canvas
 * aspect so text keeps a fixed on-screen proportion regardless of content.
 */
export function setLabel(
  sprite: THREE.Sprite,
  lines: LabelLine[],
  worldHeight: number,
  border: string | null = 'rgba(255,255,255,0.14)',
  bg = 'rgba(8,12,22,0.82)',
) {
  const key = JSON.stringify({ lines, worldHeight, border, bg });
  if (sprite.userData.key === key) return;
  sprite.userData.key = key;

  const dpr = Math.min(2, (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1);
  const canvas: HTMLCanvasElement = sprite.userData.canvas;
  const ctx = canvas.getContext('2d')!;
  const padX = 16, padY = 10, gap = 4;

  const fontOf = (l: LabelLine) => `${l.bold ? '700' : '500'} ${(l.size ?? 26)}px "JetBrains Mono", ui-monospace, monospace`;

  // Measure
  let maxW = 0;
  let totalH = padY * 2;
  const lineH: number[] = [];
  for (const l of lines) {
    ctx.font = fontOf(l);
    const w = ctx.measureText(l.text).width;
    const h = (l.size ?? 26) * 1.25;
    lineH.push(h);
    maxW = Math.max(maxW, w);
    totalH += h;
  }
  totalH += gap * (lines.length - 1);
  const cw = Math.ceil(maxW + padX * 2);
  const ch = Math.ceil(totalH);

  canvas.width = Math.ceil(cw * dpr);
  canvas.height = Math.ceil(ch * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cw, ch);

  // Rounded background
  if (bg) {
    const r = 9;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.arcTo(cw, 0, cw, ch, r);
    ctx.arcTo(cw, ch, 0, ch, r);
    ctx.arcTo(0, ch, 0, 0, r);
    ctx.arcTo(0, 0, cw, 0, r);
    ctx.closePath();
    ctx.fillStyle = bg;
    ctx.fill();
    if (border) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = border;
      ctx.stroke();
    }
  }

  // Text
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let y = padY;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    ctx.font = fontOf(l);
    ctx.fillStyle = l.color ?? '#f8fafc';
    ctx.fillText(l.text, cw / 2, y + lineH[i] / 2);
    y += lineH[i] + gap;
  }

  (sprite.userData.texture as THREE.CanvasTexture).needsUpdate = true;

  // Keep world height proportional to number of lines
  const worldH = worldHeight * (ch / ((lines[0]?.size ?? 26) * 1.25 + padY * 2));
  const aspect = cw / ch;
  sprite.scale.set(worldH * aspect, worldH, 1);
}

/* ─── Packet visuals ─── */

export interface PacketVisual {
  group: THREE.Group;
  core: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  halo: THREE.Sprite;
  label: THREE.Sprite;
  from: THREE.Vector3;
  to: THREE.Vector3;
  lastHop: number;
  t0: number;
}

export function createPacketVisual(glowTex: THREE.Texture, colorHex: string): PacketVisual {
  const group = new THREE.Group();
  const color = new THREE.Color(colorHex);
  const material = new THREE.MeshStandardMaterial({
    color: color.clone(), emissive: color.clone(), emissiveIntensity: 1.1,
    metalness: 0.3, roughness: 0.2,
  });
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.62, 0), material);
  core.raycast = () => {};
  group.add(core);

  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: color.clone(), transparent: true, opacity: 0.9,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  halo.scale.set(3.4, 3.4, 1);
  halo.raycast = () => {};
  group.add(halo);

  const label = createLabelSprite();
  label.position.y = 1.4;
  group.add(label);

  return {
    group, core, material, halo, label,
    from: new THREE.Vector3(), to: new THREE.Vector3(),
    lastHop: -999, t0: 0,
  };
}

/* ─── Flow colour logic (mirrors the old NetworkEdge heuristics) ─── */
export function flowColor(util: number, congestionPct: number): string {
  if (congestionPct > 70 || util > 0.85) return '#ef4444';
  if (congestionPct > 35 || util > 0.6) return '#f59e0b';
  if (util < 0.3 && congestionPct < 15) return '#86efac';
  return '#10b981';
}

/* Textures shared across many objects (the glow + flow sprites are created once
 * per scene and reused by every device/packet/link). These must NOT be freed when
 * an individual object is torn down — only when the whole scene unmounts. */
const sharedTextures = new WeakSet<THREE.Texture>();

/** Mark a texture as scene-owned/shared so per-object disposeObject() won't free it. */
export function markTextureShared<T extends THREE.Texture>(tex: T): T {
  sharedTextures.add(tex);
  return tex;
}

/** Dispose a Three.js object tree's geometries, materials and (non-shared) textures. */
export function disposeObject(obj: THREE.Object3D) {
  obj.traverse((child) => {
    const anyChild = child as any;
    if (anyChild.geometry) anyChild.geometry.dispose?.();
    const mat = anyChild.material;
    if (mat) {
      const mats = Array.isArray(mat) ? mat : [mat];
      for (const m of mats) {
        if (m.map && !sharedTextures.has(m.map)) m.map.dispose?.();
        m.dispose?.();
      }
    }
  });
}
