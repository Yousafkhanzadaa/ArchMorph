"use client";

import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { type Project, type Wall, wallLength } from "@/lib/architecture";

type ModelViewProps = {
  project: Project;
  selectedId?: string;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  onSelect: (id?: string) => void;
};

function colorWithSelection(base: string, selected: boolean) {
  return selected ? "#d8663f" : base;
}

function openingPoint(wall: Wall, offset: number) {
  const length = wallLength(wall);
  const ratio = length ? offset / length : 0;
  return {
    x: wall.x1 + (wall.x2 - wall.x1) * ratio,
    z: wall.y1 + (wall.y2 - wall.y1) * ratio,
    angle: Math.atan2(wall.y2 - wall.y1, wall.x2 - wall.x1),
  };
}

export default function ModelView({ project, selectedId, canvasRef, onSelect }: ModelViewProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#e7e8e4");
    scene.fog = new THREE.Fog("#e7e8e4", 80, 170);

    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 500);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;

    const controls = new OrbitControls(camera, canvas);
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

    const ambient = new THREE.HemisphereLight("#f8fbff", "#8a7969", 2.4);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight("#fff8e9", 3.8);
    sun.position.set(-30, 55, -35);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -80;
    sun.shadow.camera.right = 80;
    sun.shadow.camera.top = 80;
    sun.shadow.camera.bottom = -80;
    scene.add(sun);

    const groundMaterial = new THREE.MeshStandardMaterial({ color: "#d8d8d2", roughness: 0.95 });
    const ground = new THREE.Mesh(
      new THREE.BoxGeometry(project.plot.width + 18, 0.35, project.plot.length + 18),
      groundMaterial,
    );
    ground.position.set(project.plot.width / 2, -0.22, project.plot.length / 2);
    ground.receiveShadow = true;
    scene.add(ground);

    const plotMaterial = new THREE.MeshStandardMaterial({ color: "#eeeee9", roughness: 0.88 });
    const plotSlab = new THREE.Mesh(
      new THREE.BoxGeometry(project.plot.width, 0.16, project.plot.length),
      plotMaterial,
    );
    plotSlab.position.set(project.plot.width / 2, -0.06, project.plot.length / 2);
    plotSlab.receiveShadow = true;
    scene.add(plotSlab);

    const grid = new THREE.GridHelper(maxDimension + 30, Math.round(maxDimension + 30), "#aeb3ae", "#d0d3cf");
    grid.position.set(project.plot.width / 2, 0.035, project.plot.length / 2);
    const gridMaterial = grid.material as THREE.Material;
    gridMaterial.transparent = true;
    gridMaterial.opacity = 0.28;
    scene.add(grid);

    const boundary = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(project.plot.width, 0.05, project.plot.length)),
      new THREE.LineBasicMaterial({ color: "#26342c" }),
    );
    boundary.position.set(project.plot.width / 2, 0.08, project.plot.length / 2);
    scene.add(boundary);

    const floorById = new Map(project.floors.map((floor) => [floor.id, floor]));
    const selectable: THREE.Object3D[] = [];

    for (const room of project.rooms) {
      const floor = floorById.get(room.floorId);
      if (!floor) continue;
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(room.width - 0.15, 0.18, room.length - 0.15),
        new THREE.MeshStandardMaterial({
          color: colorWithSelection(room.color, selectedId === room.id),
          roughness: 0.82,
          transparent: room.type === "Courtyard",
          opacity: room.type === "Courtyard" ? 0.45 : 1,
        }),
      );
      slab.position.set(room.x + room.width / 2, floor.elevation + 0.1, room.y + room.length / 2);
      slab.receiveShadow = true;
      slab.userData.elementId = room.id;
      selectable.push(slab);
      scene.add(slab);

      if (room.type !== "Courtyard") {
        const ceiling = new THREE.Mesh(
          new THREE.BoxGeometry(room.width, 0.16, room.length),
          new THREE.MeshStandardMaterial({ color: "#b8b5ac", roughness: 0.92 }),
        );
        ceiling.position.set(
          room.x + room.width / 2,
          floor.elevation + floor.height + 0.08,
          room.y + room.length / 2,
        );
        ceiling.castShadow = true;
        scene.add(ceiling);
      }
    }

    for (const wall of project.walls) {
      const floor = floorById.get(wall.floorId);
      if (!floor) continue;
      const length = wallLength(wall);
      if (!length) continue;
      const geometry = new THREE.BoxGeometry(length, wall.height, wall.thickness);
      const material = new THREE.MeshStandardMaterial({
        color: colorWithSelection("#e2ded3", selectedId === wall.id),
        roughness: 0.8,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(
        (wall.x1 + wall.x2) / 2,
        floor.elevation + wall.height / 2,
        (wall.y1 + wall.y2) / 2,
      );
      mesh.rotation.y = -Math.atan2(wall.y2 - wall.y1, wall.x2 - wall.x1);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.elementId = wall.id;
      selectable.push(mesh);
      scene.add(mesh);
    }

    for (const opening of project.openings) {
      const wall = project.walls.find((item) => item.id === opening.wallId);
      const floor = floorById.get(opening.floorId);
      if (!wall || !floor) continue;
      const point = openingPoint(wall, opening.offset);
      const material = new THREE.MeshStandardMaterial({
        color: opening.kind === "door" ? "#76594a" : "#6b9dad",
        roughness: opening.kind === "door" ? 0.72 : 0.25,
        metalness: opening.kind === "window" ? 0.18 : 0,
      });
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(opening.width, opening.height, 0.12),
        material,
      );
      panel.position.set(
        point.x,
        floor.elevation + (opening.sillHeight ?? 0) + opening.height / 2,
        point.z,
      );
      panel.rotation.y = -point.angle;
      panel.userData.elementId = opening.id;
      selectable.push(panel);
      scene.add(panel);
    }

    for (const stair of project.stairs) {
      const floor = floorById.get(stair.floorId);
      if (!floor) continue;
      const stepCount = 10;
      for (let i = 0; i < stepCount; i += 1) {
        const stepLength = stair.length / stepCount;
        const stepHeight = (floor.height * 0.72) / stepCount;
        const step = new THREE.Mesh(
          new THREE.BoxGeometry(stair.width, stepHeight * (i + 1), stepLength),
          new THREE.MeshStandardMaterial({ color: "#b9b4aa", roughness: 0.9 }),
        );
        step.position.set(
          stair.x + stair.width / 2,
          floor.elevation + (stepHeight * (i + 1)) / 2,
          stair.y + stepLength * (i + 0.5),
        );
        step.castShadow = true;
        step.userData.elementId = stair.id;
        selectable.push(step);
        scene.add(step);
      }
    }

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
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(selectable, false)[0];
      onSelect(hit?.object.userData.elementId);
    };
    canvas.addEventListener("click", handleClick);

    let frame = 0;
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener("click", handleClick);
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
  }, [canvasRef, onSelect, project, selectedId]);

  return (
    <div className="model-view" ref={hostRef}>
      <canvas ref={canvasRef} aria-label={`Interactive 3D model of ${project.name}`} />
      <div className="model-view__horizon" aria-hidden="true" />
      {!project.rooms.length && (
        <div className="model-view__empty">
          <span>MODEL SPACE</span>
          <strong>The building will rise here.</strong>
          <p>Add rooms in the floor plan to generate the shared 3D model.</p>
        </div>
      )}
      <div className="model-view__help">ORBIT · DRAG &nbsp;&nbsp; PAN · RIGHT DRAG &nbsp;&nbsp; ZOOM · SCROLL</div>
    </div>
  );
}
