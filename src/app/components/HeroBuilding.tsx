"use client";

import { useEffect, useRef, type PointerEvent } from "react";
import * as THREE from "three";
import styles from "./HeroBuilding.module.css";

type BoxOptions = {
  edges?: boolean;
  edgeColor?: number;
  edgeOpacity?: number;
  castShadow?: boolean;
};

const MODEL_HEIGHT = 7.2;

function addBox(
  parent: THREE.Object3D,
  size: [number, number, number],
  position: [number, number, number],
  material: THREE.Material,
  options: BoxOptions = {},
) {
  const geometry = new THREE.BoxGeometry(...size);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.castShadow = options.castShadow ?? true;
  mesh.receiveShadow = true;
  parent.add(mesh);

  if (options.edges !== false) {
    const edgeGeometry = new THREE.EdgesGeometry(geometry, 24);
    const edgeMaterial = new THREE.LineBasicMaterial({
      color: options.edgeColor ?? 0x303934,
      transparent: true,
      opacity: options.edgeOpacity ?? 0.62,
    });
    const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    mesh.add(edges);
  }

  return mesh;
}

function addLine(
  parent: THREE.Object3D,
  points: THREE.Vector3[],
  material: THREE.LineBasicMaterial | THREE.LineDashedMaterial,
) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const line = new THREE.Line(geometry, material);
  if (material instanceof THREE.LineDashedMaterial) line.computeLineDistances();
  parent.add(line);
  return line;
}

function addDimensionNode(parent: THREE.Object3D, position: THREE.Vector3, material: THREE.Material) {
  const node = new THREE.Mesh(new THREE.SphereGeometry(0.085, 18, 18), material);
  node.position.copy(position);
  parent.add(node);
}

function createTextSprite(text: string, rotation = 0) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const context = canvas.getContext("2d");

  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "rgba(244, 240, 231, .88)";
    context.roundRect(100, 34, 312, 92, 16);
    context.fill();
    context.strokeStyle = "rgba(47, 58, 52, .18)";
    context.lineWidth = 2;
    context.stroke();
    context.fillStyle = "#26322c";
    context.font = "600 50px ui-monospace, SFMono-Regular, Menlo, monospace";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, 256, 82);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    rotation,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(2.15, 0.67, 1);
  sprite.renderOrder = 20;
  return sprite;
}

