"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import * as THREE from "three";
import styles from "./HeroBuilding.module.css";

export type HeroMode = "idle" | "studio" | "section";
export type LayerKey = "plan" | "structure" | "envelope" | "dimensions";

export type HeroSignal = {
  actor: "system" | "human" | "agent";
  code: string;
  note: string;
  value: string;
  progress: number;
  /** Height in the building the studio is currently working at, 0 at grade, 1 at roof. */
  elevation: number;
};

type PartLayer = "plan" | "structure" | "envelope";
type Level = 0 | 1 | 2;

const MODEL_HEIGHT = 7.2;
const EXPLODE: Record<Level, number> = { 0: 0, 1: 1.95, 2: 3.7 };

const INK = 0x26322c;
const GRAPHITE = 0x50594f;
const FOREST = 0x4d7561;

/** Entrance choreography. Each stage owns a window on the shared clock, in seconds. */
const STAGES = [
  { start: 0.15, span: 1.05 }, // 0  site grid establishes
  { start: 0.85, span: 1.55 }, // 1  floor-plan lines are drawn
  { start: 2.05, span: 0.85 }, // 2  ground slab + terrace
  { start: 2.55, span: 1.35 }, // 3  ground walls rise
  { start: 3.55, span: 1.45 }, // 4  openings, glazing, timber
  { start: 4.65, span: 0.8 }, //  5  level datum slab
  { start: 5.15, span: 1.25 }, // 6  upper walls rise
  { start: 6.05, span: 1.4 }, //  7  upper envelope + partitions
  { start: 7.1, span: 0.9 }, //   8  roof frame
  { start: 7.7, span: 1.45 }, //  9  dimensions + annotations
  { start: 8.9, span: 3.4 }, //  10  agent inspects, adjusts, confirms
] as const;

const AMBIENT_START = 12.4;
const CYCLE = 17.5;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const clamp01 = (value: number) => clamp(value, 0, 1);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
/** Frame-rate independent approach, so motion reads the same on any display. */
const damp = (current: number, target: number, lambda: number, delta: number) =>
  current + (target - current) * (1 - Math.exp(-lambda * delta));
/** Ramp that rises over `up`, holds, then falls over `down` — used for momentary events. */
const pulse = (t: number, start: number, up: number, hold: number, down: number) => {
  if (t <= start || t >= start + up + hold + down) return 0;
  if (t < start + up) return easeInOut((t - start) / up);
  if (t < start + up + hold) return 1;
  return 1 - easeInOut((t - start - up - hold) / down);
};

type TrackedMaterial = { material: THREE.Material; base: number };

type Part = {
  mesh: THREE.Mesh;
  materials: TrackedMaterial[];
  standard: THREE.MeshStandardMaterial[];
  stage: number;
  seq: number;
  rise: boolean;
  restY: number;
  restX: number;
  height: number;
  level: Level;
  layer: PartLayer;
  sectionOpacity: number;
  offsetX: number;
  highlight: number;
  tag?: string;
  spec?: string;
};

type BoxOptions = {
  stage: number;
  level: Level;
  layer: PartLayer;
  rise?: boolean;
  edges?: boolean;
  edgeColor?: number;
  edgeOpacity?: number;
  castShadow?: boolean;
  section?: number;
  tag?: string;
  spec?: string;
};

/** Even spacing along a polyline, so `setDrawRange` reads as a pen drawing at constant speed. */
function resamplePolyline(points: THREE.Vector3[], count: number) {
  const spans: number[] = [];
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const length = points[index].distanceTo(points[index - 1]);
    spans.push(length);
    total += length;
  }

  const sampled: THREE.Vector3[] = [];
  for (let index = 0; index < count; index += 1) {
    const target = (index / (count - 1)) * total;
    let travelled = 0;
    let segment = 0;
    while (segment < spans.length - 1 && travelled + spans[segment] < target) {
      travelled += spans[segment];
      segment += 1;
    }
    const ratio = spans[segment] > 0 ? (target - travelled) / spans[segment] : 0;
    sampled.push(points[segment].clone().lerp(points[segment + 1], ratio));
  }
  return sampled;
}

type DrawnLine = {
  line: THREE.Line;
  material: THREE.LineBasicMaterial | THREE.LineDashedMaterial;
  baseOpacity: number;
  setProgress: (value: number) => void;
};

function drawnLine(
  parent: THREE.Object3D,
  points: THREE.Vector3[],
  material: THREE.LineBasicMaterial | THREE.LineDashedMaterial,
  samples = 96,
): DrawnLine {
  const sampled = points.length > 2 || samples > 2 ? resamplePolyline(points, samples) : points;
  const geometry = new THREE.BufferGeometry().setFromPoints(sampled);
  const line = new THREE.Line(geometry, material);
  if (material instanceof THREE.LineDashedMaterial) line.computeLineDistances();
  geometry.setDrawRange(0, 0);
  parent.add(line);

  return {
    line,
    material,
    baseOpacity: material.opacity,
    setProgress: (value: number) => {
      const drawn = Math.floor(clamp01(value) * sampled.length);
      geometry.setDrawRange(0, drawn < 2 ? 0 : drawn);
    },
  };
}

type Label = {
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  write: (text: string, tone?: "normal" | "active") => void;
};

/** Annotation tags drawn to a canvas — CAD lettering on a slip of paper. */
function makeLabel(text: string, rotation = 0, width = 2.15): Label {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const context = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;

  const write = (value: string, tone: "normal" | "active" = "normal") => {
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = tone === "active" ? "rgba(249, 240, 232, .94)" : "rgba(244, 240, 231, .88)";
    context.beginPath();
    context.roundRect(96, 34, 320, 92, 3);
    context.fill();
    context.strokeStyle = tone === "active" ? "rgba(180, 83, 46, .58)" : "rgba(47, 58, 52, .2)";
    context.lineWidth = tone === "active" ? 3 : 2;
    context.stroke();
    context.fillStyle = tone === "active" ? "#a94c29" : "#26322c";
    context.font = "600 48px ui-monospace, SFMono-Regular, Menlo, monospace";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(value, 256, 82);
    texture.needsUpdate = true;
  };

  write(text);

  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, rotation, opacity: 0 });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(width, width * 0.312, 1);
  sprite.renderOrder = 20;
  return { sprite, material, write };
}

/**
 * The building, its site drawing, its dimension set and the two working markers.
 * Everything is registered with the stage it belongs to so the entrance sequence
 * can draw, raise and assemble it in the order an architect would.
 */
