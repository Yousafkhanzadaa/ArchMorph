import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { exteriorFinishPresets, type ExteriorFinishId, type RoomType } from "./architecture.ts";
import type { PresentationVolume, SurfacePatch, Vec3 } from "./model-presentation.ts";

/** Small, deterministic, shared textures. UVs use feet, so materials never stretch with a room. */
export function createModelPalette(renderer: THREE.WebGLRenderer) {
  const textures = new Set<THREE.Texture>();
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  let seed = 4917;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const texture = (kind: string, periodX: number, periodY: number, bump = false) => {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = kind === "brick" ? "#c4b9aa" : "#e9e6df"; ctx.fillRect(0, 0, 256, 256);
    if (kind === "brick") {
      for (let row = 0; row < 4; row++) for (let column = -1; column < 4; column++) {
        const value = 0.9 + random() * 0.18;
        ctx.fillStyle = `rgb(${Math.round(159 * value)} ${Math.round(102 * value)} ${Math.round(83 * value)})`;
        ctx.fillRect(column * 85 + (row % 2) * 42.5 + 2, row * 64 + 2, 81, 60);
      }
    } else if (kind === "timber" || kind === "oak" || kind === "joinery") {
      ctx.fillStyle = kind === "oak" ? "#c8b69b" : "#9a7150"; ctx.fillRect(0, 0, 256, 256);
      const boards = kind === "oak" ? 4 : kind === "joinery" ? 1 : 6;
      for (let board = 0; board < boards; board++) {
        ctx.fillStyle = `rgba(${random() > 0.5 ? "255,242,214" : "67,45,29"},${0.035 + random() * 0.075})`;
        ctx.fillRect(board * 256 / boards, 0, 256 / boards, 256);
        ctx.fillStyle = "rgba(51,35,22,0.16)"; ctx.fillRect(board * 256 / boards, 0, 0.7, 256);
      }
      for (let i = 0; i < 280; i++) {
        const x = random() * 256;
        ctx.strokeStyle = `rgba(65,42,26,${0.025 + random() * 0.075})`; ctx.lineWidth = 0.4;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.bezierCurveTo(x + 4, 75, x - 3, 165, x, 256); ctx.stroke();
      }
    } else if (kind === "tile" || kind === "paving") {
      ctx.fillStyle = kind === "paving" ? "#bab6ac" : "#d8d5cd"; ctx.fillRect(0, 0, 256, 256);
      ctx.strokeStyle = kind === "paving" ? "#95958c" : "#bdbbb4"; ctx.lineWidth = kind === "paving" ? 1.7 : 1.1;
      for (const x of [0, 128, 256]) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke(); }
      for (const y of [0, 128, 256]) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke(); }
    } else if (kind === "metal") {
      ctx.fillStyle = "#eceeed"; ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = "#b6bcb9"; ctx.fillRect(0, 0, 2, 256);
      ctx.fillStyle = "#fafbf9"; ctx.fillRect(2, 0, 1, 256);
    } else if (kind === "concrete") {
      ctx.fillStyle = "#eceae5"; ctx.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 45; i++) {
        ctx.fillStyle = `rgba(80,77,71,${0.002 + random() * 0.006})`;
        ctx.beginPath(); ctx.arc(random() * 256, random() * 256, 2 + random() * 18, 0, Math.PI * 2); ctx.fill();
      }
    }
    // Fine grain is restrained enough to read as a surface, rather than visual noise.
    const image = ctx.getImageData(0, 0, 256, 256);
    for (let i = 0; i < image.data.length; i += 4) {
      const grain = (random() - 0.5) * (kind === "concrete" ? 17 : 8);
      for (let channel = 0; channel < 3; channel++) image.data[i + channel] += grain;
    }
    ctx.putImageData(image, 0, 0);
    const map = new THREE.CanvasTexture(canvas);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(1 / periodX, 1 / periodY);
    map.colorSpace = bump ? THREE.NoColorSpace : THREE.SRGBColorSpace;
    map.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    textures.add(map); return map;
  };
  const grain = texture("stucco", 1.5, 1.5, true);
  const concrete = texture("concrete", 4, 4);
  const finish = (id: ExteriorFinishId | "interior") => {
    const cached = materials.get(id); if (cached) return cached;
    const preset = id === "interior" ? { color: "#eeeae1", roughness: 0.88, metalness: 0 } : exteriorFinishPresets[id];
    const detailed = ["brick", "timber"].includes(id);
    const map = id === "brick" ? texture("brick", 2, 1) : id === "timber" ? texture("timber", 3, 8) : id === "metal" ? texture("metal", 3, 8) : id === "concrete" ? concrete : undefined;
    const material = new THREE.MeshStandardMaterial({ color: detailed ? "#ffffff" : preset.color, ...(map ? { map } : {}), bumpMap: grain, bumpScale: id === "concrete" ? 0.004 : 0.002, roughness: preset.roughness, metalness: preset.metalness, envMapIntensity: 0.55 });
    materials.set(id, material); return material;
  };
  const oak = texture("oak", 3, 10), tile = texture("tile", 4, 4);
  materials.set("floor-oak", new THREE.MeshStandardMaterial({ color: "#ffffff", map: oak, roughness: 0.68, bumpMap: grain, bumpScale: 0.006, envMapIntensity: 0.3 }));
  materials.set("floor-tile", new THREE.MeshStandardMaterial({ color: "#ffffff", map: tile, roughness: 0.76, bumpMap: grain, bumpScale: 0.009, envMapIntensity: 0.3 }));
  materials.set("roof", new THREE.MeshStandardMaterial({ color: "#d9d6cd", roughness: 0.94, bumpMap: grain, bumpScale: 0.018 }));
  materials.set("coping", new THREE.MeshStandardMaterial({ color: "#dedbd2", roughness: 0.75, bumpMap: grain, bumpScale: 0.008 }));
  materials.set("frame", new THREE.MeshStandardMaterial({ color: "#3d4541", roughness: 0.38, metalness: 0.65, envMapIntensity: 0.65 }));
  materials.set("door", new THREE.MeshStandardMaterial({ color: "#ffffff", map: texture("joinery", 3, 8), roughness: 0.65, bumpMap: grain, bumpScale: 0.007 }));
  materials.set("hardware", new THREE.MeshStandardMaterial({ color: "#858982", roughness: 0.3, metalness: 0.8 }));
  materials.set("site", new THREE.MeshStandardMaterial({ color: "#b9b6aa", roughness: 0.95, bumpMap: grain, bumpScale: 0.008 }));
  materials.set("paving", new THREE.MeshStandardMaterial({ color: "#ffffff", map: texture("paving", 6, 6), roughness: 0.88, bumpMap: grain, bumpScale: 0.008 }));
  materials.set("foliage", new THREE.MeshStandardMaterial({ color: "#607552", roughness: 0.95 }));
  materials.set("bark", new THREE.MeshStandardMaterial({ color: "#776957", roughness: 0.95 }));

  // A tiny baked daylight environment supplies reflections without external HDR files or live probes.
  const width = 256, height = 128, data = new Float32Array(width * height * 4);
  const sky = new THREE.Color("#9eb9cf"), horizon = new THREE.Color("#f2f0e8"), ground = new THREE.Color("#8b8c79");
  const color = new THREE.Color();
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const v = y / (height - 1);
    color.copy(v < 0.5 ? ground : horizon).lerp(v < 0.5 ? horizon : sky, v < 0.5 ? v * 2 : (v - 0.5) * 2);
    const horizonDetail = Math.exp(-(((v - 0.48) / 0.035) ** 2)) * (0.06 + 0.05 * Math.sin(x * 0.13) ** 2);
    color.multiplyScalar(1 - horizonDetail);
    const sun = 3 * Math.exp(-(((x / width - 0.143) ** 2 / 0.0018) + ((v - 0.77) ** 2 / 0.003)));
    const index = (y * width + x) * 4;
    data[index] = color.r + sun; data[index + 1] = color.g + sun * 0.94; data[index + 2] = color.b + sun * 0.82; data[index + 3] = 1;
  }
  const environment = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType);
  environment.mapping = THREE.EquirectangularReflectionMapping; environment.needsUpdate = true;
  const pmrem = new THREE.PMREMGenerator(renderer), target = pmrem.fromEquirectangular(environment);
  pmrem.dispose(); environment.dispose();
  return {
    finish,
    get: (id: string) => materials.get(id)!,
    floor: (type: RoomType) => type === "Garage" ? finish("concrete") : materials.get(["Bathroom", "Kitchen", "Courtyard", "Storage"].includes(type) ? "floor-tile" : "floor-oak")!,
    environment: target.texture,
    dispose: () => { for (const map of textures) map.dispose(); for (const material of materials.values()) material.dispose(); target.dispose(); },
  };
}