function createArchitecturalModel() {
  const rig = new THREE.Group();
  const house = new THREE.Group();
  house.name = "complete-house";
  rig.add(house);

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

  // Site, terrace, and stepped approach.
  addBox(house, [13.5, 0.26, 8.4], [0, 0.05, 0], floorMaterial, { edgeOpacity: 0.72 });
  addBox(house, [9.2, 0.18, 2.15], [-1.7, 0.18, 4.55], concreteLight, { edgeOpacity: 0.48 });
  addBox(house, [3.35, 0.17, 0.68], [-3.75, 0.08, 5.65], concrete, { edgeOpacity: 0.48 });
  addBox(house, [3.05, 0.17, 0.62], [-3.75, -0.08, 5.98], concreteShade, { edgeOpacity: 0.4 });
  addBox(house, [2.75, 0.17, 0.58], [-3.75, -0.24, 6.28], concreteShade, { edgeOpacity: 0.36 });

  const jointMaterial = new THREE.LineBasicMaterial({ color: 0x667068, transparent: true, opacity: 0.2 });
  for (let x = -6; x <= 6; x += 1.5) {
    addLine(house, [new THREE.Vector3(x, 0.2, -4), new THREE.Vector3(x, 0.2, 5.55)], jointMaterial);
  }
  for (let z = -3.75; z <= 5.5; z += 1.35) {
    addLine(house, [new THREE.Vector3(-6.5, 0.2, z), new THREE.Vector3(6.5, 0.2, z)], jointMaterial);
  }

  // Ground floor: deep interior, full-height glazing, columns, and garage wing.
  addBox(house, [11.9, 3.08, 0.2], [-0.2, 1.75, -3.72], concreteShade, { edgeOpacity: 0.45 });
  addBox(house, [0.34, 3.08, 7.55], [-6.05, 1.75, 0], concreteLight, { edgeOpacity: 0.52 });
  addBox(house, [0.36, 3.08, 2.1], [6.02, 1.75, 2.72], concrete, { edgeOpacity: 0.55 });
  addBox(house, [0.36, 3.08, 1.35], [6.02, 1.75, -3.12], concreteShade, { edgeOpacity: 0.55 });
  addBox(house, [0.34, 0.46, 3.9], [6.02, 3.06, -0.84], concrete, { edgeOpacity: 0.48 });
  addBox(house, [0.16, 2.45, 3.75], [5.96, 1.57, -0.82], garage, { edges: false, castShadow: false });
  for (let z = -2.52; z <= 0.88; z += 0.38) {
    addBox(house, [0.025, 2.26, 0.025], [5.84, 1.57, z], concreteShade, { edges: false, castShadow: false });
  }

  addBox(house, [10.9, 2.72, 0.1], [-0.55, 1.68, 3.78], interiorDark, { edges: false, castShadow: false });
  const groundWindows = [[-5.28, 1.42], [-3.76, 1.42], [-2.24, 1.42], [-0.72, 1.42], [0.8, 1.42], [4.62, 1.4]] as const;
  for (const [x, width] of groundWindows) {
    addBox(house, [width, 2.7, 0.09], [x, 1.67, 3.9], glassMaterial, {
      edgeColor: 0x202b26,
      edgeOpacity: 0.82,
      castShadow: false,
    });
  }
  for (const x of [-6.02, -4.52, -3, -1.48, 0.05, 1.56, 3.77, 5.42]) {
    addBox(house, [0.16, 3.02, 0.2], [x, 1.74, 3.94], frameMaterial, { edges: false });
  }
  addBox(house, [12.5, 0.42, 0.52], [0, 3.26, 3.87], concreteLight, { edgeOpacity: 0.68 });
  addBox(house, [0.52, 3.2, 0.58], [2.62, 1.76, 3.84], concrete, { edgeOpacity: 0.55 });
  for (let index = 0; index < 12; index += 1) {
    addBox(house, [0.105, 2.78, 0.16], [1.82 + index * 0.13, 1.7, 4.08], timber, { edges: false });
  }

  // Strong horizontal datum and balcony.
  addBox(house, [12.85, 0.28, 8.08], [0, 3.48, 0], concreteLight, { edgeOpacity: 0.72 });
  addBox(house, [9.35, 0.24, 1.35], [-1.15, 3.5, 4.43], concreteLight, { edgeOpacity: 0.58 });
  addBox(house, [12.65, 0.4, 0.54], [0, 3.64, 3.92], concrete, { edgeOpacity: 0.68 });

  // Upper level: glass ribbon, corner window, balcony screen, and solid service wall.
  addBox(house, [11.85, 3.08, 0.22], [-0.2, 5.15, -3.72], concrete, { edgeOpacity: 0.5 });
  addBox(house, [0.34, 3.08, 7.55], [-6.04, 5.15, 0], concreteLight, { edgeOpacity: 0.58 });
  addBox(house, [0.36, 3.08, 3.78], [6.02, 5.15, -1.9], concrete, { edgeOpacity: 0.58 });
  addBox(house, [0.36, 0.42, 3.45], [6.02, 6.48, 1.83], concreteLight, { edgeOpacity: 0.56 });
  addBox(house, [0.11, 2.55, 3.28], [5.92, 5.12, 1.82], interiorDark, { edges: false, castShadow: false });
  addBox(house, [0.065, 2.55, 3.28], [6.01, 5.12, 1.82], glassMaterial, {
    edgeColor: 0x202b26,
    edgeOpacity: 0.76,
    castShadow: false,
  });
  for (const z of [0.32, 1.42, 2.52, 3.32]) {
    addBox(house, [0.1, 2.64, 0.12], [5.86, 5.12, z], frameMaterial, { edges: false });
  }

  addBox(house, [10.75, 2.68, 0.1], [-0.6, 5.1, 3.75], interiorDark, { edges: false, castShadow: false });
  const upperWindows = [[-5.25, 1.46], [-3.7, 1.46], [-2.15, 1.46], [-0.6, 1.46], [0.95, 1.46], [4.62, 1.5]] as const;
  for (const [x, width] of upperWindows) {
    addBox(house, [width, 2.62, 0.09], [x, 5.08, 3.88], glassMaterial, {
      edgeColor: 0x202b26,
      edgeOpacity: 0.84,
      castShadow: false,
    });
  }
  for (const x of [-6.02, -4.48, -2.92, -1.38, 0.18, 1.72, 3.78, 5.42]) {
    addBox(house, [0.15, 2.92, 0.2], [x, 5.13, 3.93], frameMaterial, { edges: false });
  }
  addBox(house, [0.55, 3.04, 0.6], [2.66, 5.15, 3.82], concreteLight, { edgeOpacity: 0.56 });
  for (let index = 0; index < 12; index += 1) {
    addBox(house, [0.105, 2.66, 0.16], [1.82 + index * 0.13, 5.1, 4.08], timber, { edges: false });
  }

  // Open roof and interior partitions: every room can be read from above.
  addBox(house, [12.65, 0.42, 0.5], [0, 6.68, 3.88], concreteLight, { edgeOpacity: 0.76 });
  addBox(house, [12.65, 0.42, 0.5], [0, 6.68, -3.84], concreteLight, { edgeOpacity: 0.76 });
  addBox(house, [0.5, 0.42, 7.25], [-6.08, 6.68, 0], concreteLight, { edgeOpacity: 0.76 });
  addBox(house, [0.5, 0.42, 7.25], [6.08, 6.68, 0], concrete, { edgeOpacity: 0.76 });
  addBox(house, [5.65, 2.9, 0.16], [-2.65, 5.12, 0.42], concreteLight, { edgeOpacity: 0.5 });
  addBox(house, [0.16, 2.9, 3.8], [-0.15, 5.12, -1.42], concrete, { edgeOpacity: 0.5 });
  addBox(house, [4.15, 2.9, 0.16], [3.85, 5.12, -0.55], concreteLight, { edgeOpacity: 0.5 });
  addBox(house, [0.16, 2.9, 2.15], [2.25, 5.12, 1.56], concrete, { edgeOpacity: 0.5 });
  addBox(house, [3.0, 1.28, 0.16], [4.52, 4.32, 2.42], concreteLight, { edgeOpacity: 0.42 });

  for (let index = 0; index < 8; index += 1) {
    addBox(house, [1.75, 0.12, 0.33], [-3.25, 3.7 + index * 0.23, 1.15 - index * 0.31], concreteShade, { edgeOpacity: 0.35 });
  }

  const dimensions = new THREE.Group();
  dimensions.name = "live-dimensions";
  rig.add(dimensions);
  const dimensionMaterial = new THREE.LineBasicMaterial({ color: 0x3e4942, transparent: true, opacity: 0.66 });
  const extensionMaterial = new THREE.LineDashedMaterial({
    color: 0x667168,
    transparent: true,
    opacity: 0.42,
    dashSize: 0.16,
    gapSize: 0.14,
  });
  const nodeMaterial = new THREE.MeshBasicMaterial({ color: 0x59645c });

  const widthStart = new THREE.Vector3(-6.3, 8.05, -4.7);
  const widthEnd = new THREE.Vector3(6.3, 8.05, -4.7);
  addLine(dimensions, [widthStart, widthEnd], dimensionMaterial);
  addLine(dimensions, [new THREE.Vector3(-6.3, 6.8, -3.85), widthStart], extensionMaterial);
  addLine(dimensions, [new THREE.Vector3(6.3, 6.8, -3.85), widthEnd], extensionMaterial);
  addDimensionNode(dimensions, widthStart, nodeMaterial);
  addDimensionNode(dimensions, widthEnd, nodeMaterial);
  const widthLabel = createTextSprite("12600");
  widthLabel.position.set(0, 8.42, -4.7);
  dimensions.add(widthLabel);

  const heightStart = new THREE.Vector3(7.35, 0, -3.95);
  const heightEnd = new THREE.Vector3(7.35, MODEL_HEIGHT, -3.95);
  addLine(dimensions, [heightStart, heightEnd], dimensionMaterial);
  addLine(dimensions, [new THREE.Vector3(6.25, 0, -3.8), heightStart], extensionMaterial);
  addLine(dimensions, [new THREE.Vector3(6.25, 6.75, -3.8), heightEnd], extensionMaterial);
  addDimensionNode(dimensions, heightStart, nodeMaterial);
  addDimensionNode(dimensions, heightEnd, nodeMaterial);
  const heightLabel = createTextSprite("7200", Math.PI / 2);
  heightLabel.position.set(7.72, 3.6, -3.95);
  dimensions.add(heightLabel);

  const depthStart = new THREE.Vector3(7.18, -0.2, -2.7);
  const depthEnd = new THREE.Vector3(7.18, -0.2, 2.7);
  addLine(dimensions, [depthStart, depthEnd], dimensionMaterial);
  addLine(dimensions, [new THREE.Vector3(6.35, 0, -2.7), depthStart], extensionMaterial);
  addLine(dimensions, [new THREE.Vector3(6.35, 0, 2.7), depthEnd], extensionMaterial);
  addDimensionNode(dimensions, depthStart, nodeMaterial);
  addDimensionNode(dimensions, depthEnd, nodeMaterial);
  const depthLabel = createTextSprite("5400");
  depthLabel.position.set(7.22, -0.5, 0);
  dimensions.add(depthLabel);

  const bayStart = new THREE.Vector3(-6.05, -0.26, 5.3);
  const bayEnd = new THREE.Vector3(-1.55, -0.26, 5.3);
  addLine(dimensions, [bayStart, bayEnd], dimensionMaterial);
  addLine(dimensions, [new THREE.Vector3(-6.05, 0, 4.15), bayStart], extensionMaterial);
  addLine(dimensions, [new THREE.Vector3(-1.55, 0, 4.15), bayEnd], extensionMaterial);
  addDimensionNode(dimensions, bayStart, nodeMaterial);
  addDimensionNode(dimensions, bayEnd, nodeMaterial);
  const bayLabel = createTextSprite("4500");
  bayLabel.position.set(-3.8, -0.58, 5.3);
  dimensions.add(bayLabel);

  for (const [label, y] of [["±0", 0.12], ["+3600", 3.58], ["+7200", 6.88]] as const) {
    const tickStart = new THREE.Vector3(-7.08, y, 3.86);
    const tickEnd = new THREE.Vector3(-6.28, y, 3.86);
    addLine(dimensions, [tickStart, tickEnd], dimensionMaterial);
    const sprite = createTextSprite(label);
    sprite.scale.set(1.55, 0.48, 1);
    sprite.position.set(-7.72, y, 3.86);
    dimensions.add(sprite);
  }

  return rig;
}