function buildModel() {
  const rig = new THREE.Group();

  const site = new THREE.Group();
  const house = new THREE.Group();
  const dimensions = new THREE.Group();
  const actors = new THREE.Group();
  rig.add(site, house, dimensions, actors);

  const parts: Part[] = [];
  const stageCounts = new Array(STAGES.length).fill(0);

  const concrete = new THREE.MeshStandardMaterial({ color: 0xded9ce, roughness: 0.82, metalness: 0.02 });
  const concreteLight = new THREE.MeshStandardMaterial({ color: 0xf0ece3, roughness: 0.76, metalness: 0.01 });
  const concreteShade = new THREE.MeshStandardMaterial({ color: 0xbab8b0, roughness: 0.88, metalness: 0.01 });
  const floorMaterial = new THREE.MeshStandardMaterial({ color: 0xd4cfc4, roughness: 0.94, metalness: 0 });
  const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x222b27, roughness: 0.55, metalness: 0.28 });
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x7f9188,
    transparent: true,
    opacity: 0.34,
    roughness: 0.14,
    metalness: 0.08,
    transmission: 0.12,
    thickness: 0.08,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const interiorDark = new THREE.MeshStandardMaterial({ color: 0x303a35, roughness: 0.86 });
  const timber = new THREE.MeshStandardMaterial({ color: 0x795735, roughness: 0.72, metalness: 0.02 });
  const garage = new THREE.MeshStandardMaterial({ color: 0x303632, roughness: 0.58, metalness: 0.22 });

  function addBox(
    size: [number, number, number],
    position: [number, number, number],
    source: THREE.Material,
    options: BoxOptions,
  ) {
    const geometry = new THREE.BoxGeometry(...size);
    // Cloned so every element can fade and highlight on its own schedule.
    const material = source.clone();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.castShadow = options.castShadow ?? true;
    mesh.receiveShadow = true;
    mesh.visible = false;
    house.add(mesh);

    const tracked: TrackedMaterial[] = [{ material, base: material.opacity }];
    const standard = material instanceof THREE.MeshStandardMaterial ? [material] : [];

    if (options.edges !== false) {
      const edgeMaterial = new THREE.LineBasicMaterial({
        color: options.edgeColor ?? 0x303934,
        transparent: true,
        opacity: options.edgeOpacity ?? 0.62,
      });
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 24), edgeMaterial);
      mesh.add(edges);
      tracked.push({ material: edgeMaterial, base: edgeMaterial.opacity });
    }

    for (const entry of tracked) entry.material.transparent = true;

    const part: Part = {
      mesh,
      materials: tracked,
      standard,
      stage: options.stage,
      seq: stageCounts[options.stage],
      rise: options.rise ?? false,
      restY: position[1],
      restX: position[0],
      height: size[1],
      level: options.level,
      layer: options.layer,
      sectionOpacity: options.section ?? 1,
      offsetX: 0,
      highlight: 0,
      tag: options.tag,
      spec: options.spec,
    };
    stageCounts[options.stage] += 1;
    parts.push(part);
    mesh.userData.part = part;
    return part;
  }

  // ── Stage 0 · the site ────────────────────────────────────────────────────
  const groundShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(34, 34),
    new THREE.ShadowMaterial({ color: 0x263029, opacity: 0, transparent: true }),
  );
  groundShadow.rotation.x = -Math.PI / 2;
  groundShadow.position.y = -0.34;
  groundShadow.receiveShadow = true;
  site.add(groundShadow);

  const grid = new THREE.GridHelper(26, 26, 0x59645d, 0x8b948d);
  grid.position.y = -0.32;
  const gridMaterial = grid.material as THREE.LineBasicMaterial;
  gridMaterial.transparent = true;
  gridMaterial.opacity = 0;
  site.add(grid);

  // Setting-out marks: the coordinate crosses a surveyor leaves on a site plan.
  const siteMarkMaterial = new THREE.LineBasicMaterial({ color: 0x6d766e, transparent: true, opacity: 0 });
  const siteMarks: DrawnLine[] = [];
  for (const [x, z] of [[-9.4, -6.4], [9.4, -6.4], [-9.4, 7], [9.4, 7]] as const) {
    siteMarks.push(
      drawnLine(site, [new THREE.Vector3(x - 0.55, -0.31, z), new THREE.Vector3(x + 0.55, -0.31, z)], siteMarkMaterial.clone(), 8),
    );
    siteMarks.push(
      drawnLine(site, [new THREE.Vector3(x, -0.31, z - 0.55), new THREE.Vector3(x, -0.31, z + 0.55)], siteMarkMaterial.clone(), 8),
    );
  }
  // Two long setting-out axes running past the footprint.
  siteMarks.push(
    drawnLine(site, [new THREE.Vector3(-10.5, -0.31, -3.72), new THREE.Vector3(10.5, -0.31, -3.72)], new THREE.LineDashedMaterial({ color: 0x6d766e, transparent: true, opacity: 0, dashSize: 0.3, gapSize: 0.24 }), 120),
  );
  siteMarks.push(
    drawnLine(site, [new THREE.Vector3(-6.05, -0.31, -7.4), new THREE.Vector3(-6.05, -0.31, 8)], new THREE.LineDashedMaterial({ color: 0x6d766e, transparent: true, opacity: 0, dashSize: 0.3, gapSize: 0.24 }), 120),
  );

  // ── Stage 1 · the floor plan, drawn line by line ──────────────────────────
  const planMaterial = new THREE.LineBasicMaterial({ color: 0x46514a, transparent: true, opacity: 0 });
  const planY = 0.24;
  const planLines: DrawnLine[] = [
    drawnLine(
      house,
      [
        new THREE.Vector3(-6.22, planY, -3.82),
        new THREE.Vector3(6.2, planY, -3.82),
        new THREE.Vector3(6.2, planY, 3.98),
        new THREE.Vector3(-6.22, planY, 3.98),
        new THREE.Vector3(-6.22, planY, -3.82),
      ],
      planMaterial.clone(),
      190,
    ),
    drawnLine(
      house,
      [
        new THREE.Vector3(-6.3, planY, 3.98),
        new THREE.Vector3(-6.3, planY, 5.62),
        new THREE.Vector3(2.9, planY, 5.62),
        new THREE.Vector3(2.9, planY, 3.98),
      ],
      planMaterial.clone(),
      120,
    ),
    drawnLine(
      house,
      [new THREE.Vector3(-5.4, planY, 0.42), new THREE.Vector3(0.15, planY, 0.42), new THREE.Vector3(0.15, planY, -3.3)],
      planMaterial.clone(),
      110,
    ),
    drawnLine(
      house,
      [new THREE.Vector3(2.25, planY, 2.6), new THREE.Vector3(2.25, planY, -0.55), new THREE.Vector3(5.9, planY, -0.55)],
      planMaterial.clone(),
      110,
    ),
    drawnLine(
      house,
      [new THREE.Vector3(5.86, planY, -3.1), new THREE.Vector3(5.86, planY, 1.05)],
      new THREE.LineDashedMaterial({ color: 0x5b655d, transparent: true, opacity: 0, dashSize: 0.2, gapSize: 0.16 }),
      80,
    ),
    // Stair run, read as treads on the plan.
    drawnLine(
      house,
      [
        new THREE.Vector3(-4.12, planY, 1.3),
        new THREE.Vector3(-2.38, planY, 1.3),
        new THREE.Vector3(-2.38, planY, -0.86),
        new THREE.Vector3(-4.12, planY, -0.86),
        new THREE.Vector3(-4.12, planY, 1.3),
      ],
      planMaterial.clone(),
      130,
    ),
  ];

  // ── Stage 2 · ground slab, terrace and approach ───────────────────────────
  addBox([13.5, 0.26, 8.4], [0, 0.05, 0], floorMaterial, {
    stage: 2, level: 0, layer: "structure", edgeOpacity: 0.72,
    tag: "Ground slab", spec: "13 500 × 8 400 · ±0",
  });
  addBox([9.2, 0.18, 2.15], [-1.7, 0.18, 4.55], concreteLight, {
    stage: 2, level: 0, layer: "structure", edgeOpacity: 0.48,
    tag: "Entry terrace", spec: "9 200 × 2 150 · south",
  });
  addBox([3.35, 0.17, 0.68], [-3.75, 0.08, 5.65], concrete, { stage: 2, level: 0, layer: "structure", edgeOpacity: 0.48 });
  addBox([3.05, 0.17, 0.62], [-3.75, -0.08, 5.98], concreteShade, { stage: 2, level: 0, layer: "structure", edgeOpacity: 0.4 });
  addBox([2.75, 0.17, 0.58], [-3.75, -0.24, 6.28], concreteShade, { stage: 2, level: 0, layer: "structure", edgeOpacity: 0.36 });

  const jointMaterial = new THREE.LineBasicMaterial({ color: 0x667068, transparent: true, opacity: 0 });
  const slabJoints: DrawnLine[] = [];
  for (let x = -6; x <= 6; x += 1.5) {
    slabJoints.push(drawnLine(house, [new THREE.Vector3(x, 0.2, -4), new THREE.Vector3(x, 0.2, 5.55)], jointMaterial.clone(), 48));
  }
  for (let z = -3.75; z <= 5.5; z += 1.35) {
    slabJoints.push(drawnLine(house, [new THREE.Vector3(-6.5, 0.2, z), new THREE.Vector3(6.5, 0.2, z)], jointMaterial.clone(), 48));
  }

  // ── Stage 3 · ground walls rise from the plan ─────────────────────────────
  addBox([11.9, 3.08, 0.2], [-0.2, 1.75, -3.72], concreteShade, {
    stage: 3, level: 0, layer: "structure", rise: true, edgeOpacity: 0.45,
    tag: "North wall", spec: "11 900 × 3 080 · solid",
  });
  addBox([0.34, 3.08, 7.55], [-6.05, 1.75, 0], concreteLight, { stage: 3, level: 0, layer: "structure", rise: true, edgeOpacity: 0.52 });
  addBox([0.36, 3.08, 2.1], [6.02, 1.75, 2.72], concrete, { stage: 3, level: 0, layer: "structure", rise: true, edgeOpacity: 0.55 });
  addBox([0.36, 3.08, 1.35], [6.02, 1.75, -3.12], concreteShade, { stage: 3, level: 0, layer: "structure", rise: true, edgeOpacity: 0.55 });

  // ── Stage 4 · openings, glazing, timber, garage ───────────────────────────
  addBox([0.34, 0.46, 3.9], [6.02, 3.06, -0.84], concrete, { stage: 4, level: 0, layer: "structure", edgeOpacity: 0.48 });
  addBox([0.16, 2.45, 3.75], [5.96, 1.57, -0.82], garage, {
    stage: 4, level: 0, layer: "envelope", edges: false, castShadow: false,
    tag: "Vehicle bay", spec: "3 750 clear opening",
  });
  for (let z = -2.52; z <= 0.88; z += 0.38) {
    addBox([0.025, 2.26, 0.025], [5.84, 1.57, z], concreteShade, { stage: 4, level: 0, layer: "envelope", edges: false, castShadow: false });
  }

  addBox([10.9, 2.72, 0.1], [-0.55, 1.68, 3.78], interiorDark, {
    stage: 4, level: 0, layer: "envelope", edges: false, castShadow: false, section: 0.2,
  });
  const groundWindows = [[-5.28, 1.42], [-3.76, 1.42], [-2.24, 1.42], [-0.72, 1.42], [0.8, 1.42], [4.62, 1.4]] as const;
  for (const [x, width] of groundWindows) {
    addBox([width, 2.7, 0.09], [x, 1.67, 3.9], glassMaterial, {
      stage: 4, level: 0, layer: "envelope", edgeColor: 0x202b26, edgeOpacity: 0.82, castShadow: false, section: 0.1,
      tag: "Glazed façade", spec: "11 900 × 3 080 · south",
    });
  }
  for (const x of [-6.02, -4.52, -3, -1.48, 0.05, 1.56, 3.77, 5.42]) {
    addBox([0.16, 3.02, 0.2], [x, 1.74, 3.94], frameMaterial, { stage: 4, level: 0, layer: "envelope", edges: false, section: 0.14 });
  }
  addBox([12.5, 0.42, 0.52], [0, 3.26, 3.87], concreteLight, { stage: 4, level: 0, layer: "structure", edgeOpacity: 0.68 });
  addBox([0.52, 3.2, 0.58], [2.62, 1.76, 3.84], concrete, { stage: 4, level: 0, layer: "structure", rise: true, edgeOpacity: 0.55 });
  for (let index = 0; index < 12; index += 1) {
    addBox([0.105, 2.78, 0.16], [1.82 + index * 0.13, 1.7, 4.08], timber, {
      stage: 4, level: 0, layer: "envelope", rise: true, edges: false, section: 0.24,
      tag: "Timber screen", spec: "12 × 105 louvres · larch",
    });
  }

  // ── Stage 5 · the horizontal datum ────────────────────────────────────────
  addBox([12.85, 0.28, 8.08], [0, 3.48, 0], concreteLight, {
    stage: 5, level: 1, layer: "structure", edgeOpacity: 0.72,
    tag: "Floor datum", spec: "+3 600 · 280 slab",
  });
  addBox([9.35, 0.24, 1.35], [-1.15, 3.5, 4.43], concreteLight, { stage: 5, level: 1, layer: "structure", edgeOpacity: 0.58 });
  addBox([12.65, 0.4, 0.54], [0, 3.64, 3.92], concrete, { stage: 5, level: 1, layer: "structure", edgeOpacity: 0.68 });

  // ── Stage 6 · upper walls ─────────────────────────────────────────────────
  addBox([11.85, 3.08, 0.22], [-0.2, 5.15, -3.72], concrete, {
    stage: 6, level: 1, layer: "structure", rise: true, edgeOpacity: 0.5,
    tag: "Service wall", spec: "11 850 × 3 080 · north",
  });
  addBox([0.34, 3.08, 7.55], [-6.04, 5.15, 0], concreteLight, { stage: 6, level: 1, layer: "structure", rise: true, edgeOpacity: 0.58 });
  addBox([0.36, 3.08, 3.78], [6.02, 5.15, -1.9], concrete, { stage: 6, level: 1, layer: "structure", rise: true, edgeOpacity: 0.58 });

  // ── Stage 7 · upper envelope, partitions, stair ───────────────────────────
  addBox([0.36, 0.42, 3.45], [6.02, 6.48, 1.83], concreteLight, { stage: 7, level: 1, layer: "structure", edgeOpacity: 0.56 });
  addBox([0.11, 2.55, 3.28], [5.92, 5.12, 1.82], interiorDark, { stage: 7, level: 1, layer: "envelope", edges: false, castShadow: false, section: 0.2 });
  addBox([0.065, 2.55, 3.28], [6.01, 5.12, 1.82], glassMaterial, {
    stage: 7, level: 1, layer: "envelope", edgeColor: 0x202b26, edgeOpacity: 0.76, castShadow: false, section: 0.12,
    tag: "Corner window", spec: "3 280 × 2 550 · east",
  });
  for (const z of [0.32, 1.42, 2.52, 3.32]) {
    addBox([0.1, 2.64, 0.12], [5.86, 5.12, z], frameMaterial, { stage: 7, level: 1, layer: "envelope", edges: false, section: 0.16 });
  }
  addBox([10.75, 2.68, 0.1], [-0.6, 5.1, 3.75], interiorDark, { stage: 7, level: 1, layer: "envelope", edges: false, castShadow: false, section: 0.2 });
  const upperWindows = [[-5.25, 1.46], [-3.7, 1.46], [-2.15, 1.46], [-0.6, 1.46], [0.95, 1.46], [4.62, 1.5]] as const;
  for (const [x, width] of upperWindows) {
    addBox([width, 2.62, 0.09], [x, 5.08, 3.88], glassMaterial, {
      stage: 7, level: 1, layer: "envelope", edgeColor: 0x202b26, edgeOpacity: 0.84, castShadow: false, section: 0.1,
      tag: "Upper glazing", spec: "6 bays · 1 460 module",
    });
  }
  for (const x of [-6.02, -4.48, -2.92, -1.38, 0.18, 1.72, 3.78, 5.42]) {
    addBox([0.15, 2.92, 0.2], [x, 5.13, 3.93], frameMaterial, { stage: 7, level: 1, layer: "envelope", edges: false, section: 0.14 });
  }
  addBox([0.55, 3.04, 0.6], [2.66, 5.15, 3.82], concreteLight, { stage: 7, level: 1, layer: "structure", rise: true, edgeOpacity: 0.56 });
  for (let index = 0; index < 12; index += 1) {
    addBox([0.105, 2.66, 0.16], [1.82 + index * 0.13, 5.1, 4.08], timber, { stage: 7, level: 1, layer: "envelope", rise: true, edges: false, section: 0.24 });
  }

  const partitions = [
    addBox([5.65, 2.9, 0.16], [-2.65, 5.12, 0.42], concreteLight, {
      stage: 7, level: 1, layer: "structure", rise: true, edgeOpacity: 0.5,
      tag: "Partition P-07", spec: "5 650 × 2 900",
    }),
    addBox([0.16, 2.9, 3.8], [-0.15, 5.12, -1.42], concrete, {
      stage: 7, level: 1, layer: "structure", rise: true, edgeOpacity: 0.5,
      tag: "Partition P-04", spec: "3 800 × 2 900 · set out from grid A",
    }),
    addBox([4.15, 2.9, 0.16], [3.85, 5.12, -0.55], concreteLight, { stage: 7, level: 1, layer: "structure", rise: true, edgeOpacity: 0.5 }),
    addBox([0.16, 2.9, 2.15], [2.25, 5.12, 1.56], concrete, { stage: 7, level: 1, layer: "structure", rise: true, edgeOpacity: 0.5 }),
  ];
  addBox([3.0, 1.28, 0.16], [4.52, 4.32, 2.42], concreteLight, { stage: 7, level: 1, layer: "structure", rise: true, edgeOpacity: 0.42 });

  for (let index = 0; index < 8; index += 1) {
    addBox([1.75, 0.12, 0.33], [-3.25, 3.7 + index * 0.23, 1.15 - index * 0.31], concreteShade, {
      stage: 7, level: 1, layer: "structure", edgeOpacity: 0.35,
      tag: "Stair run", spec: "8 × 230 rise · 310 going",
    });
  }

  // ── Stage 8 · roof frame ──────────────────────────────────────────────────
  addBox([12.65, 0.42, 0.5], [0, 6.68, 3.88], concreteLight, {
    stage: 8, level: 2, layer: "structure", edgeOpacity: 0.76,
    tag: "Roof datum", spec: "+7 200 · parapet 420",
  });
  addBox([12.65, 0.42, 0.5], [0, 6.68, -3.84], concreteLight, { stage: 8, level: 2, layer: "structure", edgeOpacity: 0.76 });
  addBox([0.5, 0.42, 7.25], [-6.08, 6.68, 0], concreteLight, { stage: 8, level: 2, layer: "structure", edgeOpacity: 0.76 });
  addBox([0.5, 0.42, 7.25], [6.08, 6.68, 0], concrete, { stage: 8, level: 2, layer: "structure", edgeOpacity: 0.76 });

  // ── Stage 9 · the dimension set ───────────────────────────────────────────
  const dimensionMaterial = new THREE.LineBasicMaterial({ color: 0x3e4942, transparent: true, opacity: 0 });
  const extensionMaterial = new THREE.LineDashedMaterial({
    color: 0x667168, transparent: true, opacity: 0, dashSize: 0.16, gapSize: 0.14,
  });
  const nodeMaterial = new THREE.MeshBasicMaterial({ color: 0x59645c, transparent: true, opacity: 0 });

  type Dimension = {
    group: THREE.Group;
    /** How much of this dimension survives when the model opens up. */
    sectionFade: number;
    lines: DrawnLine[];
    label: Label;
    nodes: THREE.Mesh[];
    materials: TrackedMaterial[];
  };
  const dimensionSet: Dimension[] = [];

  function addDimension(
    from: THREE.Vector3,
    to: THREE.Vector3,
    extensions: [THREE.Vector3, THREE.Vector3][],
    label: Label,
    labelPosition: THREE.Vector3,
  ): Dimension {
    const group = new THREE.Group();
    dimensions.add(group);

    const main = dimensionMaterial.clone();
    const lines = [drawnLine(group, [from, to], main, 90)];
    const materials: TrackedMaterial[] = [{ material: main, base: 0.66 }];

    for (const [start, end] of extensions) {
      const extension = extensionMaterial.clone();
      lines.push(drawnLine(group, [start, end], extension, 40));
      materials.push({ material: extension, base: 0.42 });
    }

    const nodes: THREE.Mesh[] = [];
    for (const point of [from, to]) {
      const node = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 16), nodeMaterial.clone());
      node.position.copy(point);
      node.visible = false;
      group.add(node);
      nodes.push(node);
      materials.push({ material: node.material as THREE.Material, base: 1 });
    }

    label.sprite.position.copy(labelPosition);
    group.add(label.sprite);

    const dimension: Dimension = { group, sectionFade: 1, lines, label, nodes, materials };
    dimensionSet.push(dimension);
    return dimension;
  }

  const widthDimension = addDimension(
    new THREE.Vector3(-6.3, 8.05, -4.7),
    new THREE.Vector3(6.3, 8.05, -4.7),
    [
      [new THREE.Vector3(-6.3, 6.8, -3.85), new THREE.Vector3(-6.3, 8.05, -4.7)],
      [new THREE.Vector3(6.3, 6.8, -3.85), new THREE.Vector3(6.3, 8.05, -4.7)],
    ],
    makeLabel("12600"),
    new THREE.Vector3(0, 8.44, -4.7),
  );
  // The overall envelope is not what a section is about; it steps back instead.
  widthDimension.sectionFade = 0;

  addDimension(
    new THREE.Vector3(7.35, 0, -3.95),
    new THREE.Vector3(7.35, MODEL_HEIGHT, -3.95),
    [
      [new THREE.Vector3(6.25, 0, -3.8), new THREE.Vector3(7.35, 0, -3.95)],
      [new THREE.Vector3(6.25, 6.75, -3.8), new THREE.Vector3(7.35, MODEL_HEIGHT, -3.95)],
    ],
    makeLabel("7200", Math.PI / 2),
    new THREE.Vector3(7.74, 3.6, -3.95),
  );

  addDimension(
    new THREE.Vector3(7.18, -0.2, -2.7),
    new THREE.Vector3(7.18, -0.2, 2.7),
    [
      [new THREE.Vector3(6.35, 0, -2.7), new THREE.Vector3(7.18, -0.2, -2.7)],
      [new THREE.Vector3(6.35, 0, 2.7), new THREE.Vector3(7.18, -0.2, 2.7)],
    ],
    makeLabel("5400"),
    new THREE.Vector3(7.22, -0.52, 0),
  );

  // The terrace bay, dimensioned the way a ground-floor plan would be.
  addDimension(
    new THREE.Vector3(-6.05, -0.26, 5.3),
    new THREE.Vector3(-1.55, -0.26, 5.3),
    [
      [new THREE.Vector3(-6.05, 0, 4.15), new THREE.Vector3(-6.05, -0.26, 5.3)],
      [new THREE.Vector3(-1.55, 0, 4.15), new THREE.Vector3(-1.55, -0.26, 5.3)],
    ],
    makeLabel("4500"),
    new THREE.Vector3(-3.8, -0.6, 5.3),
  );

  // Level marks, one per floor, so they travel with the slabs when the model opens up.
  const elevations: { level: Level; line: DrawnLine; node: THREE.Mesh; restY: number }[] = [];
  for (const [y, level] of [[0.12, 0], [3.58, 1], [6.88, 2]] as const) {
    const line = drawnLine(
      dimensions,
      [new THREE.Vector3(-7.45, y, 3.86), new THREE.Vector3(-6.28, y, 3.86)],
      dimensionMaterial.clone(),
      16,
    );
    const node = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 14), nodeMaterial.clone());
    node.position.set(-7.45, y, 3.86);
    node.visible = false;
    dimensions.add(node);
    elevations.push({ level, line, node, restY: y });
  }

  // ── Stage 10 · the two working markers ────────────────────────────────────
  const agent = new THREE.Group();
  agent.visible = false;
  actors.add(agent);

  const agentMaterial = new THREE.LineBasicMaterial({ color: FOREST, transparent: true, opacity: 0.9, depthTest: false });
  const bracket = 0.42;
  const gap = 0.18;
  const bracketPoints: number[] = [];
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
    bracketPoints.push(
      sx * bracket, 0, sz * gap, sx * bracket, 0, sz * bracket,
      sx * bracket, 0, sz * bracket, sx * gap, 0, sz * bracket,
    );
  }
  const bracketGeometry = new THREE.BufferGeometry();
  bracketGeometry.setAttribute("position", new THREE.Float32BufferAttribute(bracketPoints, 3));
  const reticle = new THREE.LineSegments(bracketGeometry, agentMaterial);
  reticle.position.y = 0.28;
  reticle.renderOrder = 18;
  agent.add(reticle);

  const stemMaterial = new THREE.LineBasicMaterial({ color: FOREST, transparent: true, opacity: 0.5, depthTest: false });
  const stem = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.28, 0), new THREE.Vector3(0, 1.35, 0)]),
    stemMaterial,
  );
  stem.renderOrder = 18;
  agent.add(stem);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 16, 16),
    new THREE.MeshBasicMaterial({ color: FOREST, transparent: true, opacity: 0.95, depthTest: false }),
  );
  head.position.y = 1.35;
  head.renderOrder = 19;
  agent.add(head);

  const scanMaterial = new THREE.LineBasicMaterial({ color: FOREST, transparent: true, opacity: 0, depthTest: false });
  const scanPoints: THREE.Vector3[] = [];
  for (let index = 0; index <= 72; index += 1) {
    const angle = (index / 72) * Math.PI * 2;
    scanPoints.push(new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)));
  }
  const scanRing = new THREE.Line(new THREE.BufferGeometry().setFromPoints(scanPoints), scanMaterial);
  scanRing.position.y = 0.26;
  scanRing.renderOrder = 17;
  agent.add(scanRing);

  // A validated mark: no words, just the tick an engineer leaves on a drawing.
  const checkCanvas = document.createElement("canvas");
  checkCanvas.width = 128;
  checkCanvas.height = 128;
  const checkContext = checkCanvas.getContext("2d");
  if (checkContext) {
    checkContext.strokeStyle = "#4d7561";
    checkContext.lineWidth = 11;
    checkContext.lineCap = "round";
    checkContext.lineJoin = "round";
    checkContext.beginPath();
    checkContext.moveTo(30, 66);
    checkContext.lineTo(55, 90);
    checkContext.lineTo(99, 38);
    checkContext.stroke();
  }
  const checkTexture = new THREE.CanvasTexture(checkCanvas);
  checkTexture.colorSpace = THREE.SRGBColorSpace;
  const checkMaterial = new THREE.SpriteMaterial({ map: checkTexture, transparent: true, depthTest: false, opacity: 0 });
  const check = new THREE.Sprite(checkMaterial);
  check.scale.setScalar(0.62);
  check.position.set(0.46, 1.5, 0);
  check.renderOrder = 24;
  agent.add(check);

  const human = new THREE.Group();
  human.visible = false;
  actors.add(human);

  const humanMaterial = new THREE.LineBasicMaterial({ color: GRAPHITE, transparent: true, opacity: 0, depthTest: false });
  const crossGeometry = new THREE.BufferGeometry();
  crossGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([-0.62, 0, 0, 0.62, 0, 0, 0, 0, -0.62, 0, 0, 0.62], 3),
  );
  const crosshair = new THREE.LineSegments(crossGeometry, humanMaterial);
  crosshair.position.y = 0.3;
  crosshair.renderOrder = 18;
  human.add(crosshair);

  const nib = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 14, 14),
    new THREE.MeshBasicMaterial({ color: INK, transparent: true, opacity: 0, depthTest: false }),
  );
  nib.position.y = 0.3;
  nib.renderOrder = 19;
  human.add(nib);

  const penMaterial = new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0, depthTest: false });
  const penGeometry = new THREE.BufferGeometry().setFromPoints(
    resamplePolyline([new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0)], 40),
  );
  penGeometry.setDrawRange(0, 0);
  const penStroke = new THREE.Line(penGeometry, penMaterial);
  penStroke.renderOrder = 17;
  penStroke.position.y = 0.3;
  actors.add(penStroke);

  // A dimension that genuinely measures the wall the agent keeps re-checking:
  // its end follows the partition, and its value is read off the geometry.
  const liveGroup = new THREE.Group();
  dimensions.add(liveGroup);

  const LIVE_SAMPLES = 64;
  const LIVE_ORIGIN = new THREE.Vector3(-5.87, 3.66, -2.6);
  const LIVE_END = -0.23;
  const liveMaterial = dimensionMaterial.clone();
  const liveGeometry = new THREE.BufferGeometry().setFromPoints(
    resamplePolyline([LIVE_ORIGIN, new THREE.Vector3(LIVE_END, LIVE_ORIGIN.y, LIVE_ORIGIN.z)], LIVE_SAMPLES),
  );
  liveGeometry.setDrawRange(0, 0);
  const liveLine = new THREE.Line(liveGeometry, liveMaterial);
  liveGroup.add(liveLine);

  const livePositions = liveGeometry.getAttribute("position") as THREE.BufferAttribute;
  const liveTickMaterial = dimensionMaterial.clone();
  const liveTicks = [LIVE_ORIGIN.x, LIVE_END].map((x) => {
    const tick = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x, LIVE_ORIGIN.y - 0.16, LIVE_ORIGIN.z),
        new THREE.Vector3(x, LIVE_ORIGIN.y + 0.3, LIVE_ORIGIN.z),
      ]),
      liveTickMaterial,
    );
    liveGroup.add(tick);
    return tick;
  });

  const liveLabel = makeLabel("5640", 0, 1.85);
  liveLabel.sprite.position.set((LIVE_ORIGIN.x + LIVE_END) / 2, LIVE_ORIGIN.y + 0.5, LIVE_ORIGIN.z);
  liveGroup.add(liveLabel.sprite);

  const liveDimension = {
    group: liveGroup,
    material: liveMaterial,
    tickMaterial: liveTickMaterial,
    label: liveLabel,
    origin: LIVE_ORIGIN,
    setProgress: (value: number) => {
      const drawn = Math.floor(clamp01(value) * LIVE_SAMPLES);
      liveGeometry.setDrawRange(0, drawn < 2 ? 0 : drawn);
    },
    setEnd: (x: number) => {
      for (let index = 0; index < LIVE_SAMPLES; index += 1) {
        const ratio = index / (LIVE_SAMPLES - 1);
        livePositions.setXYZ(index, LIVE_ORIGIN.x + (x - LIVE_ORIGIN.x) * ratio, LIVE_ORIGIN.y, LIVE_ORIGIN.z);
      }
      livePositions.needsUpdate = true;
      liveTicks[1].position.x = x - LIVE_END;
      liveLabel.sprite.position.x = (LIVE_ORIGIN.x + x) / 2;
    },
    read: (x: number) => String(Math.round(((x - LIVE_ORIGIN.x) * 1000) / 10) * 10),
    end: LIVE_END,
  };

  return {
    rig, site,
    parts, planLines, slabJoints, siteMarks, gridMaterial, groundShadow,
    dimensionSet, elevations, liveDimension,
    agent, agentMaterial, stemMaterial, reticle, scanMaterial, scanRing, checkMaterial, check, head,
    human, humanMaterial, nib, penMaterial, penGeometry, penStroke,
    partitions,
  };
}