export function surfaceGeometry(patches: SurfacePatch[], detailed = false) {
  const positions: number[] = [], normals: number[] = [], ids: Array<string | undefined> = [];
  for (const patch of patches) {
    const a = patch.points[0], u = patch.points[1].map((value, axis) => value - a[axis]), v = patch.points[3].map((value, axis) => value - a[axis]);
    // Narrow perimeter bands localise vertex occlusion at junctions instead of
    // spreading a dark corner across an entire twelve-foot wall.
    const cuts = (length: number) => detailed && length > 1.4 ? [0, 0.35 / length, 1 - 0.35 / length, 1] : [0, 1];
    const us = cuts(Math.hypot(...u)), vs = cuts(Math.hypot(...v));
    const point = (s: number, t: number) => a.map((value, axis) => value + u[axis] * s + v[axis] * t);
    for (let i = 0; i < us.length - 1; i++) for (let j = 0; j < vs.length - 1; j++) {
      const corners = [point(us[i], vs[j]), point(us[i + 1], vs[j]), point(us[i + 1], vs[j + 1]), point(us[i], vs[j + 1])];
      for (const triangle of [[0, 1, 2], [0, 2, 3]]) {
        for (const index of triangle) { positions.push(...corners[index]); normals.push(...patch.normal); }
        ids.push(patch.elementId);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  return { geometry, ids };
}

function worldUVs(geometry: THREE.BufferGeometry, horizontalGrain = false) {
  const positions = geometry.getAttribute("position"), normals = geometry.getAttribute("normal"), uvs = new Float32Array(positions.count * 2);
  for (let i = 0; i < positions.count; i++) {
    const onFloor = Math.abs(normals.getY(i)) > 0.6;
    uvs[i * 2] = onFloor || Math.abs(normals.getZ(i)) > 0.6 ? positions.getX(i) : positions.getZ(i);
    uvs[i * 2 + 1] = onFloor ? positions.getZ(i) : positions.getY(i);
    if (horizontalGrain && !onFloor) [uvs[i * 2], uvs[i * 2 + 1]] = [uvs[i * 2 + 1], uvs[i * 2]];
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
}

/** Material batches carry a triangle-to-element map, keeping ray picking precise after merging. */
export function batchModelMeshes(scene: THREE.Scene, excluded: THREE.Object3D[], occlusion?: ReturnType<typeof contactOcclusion>) {
  const buckets = new Map<string, { material: THREE.Material; geometries: THREE.BufferGeometry[]; ids: Array<string | undefined>; cast: boolean; receive: boolean }>();
  const disposed = new Set<THREE.Material>();
  scene.updateMatrixWorld(true);
  for (const object of [...scene.children]) {
    if (!(object instanceof THREE.Mesh) || excluded.includes(object) || Array.isArray(object.material)) continue;
    const material = object.material as THREE.MeshStandardMaterial;
    const key = [material.type, material.color?.getHexString(), material.roughness, material.metalness, material.opacity, material.transparent, material.side, material.depthWrite, material.map?.uuid, material.bumpMap?.uuid, material.bumpScale, material.envMapIntensity, object.castShadow, object.receiveShadow].join(":");
    let bucket = buckets.get(key);
    if (!bucket) { bucket = { material, geometries: [], ids: [], cast: object.castShadow, receive: object.receiveShadow }; buckets.set(key, bucket); }
    else if (bucket.material !== material) disposed.add(material);
    let geometry = object.geometry.clone(); geometry.applyMatrix4(object.matrixWorld);
    if (geometry.index) { const indexed = geometry; geometry = indexed.toNonIndexed(); indexed.dispose(); }
    // Extrusions and boxes must share the same attribute layout before merging.
    for (const name of Object.keys(geometry.attributes)) if (name !== "position" && name !== "normal") geometry.deleteAttribute(name);
    worldUVs(geometry, object.userData.horizontalGrain === true);
    if (occlusion) {
      const positions = geometry.getAttribute("position"), normals = geometry.getAttribute("normal"), colors = new Float32Array(positions.count * 3);
      for (let i = 0; i < positions.count; i++) {
        const value = material.transparent || object.userData.siteContext ? 1 : occlusion(
          [positions.getX(i), positions.getY(i), positions.getZ(i)], [normals.getX(i), normals.getY(i), normals.getZ(i)],
        );
        colors.fill(value, i * 3, i * 3 + 3);
      }
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      material.vertexColors = true;
    }
    bucket.geometries.push(geometry);
    const count = geometry.getAttribute("position").count / 3;
    const triangleIds = object.userData.triangleElementIds as Array<string | undefined> | undefined;
    for (let i = 0; i < count; i++) bucket.ids.push(triangleIds?.[i] ?? object.userData.elementId);
    scene.remove(object); object.geometry.dispose();
  }
  const retained = new Set([...buckets.values()].map(bucket => bucket.material));
  for (const material of disposed) if (!retained.has(material)) material.dispose();
  const meshes: THREE.Mesh[] = [];
  for (const bucket of buckets.values()) {
    const geometry = mergeGeometries(bucket.geometries, false)!;
    for (const source of bucket.geometries) source.dispose();
    const mesh = new THREE.Mesh(geometry, bucket.material);
    mesh.castShadow = bucket.cast; mesh.receiveShadow = bucket.receive; mesh.userData.triangleElementIds = bucket.ids;
    scene.add(mesh); meshes.push(mesh);
  }
  return meshes;
}

/** Local, deterministic contact shading. A plan-grid lookup bounds the CPU work,
 * and the result is stored in vertices: no screen-space pass or idle render loop. */
export function contactOcclusion(volumes: PresentationVolume[]) {
  const cellSize = 4, grid = new Map<string, PresentationVolume[]>(), cache = new Map<string, number>();
  const probes = new Map<string, Array<{ x: number; y: number; z: number; weight: number }>>();
  for (const volume of volumes) {
    for (let x = Math.floor((volume.min[0] - 1) / cellSize); x <= Math.floor((volume.max[0] + 1) / cellSize); x++) {
      for (let y = Math.floor((volume.min[1] - 1) / cellSize); y <= Math.floor((volume.max[1] + 1) / cellSize); y++) for (let z = Math.floor((volume.min[2] - 1) / cellSize); z <= Math.floor((volume.max[2] + 1) / cellSize); z++) {
        const key = `${x}:${y}:${z}`, list = grid.get(key) ?? []; list.push(volume); grid.set(key, list);
      }
    }
  }
  return (point: Vec3, normal: Vec3) => {
    const key = [...point, ...normal].map(value => Math.round(value * 1000)).join(":");
    const cached = cache.get(key); if (cached !== undefined) return cached;
    const nearby = (grid.get(`${Math.floor(point[0] / cellSize)}:${Math.floor(point[1] / cellSize)}:${Math.floor(point[2] / cellSize)}`) ?? []).filter(volume => {
      for (let axis = 0; axis < 3; axis++) {
        if (volume.min[axis] > point[axis] + 0.7 || volume.max[axis] < point[axis] - 0.7) return false;
        // A flat face cannot occlude its own outward hemisphere.
        if (normal[axis] === 1 && volume.max[axis] <= point[axis] + 0.018) return false;
        if (normal[axis] === -1 && volume.min[axis] >= point[axis] - 0.018) return false;
      }
      return true;
    });
    if (!nearby.length) { cache.set(key, 1); return 1; }
    const normalKey = normal.map(value => Math.round(value * 1000)).join(":");
    let samples = probes.get(normalKey);
    if (!samples) {
      const n = new THREE.Vector3(...normal).normalize();
      const u = new THREE.Vector3(Math.abs(n.y) < 0.9 ? 0 : 1, Math.abs(n.y) < 0.9 ? 1 : 0, 0).cross(n).normalize();
      const v = n.clone().cross(u); samples = [];
      for (let ray = 0; ray < 8; ray++) {
        const angle = ray * Math.PI / 4;
        const direction = n.clone().multiplyScalar(0.5).addScaledVector(u, Math.cos(angle) * 0.866).addScaledVector(v, Math.sin(angle) * 0.866);
        for (const [distance, weight] of [[0.18, 0.65], [0.65, 0.35]]) samples.push({ x: normal[0] * 0.018 + direction.x * distance, y: normal[1] * 0.018 + direction.y * distance, z: normal[2] * 0.018 + direction.z * distance, weight: weight / 8 });
      }
      probes.set(normalKey, samples);
    }
    let blocked = 0;
    for (const sample of samples) {
      const x = point[0] + sample.x, y = point[1] + sample.y, z = point[2] + sample.z;
      for (const volume of nearby) {
        if (x > volume.min[0] + 0.001 && x < volume.max[0] - 0.001 && y > volume.min[1] + 0.001 && y < volume.max[1] - 0.001 && z > volume.min[2] + 0.001 && z < volume.max[2] - 0.001) { blocked += sample.weight; break; }
      }
    }
    const value = 1 - Math.min(0.26, blocked * 0.45);
    cache.set(key, value); return value;
  };
}

export function selectionGeometry(meshes: THREE.Mesh[], elementId?: string) {
  if (!elementId) return undefined;
  const points: number[] = [];
  for (const mesh of meshes) {
    const ids = mesh.userData.triangleElementIds as Array<string | undefined>, positions = mesh.geometry.getAttribute("position");
    ids.forEach((id, triangle) => { if (id === elementId) for (let vertex = triangle * 3; vertex < triangle * 3 + 3; vertex++) points.push(positions.getX(vertex), positions.getY(vertex), positions.getZ(vertex)); });
  }
  if (!points.length) return undefined;
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3)); geometry.computeVertexNormals(); return geometry;
}
