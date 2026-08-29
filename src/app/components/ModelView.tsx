"use client";

import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  exteriorFinishPresets,
  roomCentroid,
  roomContainsPoint,
  roomVertices,
  stairConnection,
  stairFootprint,
  stairLocalPoint,
  stairPlanPoint,
  type NavigationMode,
  type PlanPoint,
  type Project,
} from "@/lib/architecture";
import { buildSpatialModel, openingFrameFor, resolveWalkPosition, type CollisionSegment } from "@/lib/spatial3d";

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

const WALK_EYE_HEIGHT = 5.4;
const WALK_BODY_HEIGHT = 6.4;
const WALK_RADIUS = 0.38;
const STAIR_LANDING_CLEARANCE = 0.75;
const STAIR_SOFFIT_OFFSET = 0.34;
const FLOOR_SLAB_THICKNESS = 0.18;
const CEILING_THICKNESS = 0.1;

function colorWithSelection(base: string, selected: boolean) {
  return selected ? "#d8663f" : base;
}

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

type PlanRectangle = { x: number; z: number; width: number; length: number };

function planExtrusion(vertices: PlanPoint[], thickness: number, holes: PlanRectangle[] = []) {
  const shape = new THREE.Shape();
  vertices.forEach((point, index) => index ? shape.lineTo(point.x, point.y) : shape.moveTo(point.x, point.y));
  shape.closePath();
  holes.forEach((hole) => {
    const path = new THREE.Path();
    path.moveTo(hole.x, hole.z);
    path.lineTo(hole.x, hole.z + hole.length);
    path.lineTo(hole.x + hole.width, hole.z + hole.length);
    path.lineTo(hole.x + hole.width, hole.z);
    path.closePath();
    shape.holes.push(path);
  });
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  geometry.rotateX(Math.PI / 2);
  return geometry;
}