const LAYER_ORDER: { key: LayerKey; label: string }[] = [
  { key: "plan", label: "Plan" },
  { key: "structure", label: "Structure" },
  { key: "envelope", label: "Envelope" },
  { key: "dimensions", label: "Dims" },
];

type Episode = {
  code: string;
  humanNote: string;
  agentNote: string;
  station: THREE.Vector3;
  path: THREE.Vector3[];
  pen: [THREE.Vector3, THREE.Vector3];
  targetTag: string;
  shift: number;
  values?: [string, string];
  scan: number;
};

const REST_STATION = new THREE.Vector3(4.4, 0.08, 5.25);

const EPISODES: Episode[] = [
  {
    code: "P-04",
    humanNote: "Partition moved",
    agentNote: "Alignment checked",
    station: new THREE.Vector3(0.55, 3.72, -1.4),
    path: [
      REST_STATION,
      new THREE.Vector3(5.2, 1.7, 4.7),
      new THREE.Vector3(3.4, 3.85, 0.9),
      new THREE.Vector3(0.55, 3.72, -1.4),
    ],
    pen: [new THREE.Vector3(0.55, 3.72, -3.0), new THREE.Vector3(0.55, 3.72, 0.3)],
    targetTag: "Partition P-04",
    shift: 0.18,
    values: ["4500", "4650"],
    scan: 1.9,
  },
  {
    code: "F-01",
    humanNote: "Opening extended",
    agentNote: "Daylight evaluated",
    station: new THREE.Vector3(-1.4, 0.36, 4.62),
    path: [REST_STATION, new THREE.Vector3(2.4, 0.36, 5.3), new THREE.Vector3(-1.4, 0.36, 4.62)],
    pen: [new THREE.Vector3(-5.4, 0.36, 4.62), new THREE.Vector3(1.6, 0.36, 4.62)],
    targetTag: "Glazed façade",
    shift: 0,
    scan: 3.1,
  },
  {
    code: "S-01",
    humanNote: "Stair set out",
    agentNote: "Circulation validated",
    station: new THREE.Vector3(-3.25, 3.74, 2.55),
    path: [
      REST_STATION,
      new THREE.Vector3(0.8, 0.36, 5.2),
      new THREE.Vector3(-2.0, 3.8, 3.4),
      new THREE.Vector3(-3.25, 3.74, 2.55),
    ],
    pen: [new THREE.Vector3(-4.15, 3.74, 2.28), new THREE.Vector3(-2.35, 3.74, 2.28)],
    targetTag: "Stair run",
    shift: 0,
    scan: 1.6,
  },
];

