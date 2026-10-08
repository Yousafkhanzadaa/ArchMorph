"use client";

import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  exteriorFinishPresets,
  roomInteriorPoint,
  roomContainsPoint,
  roomVertices,
  stairConnection,
  stairEntryPoint,
  stairFootprint,
  stairLayout,
  stairLocalPoint,
  stairPlanOutline,
  stairPlanPoint,
  stairProgressAt,
  wallLength,
  type NavigationMode,
  type PlanPoint,
  type Project,
} from "@/lib/architecture";
import { buildSpatialModel, openingFrameFor, orientedSlopeFrame, resolveWalkPosition } from "@/lib/spatial3d";
import { buildFloorSlab, buildParapetSurfaces, buildRoofDeck, buildWallSurfaces, fitPerspectiveView, presentationBounds, type SurfacePatch } from "@/lib/model-presentation";
import { batchModelMeshes, createModelPalette, selectionGeometry, surfaceGeometry } from "@/lib/model-materials";

type ModelViewProps = {
  project: Project;
  navigationMode: NavigationMode;
  selectedId?: string;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  onSelect: (id?: string) => void;
  onWalkFloorChange: (floorId: string) => void;
};

type WalkPose = {
  key: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
};

type OrbitPose = {
  viewKey: string;
  position: [number, number, number];
  target: [number, number, number];
};

const WALK_EYE_HEIGHT = 5.4;
const WALK_BODY_HEIGHT = 6.4;
const WALK_RADIUS = 0.38;
const STAIR_LANDING_CLEARANCE = 0.75;
/** How close to an end of a flight counts as having arrived on that floor. */
const STAIR_ARRIVAL_PROGRESS = 0.06;
const STAIR_SOFFIT_OFFSET = 0.34;
const FLOOR_SLAB_THICKNESS = 0.18;

function meshBox(
  size: [number, number, number],
  position: [number, number, number],
  rotationY: number,
  material: THREE.Material | THREE.Material[],
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.rotation.y = rotationY;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function meshSlopeBox(
  width: number,
  thickness: number,
  start: THREE.Vector3,
  end: THREE.Vector3,
  material: THREE.Material | THREE.Material[],
) {
  const frame = orientedSlopeFrame(start, end);
  if (!frame) return undefined;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, thickness, frame.length), material);
  const basis = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(frame.xAxis.x, frame.xAxis.y, frame.xAxis.z),
    new THREE.Vector3(frame.yAxis.x, frame.yAxis.y, frame.yAxis.z),
    new THREE.Vector3(frame.zAxis.x, frame.zAxis.y, frame.zAxis.z),
  );
  mesh.position.set(frame.center.x, frame.center.y, frame.center.z);
  mesh.quaternion.setFromRotationMatrix(basis);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function planExtrusion(vertices: PlanPoint[], thickness: number, holes: PlanPoint[][] = []) {
  const shape = new THREE.Shape();
  vertices.forEach((point, index) => index ? shape.lineTo(point.x, point.y) : shape.moveTo(point.x, point.y));
  shape.closePath();
  holes.forEach((hole) => {
    const path = new THREE.Path();
    [...hole].reverse().forEach((point, index) => index ? path.lineTo(point.x, point.y) : path.moveTo(point.x, point.y));
    path.closePath();
    shape.holes.push(path);
  });
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  geometry.rotateX(Math.PI / 2);
  return geometry;
}