export default function HeroBuilding() {
  const mountRef = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-9, 9, 7.5, -7.5, 0.1, 100);
    camera.position.set(16.5, 13.4, 18.5);
    camera.lookAt(0, 3.25, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
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
    keyLight.shadow.camera.far = 50;
    keyLight.shadow.bias = -0.0008;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xaec0b7, 1.35);
    fillLight.position.set(10, 8, -12);
    scene.add(fillLight);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(32, 32),
      new THREE.ShadowMaterial({ color: 0x263029, opacity: 0.16, transparent: true }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.34;
    ground.receiveShadow = true;
    scene.add(ground);

    const grid = new THREE.GridHelper(25, 25, 0x5d675f, 0x879089);
    grid.position.y = -0.32;
    const gridMaterial = grid.material as THREE.LineBasicMaterial;
    gridMaterial.transparent = true;
    gridMaterial.opacity = 0.13;
    scene.add(grid);

    const rig = createArchitecturalModel();
    rig.rotation.y = -0.1;
    scene.add(rig);

    let frame = 0;
    let smoothX = 0;
    let smoothY = 0;

    const resize = () => {
      const { width, height } = mount.getBoundingClientRect();
      if (!width || !height) return;
      const aspect = width / height;
      const vertical = aspect < 0.92 ? 18.3 : 15.3;
      camera.left = (-vertical * aspect) / 2;
      camera.right = (vertical * aspect) / 2;
      camera.top = vertical / 2;
      camera.bottom = -vertical / 2;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };

    const started = performance.now();
    const render = (now: number) => {
      const time = (now - started) / 1000;
      smoothX += (pointer.current.x - smoothX) * 0.035;
      smoothY += (pointer.current.y - smoothY) * 0.035;

      rig.rotation.y = -0.1 + Math.sin(time * 0.34) * 0.105 + smoothX * 0.13;
      rig.rotation.x = Math.sin(time * 0.27) * 0.018 - smoothY * 0.045;
      rig.position.y = Math.sin(time * 0.72) * 0.075;
      const breath = 1 + Math.sin(time * 0.42) * 0.004;
      rig.scale.setScalar(breath);

      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();
    frame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      pointer.current = { x: 0, y: 0 };
      scene.traverse((object) => {
        const disposable = object as THREE.Mesh;
        disposable.geometry?.dispose();
        const materials = disposable.material
          ? Array.isArray(disposable.material)
            ? disposable.material
            : [disposable.material]
          : [];
        for (const material of materials) {
          if (material instanceof THREE.SpriteMaterial) material.map?.dispose();
          material.dispose();
        }
      });
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, []);

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    pointer.current = {
      x: ((event.clientX - bounds.left) / bounds.width - 0.5) * 2,
      y: ((event.clientY - bounds.top) / bounds.height - 0.5) * 2,
    };
  };

  const resetPointer = () => {
    pointer.current = { x: 0, y: 0 };
  };

  return (
    <div
      className={styles.wrap}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetPointer}
      role="img"
      aria-label="A complete two-storey architectural model moving slowly in three dimensions, with concrete walls, glass façades, interior rooms, and live measurement annotations."
    >
      <div className={styles.sceneHeader} aria-hidden="true">
        <span className={styles.liveLabel}><i /> Live spatial model</span>
        <span className={styles.modelCode}>AM · 12600 / 5400 / 7200</span>
      </div>

      <div ref={mountRef} className={styles.viewport} />

      <div className={styles.depthGuide} aria-hidden="true">
        <span>+7200</span>
        <i />
        <span>±0</span>
      </div>

      <div className={styles.sceneFooter} aria-hidden="true">
        <div>
          <span>Autonomous orbit</span>
          <strong>Complete model · always live</strong>
        </div>
        <small>Move pointer to shift the view</small>
      </div>
    </div>
  );
}