function pointOnPath(path: THREE.Vector3[], t: number, out: THREE.Vector3) {
  const span = 1 / (path.length - 1);
  const index = clamp(Math.floor(t / span), 0, path.length - 2);
  const local = clamp01((t - index * span) / span);
  return out.copy(path[index]).lerp(path[index + 1], easeInOut(local));
}

type HeroBuildingProps = {
  mode?: HeroMode;
  onSignal?: (signal: HeroSignal) => void;
};

export default function HeroBuilding({ mode = "idle", onSignal }: HeroBuildingProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const annotationRef = useRef<HTMLDivElement>(null);
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    plan: true,
    structure: true,
    envelope: true,
    dimensions: true,
  });

  const controls = useRef({
    mode,
    layers,
    pointer: { x: 0, y: 0 },
    hasPointer: false,
    drag: { x: 0, y: 0 },
    dragging: false,
    lastDrag: -999,
    rect: null as DOMRect | null,
    signal: onSignal,
  });

  // Kept out of the scene's own effect so the model is never torn down and rebuilt.
  useEffect(() => {
    controls.current.mode = mode;
    controls.current.layers = layers;
    controls.current.signal = onSignal;
  });

  const toggleLayer = useCallback((key: LayerKey) => {
    setLayers((current) => ({ ...current, [key]: !current[key] }));
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    const annotation = annotationRef.current;
    if (!mount) return;

    const reduceMotion =
      typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-9, 9, 7.5, -7.5, 0.1, 100);
    camera.position.set(16.5, 13.4, 18.5);
    camera.lookAt(0, 3.25, 0);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.setAttribute("aria-hidden", "true");
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xfffbf2, 0x8b928c, 2.15));
    const keyLight = new THREE.DirectionalLight(0xfff5df, 4.8);
    keyLight.position.set(-8, 18, 12);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.left = -14;
    keyLight.shadow.camera.right = 14;
    keyLight.shadow.camera.top = 14;
    keyLight.shadow.camera.bottom = -14;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 52;
    keyLight.shadow.bias = -0.0008;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xaec0b7, 1.35);
    fillLight.position.set(10, 8, -12);
    scene.add(fillLight);

    const model = buildModel();
    scene.add(model.rig);

    // The working plane that warms up when the studio door is opened.
    const workPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 15),
      new THREE.MeshBasicMaterial({ color: 0x5c7f6a, transparent: true, opacity: 0, depthWrite: false }),
    );
    workPlane.rotation.x = -Math.PI / 2;
    workPlane.position.y = -0.33;
    model.site.add(workPlane);

    const stageCounts = new Array(STAGES.length).fill(0);
    for (const part of model.parts) stageCounts[part.stage] = Math.max(stageCounts[part.stage], part.seq + 1);

    const stageProgress = (stage: number, seq: number, count: number, elapsed: number) => {
      const window = STAGES[stage];
      const stagger = (window.span * 0.52) / Math.max(1, count);
      return clamp01((elapsed - window.start - seq * stagger) / (window.span * 0.48));
    };

    const inspectable = model.parts.filter((part) => part.tag);
    const inspectMeshes = inspectable.map((part) => part.mesh);
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const projected = new THREE.Vector3();
    const agentPosition = new THREE.Vector3().copy(REST_STATION);
    const annotationTag = annotation?.querySelector("b") ?? null;
    const annotationSpec = annotation?.querySelector("span") ?? null;

    let elapsed = reduceMotion ? AMBIENT_START + CYCLE - 3 : 0;
    let sectionAmount = 0;
    let studioAmount = 0;
    let yaw = -0.1;
    let pitch = 0;
    let hoveredTag: string | null = null;
    let lastCode = "";
    let running = true;

    const publish = (
      actor: HeroSignal["actor"],
      code: string,
      note: string,
      value: string,
      progress: number,
      elevation: number,
    ) => {
      // Quantised so the page only re-renders when a reading actually moves.
      const stepped = Math.round(clamp01(elevation) * 40) / 40;
      const key = actor + code + note + value + stepped;
      if (key === lastCode) return;
      lastCode = key;
      controls.current.signal?.({ actor, code, note, value, progress, elevation: stepped });
    };

    let lastFrame = 0;

    const resize = () => {
      const { width, height } = mount.getBoundingClientRect();
      if (!width || !height) return;
      const aspect = width / height;
      // The drawing, its dimension set and its level marks span ~21.6 units across.
      // Fit that first, then hold a sensible floor and ceiling on the zoom.
      const vertical = clamp(21.6 / aspect, 15.4, 23.5);
      camera.left = (-vertical * aspect) / 2;
      camera.right = (vertical * aspect) / 2;
      camera.top = vertical / 2;
      camera.bottom = -vertical / 2;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };

    for (const part of model.parts) {
      for (const standard of part.standard) {
        standard.emissive.setHex(0x33513f);
        standard.emissiveIntensity = 0;
      }
    }

    model.penStroke.position.set(0, 0, 0);
    const penPositions = model.penGeometry.getAttribute("position") as THREE.BufferAttribute;
    const penSamples = penPositions.count;
    const scratch = new THREE.Vector3();
    const setPenStroke = (from: THREE.Vector3, to: THREE.Vector3) => {
      for (let index = 0; index < penSamples; index += 1) {
        scratch.copy(from).lerp(to, index / (penSamples - 1));
        penPositions.setXYZ(index, scratch.x, scratch.y, scratch.z);
      }
      penPositions.needsUpdate = true;
    };

    const movingPart = model.partitions[1];
    const liveDimension = model.liveDimension;
    let penEpisode = -1;
    let liveReading = "";
    let liveTone: "normal" | "active" = "normal";

    /** Captions for the entrance — one short line per stage, never a narration. */
    const ENTRY_NOTES = [
      "Site set out", "Plan drawn", "Slab cast", "Walls raised", "Openings set",
      "Datum placed", "Upper walls raised", "Envelope assembled", "Roof framed", "Dimensions taken",
    ];

    const render = (now: number) => {
      const delta = lastFrame ? Math.min((now - lastFrame) / 1000, 0.1) : 0;
      lastFrame = now;
      if (!reduceMotion) elapsed += delta;

      const state = controls.current;
      sectionAmount = damp(sectionAmount, state.mode === "section" ? 1 : 0, 2.4, delta);
      studioAmount = damp(studioAmount, state.mode === "studio" ? 1 : 0, 3, delta);

      const planOn = state.layers.plan ? 1 : 0;
      const dimensionOn = state.layers.dimensions ? 1 : 0;
      const structureOn = state.layers.structure ? 1 : 0.07;
      const envelopeOn = state.layers.envelope ? 1 : 0.06;
      const emphasis = Math.max(sectionAmount, studioAmount);

      // ── the site drawing ──────────────────────────────────────────────────
      const siteReveal = easeOut(stageProgress(0, 0, 1, elapsed));
      model.gridMaterial.opacity = (0.1 + studioAmount * 0.16) * siteReveal * planOn;
      (workPlane.material as THREE.MeshBasicMaterial).opacity = studioAmount * 0.055 * planOn;
      (model.groundShadow.material as THREE.ShadowMaterial).opacity = 0.17 * siteReveal;

      model.siteMarks.forEach((mark, index) => {
        const progress = easeOut(stageProgress(0, index, model.siteMarks.length, elapsed));
        mark.setProgress(progress);
        mark.material.opacity = (0.26 + studioAmount * 0.16) * progress * planOn;
      });

      // Plan lines lie back once the walls stand, and return when a layer is read.
      const settled = clamp01((elapsed - STAGES[3].start) / 1.8);
      const planStrength = 0.5 - 0.26 * settled * (1 - emphasis);
      model.planLines.forEach((line, index) => {
        const progress = easeOut(stageProgress(1, index, model.planLines.length, elapsed));
        line.setProgress(progress);
        line.material.opacity = planStrength * progress * planOn;
      });
      model.slabJoints.forEach((joint, index) => {
        const progress = easeOut(stageProgress(2, index, model.slabJoints.length, elapsed));
        joint.setProgress(progress);
        joint.material.opacity = 0.2 * progress * planOn;
      });

      // ── the building ──────────────────────────────────────────────────────
      let episode = EPISODES[0];
      let cycleTime = elapsed - STAGES[10].start;
      let repetition = 0;
      const entrance = elapsed < AMBIENT_START;
      if (!entrance) {
        const since = elapsed - AMBIENT_START;
        const index = Math.floor(since / CYCLE);
        episode = EPISODES[index % EPISODES.length];
        repetition = Math.floor(index / EPISODES.length);
        cycleTime = since % CYCLE;
      }

      let travel: number;
      let scanSweep: number;
      let scanAmount: number;
      let confirmAmount: number;
      let humanFade = 0;
      let penDraw = 0;
      let penFade = 0;
      let adjusting = false;

      let returning: number;

      if (entrance) {
        travel = easeInOut(clamp01(cycleTime / 1.2));
        scanSweep = clamp01((cycleTime - 1.2) / 1.1);
        scanAmount = pulse(cycleTime, 1.2, 0.4, 0.55, 0.55);
        confirmAmount = pulse(cycleTime, 2.5, 0.28, 0.4, 0.55);
        adjusting = cycleTime > 1.55;
        returning = clamp01((cycleTime - 2.95) / 0.55);
      } else {
        humanFade = pulse(cycleTime, 0.4, 0.9, 2.4, 0.9);
        penDraw = clamp01((cycleTime - 1.3) / 1.8);
        penFade = pulse(cycleTime, 1.3, 0.4, 2.2, 1.1);
        travel = easeInOut(clamp01((cycleTime - 3.4) / 2.2));
        scanSweep = clamp01((cycleTime - 5.6) / 1.8);
        scanAmount = pulse(cycleTime, 5.6, 0.7, 1.1, 0.7);
        confirmAmount = pulse(cycleTime, 7.7, 0.28, 0.45, 0.6);
        adjusting = cycleTime > 1.6 && cycleTime < 3.9;
        returning = clamp01((cycleTime - 9) / 1.9);
      }

      // The one element the pair keeps working on; its dimension follows it.
      if (episode.shift > 0 && adjusting) {
        const target = entrance ? episode.shift : repetition % 2 === 0 ? 0 : episode.shift;
        movingPart.offsetX = damp(movingPart.offsetX, target, 2.6, delta);
      }

      const activeTag = episode.targetTag;
      const activeAmount = Math.max(scanAmount, confirmAmount * 0.65);

      for (const part of model.parts) {
        const progress = easeOut(stageProgress(part.stage, part.seq, stageCounts[part.stage], elapsed));
        part.mesh.visible = progress > 0.002;
        if (!part.mesh.visible) continue;

        const lift = EXPLODE[part.level] * sectionAmount;
        if (part.rise) {
          const grow = Math.max(0.0015, progress);
          part.mesh.scale.y = grow;
          part.mesh.position.y = part.restY - part.height / 2 + (part.height * grow) / 2 + lift;
        } else {
          part.mesh.position.y = part.restY + (1 - progress) * 0.4 + lift;
        }
        part.mesh.position.x = part.restX + part.offsetX;

        const layerAmount = part.layer === "envelope" ? envelopeOn : structureOn;
        const sectionFade = 1 + (part.sectionOpacity - 1) * sectionAmount;
        const opacity = progress * layerAmount * sectionFade;
        for (const entry of part.materials) entry.material.opacity = entry.base * opacity;

        const wanted = clamp01(
          (part.tag && part.tag === hoveredTag ? 1 : 0) + (part.tag && part.tag === activeTag ? activeAmount : 0),
        );
        part.highlight = damp(part.highlight, wanted, 5, delta);
        for (const standard of part.standard) standard.emissiveIntensity = part.highlight * 0.9;
      }

      // ── dimensions and levels ─────────────────────────────────────────────
      const dimensionSlots = model.dimensionSet.length + model.elevations.length + 1;
      model.dimensionSet.forEach((dimension, index) => {
        const progress = easeOut(stageProgress(9, index, dimensionSlots, elapsed));
        const shown = progress * dimensionOn * (1 + (dimension.sectionFade - 1) * sectionAmount);
        for (const line of dimension.lines) line.setProgress(progress);
        for (const entry of dimension.materials) entry.material.opacity = entry.base * shown;
        for (const node of dimension.nodes) node.visible = shown > 0.35;
        dimension.label.material.opacity = clamp01((shown - 0.55) / 0.45);
      });

      model.elevations.forEach((elevation, index) => {
        const progress = easeOut(stageProgress(9, model.dimensionSet.length + index, dimensionSlots, elapsed));
        elevation.line.setProgress(progress);
        elevation.line.material.opacity = 0.6 * progress * dimensionOn;
        const lift = EXPLODE[elevation.level] * sectionAmount;
        elevation.line.line.position.y = lift;
        elevation.node.position.y = elevation.restY + lift;
        elevation.node.visible = progress > 0.4 && dimensionOn > 0;
        (elevation.node.material as THREE.Material).opacity = progress * dimensionOn;
      });

      const liveProgress = easeOut(stageProgress(9, dimensionSlots - 1, dimensionSlots, elapsed));
      const liveEnd = liveDimension.end + movingPart.offsetX;
      liveDimension.setProgress(liveProgress);
      liveDimension.setEnd(liveEnd);
      liveDimension.group.position.y = EXPLODE[1] * sectionAmount;
      liveDimension.material.opacity = 0.66 * liveProgress * dimensionOn;
      liveDimension.tickMaterial.opacity = 0.5 * liveProgress * dimensionOn;
      liveDimension.label.material.opacity = clamp01((liveProgress - 0.5) / 0.5) * dimensionOn;

      const reading = liveDimension.read(liveEnd);
      const tone: "normal" | "active" = scanAmount > 0.25 || confirmAmount > 0.25 ? "active" : "normal";
      if (reading !== liveReading || tone !== liveTone) {
        liveDimension.label.write(reading, tone);
        liveReading = reading;
        liveTone = tone;
      }

      // ── the human and the agent ───────────────────────────────────────────
      const agentVisible = elapsed > STAGES[10].start;
      model.agent.visible = agentVisible;
      if (agentVisible) {
        if (returning > 0) {
          agentPosition.copy(episode.station).lerp(REST_STATION, easeInOut(returning));
        } else {
          pointOnPath(episode.path, travel, agentPosition);
        }
        model.agent.position.copy(agentPosition);

        const presence = clamp01((elapsed - STAGES[10].start) / 0.7);
        model.agentMaterial.opacity = (0.72 + 0.25 * activeAmount) * presence;
        model.stemMaterial.opacity = (0.3 + 0.2 * activeAmount) * presence;
        (model.head.material as THREE.MeshBasicMaterial).opacity =
          (0.6 + 0.3 * Math.sin(elapsed * 1.5) * 0.5 + 0.25 * activeAmount) * presence;
        model.reticle.scale.setScalar(1 + scanAmount * 0.22);
        model.scanRing.scale.setScalar(0.34 + easeOut(scanSweep) * episode.scan);
        model.scanMaterial.opacity = 0.5 * scanAmount * (1 - scanSweep * 0.55);
        model.checkMaterial.opacity = confirmAmount;
        model.check.scale.setScalar(0.58 + confirmAmount * 0.16);
      }

      const humanVisible = humanFade > 0.01;
      model.human.visible = humanVisible;
      model.penStroke.visible = penFade > 0.01;
      if (humanVisible || model.penStroke.visible) {
        const episodeIndex = EPISODES.indexOf(episode);
        if (episodeIndex !== penEpisode) {
          setPenStroke(episode.pen[0], episode.pen[1]);
          penEpisode = episodeIndex;
        }
        model.human.position.copy(episode.pen[0]).lerp(episode.pen[1], penDraw);
        model.humanMaterial.opacity = 0.8 * humanFade;
        (model.nib.material as THREE.Material).opacity = 0.85 * humanFade;
        model.penMaterial.opacity = 0.66 * penFade;
        model.penGeometry.setDrawRange(0, Math.max(0, Math.floor(penDraw * penSamples)));
      }

      // ── the view ──────────────────────────────────────────────────────────
      if (!state.dragging && performance.now() - state.lastDrag > 4200) {
        state.drag.x = damp(state.drag.x, 0, 0.45, delta);
        state.drag.y = damp(state.drag.y, 0, 0.45, delta);
      }
      const drift = reduceMotion ? 0 : Math.sin(elapsed * 0.055) * 0.05;
      const restYaw = -0.1 + studioAmount * 0.09 - sectionAmount * 0.15;
      yaw = damp(yaw, restYaw + drift + state.pointer.x * 0.12 + state.drag.x, 2.6, delta);
      pitch = damp(
        pitch,
        (reduceMotion ? 0 : Math.sin(elapsed * 0.041) * 0.012) - state.pointer.y * 0.028 + state.drag.y + sectionAmount * 0.05,
        2.6,
        delta,
      );
      model.rig.rotation.y = yaw;
      model.rig.rotation.x = pitch;

      const sun = elapsed * 0.03;
      keyLight.position.set(-7 + Math.sin(sun) * 5.5, 17.5 + Math.sin(sun * 0.6) * 1.6, 11 + Math.cos(sun) * 4.5);
      keyLight.intensity = 4.5 + Math.sin(sun * 0.8) * 0.3 + studioAmount * 0.5;
      renderer.toneMappingExposure = 1.06 + studioAmount * 0.05;

      // ── inspection ────────────────────────────────────────────────────────
      let hovered: Part | null = null;
      if (state.hasPointer && !state.dragging && state.rect) {
        ndc.set(state.pointer.x, -state.pointer.y);
        raycaster.setFromCamera(ndc, camera);
        for (const hit of raycaster.intersectObjects(inspectMeshes, false)) {
          const part = hit.object.userData.part as Part;
          const readable = part.layer === "envelope" ? state.layers.envelope : state.layers.structure;
          if (!readable || !part.mesh.visible) continue;
          hovered = part;
          projected.copy(hit.point).project(camera);
          break;
        }
      }
      hoveredTag = hovered?.tag ?? null;
      if (annotation && annotationTag && annotationSpec) {
        if (hovered && state.rect) {
          const x = (projected.x * 0.5 + 0.5) * state.rect.width;
          const y = (-projected.y * 0.5 + 0.5) * state.rect.height;
          annotation.style.transform = "translate3d(" + x.toFixed(1) + "px, " + y.toFixed(1) + "px, 0)";
          annotation.dataset.flip = x > state.rect.width * 0.6 ? "true" : "false";
          if (annotationTag.textContent !== hovered.tag) {
            annotationTag.textContent = hovered.tag ?? "";
            annotationSpec.textContent = hovered.spec ?? "";
          }
          annotation.dataset.visible = "true";
        } else {
          annotation.dataset.visible = "false";
        }
      }

      // ── what the studio reports back to the page ──────────────────────────
      const progress = clamp01(elapsed / AMBIENT_START);
      const elevation = agentVisible
        ? agentPosition.y / MODEL_HEIGHT
        : (elapsed - STAGES[2].start) / (STAGES[8].start + STAGES[8].span - STAGES[2].start);
      if (entrance && elapsed < STAGES[10].start) {
        let stage = 0;
        for (let index = 0; index < ENTRY_NOTES.length; index += 1) {
          if (elapsed >= STAGES[index].start) stage = index;
        }
        publish("system", String(stage + 1).padStart(2, "0"), ENTRY_NOTES[stage], reading, progress, elevation);
      } else if (humanFade > 0.35) {
        publish("human", episode.code, episode.humanNote, reading, progress, elevation);
      } else if (scanAmount > 0.2) {
        publish("agent", episode.code, episode.agentNote, reading, progress, elevation);
      } else if (confirmAmount > 0.2) {
        publish("agent", episode.code, "Validated", reading, progress, elevation);
      } else if (travel > 0.02 && travel < 0.999) {
        publish("agent", episode.code, "Inspecting", reading, progress, elevation);
      } else {
        publish("system", "AM", "Model live", reading, progress, elevation);
      }

      renderer.render(scene, camera);
    };

    const measure = () => {
      resize();
      controls.current.rect = mount.getBoundingClientRect();
    };

    const start = () => {
      if (running) return;
      running = true;
      lastFrame = 0;
      renderer.setAnimationLoop(render);
    };
    const stop = () => {
      if (!running) return;
      running = false;
      renderer.setAnimationLoop(null);
    };

    const observer = new ResizeObserver(measure);
    observer.observe(mount);
    measure();
    renderer.setAnimationLoop(render);

    // The studio only runs while it is on screen and the tab is in front.
    const visibility = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !document.hidden) start();
        else stop();
      },
      { threshold: 0.04 },
    );
    visibility.observe(mount);

    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("scroll", measure, { passive: true });

    return () => {
      stop();
      observer.disconnect();
      visibility.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("scroll", measure);

      scene.traverse((object) => {
        const disposable = object as THREE.Mesh;
        disposable.geometry?.dispose();
        const materials = disposable.material
          ? Array.isArray(disposable.material)
            ? disposable.material
            : [disposable.material]
          : [];
        for (const material of materials) {
          const textured = material as THREE.SpriteMaterial;
          if (textured.map) textured.map.dispose();
          material.dispose();
        }
      });
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, []);

  const readPointer = (event: { clientX: number; clientY: number }) => {
    const state = controls.current;
    const rect = state.rect ?? mountRef.current?.getBoundingClientRect();
    if (!rect) return null;
    state.rect = rect;
    return {
      x: ((event.clientX - rect.left) / rect.width - 0.5) * 2,
      y: ((event.clientY - rect.top) / rect.height - 0.5) * 2,
    };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const next = readPointer(event);
    if (!next) return;
    const state = controls.current;
    if (state.dragging) {
      // Held on the presentation table: it turns, within limits, and stays put.
      state.drag.x = clamp(state.drag.x + (next.x - state.pointer.x) * 0.9, -0.52, 0.52);
      state.drag.y = clamp(state.drag.y + (next.y - state.pointer.y) * 0.2, -0.09, 0.12);
      state.lastDrag = performance.now();
    }
    state.pointer = next;
    state.hasPointer = true;
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if ((event.target as HTMLElement).closest("button")) return;
    const next = readPointer(event);
    if (next) controls.current.pointer = next;
    controls.current.dragging = true;
    controls.current.lastDrag = performance.now();
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    controls.current.dragging = false;
    controls.current.lastDrag = performance.now();
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const handlePointerLeave = () => {
    const state = controls.current;
    state.dragging = false;
    state.hasPointer = false;
    state.pointer = { x: 0, y: 0 };
  };

  return (
    <div
      className={styles.stage}
      data-mode={mode}
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={handlePointerLeave}
    >
      <div
        ref={mountRef}
        className={styles.viewport}
        role="img"
        aria-label="A two-storey concrete and timber house being assembled and measured in real time: the site grid is set out, the floor plan is drawn, walls rise, glazing and timber screens are fitted, dimensions are taken, and an agent marker inspects the model and confirms each result."
      />

      <div ref={annotationRef} className={styles.annotation} data-visible="false" data-flip="false" aria-hidden="true">
        <div className={styles.annotationBox}>
          <b />
          <span />
        </div>
      </div>

      <div className={styles.titleBlock}>
        <div className={styles.layerSet} role="group" aria-label="Model layers">
          <span aria-hidden="true">Layers</span>
          {LAYER_ORDER.map((layer) => (
            <button
              key={layer.key}
              type="button"
              className={styles.layerToggle}
              aria-pressed={layers[layer.key]}
              onClick={() => toggleLayer(layer.key)}
            >
              {layer.label}
            </button>
          ))}
        </div>
        <p className={styles.hint} aria-hidden="true">
          Drag to orbit · hover to inspect
        </p>
      </div>
    </div>
  );
}