export default function ModelView({
  project,
  navigationMode,
  selectedId,
  canvasRef,
  onSelect,
  onWalkFloorChange,
}: ModelViewProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const walkPoseRef = useRef<WalkPose | undefined>(undefined);
  const orbitPoseRef = useRef<OrbitPose | undefined>(undefined);
  const minimapMarkerRef = useRef<SVGGElement | null>(null);
  const minimapRoomLabelRef = useRef<HTMLSpanElement | null>(null);
  const minimapRoomRefs = useRef(new Map<string, SVGPolygonElement>());
  const liveRef = useRef({ project, selectedId, onSelect, onWalkFloorChange });
  const selectionRef = useRef<((id?: string) => void) | undefined>(undefined);
  const renderedSceneKeyRef = useRef<string | undefined>(undefined);
  // History/read operations and selection do not invalidate GPU resources.
  const sceneKey = JSON.stringify([project.id, project.plot, project.floors, project.rooms, project.walls,
    project.openings, project.stairs, project.balconies, project.facadeFeatures, project.roof,
    project.siteBoundary, project.exteriorFinish, project.view, navigationMode]);
  useEffect(() => {
    liveRef.current = { project, selectedId, onSelect, onWalkFloorChange };
    const canvas = canvasRef.current;
    if (canvas && renderedSceneKeyRef.current === sceneKey) canvas.dataset.projectVersion = String(project.version);
  });
  useEffect(() => {
    const { project, selectedId } = liveRef.current;
    const onSelect = (id?: string) => liveRef.current.onSelect(id);
    const onWalkFloorChange = (id: string) => liveRef.current.onWalkFloorChange(id);
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const spatial = buildSpatialModel(project, { doorMode: navigationMode === "walk" ? "all-open" : "model" });
    const floorById = new Map(project.floors.map((floor) => [floor.id, floor]));
    const stairConnections = project.stairs.flatMap((stair) => {
      const connection = stairConnection(project, stair);
      return connection ? [connection] : [];
    });
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#e6e9e8");
    const modelBounds = presentationBounds(project);
    const modelSize = new THREE.Vector3().fromArray(modelBounds.max).sub(new THREE.Vector3().fromArray(modelBounds.min));
    const modelRadius = Math.max(12, modelSize.length() / 2);
    scene.fog = new THREE.Fog(scene.background, modelRadius * 12, modelRadius * 22);
    const camera = new THREE.PerspectiveCamera(navigationMode === "walk" ? 68 : 38, Math.max(1, host.clientWidth) / Math.max(1, host.clientHeight), 0.08, modelRadius * 25);
    camera.rotation.order = "YXZ";
    // A browser without WebGL (hardware acceleration off, a locked-down embedded view) must cost the
    // user the 3D view only. Letting this throw would take the whole studio down with it.
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: false });
    } catch {
      host.dataset.webglUnavailable = "true";
      return;
    }
    host.dataset.webglUnavailable = "false";
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = navigationMode === "walk" ? 1.12 : 1.02;
    const palette = createModelPalette(renderer);
    scene.environment = palette.environment;
    scene.environmentIntensity = 0.45;
    let frame = 0;
    let disposed = false;
    const requestRender = () => {
      if (!frame && !disposed && !document.hidden) frame = requestAnimationFrame(time => animate(time));
    };

    const controls = new OrbitControls(camera, canvas);
    controls.enabled = navigationMode === "orbit";
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.screenSpacePanning = true;
    controls.minDistance = 7;
    controls.maxDistance = modelRadius * 10;
    controls.maxPolarAngle = Math.PI / 2.02;

    const maxDimension = Math.max(project.plot.width, project.plot.length);
    const center = new THREE.Vector3().fromArray(modelBounds.min).add(new THREE.Vector3().fromArray(modelBounds.max)).multiplyScalar(0.5);
    const fitCamera = () => {
      const fit = fitPerspectiveView(presentationBounds(project, project.view.focusElementId), project.view.cameraPreset, camera.aspect, camera.fov);
      camera.position.fromArray(fit.position);
      controls.target.fromArray(fit.target);
      controls.maxDistance = Math.max(modelRadius * 10, fit.distance * 3);
      camera.lookAt(controls.target);
    };
    const orbitViewKey = `${project.view.cameraPreset}:${project.view.focusElementId ?? "project"}:${project.plot.width}x${project.plot.length}`;

    if (navigationMode === "orbit") {
      const storedPose = orbitPoseRef.current?.viewKey === orbitViewKey ? orbitPoseRef.current : undefined;
      if (storedPose) {
        camera.position.fromArray(storedPose.position);
        controls.target.fromArray(storedPose.target);
        camera.lookAt(controls.target);
      } else {
        fitCamera();
      }
    } else {
      const floor = project.floors.find((item) => item.id === project.view.activeFloorId) ?? project.floors[0];
      const startRoom = project.rooms.find((room) => room.id === project.view.walkStartRoomId && room.floorId === floor?.id)
        ?? project.rooms.find((room) => room.id === project.view.focusElementId && room.floorId === floor?.id)
        ?? project.rooms.find((room) => room.floorId === floor?.id);
      const poseKey = `${floor?.id ?? "floor"}:${project.view.walkStartRoomId ?? startRoom?.id ?? "site"}`;
      const storedPose = walkPoseRef.current?.key === poseKey ? walkPoseRef.current : undefined;
      const startCenter = startRoom ? roomInteriorPoint(startRoom) : undefined;
      const roomCenter = {
        x: startCenter?.x ?? project.plot.width / 2,
        z: startCenter?.y ?? project.plot.length / 2,
        yaw: 0,
      };
      const activeConnections = stairConnections.filter(
        (connection) => connection.lowerFloor.id === floor?.id || connection.upperFloor.id === floor?.id,
      );
      const landingCandidate = (connection: (typeof activeConnections)[number]) => {
        const atLowerLanding = connection.lowerFloor.id === floor?.id;
        const level = atLowerLanding ? "lower" : "upper";
        const landing = stairEntryPoint(connection.stair, level, STAIR_LANDING_CLEARANCE);
        const threshold = stairEntryPoint(connection.stair, level, 0);
        const lookX = threshold.x - landing.x;
        const lookZ = threshold.y - landing.y;
        return {
          x: landing.x,
          z: landing.y,
          yaw: Math.atan2(-lookX, -lookZ),
        };
      };
      const selectedConnection = activeConnections.find(({ stair }) => stair.id === selectedId);
      const candidates = [
        ...(selectedConnection ? [landingCandidate(selectedConnection)] : []),
        roomCenter,
        ...activeConnections.map(landingCandidate),
        ...(startRoom ? [
          { x: startRoom.x + WALK_RADIUS * 2, z: startRoom.y + WALK_RADIUS * 2, yaw: 0 },
          { x: startRoom.x + startRoom.width - WALK_RADIUS * 2, z: startRoom.y + WALK_RADIUS * 2, yaw: 0 },
          { x: startRoom.x + WALK_RADIUS * 2, z: startRoom.y + startRoom.length - WALK_RADIUS * 2, yaw: Math.PI },
          { x: startRoom.x + startRoom.width - WALK_RADIUS * 2, z: startRoom.y + startRoom.length - WALK_RADIUS * 2, yaw: Math.PI },
        ] : []),
      ];
      const safeStart = candidates.find((candidate) => {
        const insideRoom = !startRoom || roomContainsPoint(startRoom, { x: candidate.x, y: candidate.z });
        const clearOfStairs = !activeConnections.some(({ stair }) => {
          const footprint = stairFootprint(stair);
          return candidate.x >= footprint.x - WALK_RADIUS && candidate.x <= footprint.x + footprint.width + WALK_RADIUS
            && candidate.z >= footprint.y - WALK_RADIUS && candidate.z <= footprint.y + footprint.length + WALK_RADIUS;
        });
        return insideRoom && clearOfStairs;
      }) ?? roomCenter;
      camera.position.set(
        storedPose?.x ?? safeStart.x,
        storedPose?.y ?? ((floor?.elevation ?? 0) + WALK_EYE_HEIGHT),
        storedPose?.z ?? safeStart.z,
      );
      camera.rotation.set(storedPose?.pitch ?? 0, storedPose?.yaw ?? safeStart.yaw, 0);
    }

    const ambient = new THREE.HemisphereLight("#e2edff", "#b5a48e", navigationMode === "walk" ? 1.75 : 1.35);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight("#fff4df", 3);
    sun.position.copy(center).add(new THREE.Vector3(-0.8, 1.6, -1).multiplyScalar(modelRadius * 2));
    sun.target.position.copy(center);
    scene.add(sun.target);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -modelRadius * 1.15;
    sun.shadow.camera.right = modelRadius * 1.15;
    sun.shadow.camera.top = modelRadius * 1.15;
    sun.shadow.camera.bottom = -modelRadius * 1.15;
    sun.shadow.camera.near = modelRadius;
    sun.shadow.camera.far = modelRadius * 7;
    sun.shadow.bias = -0.00015;
    sun.shadow.normalBias = 0.035;
    sun.shadow.radius = 3.4;
    scene.add(sun);
    const fill = new THREE.DirectionalLight("#dceaff", navigationMode === "walk" ? 0.65 : 0.45);
    fill.position.copy(center).add(new THREE.Vector3(modelRadius, modelRadius, modelRadius));
    scene.add(fill);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(modelRadius * 50, modelRadius * 50),
      new THREE.MeshStandardMaterial({ color: "#cdd2cc", roughness: 0.95 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(project.plot.width / 2, -0.18, project.plot.length / 2);
    ground.receiveShadow = true;
    scene.add(ground);

    const plotSlab = new THREE.Mesh(
      new THREE.BoxGeometry(project.plot.width, 0.16, project.plot.length),
      palette.get("floor-tile"),
    );
    plotSlab.position.set(project.plot.width / 2, -0.06, project.plot.length / 2);
    plotSlab.receiveShadow = true;
    scene.add(plotSlab);

    const grid = new THREE.GridHelper(maxDimension + 30, Math.round(maxDimension + 30), "#aeb3ae", "#d0d3cf");
    grid.position.set(project.plot.width / 2, 0.035, project.plot.length / 2);
    const gridMaterial = grid.material as THREE.Material;
    gridMaterial.transparent = true;
    gridMaterial.opacity = navigationMode === "walk" ? 0.015 : 0.045;
    scene.add(grid);

    const boundary = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(project.plot.width, 0.05, project.plot.length)),
      new THREE.LineBasicMaterial({ color: "#8b9690", transparent: true, opacity: 0.5 }),
    );
    boundary.position.set(project.plot.width / 2, 0.08, project.plot.length / 2);
    scene.add(boundary);

    const selectable: THREE.Object3D[] = [];
    const finishMaterial = (finishId: keyof typeof exteriorFinishPresets) => palette.finish(finishId);
    const addSurfaces = (patches: SurfacePatch[], material: THREE.Material) => {
      if (!patches.length) return;
      const { geometry, ids } = surfaceGeometry(patches);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData.triangleElementIds = ids;
      mesh.castShadow = mesh.receiveShadow = true;
      scene.add(mesh);
    };
    const wallFinish = (wallIds: string[]) => {
      const wall = wallIds.map((id) => project.walls.find((item) => item.id === id)).find((item) => item?.exterior);
      return wall?.finish ?? project.exteriorFinish;
    };

    for (const room of project.rooms) addSurfaces(buildFloorSlab(project, room), palette.floor(room.type));
    for (const floor of project.floors) addSurfaces(buildRoofDeck(project, floor.id, spatial), palette.get("roof"));

    let wallPieceCount = spatial.wallVolumes.length;
    const wallSurfaces = buildWallSurfaces(project, spatial);
    const wallGroups = new Map<string, SurfacePatch[]>();
    for (const patch of wallSurfaces) {
      const key = patch.finish ?? "interior";
      const group = wallGroups.get(key) ?? [];
      group.push(patch); wallGroups.set(key, group);
    }
    for (const [finish, patches] of wallGroups) addSurfaces(patches, palette.finish(finish as keyof typeof exteriorFinishPresets | "interior"));
    for (const solid of spatial.wallSolids) {
      const floor = floorById.get(solid.floorId);
      const length = Math.hypot(solid.x2 - solid.x1, solid.z2 - solid.z1);
      if (!floor || !length) continue;
      const exterior = solid.wallIds.some((wallId) => project.walls.find((wall) => wall.id === wallId)?.exterior);
      const mesh = meshBox(
        [length, solid.top - solid.bottom, solid.thickness],
        [(solid.x1 + solid.x2) / 2, floor.elevation + (solid.bottom + solid.top) / 2, (solid.z1 + solid.z2) / 2],
        -Math.atan2(solid.z2 - solid.z1, solid.x2 - solid.x1),
        palette.finish(exterior ? wallFinish(solid.wallIds) : "interior"),
      );
      mesh.userData.elementId = solid.wallIds[0];
      mesh.userData.wallIds = solid.wallIds;
      selectable.push(mesh);
      scene.add(mesh);
      wallPieceCount += 1;
    }

    const parapets = buildParapetSurfaces(project);
    addSurfaces(parapets, finishMaterial(project.roof.finish));
    addSurfaces(buildParapetSurfaces(project, true), palette.get("coping"));
    const renderedParapetCount = project.roof.parapetEnabled ? parapets.length : 0;

    let renderedBoundaryPieceCount = 0;
    if (project.siteBoundary.enabled) {
      const setting = project.siteBoundary;
      const material = finishMaterial(setting.finish);
      const addBoundaryPiece = (size: [number, number, number], position: [number, number, number]) => {
        if (size[0] <= 0.05 || size[2] <= 0.05) return;
        scene.add(meshBox(size, position, 0, material));
        renderedBoundaryPieceCount += 1;
      };
      const halfHeight = setting.height / 2;
      const t = setting.thickness;
      if (setting.gate.enabled) {
        const gateStart = setting.gate.offset - setting.gate.width / 2;
        const gateEnd = setting.gate.offset + setting.gate.width / 2;
        addBoundaryPiece([gateStart, setting.height, t], [gateStart / 2, halfHeight, 0]);
        addBoundaryPiece([project.plot.width - gateEnd, setting.height, t], [(gateEnd + project.plot.width) / 2, halfHeight, 0]);
        const gateMaterial = finishMaterial("metal");
        if (setting.gate.style === "solid") {
          scene.add(meshBox([setting.gate.width, setting.gate.height, 0.22], [setting.gate.offset, setting.gate.height / 2, -0.03], 0, gateMaterial));
          renderedBoundaryPieceCount += 1;
        } else {
          const slatCount = Math.min(12, Math.max(4, Math.round(setting.gate.width / 0.75)));
          for (let index = 0; index < slatCount; index += 1) {
            const x = gateStart + (index + 0.5) * setting.gate.width / slatCount;
            scene.add(meshBox([0.16, setting.gate.height, 0.16], [x, setting.gate.height / 2, -0.03], 0, gateMaterial));
            renderedBoundaryPieceCount += 1;
          }
          for (const y of [0.35, setting.gate.height - 0.35]) {
            scene.add(meshBox([setting.gate.width, 0.16, 0.16], [setting.gate.offset, y, -0.03], 0, gateMaterial));
            renderedBoundaryPieceCount += 1;
          }
        }
      } else {
        addBoundaryPiece([project.plot.width, setting.height, t], [project.plot.width / 2, halfHeight, 0]);
      }
      addBoundaryPiece([project.plot.width, setting.height, t], [project.plot.width / 2, halfHeight, project.plot.length]);
      addBoundaryPiece([t, setting.height, project.plot.length], [0, halfHeight, project.plot.length / 2]);
      addBoundaryPiece([t, setting.height, project.plot.length], [project.plot.width, halfHeight, project.plot.length / 2]);
    }

    let renderedBalconyCount = 0;
    let renderedRailingPieceCount = 0;
    for (const balcony of project.balconies) {
      const floor = floorById.get(balcony.floorId);
      if (!floor) continue;
      const slabTop = floor.elevation + Math.max(FLOOR_SLAB_THICKNESS, balcony.slabThickness);
      const slab = meshBox(
        [balcony.width, balcony.slabThickness, balcony.length],
        [balcony.x + balcony.width / 2, floor.elevation + balcony.slabThickness / 2, balcony.y + balcony.length / 2],
        0,
        finishMaterial(balcony.finish),
      );
      slab.userData.elementId = balcony.id;
      selectable.push(slab);
      scene.add(slab);
      renderedBalconyCount += 1;
      if (!balcony.railing.enabled) continue;
      const railMaterial = palette.get("frame");
      const addRailPiece = (size: [number, number, number], position: [number, number, number]) => {
        const piece = meshBox(size, position, 0, railMaterial);
        piece.userData.elementId = balcony.id;
        selectable.push(piece);
        scene.add(piece);
        renderedRailingPieceCount += 1;
      };
      for (const side of balcony.railing.sides) {
        const alongX = side === "north" || side === "south";
        const span = alongX ? balcony.width : balcony.length;
        const fixed = side === "north" ? balcony.y : side === "south" ? balcony.y + balcony.length : side === "west" ? balcony.x : balcony.x + balcony.width;
        const center = alongX
          ? [balcony.x + balcony.width / 2, fixed] as const
          : [fixed, balcony.y + balcony.length / 2] as const;
        if (balcony.railing.style === "solid") {
          addRailPiece(
            alongX ? [span, balcony.railing.height, 0.12] : [0.12, balcony.railing.height, span],
            [center[0], slabTop + balcony.railing.height / 2, center[1]],
          );
          continue;
        }
        const levels = balcony.railing.style === "horizontal" ? [0.18, balcony.railing.height / 2, balcony.railing.height] : [balcony.railing.height];
        for (const level of levels) addRailPiece(
          alongX ? [span, 0.12, 0.12] : [0.12, 0.12, span],
          [center[0], slabTop + level, center[1]],
        );
        const postCount = Math.min(10, Math.max(2, Math.ceil(span / (balcony.railing.style === "vertical" ? 1 : 4)) + 1));
        for (let index = 0; index < postCount; index += 1) {
          const progress = postCount === 1 ? 0.5 : index / (postCount - 1);
          const x = alongX ? balcony.x + span * progress : center[0];
          const z = alongX ? center[1] : balcony.y + span * progress;
          addRailPiece([0.12, balcony.railing.height, 0.12], [x, slabTop + balcony.railing.height / 2, z]);
        }
      }
    }

    let renderedFacadeFeaturePieceCount = 0;
    for (const feature of project.facadeFeatures) {
      const wall = project.walls.find((item) => item.id === feature.wallId);
      const floor = wall ? floorById.get(wall.floorId) : undefined;
      if (!wall || !floor) continue;
      const length = wallLength(wall);
      if (!length) continue;
      const tx = (wall.x2 - wall.x1) / length;
      const tz = (wall.y2 - wall.y1) / length;
      const side = wall.roomSides[0]?.side;
      const normal = side === "north" ? { x: 0, z: -1 }
        : side === "south" ? { x: 0, z: 1 }
          : side === "east" ? { x: 1, z: 0 }
            : { x: -1, z: 0 };
      const anchor = { x: wall.x1 + tx * feature.offset, z: wall.y1 + tz * feature.offset };
      const rotation = -Math.atan2(wall.y2 - wall.y1, wall.x2 - wall.x1);
      const material = finishMaterial(feature.finish);
      const addFeaturePiece = (size: [number, number, number], y: number, projectionCenter: number, tangentCenter = 0) => {
        const piece = meshBox(
          size,
          [anchor.x + tx * tangentCenter + normal.x * projectionCenter, floor.elevation + y, anchor.z + tz * tangentCenter + normal.z * projectionCenter],
          rotation,
          material,
        );
        piece.userData.elementId = feature.id;
        selectable.push(piece);
        scene.add(piece);
        renderedFacadeFeaturePieceCount += 1;
      };
      if (feature.kind === "frame") {
        const centerProjection = feature.projection / 2 + wall.thickness / 2;
        addFeaturePiece([feature.width + feature.thickness * 2, feature.thickness, feature.projection], feature.elevation + feature.height, centerProjection);
        for (const tangentCenter of [-(feature.width + feature.thickness) / 2, (feature.width + feature.thickness) / 2]) {
          addFeaturePiece([feature.thickness, feature.height, feature.projection], feature.elevation + feature.height / 2, centerProjection, tangentCenter);
        }
      } else {
        addFeaturePiece([feature.width, feature.thickness, feature.projection], feature.elevation, feature.projection / 2 + wall.thickness / 2);
      }
    }

    let renderedDoorCount = 0;
    let renderedDoorPanelCount = 0;
    let renderedWindowCount = 0;
    for (const frame of spatial.openingFrames) {
      const { opening } = frame;
      const floor = floorById.get(opening.floorId);
      if (!floor) continue;
      const elevation = floor.elevation;
      const depth = Math.max(0.16, frame.wall.thickness * 0.55);
      const frameMaterial = palette.get(opening.kind === "door" ? "door" : "frame");

      if (opening.kind === "door") {
        renderedDoorCount += 1;
        const jambWidth = 0.16;
        const headerHeight = 0.17;
        for (const side of [-1, 1]) {
          const jamb = meshBox(
            [jambWidth, opening.height, depth],
            [
              frame.x + frame.dirX * side * (opening.width / 2 - jambWidth / 2),
              elevation + opening.height / 2,
              frame.z + frame.dirZ * side * (opening.width / 2 - jambWidth / 2),
            ],
            -frame.angle,
            frameMaterial,
          );
          jamb.userData.elementId = opening.id;
          selectable.push(jamb);
          scene.add(jamb);
        }
        const header = meshBox(
          [opening.width, headerHeight, depth],
          [frame.x, elevation + opening.height - headerHeight / 2, frame.z],
          -frame.angle,
          frameMaterial,
        );
        header.userData.elementId = opening.id;
        selectable.push(header);
        scene.add(header);
        const threshold = meshBox([opening.width - jambWidth * 2, 0.06, frame.wall.thickness + 0.12], [frame.x, elevation + FLOOR_SLAB_THICKNESS - 0.03, frame.z], -frame.angle, palette.get("coping"));
        threshold.userData.elementId = opening.id;
        scene.add(threshold);

        const hingeDirection = opening.hingeSide === "end" ? 1 : -1;
        const hingeX = frame.x + frame.dirX * hingeDirection * opening.width / 2;
        const hingeZ = frame.z + frame.dirZ * hingeDirection * opening.width / 2;
        const swingSign = (opening.swingDirection === "outward" ? 1 : -1) * (opening.handing === "right" ? -1 : 1);
        const isClosed = navigationMode !== "walk" && opening.state === "closed";
        const panel = meshBox(
          [Math.max(0.2, opening.width - 0.12), Math.max(0.2, opening.height - 0.12), 0.12],
          isClosed
            ? [frame.x, elevation + opening.height / 2, frame.z]
            : [hingeX + frame.normalX * swingSign * opening.width / 2, elevation + opening.height / 2, hingeZ + frame.normalZ * swingSign * opening.width / 2],
          isClosed ? -frame.angle : -(frame.angle + swingSign * Math.PI / 2),
          palette.get("door"),
        );
        panel.userData.elementId = opening.id;
        panel.userData.openAngle = isClosed ? 0 : 90 * swingSign;
        selectable.push(panel);
        scene.add(panel);
        const handle = meshBox([0.32, 0.055, 0.055], [0, 0, 0], 0, palette.get("hardware"));
        handle.position.set(opening.width * 0.32, -opening.height / 2 + 3.15, 0.11).applyAxisAngle(new THREE.Vector3(0, 1, 0), panel.rotation.y).add(panel.position);
        handle.rotation.y = panel.rotation.y;
        handle.userData.elementId = opening.id;
        scene.add(handle);
        renderedDoorPanelCount += 1;
      } else {
        renderedWindowCount += 1;
        const sill = opening.sillHeight ?? 0;
        const rail = 0.105;
        const centerY = elevation + sill + opening.height / 2;
        const visibleTransmittance = opening.visibleTransmittance ?? (opening.glazing === "privacy" ? 0.35 : 0.7);
        for (const side of [-1, 1]) {
          const jamb = meshBox(
            [rail, opening.height, depth],
            [
              frame.x + frame.dirX * side * (opening.width / 2 - rail / 2),
              centerY,
              frame.z + frame.dirZ * side * (opening.width / 2 - rail / 2),
            ],
            -frame.angle,
            frameMaterial,
          );
          jamb.userData.elementId = opening.id;
          selectable.push(jamb);
          scene.add(jamb);
        }
        for (const edge of [0, 1]) {
          const railMesh = meshBox(
            [opening.width, rail, depth],
            [frame.x, elevation + sill + edge * opening.height + (edge ? -rail / 2 : rail / 2), frame.z],
            -frame.angle,
            frameMaterial,
          );
          railMesh.userData.elementId = opening.id;
          selectable.push(railMesh);
          scene.add(railMesh);
        }
        const sillMesh = meshBox([opening.width + 0.12, 0.09, frame.wall.thickness + 0.22], [frame.x, elevation + sill - 0.045, frame.z], -frame.angle, palette.get("coping"));
        sillMesh.userData.elementId = opening.id;
        scene.add(sillMesh);
        const glass = meshBox(
          [Math.max(0.2, opening.width - 0.24), Math.max(0.2, opening.height - 0.24), 0.045],
          [frame.x, centerY, frame.z],
          -frame.angle,
          new THREE.MeshPhysicalMaterial({
            color: opening.glazing === "privacy" ? "#d1d9d6" : opening.glazing === "low-e" ? "#aec2b9" : "#c1d2d7",
            transparent: true,
            opacity: opening.glazing === "privacy" ? 0.72 : Math.max(0.22, 0.5 - visibleTransmittance * 0.3),
            // Environment reflections avoid the extra full-scene transmission pass.
            transmission: 0,
            envMapIntensity: 1.25,
            depthWrite: false,
            roughness: opening.glazing === "privacy" ? 0.48 : 0.12,
            metalness: 0.15,
            side: THREE.DoubleSide,
          }),
        );
        glass.castShadow = glass.receiveShadow = false;
        glass.userData.elementId = opening.id;
        glass.userData.visibleTransmittance = visibleTransmittance;
        glass.userData.solarHeatGainCoefficient = opening.solarHeatGainCoefficient;
        selectable.push(glass);
        scene.add(glass);
        if (opening.windowType === "sliding" || opening.windowType === "casement") {
          const mullion = meshBox(
            [rail, Math.max(0.2, opening.height - 0.2), depth + 0.02],
            [frame.x, centerY, frame.z],
            -frame.angle,
            frameMaterial,
          );
          mullion.userData.elementId = opening.id;
          selectable.push(mullion);
          scene.add(mullion);
        }
      }
    }

    let renderedStairFlightCount = 0;
    let renderedStairLandingCount = 0;
    for (const stair of project.stairs) {
      const floor = floorById.get(stair.floorId);
      if (!floor) continue;
      const connection = stairConnection(project, stair);
      if (navigationMode === "walk" && connection
        && connection.lowerFloor.id !== project.view.activeFloorId
        && connection.upperFloor.id !== project.view.activeFloorId) continue;
      const lowerElevation = connection?.lowerFloor.elevation ?? floor.elevation;
      const rise = connection?.rise ?? floor.height * 0.72;
      const layout = stairLayout(stair);
      const stairMaterial = palette.get("coping");
      const supportMaterial = palette.finish("concrete");
      const riserMaterial = palette.finish("interior");
      const treadThickness = 0.18;
      layout.flights.forEach((flight, flightIndex) => {
        renderedStairFlightCount += 1;
        const treadCount = connection?.treadsPerFlight[flightIndex] ?? Math.max(5, Math.round((connection?.treadCount ?? 10) / layout.flights.length));
        const flightRise = rise * (flight.progressEnd - flight.progressStart);
        const flightBase = lowerElevation + rise * flight.progressStart;
        const stepLength = flight.length / treadCount;
        const riserHeight = flightRise / (treadCount + 1);
        const supportOffset = Math.max(STAIR_SOFFIT_OFFSET, riserHeight + treadThickness);
        const start = stairPlanPoint(stair, flight.start.u, flight.start.v);
        const end = stairPlanPoint(stair, flight.end.u, flight.end.v);
        const flightYaw = Math.atan2(end.x - start.x, end.y - start.y);
        const localPointAt = (along: number, lateral = 0) => {
          const ratio = along / flight.length;
          const du = (flight.end.u - flight.start.u) / flight.length;
          const dv = (flight.end.v - flight.start.v) / flight.length;
          return {
            u: flight.start.u + (flight.end.u - flight.start.u) * ratio - dv * lateral,
            v: flight.start.v + (flight.end.v - flight.start.v) * ratio + du * lateral,
          };
        };
        for (let index = 0; index < treadCount; index += 1) {
          const treadElevation = flightBase + riserHeight * (index + 1);
          const localCenter = localPointAt(stepLength * (index + 0.5));
          const centerPoint = stairPlanPoint(stair, localCenter.u, localCenter.v);
          const step = meshBox(
            [flight.width, treadThickness, stepLength + 0.05],
            [centerPoint.x, treadElevation - treadThickness / 2, centerPoint.y],
            flightYaw,
            stairMaterial,
          );
          step.userData.elementId = stair.id;
          step.userData.stairProgress = flight.progressStart + (index + 1) / (treadCount + 1) * (flight.progressEnd - flight.progressStart);
          selectable.push(step);
          scene.add(step);
        }
        for (let index = 0; index <= treadCount; index += 1) {
          const localCenter = localPointAt(stepLength * index);
          const centerPoint = stairPlanPoint(stair, localCenter.u, localCenter.v);
          const riser = meshBox(
            [flight.width, riserHeight, 0.12],
            [centerPoint.x, flightBase + riserHeight * (index + 0.5), centerPoint.y],
            flightYaw,
            riserMaterial,
          );
          riser.userData.elementId = stair.id;
          selectable.push(riser);
          scene.add(riser);
        }

        const soffit = meshSlopeBox(
          Math.max(0.2, flight.width - 0.22),
          0.14,
          new THREE.Vector3(start.x, flightBase - supportOffset, start.y),
          new THREE.Vector3(end.x, flightBase + flightRise - supportOffset, end.y),
          supportMaterial,
        );
        if (soffit) {
          soffit.userData.elementId = stair.id;
          selectable.push(soffit);
          scene.add(soffit);
        }
        for (const side of [-flight.width / 2 + 0.18, flight.width / 2 - 0.18]) {
          const localStringerStart = localPointAt(0, side);
          const localStringerEnd = localPointAt(flight.length, side);
          const stringerStart = stairPlanPoint(stair, localStringerStart.u, localStringerStart.v);
          const stringerEnd = stairPlanPoint(stair, localStringerEnd.u, localStringerEnd.v);
          const stringer = meshSlopeBox(
            0.16,
            0.24,
            new THREE.Vector3(stringerStart.x, flightBase - supportOffset, stringerStart.y),
            new THREE.Vector3(stringerEnd.x, flightBase + flightRise - supportOffset, stringerEnd.y),
            supportMaterial,
          );
          if (stringer) {
            stringer.userData.elementId = stair.id;
            selectable.push(stringer);
            scene.add(stringer);
          }
          const rail = meshSlopeBox(0.09, 0.09,
            new THREE.Vector3(stringerStart.x, flightBase + 3, stringerStart.y),
            new THREE.Vector3(stringerEnd.x, flightBase + flightRise + 3, stringerEnd.y),
            palette.get("frame"));
          if (rail) { rail.userData.elementId = stair.id; scene.add(rail); }
          const postCount = Math.min(6, Math.max(2, Math.ceil(flight.length / 4) + 1));
          for (let index = 0; index < postCount; index++) {
            const fraction = index / (postCount - 1);
            const point = localPointAt(flight.length * fraction, side);
            const plan = stairPlanPoint(stair, point.u, point.v);
            const post = meshBox([0.07, 3, 0.07], [plan.x, flightBase + flightRise * fraction + 1.5, plan.y], flightYaw, palette.get("frame"));
            post.userData.elementId = stair.id; scene.add(post);
          }
        }
      });
      if (layout.landing) {
        renderedStairLandingCount += 1;
        const landingVertices = layout.landing.vertices.map((point) => stairPlanPoint(stair, point.u, point.v));
        const landing = new THREE.Mesh(planExtrusion(landingVertices, treadThickness), stairMaterial);
        landing.position.y = lowerElevation + rise * layout.landing.progress;
        landing.castShadow = true;
        landing.receiveShadow = true;
        landing.userData.elementId = stair.id;
        landing.userData.stairProgress = layout.landing.progress;
        selectable.push(landing);
        scene.add(landing);
      }
    }

    const batches = batchModelMeshes(scene, [ground]);
    selectable.splice(0, selectable.length, ...batches);
    const selectionMaterial = new THREE.MeshBasicMaterial({ color: "#d78954", transparent: true, opacity: 0.16, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const outlineMaterial = new THREE.LineBasicMaterial({ color: "#bf6335", transparent: true, opacity: 0.85 });
    let highlight: THREE.Mesh | undefined;
    let outline: THREE.LineSegments | undefined;
    const updateSelection = (id?: string) => {
      if (highlight) { scene.remove(highlight); highlight.geometry.dispose(); }
      if (outline) { scene.remove(outline); outline.geometry.dispose(); }
      highlight = undefined; outline = undefined;
      const geometry = selectionGeometry(batches, id);
      if (geometry && navigationMode === "orbit") {
        highlight = new THREE.Mesh(geometry, selectionMaterial);
        outline = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 25), outlineMaterial);
        scene.add(highlight, outline);
      } else geometry?.dispose();
      requestRender();
    };
    selectionRef.current = updateSelection;
    controls.addEventListener("change", requestRender);
    canvas.dataset.sceneGeneration = String(Number(canvas.dataset.sceneGeneration ?? 0) + 1);
    renderedSceneKeyRef.current = sceneKey;
    canvas.dataset.projectId = project.id;
    canvas.dataset.projectVersion = String(project.version);
    canvas.dataset.viewSignature = JSON.stringify(project.view);
    canvas.dataset.meshBatches = String(batches.length);
    canvas.dataset.wallSurfaceCount = String(wallSurfaces.length);
    canvas.dataset.navigationMode = navigationMode;
    canvas.dataset.wallPieceCount = String(wallPieceCount);
    canvas.dataset.doorCount = String(project.openings.filter((item) => item.kind === "door").length);
    canvas.dataset.renderedDoorCount = String(renderedDoorCount);
    canvas.dataset.renderedDoorPanelCount = String(renderedDoorPanelCount);
    canvas.dataset.windowCount = String(project.openings.filter((item) => item.kind === "window").length);
    canvas.dataset.renderedWindowCount = String(renderedWindowCount);
    canvas.dataset.stairFlightCount = String(renderedStairFlightCount);
    canvas.dataset.stairLandingCount = String(renderedStairLandingCount);
    canvas.dataset.collisionSegmentCount = String(spatial.collisionSegments.length);
    canvas.dataset.parapetPieceCount = String(renderedParapetCount);
    canvas.dataset.boundaryPieceCount = String(renderedBoundaryPieceCount);
    canvas.dataset.balconyCount = String(renderedBalconyCount);
    canvas.dataset.railingPieceCount = String(renderedRailingPieceCount);
    canvas.dataset.facadeFeaturePieceCount = String(renderedFacadeFeaturePieceCount);
    // PMREM generation uses this renderer too; request the building's shadow only after it exists.
    renderer.shadowMap.needsUpdate = true;

    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const heightPx = Math.max(1, host.clientHeight);
      renderer.setSize(width, heightPx, false);
      const nextAspect = width / heightPx;
      const aspectChanged = Math.abs(camera.aspect - nextAspect) > 0.001;
      camera.aspect = nextAspect;
      camera.updateProjectionMatrix();
      if (navigationMode === "orbit" && aspectChanged) fitCamera();
      requestRender();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let selectionPointerStart: { x: number; y: number } | undefined;
    let dragLook: { pointerId: number; x: number; y: number } | undefined;
    const updateLook = (movementX: number, movementY: number) => {
      yaw -= movementX * 0.0022;
      pitch = Math.max(-Math.PI * 0.46, Math.min(Math.PI * 0.46, pitch - movementY * 0.0022));
      camera.rotation.set(pitch, yaw, 0);
      requestRender();
    };
    const handleSelectionPointerDown = (event: PointerEvent) => {
      selectionPointerStart = event.button === 0 ? { x: event.clientX, y: event.clientY } : undefined;
      if (navigationMode === "walk" && event.button === 0) {
        canvas.focus();
        dragLook = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
        canvas.setPointerCapture(event.pointerId);
        host.dataset.dragLooking = "true";
      }
    };
    const handleSelectionPointerMove = (event: PointerEvent) => {
      if (navigationMode !== "walk" || document.pointerLockElement === canvas || dragLook?.pointerId !== event.pointerId) return;
      updateLook(event.clientX - dragLook.x, event.clientY - dragLook.y);
      dragLook = { ...dragLook, x: event.clientX, y: event.clientY };
    };
    const finishDragLook = (event: PointerEvent) => {
      if (dragLook?.pointerId !== event.pointerId) return;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      dragLook = undefined;
      host.dataset.dragLooking = "false";
    };
    const handleClick = (event: MouseEvent) => {
      if (navigationMode === "walk") {
        canvas.focus();
        const pointerTravel = selectionPointerStart
          ? Math.hypot(event.clientX - selectionPointerStart.x, event.clientY - selectionPointerStart.y)
          : 0;
        selectionPointerStart = undefined;
        if (pointerTravel <= 4) {
          const markPointerLockUnavailable = () => { host.dataset.pointerLockUnavailable = "true"; };
          try {
            Promise.resolve(canvas.requestPointerLock()).catch(markPointerLockUnavailable);
          } catch {
            markPointerLockUnavailable();
          }
        }
        return;
      }
      const pointerTravel = selectionPointerStart
        ? Math.hypot(event.clientX - selectionPointerStart.x, event.clientY - selectionPointerStart.y)
        : 0;
      selectionPointerStart = undefined;
      if (pointerTravel > 4) return;
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(selectable, false)[0];
      const pickedId = hit?.object.userData.triangleElementIds?.[hit.faceIndex ?? -1] ?? hit?.object.userData.elementId;
      canvas.dataset.pickedElementId = pickedId ?? "";
      onSelect(pickedId);
    };
    canvas.addEventListener("pointerdown", handleSelectionPointerDown);
    canvas.addEventListener("pointermove", handleSelectionPointerMove);
    canvas.addEventListener("pointerup", finishDragLook);
    canvas.addEventListener("pointercancel", finishDragLook);
    canvas.addEventListener("click", handleClick);

    const activeFloor = project.floors.find((floor) => floor.id === project.view.activeFloorId) ?? project.floors[0];
    const activeStairConnections = stairConnections.filter(
      (connection) => connection.lowerFloor.id === activeFloor?.id || connection.upperFloor.id === activeFloor?.id,
    );
    // A stair no longer erases every wall crossing its bounding box. Valid stair halls remain
    // navigable; walls that cut through a flight or landing stay real obstructions and validate as clashes.
    const activeCollisions = spatial.collisionSegments.filter((segment) => segment.floorId === project.view.activeFloorId);
    const pressed = new Set<string>();
    let yaw = camera.rotation.y;
    let pitch = camera.rotation.x;
    let transitionRequested = false;
    let activeStairId: string | undefined;

    const stairAt = (x: number, z: number) => activeStairConnections
      .filter(({ stair }) => stairProgressAt(stair, { x, y: z }) !== undefined)
      .sort((left, right) => {
        const leftProgress = stairProgressAt(left.stair, { x, y: z }) ?? 0;
        const rightProgress = stairProgressAt(right.stair, { x, y: z }) ?? 0;
        const leftEye = left.lowerFloor.elevation + leftProgress * left.rise + WALK_EYE_HEIGHT;
        const rightEye = right.lowerFloor.elevation + rightProgress * right.rise + WALK_EYE_HEIGHT;
        return Math.abs(camera.position.y - leftEye) - Math.abs(camera.position.y - rightEye);
      })[0];

    const stairProgress = (connection: (typeof activeStairConnections)[number], x: number, z: number) => stairProgressAt(connection.stair, { x, y: z }) ?? 0;

    const canWalkUnderStair = (connection: (typeof activeStairConnections)[number], x: number, z: number) => {
      if (activeFloor?.id !== connection.lowerFloor.id) return false;
      const supportOffset = Math.max(STAIR_SOFFIT_OFFSET, connection.riserHeight + FLOOR_SLAB_THICKNESS);
      const undersideClearance = stairProgress(connection, x, z) * connection.rise - supportOffset;
      return undersideClearance >= WALK_BODY_HEIGHT;
    };

    const poseKeyForFloor = (floorId: string) => `${floorId}:${project.view.walkStartRoomId ?? project.rooms.find((room) => room.floorId === floorId)?.id ?? "site"}`;

    const moveWalkCamera = (moveX: number, moveZ: number) => {
      const distance = Math.hypot(moveX, moveZ);
      const steps = Math.max(1, Math.ceil(distance / 0.1));
      for (let step = 0; step < steps; step += 1) {
        const previousX = camera.position.x;
        const previousZ = camera.position.z;
        let x = camera.position.x + moveX / steps;
        let z = camera.position.z + moveZ / steps;
        const resolved = resolveWalkPosition(x, z, WALK_RADIUS, activeCollisions);
        x = Math.max(WALK_RADIUS, Math.min(project.plot.width - WALK_RADIUS, resolved.x));
        z = Math.max(WALK_RADIUS, Math.min(project.plot.length - WALK_RADIUS, resolved.z));
        const previousStair = stairAt(previousX, previousZ);
        const nextStair = stairAt(x, z);
        const activeFloorEye = (activeFloor?.elevation ?? 0) + WALK_EYE_HEIGHT;

        if (activeStairId) {
          if (!nextStair || nextStair.stair.id !== activeStairId) {
            // A stair has to be leavable at either end. Blocking every off-stair step traps the
            // walker on the top tread: the flight ends, the next step is off the flight, and the
            // move is discarded. Stepping off at an end arrives on that end's floor.
            const finished = previousStair?.stair.id === activeStairId ? previousStair : undefined;
            const leaving = finished ? stairProgress(finished, previousX, previousZ) : undefined;
            if (leaving === undefined || (leaving > STAIR_ARRIVAL_PROGRESS && leaving < 1 - STAIR_ARRIVAL_PROGRESS)) continue;
            const arrivalFloor = leaving >= 1 - STAIR_ARRIVAL_PROGRESS ? finished!.upperFloor : finished!.lowerFloor;
            activeStairId = undefined;
            camera.position.x = x;
            camera.position.z = z;
            camera.position.y = arrivalFloor.elevation + WALK_EYE_HEIGHT;
            if (activeFloor?.id !== arrivalFloor.id && !transitionRequested) {
              transitionRequested = true;
              walkPoseRef.current = {
                key: poseKeyForFloor(arrivalFloor.id),
                x, y: arrivalFloor.elevation + WALK_EYE_HEIGHT, z, yaw, pitch,
              };
              onWalkFloorChange(arrivalFloor.id);
            }
            continue;
          }
        } else if (nextStair) {
          const enteringDifferentStair = previousStair?.stair.id !== nextStair.stair.id;
          const previousLocal = stairLocalPoint(nextStair.stair, { x: previousX, y: previousZ });
          const layout = stairLayout(nextStair.stair);
          const enteredThrough = (entry: typeof layout.lowerEntry) => {
            const deltaU = previousLocal.u - entry.u;
            const deltaV = previousLocal.v - entry.v;
            const outwardDistance = deltaU * entry.outwardU + deltaV * entry.outwardV;
            const lateralDistance = -deltaU * entry.outwardV + deltaV * entry.outwardU;
            return enteringDifferentStair && outwardDistance >= -0.05 && Math.abs(lateralDistance) <= nextStair.stair.width / 2 + 0.05;
          };
          const enteredFromLowerLanding = enteredThrough(layout.lowerEntry);
          const enteredFromUpperLanding = enteredThrough(layout.upperEntry);
          const shouldClimb = activeFloor?.id === nextStair.lowerFloor.id && enteredFromLowerLanding;
          const shouldDescend = activeFloor?.id === nextStair.upperFloor.id && enteredFromUpperLanding;
          if (shouldClimb || shouldDescend) {
            activeStairId = nextStair.stair.id;
          } else if (!canWalkUnderStair(nextStair, x, z)) {
            continue;
          }
        }

        camera.position.x = x;
        camera.position.z = z;
        if (!nextStair || activeStairId !== nextStair.stair.id) {
          camera.position.y = activeFloorEye;
          continue;
        }

        const progress = stairProgress(nextStair, x, z);
        camera.position.y = nextStair.lowerFloor.elevation + progress * nextStair.rise + WALK_EYE_HEIGHT;
        const targetFloorId = activeFloor?.id === nextStair.lowerFloor.id && progress >= 1 - STAIR_ARRIVAL_PROGRESS
          ? nextStair.upperFloor.id
          : activeFloor?.id === nextStair.upperFloor.id && progress <= STAIR_ARRIVAL_PROGRESS
            ? nextStair.lowerFloor.id
            : undefined;
        if (targetFloorId && !transitionRequested) {
          transitionRequested = true;
          const targetFloor = floorById.get(targetFloorId);
          const ascending = targetFloorId === nextStair.upperFloor.id;
          const landing = stairEntryPoint(nextStair.stair, ascending ? "upper" : "lower", STAIR_LANDING_CLEARANCE);
          walkPoseRef.current = {
            key: poseKeyForFloor(targetFloorId),
            x: landing.x,
            y: (targetFloor?.elevation ?? camera.position.y - WALK_EYE_HEIGHT) + WALK_EYE_HEIGHT,
            z: landing.y,
            yaw,
            pitch,
          };
          onWalkFloorChange(targetFloorId);
        }
      }
    };

    const directionForKey = (code: string) => {
      const forwardX = -Math.sin(yaw);
      const forwardZ = -Math.cos(yaw);
      const rightX = Math.cos(yaw);
      const rightZ = -Math.sin(yaw);
      if (code === "KeyW" || code === "ArrowUp") return { x: forwardX, z: forwardZ };
      if (code === "KeyS" || code === "ArrowDown") return { x: -forwardX, z: -forwardZ };
      if (code === "KeyA" || code === "ArrowLeft") return { x: -rightX, z: -rightZ };
      if (code === "KeyD" || code === "ArrowRight") return { x: rightX, z: rightZ };
      return undefined;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (navigationMode !== "walk") return;
      const direction = directionForKey(event.code);
      if (!direction && event.code !== "ShiftLeft" && event.code !== "ShiftRight") return;
      event.preventDefault();
      pressed.add(event.code);
      if (direction && !event.repeat) moveWalkCamera(direction.x * 0.25, direction.z * 0.25);
      requestRender();
    };
    const handleKeyUp = (event: KeyboardEvent) => pressed.delete(event.code);
    const handleMouseMove = (event: MouseEvent) => {
      if (navigationMode !== "walk" || document.pointerLockElement !== canvas) return;
      updateLook(event.movementX, event.movementY);
    };
    const updatePointerState = () => {
      host.dataset.pointerLocked = String(document.pointerLockElement === canvas);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("pointerlockchange", updatePointerState);

    let previousTime = performance.now();
    let renderCount = 0;
    const renderScene = () => {
      renderer.render(scene, camera);
      canvas.dataset.drawCalls = String(renderer.info.render.calls);
      canvas.dataset.triangles = String(renderer.info.render.triangles);
      canvas.dataset.textureCount = String(renderer.info.memory.textures);
      canvas.dataset.renderCount = String(++renderCount);
    };
    const animate = (time = performance.now()) => {
      frame = 0;
      const delta = Math.min(0.05, Math.max(0, (time - previousTime) / 1000));
      previousTime = time;
      if (navigationMode === "orbit") {
        if (controls.update()) requestRender();
      }
      else {
        let moveX = 0;
        let moveZ = 0;
        for (const code of pressed) {
          const direction = directionForKey(code);
          if (direction) {
            moveX += direction.x;
            moveZ += direction.z;
          }
        }
        const magnitude = Math.hypot(moveX, moveZ);
        if (magnitude) {
          const fast = pressed.has("ShiftLeft") || pressed.has("ShiftRight");
          const speed = fast ? 8 : 5;
          moveWalkCamera((moveX / magnitude) * speed * delta, (moveZ / magnitude) * speed * delta);
          requestRender();
        }
        camera.rotation.set(pitch, yaw, 0);
        if (!transitionRequested) {
          walkPoseRef.current = {
            key: poseKeyForFloor(project.view.activeFloorId),
            x: camera.position.x,
            y: camera.position.y,
            z: camera.position.z,
            yaw,
            pitch,
          };
        }
      }
      canvas.dataset.cameraX = camera.position.x.toFixed(2);
      canvas.dataset.cameraY = camera.position.y.toFixed(2);
      canvas.dataset.cameraZ = camera.position.z.toFixed(2);
      canvas.dataset.cameraYaw = yaw.toFixed(3);
      canvas.dataset.cameraPitch = pitch.toFixed(3);
      if (navigationMode === "walk") {
        const marker = minimapMarkerRef.current;
        if (marker) {
          marker.setAttribute(
            "transform",
            `translate(${camera.position.x} ${camera.position.z}) rotate(${THREE.MathUtils.radToDeg(-yaw)})`,
          );
        }
        const currentRoom = project.rooms.find((room) =>
          room.floorId === project.view.activeFloorId
          && roomContainsPoint(room, { x: camera.position.x, y: camera.position.z }),
        );
        const roomLabel = minimapRoomLabelRef.current;
        const nextLabel = currentRoom?.name ?? "Outside rooms";
        if (roomLabel && roomLabel.textContent !== nextLabel) roomLabel.textContent = nextLabel;
        minimapRoomRefs.current.forEach((element, roomId) => {
          element.classList.toggle("is-current", roomId === currentRoom?.id);
        });
      }
      renderScene();
    };
    const clearMovement = () => pressed.clear();
    const visibilityChanged = () => {
      if (document.hidden) { cancelAnimationFrame(frame); frame = 0; clearMovement(); }
      else { previousTime = performance.now(); requestRender(); }
    };
    const reframe = (event: Event) => {
      if (navigationMode !== "orbit") return;
      const view = (event as CustomEvent<Project["view"]>).detail ?? project.view;
      const fit = fitPerspectiveView(presentationBounds(project, view.focusElementId), view.cameraPreset, camera.aspect, camera.fov);
      // Clear any remaining damping before assigning the requested architectural view.
      const damping = controls.enableDamping;
      controls.enableDamping = false;
      controls.reset();
      camera.position.fromArray(fit.position); controls.target.fromArray(fit.target);
      camera.lookAt(controls.target); controls.update(); controls.enableDamping = damping; requestRender();
    };
    canvas.addEventListener("archmorph:snapshot", renderScene);
    canvas.addEventListener("archmorph:frame-view", reframe);
    document.addEventListener("visibilitychange", visibilityChanged);
    window.addEventListener("blur", clearMovement);
    requestRender();

    return () => {
      if (navigationMode === "orbit") {
        orbitPoseRef.current = {
          viewKey: orbitViewKey,
          position: camera.position.toArray() as [number, number, number],
          target: controls.target.toArray() as [number, number, number],
        };
      }
      disposed = true;
      selectionRef.current = undefined;
      renderedSceneKeyRef.current = undefined;
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener("pointerdown", handleSelectionPointerDown);
      canvas.removeEventListener("pointermove", handleSelectionPointerMove);
      canvas.removeEventListener("pointerup", finishDragLook);
      canvas.removeEventListener("pointercancel", finishDragLook);
      canvas.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("pointerlockchange", updatePointerState);
      canvas.removeEventListener("archmorph:snapshot", renderScene);
      canvas.removeEventListener("archmorph:frame-view", reframe);
      document.removeEventListener("visibilitychange", visibilityChanged);
      window.removeEventListener("blur", clearMovement);
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      controls.dispose();
      selectionMaterial.dispose(); outlineMaterial.dispose();
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          materials.forEach((material) => material.dispose());
        }
      });
      sun.shadow.dispose();
      palette.dispose();
      renderer.dispose();
    };
  }, [canvasRef, navigationMode, sceneKey]);
  useEffect(() => { selectionRef.current?.(selectedId); }, [selectedId, sceneKey]);

  const doors = project.openings.filter((item) => item.kind === "door").length;
  const windows = project.openings.filter((item) => item.kind === "window").length;
  const stairs = project.stairs.length;
  const activeFloor = project.floors.find((floor) => floor.id === project.view.activeFloorId) ?? project.floors[0];
  const minimapRooms = project.rooms.filter((room) => room.floorId === activeFloor?.id);
  const minimapWalls = project.walls.filter((wall) => wall.floorId === activeFloor?.id);
  const minimapOpeningFrames = project.openings
    .filter((opening) => opening.floorId === activeFloor?.id)
    .flatMap((opening) => {
      const frame = openingFrameFor(project, opening);
      return frame ? [frame] : [];
    });
  const minimapStairs = project.stairs.filter((stair) => {
    const connection = stairConnection(project, stair);
    return stair.floorId === activeFloor?.id || connection?.targetFloor.id === activeFloor?.id;
  });
  const markerSize = Math.max(project.plot.width, project.plot.length) / 45;
  const activeFloorIndex = project.floors.findIndex((floor) => floor.id === activeFloor?.id);
  const minimapWallMaskId = "walk-minimap-wall-mask";

  return (
    <div className={`model-view is-${navigationMode}`} ref={hostRef}>
      <canvas
        ref={canvasRef}
        tabIndex={0}
        aria-label={`${navigationMode === "walk" ? "Walkthrough" : "Interactive 3D model"} of ${project.name}`}
        aria-describedby="model-navigation-help model-sync-status"
      />
      <div className="model-view__gl-error" role="alert">
        <span>3D UNAVAILABLE</span>
        <strong>This browser could not start WebGL.</strong>
        <p>Turn on hardware acceleration, or open ArchMorph in a browser that supports WebGL.</p>
        <p>The floor plan, editing, checks, history, and export all keep working — switch back to Floor plan to carry on.</p>
      </div>
      {!project.rooms.length && (
        <div className="model-view__empty">
          <span>MODEL SPACE</span>
          <strong>The building will rise here.</strong>
          <p>Add rooms in the floor plan to generate the shared 3D model.</p>
        </div>
      )}
      {navigationMode === "walk" ? (
        <>
          <aside className="walk-minimap" aria-label={`Current position on ${activeFloor?.name ?? "active floor"}`}>
            <div className="walk-minimap__heading">
              <b>{activeFloor?.name ?? "Active floor"} · {Math.max(1, activeFloorIndex + 1)} of {project.floors.length}</b>
              <span ref={minimapRoomLabelRef}>{minimapRooms[0]?.name ?? "Outside rooms"}</span>
            </div>
            <svg
              viewBox={`0 0 ${project.plot.width} ${project.plot.length}`}
              role="img"
              aria-label={`Mini floor plan of ${activeFloor?.name ?? "the active floor"}`}
              preserveAspectRatio="xMidYMid meet"
            >
              <defs>
                <mask
                  id={minimapWallMaskId}
                  maskUnits="userSpaceOnUse"
                  x="0"
                  y="0"
                  width={project.plot.width}
                  height={project.plot.length}
                >
                  <rect x="0" y="0" width={project.plot.width} height={project.plot.length} fill="white" />
                  {minimapOpeningFrames.map((frame) => (
                    <line
                      key={`mask-${frame.opening.id}`}
                      x1={frame.x - frame.dirX * frame.opening.width / 2}
                      y1={frame.z - frame.dirZ * frame.opening.width / 2}
                      x2={frame.x + frame.dirX * frame.opening.width / 2}
                      y2={frame.z + frame.dirZ * frame.opening.width / 2}
                      stroke="black"
                      strokeWidth={Math.max(0.5, frame.wall.thickness + 0.28)}
                      strokeLinecap="butt"
                    />
                  ))}
                </mask>
              </defs>
              <rect className="walk-minimap__plot" x="0" y="0" width={project.plot.width} height={project.plot.length} />
              {minimapRooms.map((room) => (
                <polygon
                  key={room.id}
                  ref={(element) => {
                    if (element) minimapRoomRefs.current.set(room.id, element);
                    else minimapRoomRefs.current.delete(room.id);
                  }}
                  className="walk-minimap__room"
                  points={roomVertices(room).map((point) => `${point.x},${point.y}`).join(" ")}
                  fill={room.color}
                />
              ))}
              <g mask={`url(#${minimapWallMaskId})`}>
                {minimapWalls.map((wall) => (
                  <line
                    key={wall.id}
                    className="walk-minimap__wall"
                    x1={wall.x1}
                    y1={wall.y1}
                    x2={wall.x2}
                    y2={wall.y2}
                    strokeWidth={Math.max(0.35, wall.thickness)}
                  />
                ))}
              </g>
              {minimapOpeningFrames.map((frame) => {
                const { opening } = frame;
                const angle = THREE.MathUtils.radToDeg(frame.angle);
                if (opening.kind === "window") {
                  return (
                    <g key={opening.id} className="walk-minimap__opening walk-minimap__window" transform={`translate(${frame.x} ${frame.z}) rotate(${angle})`}>
                      <line x1={-opening.width / 2} y1="-0.13" x2={opening.width / 2} y2="-0.13" />
                      <line x1={-opening.width / 2} y1="0.13" x2={opening.width / 2} y2="0.13" />
                    </g>
                  );
                }
                const hingeX = opening.hingeSide === "end" ? opening.width / 2 : -opening.width / 2;
                const closedEndX = -hingeX;
                const swingSign = (opening.swingDirection === "outward" ? 1 : -1) * (opening.handing === "right" ? -1 : 1);
                const openEndY = swingSign * opening.width;
                return (
                  <g key={opening.id} className="walk-minimap__opening walk-minimap__door" transform={`translate(${frame.x} ${frame.z}) rotate(${angle})`}>
                    <line className="walk-minimap__door-leaf" x1={hingeX} y1="0" x2={hingeX} y2={openEndY} />
                    <path d={`M ${closedEndX} 0 A ${opening.width} ${opening.width} 0 0 ${swingSign > 0 ? 1 : 0} ${hingeX} ${openEndY}`} />
                  </g>
                );
              })}
              {minimapStairs.map((stair) => {
                const outline = stairPlanOutline(stair);
                return <polygon
                  key={stair.id}
                  className="walk-minimap__stair"
                  points={outline.map((point) => `${point.x},${point.y}`).join(" ")}
                />;
              })}
              <g ref={minimapMarkerRef} className="walk-minimap__marker">
                <circle className="walk-minimap__marker-halo" r={markerSize * 1.12} />
                <circle r={markerSize * 0.62} />
                <path d={`M 0 ${-markerSize * 1.55} L ${markerSize * 0.62} ${markerSize * 0.45} L 0 ${markerSize * 0.12} L ${-markerSize * 0.62} ${markerSize * 0.45} Z`} />
              </g>
            </svg>
          </aside>
          <div className="model-view__walk-help" id="model-navigation-help">
            <b>WALK MODE</b>
            <span>Click to lock look, or drag to look · WASD / arrows to move · Walk onto stairs to change levels · Esc releases mouse</span>
          </div>
        </>
      ) : (
        <div className="model-view__help" id="model-navigation-help">ORBIT · DRAG &nbsp;&nbsp; PAN · RIGHT DRAG OR SHIFT-DRAG &nbsp;&nbsp; ZOOM · SCROLL</div>
      )}
      <div className="model-view__sync" id="model-sync-status" aria-label={`3D sync: ${doors} ${doors === 1 ? "door" : "doors"}, ${windows} ${windows === 1 ? "window" : "windows"}, and ${stairs} ${stairs === 1 ? "staircase" : "staircases"}`}>
        <span /> 2D SYNCED&nbsp;&nbsp;·&nbsp;&nbsp;{doors} {doors === 1 ? "DOOR" : "DOORS"}&nbsp;&nbsp;·&nbsp;&nbsp;{windows} {windows === 1 ? "WINDOW" : "WINDOWS"}&nbsp;&nbsp;·&nbsp;&nbsp;{stairs} {stairs === 1 ? "STAIRCASE" : "STAIRCASES"}
      </div>
    </div>
  );
}