function cutCollisionSegmentAtStair(segment: CollisionSegment, stair: PlanRectangle) {
  const dx = segment.x2 - segment.x1;
  const dz = segment.z2 - segment.z1;
  let enter = 0;
  let exit = 1;
  const limits: Array<[number, number]> = [
    [-dx, segment.x1 - stair.x],
    [dx, stair.x + stair.width - segment.x1],
    [-dz, segment.z1 - stair.z],
    [dz, stair.z + stair.length - segment.z1],
  ];
  for (const [direction, distance] of limits) {
    if (Math.abs(direction) < 0.0001) {
      if (distance < 0) return [segment];
      continue;
    }
    const ratio = distance / direction;
    if (direction < 0) enter = Math.max(enter, ratio);
    else exit = Math.min(exit, ratio);
    if (enter > exit) return [segment];
  }
  const piece = (start: number, end: number): CollisionSegment => ({
    ...segment,
    x1: segment.x1 + dx * start,
    z1: segment.z1 + dz * start,
    x2: segment.x1 + dx * end,
    z2: segment.z1 + dz * end,
  });
  return [
    ...(enter > 0.001 ? [piece(0, enter)] : []),
    ...(exit < 0.999 ? [piece(exit, 1)] : []),
  ];
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
  const minimapMarkerRef = useRef<SVGGElement | null>(null);
  const minimapRoomLabelRef = useRef<HTMLSpanElement | null>(null);
  const minimapRoomRefs = useRef(new Map<string, SVGPolygonElement>());
  useEffect(() => {
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
    scene.background = new THREE.Color(navigationMode === "walk" ? "#dce5e4" : "#e7e8e4");
    scene.fog = new THREE.Fog(scene.background, navigationMode === "walk" ? 48 : 80, navigationMode === "walk" ? 105 : 170);

    const camera = new THREE.PerspectiveCamera(navigationMode === "walk" ? 68 : 34, 1, 0.1, 500);
    camera.rotation.order = "YXZ";
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = navigationMode === "walk" ? 1.25 : 1.08;

    const controls = new OrbitControls(camera, canvas);
    controls.enabled = navigationMode === "orbit";
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.screenSpacePanning = true;
    controls.minDistance = 7;
    controls.maxDistance = 180;
    controls.maxPolarAngle = Math.PI / 2.02;

    const maxDimension = Math.max(project.plot.width, project.plot.length);
    const center = new THREE.Vector3(project.plot.width / 2, 3.2, project.plot.length / 2);
    const focusedRoom = project.rooms.find((room) => room.id === project.view.focusElementId);
    const focusedCenter = focusedRoom ? roomCentroid(focusedRoom) : undefined;
    const target = focusedCenter
      ? new THREE.Vector3(focusedCenter.x, 3.2, focusedCenter.y)
      : center;

    if (navigationMode === "orbit") {
      const distance = maxDimension * 0.82;
      const height = Math.max(24, maxDimension * 0.48);
      const positions: Record<string, THREE.Vector3> = {
        front: new THREE.Vector3(project.plot.width / 2, height, -distance),
        rear: new THREE.Vector3(project.plot.width / 2, height, project.plot.length + distance),
        left: new THREE.Vector3(-distance, height, project.plot.length / 2),
        right: new THREE.Vector3(project.plot.width + distance, height, project.plot.length / 2),
        top: new THREE.Vector3(project.plot.width / 2, maxDimension * 1.25, project.plot.length / 2 + 0.01),
        "front-left": new THREE.Vector3(-distance * 0.62, height, -distance * 0.62),
        "front-right": new THREE.Vector3(project.plot.width + distance * 0.62, height, -distance * 0.62),
      };
      camera.position.copy(positions[project.view.cameraPreset] ?? positions["front-right"]);
      controls.target.copy(target);
      camera.lookAt(target);
    } else {
      const floor = project.floors.find((item) => item.id === project.view.activeFloorId) ?? project.floors[0];
      const startRoom = project.rooms.find((room) => room.id === project.view.walkStartRoomId && room.floorId === floor?.id)
        ?? project.rooms.find((room) => room.id === project.view.focusElementId && room.floorId === floor?.id)
        ?? project.rooms.find((room) => room.floorId === floor?.id);
      const poseKey = `${floor?.id ?? "floor"}:${project.view.walkStartRoomId ?? startRoom?.id ?? "site"}`;
      const storedPose = walkPoseRef.current?.key === poseKey ? walkPoseRef.current : undefined;
      const startCenter = startRoom ? roomCentroid(startRoom) : undefined;
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
        const landing = stairPlanPoint(connection.stair, connection.stair.width / 2, atLowerLanding ? connection.stair.length + STAIR_LANDING_CLEARANCE : -STAIR_LANDING_CLEARANCE);
        const stairYaw = connection.stair.rotation * Math.PI / 180;
        return {
          x: landing.x,
          z: landing.y,
          yaw: atLowerLanding ? stairYaw : stairYaw + Math.PI,
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

    const ambient = new THREE.HemisphereLight("#f8fbff", "#81776d", navigationMode === "walk" ? 3.1 : 2.4);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight("#fff8e9", navigationMode === "walk" ? 3.1 : 3.8);
    sun.position.set(-30, 55, -35);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -80;
    sun.shadow.camera.right = 80;
    sun.shadow.camera.top = 80;
    sun.shadow.camera.bottom = -80;
    scene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.BoxGeometry(project.plot.width + 18, 0.35, project.plot.length + 18),
      new THREE.MeshStandardMaterial({ color: "#d8d8d2", roughness: 0.95 }),
    );
    ground.position.set(project.plot.width / 2, -0.22, project.plot.length / 2);
    ground.receiveShadow = true;
    scene.add(ground);

    const plotSlab = new THREE.Mesh(
      new THREE.BoxGeometry(project.plot.width, 0.16, project.plot.length),
      new THREE.MeshStandardMaterial({ color: "#eeeee9", roughness: 0.88 }),
    );
    plotSlab.position.set(project.plot.width / 2, -0.06, project.plot.length / 2);
    plotSlab.receiveShadow = true;
    scene.add(plotSlab);

    const grid = new THREE.GridHelper(maxDimension + 30, Math.round(maxDimension + 30), "#aeb3ae", "#d0d3cf");
    grid.position.set(project.plot.width / 2, 0.035, project.plot.length / 2);
    const gridMaterial = grid.material as THREE.Material;
    gridMaterial.transparent = true;
    gridMaterial.opacity = navigationMode === "walk" ? 0.08 : 0.28;
    scene.add(grid);

    const boundary = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(project.plot.width, 0.05, project.plot.length)),
      new THREE.LineBasicMaterial({ color: "#26342c" }),
    );
    boundary.position.set(project.plot.width / 2, 0.08, project.plot.length / 2);
    scene.add(boundary);

    const selectable: THREE.Object3D[] = [];

    for (const room of project.rooms) {
      const floor = floorById.get(room.floorId);
      if (!floor) continue;
      const slabVoids = stairConnections
        .filter((connection) => connection.upperFloor.id === floor.id)
        .map(({ stair }) => { const footprint = stairFootprint(stair); return { x: footprint.x - 0.08, z: footprint.y - 0.08, width: footprint.width + 0.16, length: footprint.length + 0.16 }; });
      const slabMaterial = new THREE.MeshStandardMaterial({
        color: colorWithSelection(room.color, selectedId === room.id),
        roughness: 0.82,
        transparent: room.type === "Courtyard",
        opacity: room.type === "Courtyard" ? 0.45 : 1,
      });
      const slab = new THREE.Mesh(planExtrusion(roomVertices(room), FLOOR_SLAB_THICKNESS, slabVoids), slabMaterial);
      slab.position.y = floor.elevation + FLOOR_SLAB_THICKNESS;
      slab.receiveShadow = true;
      slab.userData.elementId = room.id;
      selectable.push(slab);
      scene.add(slab);

      if (room.type !== "Courtyard") {
        const ceilingVoids = stairConnections
          .filter((connection) => connection.lowerFloor.id === floor.id)
          .map(({ stair }) => { const footprint = stairFootprint(stair); return { x: footprint.x - 0.08, z: footprint.y - 0.08, width: footprint.width + 0.16, length: footprint.length + 0.16 }; });
        const ceilingMaterial = new THREE.MeshStandardMaterial({ color: "#f0eee7", roughness: 0.94 });
        const ceiling = new THREE.Mesh(planExtrusion(roomVertices(room), CEILING_THICKNESS, ceilingVoids), ceilingMaterial);
        ceiling.position.y = floor.elevation + floor.height;
        ceiling.castShadow = true;
        ceiling.receiveShadow = true;
        ceiling.userData.elementId = room.id;
        selectable.push(ceiling);
        scene.add(ceiling);
      }
    }

    let wallPieceCount = 0;
    for (const volume of spatial.wallVolumes) {
      const floor = floorById.get(volume.floorId);
      if (!floor || volume.width <= 0 || volume.length <= 0) continue;
      const selected = volume.wallIds.includes(selectedId ?? "");
      const exterior = volume.wallIds.some((wallId) => project.walls.find((wall) => wall.id === wallId)?.exterior);
      const finish = exteriorFinishPresets[project.exteriorFinish];
      const mesh = meshBox(
        [volume.width, volume.top - volume.bottom, volume.length],
        [volume.x + volume.width / 2, floor.elevation + (volume.bottom + volume.top) / 2, volume.z + volume.length / 2],
        0,
        new THREE.MeshStandardMaterial({ color: colorWithSelection(exterior ? finish.color : "#e6e1d6", selected), roughness: exterior ? finish.roughness : 0.84, metalness: exterior ? finish.metalness : 0 }),
      );
      mesh.userData.elementId = volume.wallIds[0];
      mesh.userData.wallIds = volume.wallIds;
      selectable.push(mesh);
      scene.add(mesh);
      wallPieceCount += 1;
    }
    for (const solid of spatial.wallSolids) {
      const floor = floorById.get(solid.floorId);
      const length = Math.hypot(solid.x2 - solid.x1, solid.z2 - solid.z1);
      if (!floor || !length) continue;
      const selected = solid.wallIds.includes(selectedId ?? "");
      const exterior = solid.wallIds.some((wallId) => project.walls.find((wall) => wall.id === wallId)?.exterior);
      const finish = exteriorFinishPresets[project.exteriorFinish];
      const mesh = meshBox(
        [length, solid.top - solid.bottom, solid.thickness],
        [(solid.x1 + solid.x2) / 2, floor.elevation + (solid.bottom + solid.top) / 2, (solid.z1 + solid.z2) / 2],
        -Math.atan2(solid.z2 - solid.z1, solid.x2 - solid.x1),
        new THREE.MeshStandardMaterial({ color: colorWithSelection(exterior ? finish.color : "#e6e1d6", selected), roughness: exterior ? finish.roughness : 0.84, metalness: exterior ? finish.metalness : 0 }),
      );
      mesh.userData.elementId = solid.wallIds[0];
      mesh.userData.wallIds = solid.wallIds;
      selectable.push(mesh);
      scene.add(mesh);
      wallPieceCount += 1;
    }

    let renderedDoorCount = 0;
    let renderedDoorPanelCount = 0;
    let renderedWindowCount = 0;
    for (const frame of spatial.openingFrames) {
      const { opening } = frame;
      const floor = floorById.get(opening.floorId);
      if (!floor) continue;
      const selected = selectedId === opening.id;
      const elevation = floor.elevation;
      const depth = Math.max(0.18, frame.wall.thickness + 0.08);
      const frameMaterial = new THREE.MeshStandardMaterial({
        color: colorWithSelection(opening.kind === "door" ? "#80624f" : "#4f6b71", selected),
        roughness: opening.kind === "door" ? 0.68 : 0.42,
        metalness: opening.kind === "window" ? 0.2 : 0,
      });

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
          new THREE.MeshStandardMaterial({ color: colorWithSelection("#9b765c", selected), roughness: 0.72 }),
        );
        panel.userData.elementId = opening.id;
        panel.userData.openAngle = isClosed ? 0 : 90 * swingSign;
        selectable.push(panel);
        scene.add(panel);
        renderedDoorPanelCount += 1;
      } else {
        renderedWindowCount += 1;
        const sill = opening.sillHeight ?? 0;
        const rail = 0.16;
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
        const glass = meshBox(
          [Math.max(0.2, opening.width - 0.24), Math.max(0.2, opening.height - 0.24), 0.045],
          [frame.x, centerY, frame.z],
          -frame.angle,
          new THREE.MeshPhysicalMaterial({
            color: colorWithSelection(opening.glazing === "privacy" ? "#c4d2d0" : opening.glazing === "low-e" ? "#96bdb9" : "#9bc8d4", selected),
            transparent: true,
            opacity: opening.glazing === "privacy" ? 0.72 : Math.max(0.22, 0.5 - visibleTransmittance * 0.3),
            transmission: selected || opening.glazing === "privacy" ? 0 : Math.max(0.08, Math.min(0.72, visibleTransmittance * 0.78)),
            roughness: opening.glazing === "privacy" ? 0.48 : 0.12,
            metalness: 0.06,
            side: THREE.DoubleSide,
          }),
        );
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

    for (const stair of project.stairs) {
      const floor = floorById.get(stair.floorId);
      if (!floor) continue;
      const connection = stairConnection(project, stair);
      if (navigationMode === "walk" && connection
        && connection.lowerFloor.id !== project.view.activeFloorId
        && connection.upperFloor.id !== project.view.activeFloorId) continue;
      const lowerElevation = connection?.lowerFloor.elevation ?? floor.elevation;
      const rise = connection?.rise ?? floor.height * 0.72;
      const treadCount = connection?.treadCount ?? 10;
      const stepLength = stair.length / treadCount;
      const riserHeight = rise / (treadCount + 1);
      const selected = selectedId === stair.id;
      const stairMaterial = new THREE.MeshStandardMaterial({
        color: colorWithSelection("#aaa69d", selected),
        roughness: 0.86,
      });
      const supportMaterial = new THREE.MeshStandardMaterial({
        color: colorWithSelection("#77776f", selected),
        roughness: 0.78,
      });
      const riserMaterial = new THREE.MeshStandardMaterial({
        color: colorWithSelection("#918e87", selected),
        roughness: 0.9,
      });
      const treadThickness = 0.18;
      const stairRotation = stair.rotation * Math.PI / 180;
      for (let index = 0; index < treadCount; index += 1) {
        const treadElevation = lowerElevation + riserHeight * (index + 1);
        const centerPoint = stairPlanPoint(stair, stair.width / 2, stair.length - stepLength * (index + 0.5));
        const step = meshBox(
          [stair.width, treadThickness, stepLength + 0.05],
          [centerPoint.x, treadElevation - treadThickness / 2, centerPoint.y],
          stairRotation,
          stairMaterial,
        );
        step.userData.elementId = stair.id;
        step.userData.stairProgress = (index + 1) / (treadCount + 1);
        selectable.push(step);
        scene.add(step);
      }
      for (let index = 0; index <= treadCount; index += 1) {
        const centerPoint = stairPlanPoint(stair, stair.width / 2, stair.length - stepLength * index);
        const riser = meshBox(
          [stair.width, riserHeight, 0.12],
          [
            centerPoint.x,
            lowerElevation + riserHeight * (index + 0.5),
            centerPoint.y,
          ],
          stairRotation,
          riserMaterial,
        );
        riser.userData.elementId = stair.id;
        selectable.push(riser);
        scene.add(riser);
      }

      const stringerLength = Math.hypot(stair.length, rise);
      const stringerAngle = Math.atan2(rise, stair.length);
      const stairCenter = stairPlanPoint(stair, stair.width / 2, stair.length / 2);
      const soffit = meshBox(
        [Math.max(0.2, stair.width - 0.22), 0.14, stringerLength],
        [stairCenter.x, lowerElevation + rise / 2 - STAIR_SOFFIT_OFFSET, stairCenter.y],
        stairRotation,
        supportMaterial,
      );
      soffit.rotation.x = stringerAngle;
      soffit.userData.elementId = stair.id;
      selectable.push(soffit);
      scene.add(soffit);
      for (const side of [0.18, stair.width - 0.18]) {
        const stringerCenter = stairPlanPoint(stair, side, stair.length / 2);
        const stringer = meshBox(
          [0.16, 0.24, stringerLength],
          [stringerCenter.x, lowerElevation + rise / 2 - 0.2, stringerCenter.y],
          stairRotation,
          supportMaterial,
        );
        stringer.rotation.x = stringerAngle;
        stringer.userData.elementId = stair.id;
        selectable.push(stringer);
        scene.add(stringer);
      }
    }

    canvas.dataset.navigationMode = navigationMode;
    canvas.dataset.wallPieceCount = String(wallPieceCount);
    canvas.dataset.doorCount = String(project.openings.filter((item) => item.kind === "door").length);
    canvas.dataset.renderedDoorCount = String(renderedDoorCount);
    canvas.dataset.renderedDoorPanelCount = String(renderedDoorPanelCount);
    canvas.dataset.windowCount = String(project.openings.filter((item) => item.kind === "window").length);
    canvas.dataset.renderedWindowCount = String(renderedWindowCount);
    canvas.dataset.collisionSegmentCount = String(spatial.collisionSegments.length);

    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const heightPx = Math.max(1, host.clientHeight);
      renderer.setSize(width, heightPx, false);
      camera.aspect = width / heightPx;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const handleClick = (event: MouseEvent) => {
      if (navigationMode === "walk") {
        canvas.focus();
        void canvas.requestPointerLock();
        return;
      }
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(selectable, false)[0];
      onSelect(hit?.object.userData.elementId);
    };
    canvas.addEventListener("click", handleClick);

    const activeFloor = project.floors.find((floor) => floor.id === project.view.activeFloorId) ?? project.floors[0];
    const activeStairConnections = stairConnections.filter(
      (connection) => connection.lowerFloor.id === activeFloor?.id || connection.upperFloor.id === activeFloor?.id,
    );
    const activeCollisions = activeStairConnections.reduce(
      (segments, { stair }) => {
        const footprint = stairFootprint(stair);
        return segments.flatMap((segment) => cutCollisionSegmentAtStair(segment, { x: footprint.x, z: footprint.y, width: footprint.width, length: footprint.length }));
      },
      spatial.collisionSegments.filter((segment) => segment.floorId === project.view.activeFloorId),
    );
    const pressed = new Set<string>();
    let yaw = camera.rotation.y;
    let pitch = camera.rotation.x;
    let transitionRequested = false;
    let activeStairId: string | undefined;

    const stairAt = (x: number, z: number) => activeStairConnections
      .filter(({ stair }) => {
        const local = stairLocalPoint(stair, { x, y: z });
        return local.u >= 0 && local.u <= stair.width && local.v >= 0 && local.v <= stair.length;
      })
      .sort((left, right) => {
        const leftProgress = Math.max(0, Math.min(1, (left.stair.length - stairLocalPoint(left.stair, { x, y: z }).v) / left.stair.length));
        const rightProgress = Math.max(0, Math.min(1, (right.stair.length - stairLocalPoint(right.stair, { x, y: z }).v) / right.stair.length));
        const leftEye = left.lowerFloor.elevation + leftProgress * left.rise + WALK_EYE_HEIGHT;
        const rightEye = right.lowerFloor.elevation + rightProgress * right.rise + WALK_EYE_HEIGHT;
        return Math.abs(camera.position.y - leftEye) - Math.abs(camera.position.y - rightEye);
      })[0];

    const stairProgress = (connection: (typeof activeStairConnections)[number], x: number, z: number) => (
      Math.max(0, Math.min(1, (connection.stair.length - stairLocalPoint(connection.stair, { x, y: z }).v) / connection.stair.length))
    );

    const canWalkUnderStair = (connection: (typeof activeStairConnections)[number], x: number, z: number) => {
      if (activeFloor?.id !== connection.lowerFloor.id) return false;
      const undersideClearance = stairProgress(connection, x, z) * connection.rise - STAIR_SOFFIT_OFFSET;
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
          if (!nextStair || nextStair.stair.id !== activeStairId) continue;
        } else if (nextStair) {
          const enteringDifferentStair = previousStair?.stair.id !== nextStair.stair.id;
          const previousLocal = stairLocalPoint(nextStair.stair, { x: previousX, y: previousZ });
          const enteredFromLowerLanding = enteringDifferentStair && previousLocal.v >= nextStair.stair.length - 0.05;
          const enteredFromUpperLanding = enteringDifferentStair && previousLocal.v <= 0.05;
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
        const targetFloorId = activeFloor?.id === nextStair.lowerFloor.id && progress >= 0.96
          ? nextStair.upperFloor.id
          : activeFloor?.id === nextStair.upperFloor.id && progress <= 0.04
            ? nextStair.lowerFloor.id
            : undefined;
        if (targetFloorId && !transitionRequested) {
          transitionRequested = true;
          const targetFloor = floorById.get(targetFloorId);
          const ascending = targetFloorId === nextStair.upperFloor.id;
          const landing = stairPlanPoint(nextStair.stair, nextStair.stair.width / 2, ascending ? -STAIR_LANDING_CLEARANCE : nextStair.stair.length + STAIR_LANDING_CLEARANCE);
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
    };
    const handleKeyUp = (event: KeyboardEvent) => pressed.delete(event.code);
    const handleMouseMove = (event: MouseEvent) => {
      if (navigationMode !== "walk" || document.pointerLockElement !== canvas) return;
      yaw -= event.movementX * 0.0022;
      pitch = Math.max(-Math.PI * 0.46, Math.min(Math.PI * 0.46, pitch - event.movementY * 0.0022));
      camera.rotation.set(pitch, yaw, 0);
    };
    const updatePointerState = () => {
      host.dataset.pointerLocked = String(document.pointerLockElement === canvas);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("pointerlockchange", updatePointerState);

    let frame = 0;
    let previousTime = performance.now();
    const animate = (time = performance.now()) => {
      const delta = Math.min(0.05, Math.max(0, (time - previousTime) / 1000));
      previousTime = time;
      if (navigationMode === "orbit") controls.update();
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
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("pointerlockchange", updatePointerState);
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      controls.dispose();
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
    };
  }, [canvasRef, navigationMode, onSelect, onWalkFloorChange, project, selectedId]);

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
      />
      <div className="model-view__horizon" aria-hidden="true" />
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
                const corners = [stairPlanPoint(stair, 0, 0), stairPlanPoint(stair, stair.width, 0), stairPlanPoint(stair, stair.width, stair.length), stairPlanPoint(stair, 0, stair.length)];
                return <polygon
                  key={stair.id}
                  className="walk-minimap__stair"
                  points={corners.map((point) => `${point.x},${point.y}`).join(" ")}
                />;
              })}
              <g ref={minimapMarkerRef} className="walk-minimap__marker">
                <circle className="walk-minimap__marker-halo" r={markerSize * 1.12} />
                <circle r={markerSize * 0.62} />
                <path d={`M 0 ${-markerSize * 1.55} L ${markerSize * 0.62} ${markerSize * 0.45} L 0 ${markerSize * 0.12} L ${-markerSize * 0.62} ${markerSize * 0.45} Z`} />
              </g>
            </svg>
          </aside>
          <div className="model-view__walk-help">
            <b>WALK MODE</b>
            <span>Click canvas to look · WASD / arrows to move · Walk onto stairs to change levels · Esc releases mouse</span>
          </div>
        </>
      ) : (
        <div className="model-view__help">ORBIT · DRAG &nbsp;&nbsp; PAN · RIGHT DRAG &nbsp;&nbsp; ZOOM · SCROLL</div>
      )}
      <div className="model-view__sync" aria-label={`3D sync: ${doors} doors, ${windows} windows, and ${stairs} stairs`}>
        <span /> 2D SYNCED&nbsp;&nbsp;·&nbsp;&nbsp;{doors} DOORS&nbsp;&nbsp;·&nbsp;&nbsp;{windows} WINDOWS&nbsp;&nbsp;·&nbsp;&nbsp;{stairs} STAIRS
      </div>
    </div>
  );
}
