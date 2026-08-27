"use client";

import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { stairConnection, type NavigationMode, type Project } from "@/lib/architecture";
import { buildSpatialModel, resolveWalkPosition, type CollisionSegment } from "@/lib/spatial3d";

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

function colorWithSelection(base: string, selected: boolean) {
  return selected ? "#d8663f" : base;
}

function meshBox(
  size: [number, number, number],
  position: [number, number, number],
  rotationY: number,
  material: THREE.Material,
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.rotation.y = rotationY;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

type PlanRectangle = { x: number; z: number; width: number; length: number };

function subtractRectangle(source: PlanRectangle, cut: PlanRectangle) {
  const left = Math.max(source.x, cut.x);
  const right = Math.min(source.x + source.width, cut.x + cut.width);
  const top = Math.max(source.z, cut.z);
  const bottom = Math.min(source.z + source.length, cut.z + cut.length);
  if (right - left <= 0.01 || bottom - top <= 0.01) return [source];
  return [
    { x: source.x, z: source.z, width: source.width, length: top - source.z },
    { x: source.x, z: bottom, width: source.width, length: source.z + source.length - bottom },
    { x: source.x, z: top, width: left - source.x, length: bottom - top },
    { x: right, z: top, width: source.x + source.width - right, length: bottom - top },
  ].filter((piece) => piece.width > 0.01 && piece.length > 0.01);
}

function subtractRectangles(source: PlanRectangle, cuts: PlanRectangle[]) {
  return cuts.reduce<PlanRectangle[]>((pieces, cut) => pieces.flatMap((piece) => subtractRectangle(piece, cut)), [source]);
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

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const spatial = buildSpatialModel(project);
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
    const target = focusedRoom
      ? new THREE.Vector3(focusedRoom.x + focusedRoom.width / 2, 3.2, focusedRoom.y + focusedRoom.length / 2)
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
      const startX = startRoom ? startRoom.x + startRoom.width / 2 : project.plot.width / 2;
      const startZ = startRoom ? startRoom.y + startRoom.length / 2 : project.plot.length / 2;
      camera.position.set(storedPose?.x ?? startX, storedPose?.y ?? ((floor?.elevation ?? 0) + 5.4), storedPose?.z ?? startZ);
      camera.rotation.set(storedPose?.pitch ?? 0, storedPose?.yaw ?? 0, 0);
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

    const floorById = new Map(project.floors.map((floor) => [floor.id, floor]));
    const selectable: THREE.Object3D[] = [];
    const stairConnections = project.stairs.flatMap((stair) => {
      const connection = stairConnection(project, stair);
      return connection ? [connection] : [];
    });

    for (const room of project.rooms) {
      const floor = floorById.get(room.floorId);
      if (!floor) continue;
      const roomRectangle = { x: room.x + 0.075, z: room.y + 0.075, width: Math.max(0.1, room.width - 0.15), length: Math.max(0.1, room.length - 0.15) };
      const slabVoids = stairConnections
        .filter((connection) => connection.upperFloor.id === floor.id)
        .map(({ stair }) => ({ x: stair.x - 0.08, z: stair.y - 0.08, width: stair.width + 0.16, length: stair.length + 0.16 }));
      const slabMaterial = new THREE.MeshStandardMaterial({
        color: colorWithSelection(room.color, selectedId === room.id),
        roughness: 0.82,
        transparent: room.type === "Courtyard",
        opacity: room.type === "Courtyard" ? 0.45 : 1,
      });
      for (const piece of subtractRectangles(roomRectangle, slabVoids)) {
        const slab = new THREE.Mesh(new THREE.BoxGeometry(piece.width, 0.18, piece.length), slabMaterial);
        slab.position.set(piece.x + piece.width / 2, floor.elevation + 0.1, piece.z + piece.length / 2);
        slab.receiveShadow = true;
        slab.userData.elementId = room.id;
        selectable.push(slab);
        scene.add(slab);
      }

      if (room.type !== "Courtyard") {
        const ceilingVoids = stairConnections
          .filter((connection) => connection.lowerFloor.id === floor.id)
          .map(({ stair }) => ({ x: stair.x - 0.08, z: stair.y - 0.08, width: stair.width + 0.16, length: stair.length + 0.16 }));
        const ceilingMaterial = new THREE.MeshStandardMaterial({ color: "#f0eee7", roughness: 0.94, side: THREE.DoubleSide });
        for (const piece of subtractRectangles({ x: room.x, z: room.y, width: room.width, length: room.length }, ceilingVoids)) {
          const ceiling = new THREE.Mesh(new THREE.BoxGeometry(piece.width, 0.14, piece.length), ceilingMaterial);
          ceiling.position.set(piece.x + piece.width / 2, floor.elevation + floor.height + 0.08, piece.z + piece.length / 2);
          ceiling.castShadow = true;
          ceiling.userData.elementId = room.id;
          selectable.push(ceiling);
          scene.add(ceiling);
        }
      }
    }

    let wallPieceCount = 0;
    for (const solid of spatial.wallSolids) {
      const floor = floorById.get(solid.floorId);
      const length = Math.hypot(solid.x2 - solid.x1, solid.z2 - solid.z1);
      if (!floor || !length) continue;
      const selected = solid.wallIds.includes(selectedId ?? "");
      const mesh = meshBox(
        [length, solid.top - solid.bottom, solid.thickness],
        [(solid.x1 + solid.x2) / 2, floor.elevation + (solid.bottom + solid.top) / 2, (solid.z1 + solid.z2) / 2],
        -Math.atan2(solid.z2 - solid.z1, solid.x2 - solid.x1),
        new THREE.MeshStandardMaterial({ color: colorWithSelection("#e6e1d6", selected), roughness: 0.84 }),
      );
      mesh.userData.elementId = solid.wallIds[0];
      mesh.userData.wallIds = solid.wallIds;
      selectable.push(mesh);
      scene.add(mesh);
      wallPieceCount += 1;
    }

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
        const isClosed = opening.state === "closed";
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
      } else {
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
      const lowerElevation = connection?.lowerFloor.elevation ?? floor.elevation;
      const rise = connection?.rise ?? floor.height * 0.72;
      const treadCount = connection?.treadCount ?? 10;
      const stepLength = stair.length / treadCount;
      for (let index = 0; index < treadCount; index += 1) {
        const progress = (index + 1) / treadCount;
        const solidHeight = rise * progress;
        const step = meshBox(
          [stair.width, solidHeight, stepLength],
          [stair.x + stair.width / 2, lowerElevation + solidHeight / 2, stair.y + stair.length - stepLength * (index + 0.5)],
          0,
          new THREE.MeshStandardMaterial({ color: colorWithSelection("#b9b4aa", selectedId === stair.id), roughness: 0.9 }),
        );
        step.userData.elementId = stair.id;
        step.userData.stairProgress = progress;
        selectable.push(step);
        scene.add(step);
      }
    }

    canvas.dataset.navigationMode = navigationMode;
    canvas.dataset.wallPieceCount = String(wallPieceCount);
    canvas.dataset.doorCount = String(project.openings.filter((item) => item.kind === "door").length);
    canvas.dataset.windowCount = String(project.openings.filter((item) => item.kind === "window").length);
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
      (segments, { stair }) => segments.flatMap((segment) => cutCollisionSegmentAtStair(segment, {
        x: stair.x,
        z: stair.y,
        width: stair.width,
        length: stair.length,
      })),
      spatial.collisionSegments.filter((segment) => segment.floorId === project.view.activeFloorId),
    );
    const eyeHeight = 5.4;
    const radius = 0.38;
    const pressed = new Set<string>();
    let yaw = camera.rotation.y;
    let pitch = camera.rotation.x;
    let transitionRequested = false;

    const stairAt = (x: number, z: number) => activeStairConnections.find(({ stair }) =>
      x >= stair.x && x <= stair.x + stair.width && z >= stair.y && z <= stair.y + stair.length,
    );

    const poseKeyForFloor = (floorId: string) => `${floorId}:${project.view.walkStartRoomId ?? project.rooms.find((room) => room.floorId === floorId)?.id ?? "site"}`;

    const moveWalkCamera = (moveX: number, moveZ: number) => {
      const distance = Math.hypot(moveX, moveZ);
      const steps = Math.max(1, Math.ceil(distance / 0.1));
      for (let step = 0; step < steps; step += 1) {
        const previousX = camera.position.x;
        const previousZ = camera.position.z;
        let x = camera.position.x + moveX / steps;
        let z = camera.position.z + moveZ / steps;
        const resolved = resolveWalkPosition(x, z, radius, activeCollisions);
        x = Math.max(radius, Math.min(project.plot.width - radius, resolved.x));
        z = Math.max(radius, Math.min(project.plot.length - radius, resolved.z));
        const previousStair = stairAt(previousX, previousZ);
        const nextStair = stairAt(x, z);
        const activeFloorEye = (activeFloor?.elevation ?? 0) + eyeHeight;
        const betweenLandings = previousStair && Math.abs(camera.position.y - activeFloorEye) > 0.3;
        if (betweenLandings && !nextStair) continue;

        camera.position.x = x;
        camera.position.z = z;
        if (!nextStair) {
          camera.position.y = activeFloorEye;
          continue;
        }

        const progress = Math.max(0, Math.min(1, (nextStair.stair.y + nextStair.stair.length - z) / nextStair.stair.length));
        camera.position.y = nextStair.lowerFloor.elevation + progress * nextStair.rise + eyeHeight;
        const targetFloorId = activeFloor?.id === nextStair.lowerFloor.id && progress >= 0.96
          ? nextStair.upperFloor.id
          : activeFloor?.id === nextStair.upperFloor.id && progress <= 0.04
            ? nextStair.lowerFloor.id
            : undefined;
        if (targetFloorId && !transitionRequested) {
          transitionRequested = true;
          walkPoseRef.current = {
            key: poseKeyForFloor(targetFloorId),
            x: camera.position.x,
            y: camera.position.y,
            z: camera.position.z,
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
        <div className="model-view__walk-help">
          <b>WALK MODE</b>
          <span>Click canvas to look · WASD / arrows to move · Walk onto stairs to change levels · Esc releases mouse</span>
        </div>
      ) : (
        <div className="model-view__help">ORBIT · DRAG &nbsp;&nbsp; PAN · RIGHT DRAG &nbsp;&nbsp; ZOOM · SCROLL</div>
      )}
      <div className="model-view__sync" aria-label={`3D sync: ${doors} doors, ${windows} windows, and ${stairs} stairs`}>
        <span /> 2D SYNCED&nbsp;&nbsp;·&nbsp;&nbsp;{doors} DOORS&nbsp;&nbsp;·&nbsp;&nbsp;{windows} WINDOWS&nbsp;&nbsp;·&nbsp;&nbsp;{stairs} STAIRS
      </div>
    </div>
  );
}
