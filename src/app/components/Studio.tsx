"use client";
/* eslint-disable react-hooks/refs -- WebMCP callbacks need an imperative pointer to the latest shared project. */

import {
  Box,
  Braces,
  Building2,
  Check,
  ChevronDown,
  CircleAlert,
  Copy,
  Code2,
  DoorOpen,
  Download,
  Eye,
  FilePlus2,
  Footprints,
  Grid2X2,
  History,
  FolderOpen,
  Layers3,
  Maximize2,
  Minus,
  MousePointer2,
  PanelTop,
  Plus,
  Redo2,
  RotateCw,
  Ruler,
  Scan,
  Save,
  Sparkles,
  Square,
  Trash2,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  applyOperation,
  cloneProject,
  createId,
  createInitialProject,
  glazingPerformanceDefaults,
  exteriorFinishPresets,
  projectMetrics,
  recommendedStairRun,
  roomArea,
  roomContainsPoint,
  roomTypes,
  stairConnection,
  stairFootprint,
  validateLayout,
  wallCardinalFacing,
  wallLength,
  type Actor,
  type ArchitectureOperation,
  type CameraPreset,
  type OperationOutcome,
  type Project,
  type RoomType,
  type RoomShape,
  type StairRotation,
  type ExteriorFinishId,
  type FacadeFeatureKind,
  type RailingStyle,
  type ValidationReport,
} from "@/lib/architecture";
import {
  createNewLocalProject,
  deleteLocalProject,
  duplicateLocalProject,
  exportProjectDocument,
  importProjectDocument,
  listSavedProjects,
  loadLatestProject,
  loadSavedProject,
  saveProjectLocally,
  type SavedProjectSummary,
} from "@/lib/persistence";
import { createArchMorphTools } from "@/lib/webmcp-tools";
import FloorPlan, { type CanvasTool } from "./FloorPlan";
import ModelView from "./ModelView";

type InspectorTab = "properties" | "activity" | "checks";
type ToolStatus = "native" | "preview" | "registering";
type ToolCall = {
  id: string;
  name: string;
  input: Record<string, unknown>;
  output?: unknown;
  error?: string;
  status: "running" | "success" | "error";
  duration?: number;
  timestamp: string;
  modified: boolean;
};

const toolItems: Array<{ id: CanvasTool; label: string; icon: typeof MousePointer2; key: string }> = [
  { id: "select", label: "Select & move", icon: MousePointer2, key: "V" },
  { id: "room", label: "Place room", icon: Square, key: "R" },
  { id: "wall", label: "Draw wall", icon: Minus, key: "W" },
  { id: "door", label: "Place door", icon: DoorOpen, key: "D" },
  { id: "window", label: "Place window", icon: PanelTop, key: "N" },
  { id: "stair", label: "Place straight stair", icon: Layers3, key: "S" },
  { id: "measure", label: "Measure", icon: Ruler, key: "M" },
];

const defaultRoomSize: Record<RoomType, [number, number]> = {
  "Living Room": [14, 16],
  Kitchen: [10, 12],
  Bedroom: [11, 12],
  Bathroom: [6, 8],
  Garage: [12, 20],
  Office: [9, 10],
  "Dining Room": [10, 12],
  Storage: [5, 6],
  Courtyard: [10, 10],
  Custom: [10, 10],
};

const roomSwatches: Record<RoomType, string> = {
  "Living Room": "#e8b39c",
  Kitchen: "#d8d2a7",
  Bedroom: "#a9c7c2",
  Bathroom: "#a9bfd2",
  Garage: "#c6c3bc",
  Office: "#b8b0cf",
  "Dining Room": "#d9b8a3",
  Storage: "#c9b99e",
  Courtyard: "#b9cba7",
  Custom: "#c7b7ae",
};

function formatTime(timestamp: string) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(
    new Date(timestamp),
  );
}

function downloadUrl(url: string, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function downloadText(text: string, filename: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  downloadUrl(url, filename);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function serializedPlan(svg: SVGSVGElement) {
  const copy = svg.cloneNode(true) as SVGSVGElement;
  copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  copy.setAttribute("width", "1200");
  copy.setAttribute("height", "1600");
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = `
    text{font-family:Arial,sans-serif;fill:#27332c}.room-name{font-size:1.05px;font-weight:700;letter-spacing:.03em}.room-area,.room-size{font-size:.7px}.plot-note,.setback-label{font-size:.65px;letter-spacing:.15em}.plot-dimensions,.selection-dimension{stroke:#5d665f;stroke-width:.08;fill:none}.plot-dimensions text,.selection-dimension-text,.measurement-text{font-size:.72px;fill:#4d5750;stroke:none}.empty-title{font-size:1.2px;font-weight:650}.empty-subtitle{font-size:.75px}.stair rect,.stair line{fill:none;stroke:#45534b;stroke-width:.08}.stair-label{font-size:.55px;font-weight:700}.selection-footer{font-size:.68px;letter-spacing:.12em}`;
  copy.insertBefore(style, copy.firstChild);
  return new XMLSerializer().serializeToString(copy);
}

async function svgToPng(svg: SVGSVGElement) {
  const source = serializedPlan(svg);
  const url = URL.createObjectURL(new Blob([source], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Could not render the plan snapshot."));
      image.src = url;
    });
    const ratio = Math.max(1, image.naturalWidth / Math.max(1, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = ratio >= 1 ? 1600 : Math.round(1600 * ratio);
    canvas.height = ratio >= 1 ? Math.round(1600 / ratio) : 1600;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas export is not available.");
    context.fillStyle = "#f4f2ed";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

function IconButton({
  label,
  active,
  disabled,
  children,
  onClick,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`icon-button ${active ? "is-active" : ""}`}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function NumberField({
  label,
  value,
  unit = "ft",
  min,
  max,
  step = 0.5,
  onCommit,
}: {
  label: string;
  value: number;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  onCommit: (value: number) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <span className="number-control">
        <input
          key={value}
          type="number"
          defaultValue={value}
          min={min}
          max={max}
          step={step}
          onBlur={(event) => {
            const next = Number(event.currentTarget.value);
            if (Number.isFinite(next) && next !== value && (min === undefined || next >= min) && (max === undefined || next <= max)) onCommit(next);
            else event.currentTarget.value = String(value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
        <b>{unit}</b>
      </span>
    </label>
  );
}

function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="panel-section">
      <div className="section-heading">
        <h3>{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function compactJson(value: unknown) {
  try {
    const text = JSON.stringify(value, null, 2);
    return text.length > 1600 ? `${text.slice(0, 1600)}\n…` : text;
  } catch {
    return String(value);
  }
}

export default function Studio() {
  const [project, setProject] = useState<Project>(() => createInitialProject());
  const projectRef = useRef(project);
  const [selectedId, setSelectedId] = useState<string>();
  const [tool, setTool] = useState<CanvasTool>("select");
  const [roomType, setRoomType] = useState<RoomType>("Living Room");
  const [roomShape, setRoomShape] = useState<Exclude<RoomShape, "custom">>("rectangle");
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("properties");
  const [validation, setValidation] = useState<ValidationReport>(() => validateLayout(project));
  const [debugMode, setDebugMode] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [toolStatus, setToolStatus] = useState<ToolStatus>("registering");
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [debugToolName, setDebugToolName] = useState("inspect_project");
  const [debugInput, setDebugInput] = useState("{}");
  const [toast, setToast] = useState<string>();
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [savedProjects, setSavedProjects] = useState<SavedProjectSummary[]>([]);
  const [savedVersion, setSavedVersion] = useState(0);
  const [pastCount, setPastCount] = useState(0);
  const [futureCount, setFutureCount] = useState(0);
  const pastRef = useRef<Project[]>([]);
  const futureRef = useRef<Project[]>([]);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      setDebugMode(params.get("debug") === "1" || params.get("mode") === "debug");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(undefined), 2600);
  }, []);

  const replaceProject = useCallback((next: Project, message?: string) => {
    projectRef.current = next;
    setProject(next);
    setSelectedId(undefined);
    setTool("select");
    setValidation(validateLayout(next));
    pastRef.current = [];
    futureRef.current = [];
    setPastCount(0);
    setFutureCount(0);
    setSavedVersion(next.version);
    setSavedProjects(listSavedProjects());
    setProjectMenuOpen(false);
    if (message) notify(message);
  }, [notify]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const restored = loadLatestProject();
      if (restored) replaceProject(restored, "Restored latest local project");
      else {
        saveProjectLocally(projectRef.current);
        setSavedVersion(projectRef.current.version);
        setSavedProjects(listSavedProjects());
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [replaceProject]);

  const commit = useCallback(
    (operation: ArchitectureOperation, actor: Actor = "human"): OperationOutcome => {
      const previous = projectRef.current;
      try {
        const outcome = applyOperation(previous, operation, actor);
        pastRef.current = [...pastRef.current.slice(-79), cloneProject(previous)];
        futureRef.current = [];
        projectRef.current = outcome.project;
        setProject(outcome.project);
        saveProjectLocally(outcome.project);
        setSavedVersion(outcome.project.version);
        setSavedProjects(listSavedProjects());
        if (outcome.project.view.focusElementId !== previous.view.focusElementId) {
          setSelectedId(outcome.project.view.focusElementId);
        }
        setPastCount(pastRef.current.length);
        setFutureCount(0);
        setValidation(validateLayout(outcome.project));
        if (actor === "human") notify(outcome.description.replace(/^You /, ""));
        return outcome;
      } catch (error) {
        const message = error instanceof Error ? error.message : "The operation could not be completed.";
        notify(message);
        throw error;
      }
    },
    [notify],
  );

  const noteActivity = useCallback((description: string, operation: string, actor: Actor = "agent") => {
    const current = projectRef.current;
    const next: Project = {
      ...current,
      activity: [
        {
          id: createId("activity"),
          actor,
          description,
          operation,
          timestamp: new Date().toISOString(),
          version: current.version,
        },
        ...current.activity,
      ].slice(0, 100),
    };
    projectRef.current = next;
    setProject(next);
    saveProjectLocally(next);
    setSavedVersion(next.version);
  }, []);

  const captureSnapshot = useCallback(async (options?: { download?: boolean; signal?: AbortSignal }) => {
    options?.signal?.throwIfAborted();
    const current = projectRef.current;
    let dataUrl: string;
    if (current.view.mode === "3d") {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("The 3D canvas is not ready.");
      dataUrl = canvas.toDataURL("image/png");
    } else {
      if (!svgRef.current) throw new Error("The floor plan is not ready.");
      dataUrl = await svgToPng(svgRef.current);
    }
    options?.signal?.throwIfAborted();
    const viewLabel = current.view.mode === "2d" ? "2d" : `3d-${current.view.navigationMode ?? "orbit"}`;
    const filename = `archmorph-${viewLabel}-v${current.version}.png`;
    if (options?.download) downloadUrl(dataUrl, filename);
    notify(`Captured ${current.view.mode === "2d" ? "floor plan" : current.view.navigationMode === "walk" ? "walkthrough" : current.view.cameraPreset} view`);
    return {
      projectId: current.id,
      projectVersion: current.version,
      view: current.view,
      filename,
      mimeType: "image/png",
      imageDataUrl: dataUrl,
    };
  }, [notify]);

  const exportPlan = useCallback((format: "json" | "svg", download = false, signal?: AbortSignal) => {
    signal?.throwIfAborted();
    const current = projectRef.current;
    if (format === "svg") {
      if (!svgRef.current) throw new Error("Switch to the 2D floor plan before exporting SVG.");
      const content = serializedPlan(svgRef.current);
      const filename = `archmorph-plan-v${current.version}.svg`;
      if (download) downloadText(content, filename, "image/svg+xml");
      if (download) setSavedVersion(current.version);
      return { format, filename, projectVersion: current.version, content };
    }
    const content = exportProjectDocument(current);
    const filename = `archmorph-project-v${current.version}.json`;
    if (download) downloadText(content, filename, "application/json");
    if (download) setSavedVersion(current.version);
    return { format, filename, projectVersion: current.version, content };
  }, []);

  const webTools = useMemo(
    () =>
      createArchMorphTools({
        getProject: () => projectRef.current,
        perform: (operation) => commit(operation, "agent"),
        captureSnapshot,
        exportPlan,
        noteActivity: (description, operation) => noteActivity(description, operation, "agent"),
      }),
    [captureSnapshot, commit, exportPlan, noteActivity],
  );

  const invokeTool = useCallback(async (
    name: string,
    input: Record<string, unknown> = {},
    options?: { signal: AbortSignal },
  ) => {
    const definition = webTools.find((item) => item.name === name);
    if (!definition) throw new Error(`Unknown ArchMorph tool: ${name}`);
    const callId = createId("call");
    const started = performance.now();
    const before = projectRef.current;
    setToolCalls((calls) => [
      { id: callId, name, input, status: "running" as const, timestamp: new Date().toISOString(), modified: false },
      ...calls,
    ].slice(0, 30));
    try {
      const output = await definition.execute(input, options);
      const modified = projectRef.current !== before;
      setToolCalls((calls) =>
        calls.map((call) =>
          call.id === callId
            ? { ...call, output, modified, status: "success", duration: Math.round(performance.now() - started) }
            : call,
        ),
      );
      return output;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Tool execution failed.";
      setToolCalls((calls) =>
        calls.map((call) =>
          call.id === callId
            ? { ...call, error: message, status: "error", duration: Math.round(performance.now() - started) }
            : call,
        ),
      );
      throw error;
    }
  }, [webTools]);

  useEffect(() => {
    let disposed = false;
    const registration = new AbortController();
    const register = async () => {
      const modelContext = document.modelContext;
      if (!modelContext?.registerTool) {
        setToolStatus("preview");
        return;
      }
      setToolStatus("registering");
      for (const toolDefinition of webTools) {
        if (disposed) return;
        await modelContext.registerTool({
          name: toolDefinition.name,
          description: toolDefinition.description,
          inputSchema: toolDefinition.inputSchema,
          annotations: toolDefinition.annotations,
          execute: (input, options) => invokeTool(toolDefinition.name, input, options),
        }, { signal: registration.signal });
      }
      if (!disposed) setToolStatus("native");
    };
    window.__archMorph = {
      getProject: () => cloneProject(projectRef.current),
      listTools: () => webTools.map((item) => item.name),
      invokeTool,
    };
    void register();
    return () => {
      disposed = true;
      registration.abort();
      delete window.__archMorph;
    };
  }, [invokeTool, webTools]);

  const undo = useCallback(() => {
    const previous = pastRef.current.pop();
    if (!previous) return;
    futureRef.current.push(cloneProject(projectRef.current));
    projectRef.current = previous;
    setProject(previous);
    saveProjectLocally(previous);
    setSavedVersion(previous.version);
    setValidation(validateLayout(previous));
    setSelectedId(undefined);
    setPastCount(pastRef.current.length);
    setFutureCount(futureRef.current.length);
    notify("Undid last change");
  }, [notify]);

  const redo = useCallback(() => {
    const next = futureRef.current.pop();
    if (!next) return;
    pastRef.current.push(cloneProject(projectRef.current));
    projectRef.current = next;
    setProject(next);
    saveProjectLocally(next);
    setSavedVersion(next.version);
    setValidation(validateLayout(next));
    setSelectedId(undefined);
    setPastCount(pastRef.current.length);
    setFutureCount(futureRef.current.length);
    notify("Redid change");
  }, [notify]);

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    const room = projectRef.current.rooms.find((item) => item.id === selectedId);
    try {
      commit(room ? { type: "delete_room", roomId: selectedId } : { type: "delete_element", elementId: selectedId });
      setSelectedId(undefined);
    } catch {
      // The operation pipeline already provides the user-facing error.
    }
  }, [commit, selectedId]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.matches("input, textarea, select, [contenteditable='true']")) return;
      const key = event.key.toLowerCase();
      const walking = projectRef.current.view.mode === "3d" && (projectRef.current.view.navigationMode ?? "orbit") === "walk";
      if (walking && ["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift"].includes(key)) return;
      if ((event.metaKey || event.ctrlKey) && key === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && key === "y") {
        event.preventDefault();
        redo();
        return;
      }
      const shortcut = toolItems.find((item) => item.key.toLowerCase() === key);
      if (shortcut) setTool(shortcut.id);
      if ((event.key === "Backspace" || event.key === "Delete") && selectedId) deleteSelected();
      if (event.key === "Escape") {
        setSelectedId(undefined);
        setTool("select");
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [deleteSelected, redo, selectedId, undo]);

  const selectedRoom = project.rooms.find((item) => item.id === selectedId);
  const selectedWall = project.walls.find((item) => item.id === selectedId);
  const selectedOpening = project.openings.find((item) => item.id === selectedId);
  const selectedStair = project.stairs.find((item) => item.id === selectedId);
  const selectedBalcony = project.balconies.find((item) => item.id === selectedId);
  const selectedFacadeFeature = project.facadeFeatures.find((item) => item.id === selectedId);
  const selectedStairConnection = selectedStair ? stairConnection(project, selectedStair) : undefined;
  const selectedStairFootprint = selectedStair ? stairFootprint(selectedStair) : undefined;
  const selectedStairRoom = selectedStair && selectedStairFootprint ? project.rooms.find((room) => (
    room.floorId === selectedStair.floorId
    && roomContainsPoint(room, { x: selectedStairFootprint.x + selectedStairFootprint.width / 2, y: selectedStairFootprint.y + selectedStairFootprint.length / 2 })
  )) : undefined;
  const selectedOpeningWall = selectedOpening ? project.walls.find((item) => item.id === selectedOpening.wallId) : undefined;
  const selectedFacadeFacing = selectedOpeningWall ? wallCardinalFacing(project, selectedOpeningWall) : undefined;
  const activeFloor = project.floors.find((item) => item.id === project.view.activeFloorId)!;
  const metrics = projectMetrics(project);
  const nativeStatus = toolStatus === "native";
  const navigationMode = project.view.navigationMode ?? "orbit";

  const safeCommit = (operation: ArchitectureOperation) => {
    try {
      commit(operation);
    } catch {
      // Errors are surfaced by commit as a toast.
    }
  };

  const addDefaultBalcony = (kind: "balcony" | "terrace") => {
    const width = Math.min(10, project.plot.width - 2);
    const length = Math.min(6, project.plot.length - 2);
    safeCommit({
      type: "add_balcony",
      floorId: activeFloor.id,
      name: kind === "terrace" ? "Front Terrace" : "Front Balcony",
      kind,
      x: Math.max(0, (project.plot.width - width) / 2),
      y: 0,
      width,
      length,
    });
  };

  const addDefaultFacadeFeature = (kind: FacadeFeatureKind) => {
    const wall = project.walls.find((item) => item.floorId === activeFloor.id && item.exterior && wallLength(item) >= 4);
    if (!wall) {
      notify("Add a room on this floor first so the feature has an exterior host wall");
      return;
    }
    safeCommit({ type: "add_facade_feature", kind, wallId: wall.id, offset: wallLength(wall) / 2, width: Math.min(kind === "frame" ? 8 : 6, wallLength(wall) - 1) });
  };

  const handleWalkFloorChange = useCallback((floorId: string) => {
    try {
      commit({ type: "set_active_floor", floorId });
    } catch {
      // commit handles the error.
    }
  }, [commit]);

  const createRoomAt = (point: { x: number; y: number }, type: RoomType) => {
    const [defaultWidth, defaultLength] = defaultRoomSize[type];
    const width = Math.min(defaultWidth, project.plot.width);
    const length = Math.min(defaultLength, project.plot.length);
    const x = Math.max(0, Math.min(point.x - width / 2, project.plot.width - width));
    const y = Math.max(0, Math.min(point.y - length / 2, project.plot.length - length));
    const count = project.rooms.filter((room) => room.type === type).length + 1;
    const numbered = ["Bedroom", "Bathroom", "Custom"].includes(type) && count > 1;
    try {
      const outcome = commit({
        type: "create_room",
        floorId: project.view.activeFloorId,
        name: numbered ? `${type} ${count}` : type,
        roomType: type,
        x: Math.round(x * 2) / 2,
        y: Math.round(y * 2) / 2,
        width,
        length,
        shape: roomShape,
      });
      const room = outcome.result.room as { id?: string } | undefined;
      if (room?.id) setSelectedId(room.id);
      setTool("select");
    } catch {
      // commit handles the error.
    }
  };

  const createStairAt = (point: { x: number; y: number }) => {
    const floors = [...project.floors].sort((a, b) => a.level - b.level);
    const floorIndex = floors.findIndex((floor) => floor.id === project.view.activeFloorId);
    const direction = floors[floorIndex + 1] ? "up" : floors[floorIndex - 1] ? "down" : undefined;
    if (!direction) {
      notify("Add an adjacent floor before placing a stair");
      return;
    }
    const width = 3.5;
    const length = recommendedStairRun(project, project.view.activeFloorId, direction);
    const x = Math.max(0, Math.min(point.x - width / 2, project.plot.width - width));
    const y = Math.max(0, Math.min(point.y - length / 2, project.plot.length - length));
    try {
      const outcome = commit({
        type: "add_stairs",
        floorId: project.view.activeFloorId,
        x: Math.round(x * 2) / 2,
        y: Math.round(y * 2) / 2,
        width,
        length,
        direction,
      });
      const stair = outcome.result.stair as { id?: string } | undefined;
      if (stair?.id) setSelectedId(stair.id);
      setTool("select");
    } catch {
      // commit handles the error.
    }
  };

  const runValidation = () => {
    const report = validateLayout(projectRef.current);
    setValidation(report);
    noteActivity(`You validated the layout · ${report.issueCount} ${report.issueCount === 1 ? "issue" : "issues"}`, "validate_layout", "human");
    setInspectorTab("checks");
    notify(report.issueCount ? `Found ${report.issueCount} layout ${report.issueCount === 1 ? "issue" : "issues"}` : "Layout checks passed");
  };

  const runDebugTool = async () => {
    try {
      const parsed = JSON.parse(debugInput) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Tool input must be a JSON object.");
      }
      await invokeTool(debugToolName, parsed as Record<string, unknown>);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Invalid WebMCP tool input.");
    }
  };

  const saveCurrentProject = () => {
    saveProjectLocally(projectRef.current);
    setSavedVersion(projectRef.current.version);
    setSavedProjects(listSavedProjects());
    setProjectMenuOpen(false);
    notify("Project saved locally");
  };

  const createProject = () => {
    const next = createNewLocalProject("Untitled Residence", projectRef.current.plot);
    replaceProject(next, "Created a new local project");
  };

  const duplicateProject = () => {
    const next = duplicateLocalProject(projectRef.current);
    replaceProject(next, "Duplicated project");
  };

  const removeCurrentProject = () => {
    if (!window.confirm(`Delete “${projectRef.current.name}” from this device? This cannot be undone.`)) return;
    const next = deleteLocalProject(projectRef.current.id) ?? createNewLocalProject();
    replaceProject(next, "Deleted local project");
  };

  const importProject = async (file?: File) => {
    if (!file) return;
    try {
      const next = importProjectDocument(await file.text());
      replaceProject(next, "Imported project");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not import this project.");
    } finally {
      if (importInputRef.current) importInputRef.current.value = "";
    }
  };

  return (
    <main className="studio-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true"><span>AM</span></div>
          <div>
            <strong>ArchMorph</strong>
            <span>RESIDENTIAL STUDIO</span>
          </div>
        </div>
        <div className="project-switcher">
          <button className="project-title" type="button" title="Project files" aria-expanded={projectMenuOpen} onClick={() => { setSavedProjects(listSavedProjects()); setProjectMenuOpen((value) => !value); }}>
            <Building2 size={14} />
            <span>{project.name}</span>
            <i>{savedVersion === project.version ? "Saved locally" : `v${project.version}`}</i>
            <ChevronDown size={13} />
          </button>
          {projectMenuOpen && (
            <div className="project-menu" role="dialog" aria-label="Project files">
              <label className="project-name-field"><span>Project name</span><input key={`${project.id}:${project.name}`} defaultValue={project.name} onBlur={(event) => { const name = event.currentTarget.value.trim(); if (name && name !== project.name) safeCommit({ type: "rename_project", name }); else event.currentTarget.value = project.name; }} /></label>
              <div className="project-menu-actions">
                <button type="button" onClick={saveCurrentProject}><Save size={14} />Save</button>
                <button type="button" onClick={createProject}><FilePlus2 size={14} />New</button>
                <button type="button" onClick={duplicateProject}><Copy size={14} />Duplicate</button>
                <button type="button" onClick={() => { exportPlan("json", true); setProjectMenuOpen(false); notify("Project exported"); }}><Download size={14} />Export</button>
                <button type="button" onClick={() => importInputRef.current?.click()}><Upload size={14} />Import</button>
                <button type="button" className="is-danger" onClick={removeCurrentProject}><Trash2 size={14} />Delete</button>
              </div>
              <div className="saved-projects"><span>Projects on this device</span>{savedProjects.map((saved) => (
                <button key={saved.id} type="button" className={saved.id === project.id ? "is-active" : ""} onClick={() => replaceProject(loadSavedProject(saved.id), `Loaded ${saved.name}`)}>
                  <FolderOpen size={14} /><span><b>{saved.name}</b><small>{saved.floorCount} floor{saved.floorCount === 1 ? "" : "s"} · {saved.roomCount} rooms · v{saved.version}</small></span>
                </button>
              ))}</div>
            </div>
          )}
          <input ref={importInputRef} hidden type="file" accept="application/json,.json,.archmorph" onChange={(event) => void importProject(event.currentTarget.files?.[0])} />
        </div>
        <div className="view-switch" role="group" aria-label="Drawing view">
          <button className={project.view.mode === "2d" ? "is-active" : ""} onClick={() => safeCommit({ type: "switch_view", mode: "2d" })}>
            <Grid2X2 size={14} /> Floor plan
          </button>
          <button className={project.view.mode === "3d" && navigationMode === "orbit" ? "is-active" : ""} onClick={() => safeCommit({ type: "set_navigation_mode", mode: "orbit" })}>
            <Box size={15} /> 3D Orbit
          </button>
          <button className={project.view.mode === "3d" && navigationMode === "walk" ? "is-active" : ""} onClick={() => safeCommit({ type: "set_navigation_mode", mode: "walk", roomId: selectedRoom?.id })}>
            <Footprints size={15} /> Walk
          </button>
        </div>
        <div className="top-actions">
          <IconButton label="Undo" disabled={!pastCount} onClick={undo}><Undo2 size={17} /></IconButton>
          <IconButton label="Redo" disabled={!futureCount} onClick={redo}><Redo2 size={17} /></IconButton>
          <div className="top-divider" />
          {debugMode && (
            <button type="button" className={`agent-pill ${nativeStatus ? "is-live" : ""}`} onClick={() => setDebugOpen(true)}>
              <span className="agent-orb"><Sparkles size={12} /></span>
              <span><b>{nativeStatus ? "Agent ready" : "WebMCP preview"}</b><small>{webTools.length} tools · shared state</small></span>
            </button>
          )}
          <button type="button" className="export-button" onClick={() => { exportPlan(project.view.mode === "2d" ? "svg" : "json", true); notify("Project exported"); }}>
            <Download size={15} /> Export
          </button>
        </div>
      </header>

      <div className="workspace">
        <aside className="tool-rail" aria-label="Architectural tools">
          <div className="rail-tools">
            {toolItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={tool === item.id ? "is-active" : ""}
                  onClick={() => setTool(item.id)}
                  title={`${item.label} (${item.key})`}
                  aria-pressed={tool === item.id}
                >
                  <Icon size={19} />
                  <span>{item.label}</span>
                  <kbd>{item.key}</kbd>
                </button>
              );
            })}
          </div>
          {debugMode && (
            <div className="rail-bottom">
              <button type="button" className={debugOpen ? "is-active" : ""} onClick={() => setDebugOpen((value) => !value)} title="WebMCP developer view">
                <Code2 size={18} /><span>WebMCP</span>
              </button>
            </div>
          )}
        </aside>

        <aside className="library-panel">
          <div className="panel-scroll">
            <Section title="Site">
              <div className="site-line"><span>Rectangular plot</span><b>{project.plot.width}&apos; × {project.plot.length}&apos;</b></div>
              <div className="site-line"><span>Front faces</span><b>{project.plot.orientation}</b></div>
            </Section>

            <Section title="Exterior finish">
              <label className="field field-full"><span>Façade palette</span><select value={project.exteriorFinish} onChange={(event) => safeCommit({ type: "set_exterior_finish", finish: event.target.value as ExteriorFinishId })}>{Object.entries(exteriorFinishPresets).map(([id, finish]) => <option key={id} value={id}>{finish.label}</option>)}</select></label>
              <p className="technical-note">Project default with optional per-wall overrides; lightweight visual materials only.</p>
            </Section>

            <Section title="Exterior systems" action={<span className="section-hint">LIGHTWEIGHT</span>}>
              <div className="room-library">
                <button type="button" onClick={() => addDefaultBalcony(activeFloor.level > 0 ? "balcony" : "terrace")}>
                  <span style={{ background: "#b8aea0" }} /><div><b>{activeFloor.level > 0 ? "Add balcony" : "Add terrace"}</b><small>Slab + configurable railing</small></div><Plus size={14} />
                </button>
                {(["canopy", "frame", "sunshade"] as FacadeFeatureKind[]).map((kind) => (
                  <button type="button" key={kind} onClick={() => addDefaultFacadeFeature(kind)}>
                    <span style={{ background: kind === "frame" ? "#9f6653" : kind === "canopy" ? "#69756f" : "#aaa79f" }} /><div><b>Add {kind}</b><small>Exterior-wall hosted feature</small></div><Plus size={14} />
                  </button>
                ))}
              </div>
              <button type="button" className="walk-inside-button" onClick={() => safeCommit({ type: "set_site_boundary", enabled: !project.siteBoundary.enabled })}>
                <Building2 size={15} /> {project.siteBoundary.enabled ? "Hide" : "Add"} boundary wall + gate
              </button>
            </Section>

            <Section title="Rooms" action={<span className="section-hint">CLICK TO PLACE</span>}>
              <label className="field field-full"><span>Footprint shape</span><select value={roomShape} onChange={(event) => setRoomShape(event.target.value as Exclude<RoomShape, "custom">)}><option value="rectangle">Rectangle</option><option value="l-shape">L-shaped</option><option value="t-shape">T-shaped</option><option value="u-shape">U-shaped</option></select></label>
              <div className="room-library">
                {roomTypes.map((type) => (
                  <button
                    type="button"
                    key={type}
                    className={roomType === type && tool === "room" ? "is-active" : ""}
                    onClick={() => { setRoomType(type); setTool("room"); }}
                  >
                    <span style={{ background: roomSwatches[type] }} />
                    <div><b>{type}</b><small>{defaultRoomSize[type][0]}′ × {defaultRoomSize[type][1]}′ default</small></div>
                    <Plus size={14} />
                  </button>
                ))}
              </div>
            </Section>

            <Section title="Floors" action={
              <button className="text-action" type="button" onClick={() => safeCommit({ type: "create_floor" })}><Plus size={13} /> Add</button>
            }>
              <div className="floor-list">
                {[...project.floors].sort((a, b) => a.level - b.level).map((floor) => {
                  const roomCount = project.rooms.filter((room) => room.floorId === floor.id).length;
                  const stairCount = project.stairs.filter((stair) => stair.floorId === floor.id || stairConnection(project, stair)?.targetFloor.id === floor.id).length;
                  return (
                    <button
                      key={floor.id}
                      type="button"
                      className={floor.id === project.view.activeFloorId ? "is-active" : ""}
                      onClick={() => safeCommit({ type: "set_active_floor", floorId: floor.id })}
                    >
                      <Layers3 size={15} /><span><b>{floor.name}</b><small>{roomCount} {roomCount === 1 ? "room" : "rooms"}{stairCount ? ` · ${stairCount} stair connection${stairCount === 1 ? "" : "s"}` : ""}</small></span>
                    </button>
                  );
                })}
              </div>
            </Section>
          </div>
          <div className="library-foot">
            <span>Grid 1 ft</span><span>Snap 6 in</span><span>Units ft</span>
          </div>
        </aside>

        <section className="canvas-stage">
          <div className="canvas-toolbar">
            <div className="metric-strip">
              <span><small>NET FLOOR</small><b>{metrics.totalNetFloorArea.toLocaleString()} <i>sq ft</i></b></span>
              <span><small>GROSS</small><b>{metrics.grossCoveredArea.toLocaleString()} <i>sq ft</i></b></span>
              <span><small>OPEN SITE</small><b>{metrics.openSiteArea.toLocaleString()} <i>sq ft</i></b></span>
            </div>
            <div className="canvas-controls">
              {project.view.mode === "3d" && navigationMode === "orbit" && (
                <select
                  aria-label="Camera view"
                  value={project.view.cameraPreset}
                  onChange={(event) => safeCommit({ type: "set_camera", preset: event.target.value as CameraPreset })}
                >
                  <option value="front-right">Perspective</option>
                  <option value="front">Street elevation</option>
                  <option value="rear">Rear elevation</option>
                  <option value="top">Top overview</option>
                </select>
              )}
              <IconButton label="Focus whole project" onClick={() => safeCommit({ type: "focus_element" })}><Scan size={16} /></IconButton>
              <IconButton label="Capture snapshot" onClick={() => void captureSnapshot({ download: true })}><Maximize2 size={16} /></IconButton>
            </div>
          </div>

          <div className={`design-viewport mode-${project.view.mode} navigation-${navigationMode}`}>
            {project.view.mode === "2d" ? (
              <FloorPlan
                project={project}
                tool={tool}
                roomType={roomType}
                selectedId={selectedId}
                svgRef={svgRef}
                onSelect={setSelectedId}
                onCreateRoom={createRoomAt}
                onMoveRoom={(roomId, point) => safeCommit({ type: "move_room", roomId, ...point })}
                onResizeRoom={(roomId, width, length) => safeCommit({ type: "resize_room", roomId, width, length })}
                onUpdateRoomVertices={(roomId, vertices) => safeCommit({ type: "update_room_vertices", roomId, vertices })}
                onAddWall={(start, end) => safeCommit({ type: "add_wall", floorId: project.view.activeFloorId, x1: start.x, y1: start.y, x2: end.x, y2: end.y })}
                onMoveWall={(wallId, dx, dy) => safeCommit({ type: "move_wall", wallId, dx, dy })}
                onAddOpening={(kind, wallId, offset) => safeCommit({ type: "add_opening", kind, wallId, offset })}
                onRemoveOpening={(openingId) => safeCommit({ type: "delete_element", elementId: openingId })}
                onAddStair={createStairAt}
                onMoveStair={(stairId, x, y) => safeCommit({ type: "update_stairs", stairId, x, y })}
              />
            ) : (
              <ModelView
                project={project}
                navigationMode={navigationMode}
                selectedId={selectedId}
                canvasRef={canvasRef}
                onSelect={setSelectedId}
                onWalkFloorChange={handleWalkFloorChange}
              />
            )}
          </div>

          <div className="statusbar">
            <span><span className="status-dot" /> {activeFloor.name}</span>
            <span>{toolItems.find((item) => item.id === tool)?.label}</span>
            <span className="status-message">{project.view.mode === "3d" && navigationMode === "walk" ? "WASD / arrows to move · Walk onto a stair to change levels · Minimap tracks your floor and room" : tool === "room" ? `Click the plot to place a ${roomType.toLowerCase()}` : tool === "stair" ? "Click the plan to place a straight stair between adjacent floors" : tool === "door" || tool === "window" ? `Click a wall to add a ${tool} · Click an existing ${tool} to remove it` : project.view.mode === "3d" ? "Drag to orbit · Shift-drag to pan · Scroll to zoom" : "Drag rooms and stairs to move · Draw walls with orthogonal / 45° snapping"}</span>
            {debugMode && <span>Project v{project.version}</span>}
          </div>
        </section>

        <aside className="inspector">
          <div className="inspector-tabs">
            <button className={inspectorTab === "properties" ? "is-active" : ""} onClick={() => setInspectorTab("properties")}>Properties</button>
            <button className={inspectorTab === "activity" ? "is-active" : ""} onClick={() => setInspectorTab("activity")}>History</button>
            <button className={inspectorTab === "checks" ? "is-active" : ""} onClick={() => setInspectorTab("checks")}>
              Checks {validation.issueCount > 0 && <em>{validation.issueCount}</em>}
            </button>
          </div>
          <div className="inspector-scroll">
            {inspectorTab === "properties" && (
              <>
                <div className="selection-title">
                  <span className="selection-icon">
                    {selectedRoom ? <Square size={17} /> : selectedWall ? <Minus size={17} /> : selectedOpening ? <DoorOpen size={17} /> : selectedStair ? <Layers3 size={17} /> : selectedBalcony ? <PanelTop size={17} /> : selectedFacadeFeature ? <Maximize2 size={17} /> : <Grid2X2 size={17} />}
                  </span>
                  <div>
                    <small>{selectedRoom ? selectedRoom.type : selectedWall ? "Wall" : selectedOpening ? selectedOpening.kind : selectedStair ? "Staircase" : selectedBalcony ? selectedBalcony.kind : selectedFacadeFeature ? "Façade feature" : "Project site"}</small>
                    <h2>{selectedRoom?.name ?? (selectedWall ? selectedWall.roomIds.length > 1 ? "Shared wall" : selectedWall.side ? `${selectedWall.side} wall` : "Independent wall" : selectedOpening ? `${selectedOpening.kind[0].toUpperCase()}${selectedOpening.kind.slice(1)}` : selectedStair ? "Staircase" : selectedBalcony ? selectedBalcony.name : selectedFacadeFeature ? selectedFacadeFeature.kind[0].toUpperCase() + selectedFacadeFeature.kind.slice(1) : project.name)}</h2>
                  </div>
                  {selectedId && <button type="button" onClick={deleteSelected} title="Delete selected element"><Trash2 size={16} /></button>}
                </div>

                {selectedRoom ? (
                  <>
                    <Section title="Identity">
                      <label className="field field-full"><span>Name</span><input key={`${selectedRoom.id}:${selectedRoom.name}`} defaultValue={selectedRoom.name} onBlur={(event) => { const name = event.currentTarget.value.trim(); if (name && name !== selectedRoom.name) safeCommit({ type: "update_room", roomId: selectedRoom.id, name }); else event.currentTarget.value = selectedRoom.name; }} /></label>
                      <label className="field field-full"><span>Room type</span><select value={selectedRoom.type} onChange={(event) => safeCommit({ type: "update_room", roomId: selectedRoom.id, roomType: event.target.value as RoomType })}>{roomTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
                    </Section>
                    <Section title="Dimensions">
                      <div className="field-grid">
                        <NumberField label="Width" value={selectedRoom.width} min={3} onCommit={(width) => safeCommit({ type: "resize_room", roomId: selectedRoom.id, width, length: selectedRoom.length })} />
                        <NumberField label="Length" value={selectedRoom.length} min={3} onCommit={(length) => safeCommit({ type: "resize_room", roomId: selectedRoom.id, width: selectedRoom.width, length })} />
                        <NumberField label="X position" value={selectedRoom.x} min={0} onCommit={(x) => safeCommit({ type: "move_room", roomId: selectedRoom.id, x, y: selectedRoom.y })} />
                        <NumberField label="Y position" value={selectedRoom.y} min={0} onCommit={(y) => safeCommit({ type: "move_room", roomId: selectedRoom.id, x: selectedRoom.x, y })} />
                      </div>
                      <div className="area-result"><span>Net room area</span><b>{roomArea(selectedRoom).toLocaleString()} sq ft</b></div>
                    </Section>
                    <Section title="Element">
                      <div className="detail-list"><span>Footprint <b>{(selectedRoom.shape ?? "rectangle").replace("-", " ")}</b></span><span>Floor <b>{project.floors.find((floor) => floor.id === selectedRoom.floorId)?.name}</b></span><span>Boundary segments <b>{selectedRoom.wallIds.length}</b></span></div>
                      <button type="button" className="walk-inside-button" onClick={() => safeCommit({ type: "set_navigation_mode", mode: "walk", roomId: selectedRoom.id })}><Footprints size={15} /> Walk inside {selectedRoom.name}</button>
                    </Section>
                  </>
                ) : selectedWall ? (
                  <>
                    <Section title="Geometry"><div className="detail-list"><span>Length <b>{wallLength(selectedWall).toFixed(2)} ft</b></span><span>Thickness <b>{selectedWall.thickness} ft</b></span><span>Height <b>{selectedWall.height} ft</b></span><span>Topology <b>{selectedWall.exterior ? "Exterior" : selectedWall.roomIds.length > 1 ? "Shared interior" : "Independent"}</b></span><span>Adjacent spaces <b>{selectedWall.roomIds.map((roomId) => project.rooms.find((room) => room.id === roomId)?.name ?? roomId).join(" / ") || "None"}</b></span></div></Section>
                    {selectedWall.exterior && <Section title="Façade finish"><label className="field field-full"><span>Wall material</span><select value={selectedWall.finish ?? ""} onChange={(event) => safeCommit({ type: "set_wall_finish", wallId: selectedWall.id, finish: (event.target.value || undefined) as ExteriorFinishId | undefined })}><option value="">Project default · {exteriorFinishPresets[project.exteriorFinish].label}</option>{Object.entries(exteriorFinishPresets).map(([id, finish]) => <option key={id} value={id}>{finish.label}</option>)}</select></label><p className="technical-note">A wall override stays attached to this canonical exterior wall; reset it to follow the project palette.</p></Section>}
                    <Section title="Openings"><div className="detail-list"><span>Doors <b>{project.openings.filter((item) => item.wallId === selectedWall.id && item.kind === "door").length}</b></span><span>Windows <b>{project.openings.filter((item) => item.wallId === selectedWall.id && item.kind === "window").length}</b></span></div></Section>
                  </>
                ) : selectedOpening ? (
                  <>
                    <Section title="Opening geometry">
                      <div className="field-grid">
                        <NumberField label="Offset" value={selectedOpening.offset} min={0} onCommit={(offset) => safeCommit({ type: "update_opening", openingId: selectedOpening.id, offset })} />
                        <NumberField label="Width" value={selectedOpening.width} min={0.5} onCommit={(width) => safeCommit({ type: "update_opening", openingId: selectedOpening.id, width })} />
                        <NumberField label="Height" value={selectedOpening.height} min={0.5} onCommit={(height) => safeCommit({ type: "update_opening", openingId: selectedOpening.id, height })} />
                        {selectedOpening.kind === "window" && <NumberField label="Sill height" value={selectedOpening.sillHeight ?? 0} min={0} onCommit={(sillHeight) => safeCommit({ type: "update_opening", openingId: selectedOpening.id, sillHeight })} />}
                      </div>
                    </Section>
                    <Section title="Host wall">
                      <label className="field field-full"><span>Architectural wall</span><select value={selectedOpening.wallId} onChange={(event) => { const wall = project.walls.find((item) => item.id === event.target.value); if (wall) safeCommit({ type: "rehost_opening", openingId: selectedOpening.id, wallId: wall.id, offset: Math.max(selectedOpening.width / 2, Math.min(selectedOpening.offset, wallLength(wall) - selectedOpening.width / 2)) }); }}>{project.walls.filter((wall) => wall.floorId === selectedOpening.floorId && wall.roomIds.length > 0 && wallLength(wall) >= selectedOpening.width).map((wall) => <option key={wall.id} value={wall.id}>{wall.exterior ? `${wallCardinalFacing(project, wall) ?? "Exterior"} façade` : wall.roomIds.map((roomId) => project.rooms.find((room) => room.id === roomId)?.name).filter(Boolean).join(" / ")} · {wallLength(wall).toFixed(1)} ft</option>)}</select></label>
                    </Section>
                    {selectedOpening.kind === "door" ? (
                      <Section title="Door configuration">
                        <div className="field-grid">
                          <label className="field"><span>Hinge side</span><select value={selectedOpening.hingeSide ?? "start"} onChange={(event) => safeCommit({ type: "update_opening", openingId: selectedOpening.id, hingeSide: event.target.value as "start" | "end" })}><option value="start">Start</option><option value="end">End</option></select></label>
                          <label className="field"><span>Handing</span><select value={selectedOpening.handing ?? "left"} onChange={(event) => safeCommit({ type: "update_opening", openingId: selectedOpening.id, handing: event.target.value as "left" | "right" })}><option value="left">Left</option><option value="right">Right</option></select></label>
                          <label className="field"><span>Swing</span><select value={selectedOpening.swingDirection ?? "inward"} onChange={(event) => safeCommit({ type: "update_opening", openingId: selectedOpening.id, swingDirection: event.target.value as "inward" | "outward" })}><option value="inward">Inward</option><option value="outward">Outward</option></select></label>
                          <label className="field"><span>State</span><select value={selectedOpening.state ?? "open"} onChange={(event) => safeCommit({ type: "update_opening", openingId: selectedOpening.id, state: event.target.value as "open" | "closed" })}><option value="open">Open</option><option value="closed">Closed</option></select></label>
                        </div>
                      </Section>
                    ) : (
                      <Section title="Window configuration">
                        <div className="field-grid">
                          <label className="field"><span>Type</span><select value={selectedOpening.windowType ?? "fixed"} onChange={(event) => safeCommit({ type: "update_opening", openingId: selectedOpening.id, windowType: event.target.value as "fixed" | "casement" | "sliding" | "awning" })}><option value="fixed">Fixed</option><option value="casement">Casement</option><option value="sliding">Sliding</option><option value="awning">Awning</option></select></label>
                          <label className="field"><span>Operation</span><select value={selectedOpening.operable ? "operable" : "fixed"} onChange={(event) => safeCommit({ type: "update_opening", openingId: selectedOpening.id, operable: event.target.value === "operable" })}><option value="fixed">Fixed</option><option value="operable">Operable</option></select></label>
                          <label className="field"><span>Glazing system</span><select value={selectedOpening.glazing ?? "clear"} onChange={(event) => { const glazing = event.target.value as keyof typeof glazingPerformanceDefaults; const { label: _label, ...performance } = glazingPerformanceDefaults[glazing]; void _label; safeCommit({ type: "update_opening", openingId: selectedOpening.id, glazing, ...performance }); }}><option value="clear">Clear double</option><option value="low-e">Low-e double</option><option value="privacy">Obscure double</option></select></label>
                          <NumberField label="SHGC" unit="" value={selectedOpening.solarHeatGainCoefficient ?? 0.55} min={0} max={1} step={0.01} onCommit={(solarHeatGainCoefficient) => safeCommit({ type: "update_opening", openingId: selectedOpening.id, solarHeatGainCoefficient })} />
                          <NumberField label="Visible transmittance" unit="" value={selectedOpening.visibleTransmittance ?? 0.7} min={0} max={1} step={0.01} onCommit={(visibleTransmittance) => safeCommit({ type: "update_opening", openingId: selectedOpening.id, visibleTransmittance })} />
                          <NumberField label="U-factor" unit="IP" value={selectedOpening.uFactor ?? 0.45} min={0.1} max={2} step={0.01} onCommit={(uFactor) => safeCommit({ type: "update_opening", openingId: selectedOpening.id, uFactor })} />
                        </div>
                        <p className="technical-note">Concept inputs: SHGC describes admitted solar heat, VT describes visible daylight, and U-factor describes heat flow. Confirm final values against a rated product and the project climate.</p>
                      </Section>
                    )}
                    <Section title="Architectural context"><div className="detail-list"><span>Host <b>{selectedOpeningWall?.exterior ? "Exterior wall" : "Interior wall"}</b></span>{selectedFacadeFacing && <span>Façade faces <b>{selectedFacadeFacing}</b></span>}<span>Representation <b>Plan + 3D synchronized</b></span></div></Section>
                  </>
                ) : selectedStair ? (
                  <>
                    <Section title="Straight stair geometry">
                      <div className="field-grid">
                        <NumberField label="Width" value={selectedStair.width} min={3} onCommit={(width) => safeCommit({ type: "update_stairs", stairId: selectedStair.id, width })} />
                        <NumberField label="Run length" value={selectedStair.length} min={6} onCommit={(length) => safeCommit({ type: "update_stairs", stairId: selectedStair.id, length })} />
                        <NumberField label="X position" value={selectedStair.x} min={0} onCommit={(x) => safeCommit({ type: "update_stairs", stairId: selectedStair.id, x })} />
                        <NumberField label="Y position" value={selectedStair.y} min={0} onCommit={(y) => safeCommit({ type: "update_stairs", stairId: selectedStair.id, y })} />
                      </div>
                      <label className="field field-full stair-direction-field"><span>Connection direction</span><select value={selectedStair.direction} onChange={(event) => safeCommit({ type: "update_stairs", stairId: selectedStair.id, direction: event.target.value as "up" | "down" })}><option value="up">Up to next floor</option><option value="down">Down to previous floor</option></select></label>
                      <label className="field field-full stair-direction-field"><span>Plan rotation</span><select value={selectedStair.rotation} onChange={(event) => safeCommit({ type: "update_stairs", stairId: selectedStair.id, rotation: Number(event.target.value) as StairRotation })}><option value={0}>0°</option><option value={90}>90°</option><option value={180}>180°</option><option value={270}>270°</option></select></label>
                      <button type="button" className="walk-inside-button" onClick={() => safeCommit({ type: "update_stairs", stairId: selectedStair.id, rotation: ((selectedStair.rotation + 90) % 360) as StairRotation })}><RotateCw size={15} /> Rotate 90°</button>
                    </Section>
                    <Section title="Vertical connection">
                      {selectedStairConnection ? (
                        <div className="detail-list"><span>Connects <b>{selectedStairConnection.sourceFloor.name} → {selectedStairConnection.targetFloor.name}</b></span><span>Floor-to-floor rise <b>{selectedStairConnection.rise} ft</b></span><span>Concept risers <b>{selectedStairConnection.riserCount} × {(selectedStairConnection.riserHeight * 12).toFixed(2)} in</b></span><span>Concept tread depth <b>{(selectedStairConnection.treadDepth * 12).toFixed(2)} in</b></span><span>Recommended straight run <b>{selectedStairConnection.recommendedRun} ft</b></span></div>
                      ) : <p className="technical-note is-warning">This stair has no adjacent destination floor in its current direction.</p>}
                      <p className="technical-note">Concept check uses a 7¾ in maximum riser and 10 in minimum tread. Landings, headroom, handrails, guards, structure, and local code still require project-specific review.</p>
                    </Section>
                    <button type="button" className="walk-inside-button inspector-walk-button" onClick={() => safeCommit({ type: "set_navigation_mode", mode: "walk", roomId: selectedStairRoom?.id })}><Footprints size={15} /> Test this connection in Walk Mode</button>
                  </>
                ) : selectedBalcony ? (
                  <>
                    <Section title="Platform geometry">
                      <label className="field field-full"><span>Name</span><input key={`${selectedBalcony.id}:${selectedBalcony.name}`} defaultValue={selectedBalcony.name} onBlur={(event) => safeCommit({ type: "update_balcony", balconyId: selectedBalcony.id, name: event.currentTarget.value })} /></label>
                      <div className="field-grid">
                        <NumberField label="Width" value={selectedBalcony.width} min={3} onCommit={(width) => safeCommit({ type: "update_balcony", balconyId: selectedBalcony.id, width })} />
                        <NumberField label="Length" value={selectedBalcony.length} min={3} onCommit={(length) => safeCommit({ type: "update_balcony", balconyId: selectedBalcony.id, length })} />
                        <NumberField label="X position" value={selectedBalcony.x} min={0} onCommit={(x) => safeCommit({ type: "update_balcony", balconyId: selectedBalcony.id, x })} />
                        <NumberField label="Y position" value={selectedBalcony.y} min={0} onCommit={(y) => safeCommit({ type: "update_balcony", balconyId: selectedBalcony.id, y })} />
                        <NumberField label="Slab thickness" value={selectedBalcony.slabThickness} min={0.25} max={2} step={0.05} onCommit={(slabThickness) => safeCommit({ type: "update_balcony", balconyId: selectedBalcony.id, slabThickness })} />
                      </div>
                      <label className="field field-full"><span>Type</span><select value={selectedBalcony.kind} onChange={(event) => safeCommit({ type: "update_balcony", balconyId: selectedBalcony.id, kind: event.target.value as "balcony" | "terrace" })}><option value="balcony">Balcony</option><option value="terrace">Terrace</option></select></label>
                    </Section>
                    <Section title="Railing">
                      <label className="field field-full"><span>Railing</span><select value={selectedBalcony.railing.enabled ? "enabled" : "disabled"} onChange={(event) => safeCommit({ type: "update_balcony", balconyId: selectedBalcony.id, railingEnabled: event.target.value === "enabled" })}><option value="enabled">Enabled</option><option value="disabled">Disabled</option></select></label>
                      <div className="field-grid"><NumberField label="Height" value={selectedBalcony.railing.height} min={2} max={6} step={0.1} onCommit={(railingHeight) => safeCommit({ type: "update_balcony", balconyId: selectedBalcony.id, railingHeight })} /><label className="field"><span>Style</span><select value={selectedBalcony.railing.style} onChange={(event) => safeCommit({ type: "update_balcony", balconyId: selectedBalcony.id, railingStyle: event.target.value as RailingStyle })}><option value="horizontal">Horizontal</option><option value="vertical">Vertical</option><option value="solid">Solid</option></select></label></div>
                    </Section>
                    <Section title="Finish"><label className="field field-full"><span>Material</span><select value={selectedBalcony.finish} onChange={(event) => safeCommit({ type: "update_balcony", balconyId: selectedBalcony.id, finish: event.target.value as ExteriorFinishId })}>{Object.entries(exteriorFinishPresets).map(([id, finish]) => <option key={id} value={id}>{finish.label}</option>)}</select></label></Section>
                  </>
                ) : selectedFacadeFeature ? (
                  <>
                    <Section title="Façade feature">
                      <label className="field field-full"><span>Type</span><select value={selectedFacadeFeature.kind} onChange={(event) => safeCommit({ type: "update_facade_feature", featureId: selectedFacadeFeature.id, kind: event.target.value as FacadeFeatureKind })}><option value="frame">Frame</option><option value="canopy">Canopy</option><option value="sunshade">Sunshade</option></select></label>
                      <div className="field-grid">
                        <NumberField label="Offset" value={selectedFacadeFeature.offset} min={0.5} onCommit={(offset) => safeCommit({ type: "update_facade_feature", featureId: selectedFacadeFeature.id, offset })} />
                        <NumberField label="Width" value={selectedFacadeFeature.width} min={1} onCommit={(width) => safeCommit({ type: "update_facade_feature", featureId: selectedFacadeFeature.id, width })} />
                        <NumberField label="Elevation" value={selectedFacadeFeature.elevation} min={0} onCommit={(elevation) => safeCommit({ type: "update_facade_feature", featureId: selectedFacadeFeature.id, elevation })} />
                        <NumberField label="Height" value={selectedFacadeFeature.height} min={0.1} onCommit={(height) => safeCommit({ type: "update_facade_feature", featureId: selectedFacadeFeature.id, height })} />
                        <NumberField label="Projection" value={selectedFacadeFeature.projection} min={0.1} max={8} step={0.1} onCommit={(projection) => safeCommit({ type: "update_facade_feature", featureId: selectedFacadeFeature.id, projection })} />
                        <NumberField label="Thickness" value={selectedFacadeFeature.thickness} min={0.1} max={2} step={0.05} onCommit={(thickness) => safeCommit({ type: "update_facade_feature", featureId: selectedFacadeFeature.id, thickness })} />
                      </div>
                    </Section>
                    <Section title="Host + finish">
                      <label className="field field-full"><span>Exterior wall</span><select value={selectedFacadeFeature.wallId} onChange={(event) => { const wall = project.walls.find((item) => item.id === event.target.value)!; safeCommit({ type: "update_facade_feature", featureId: selectedFacadeFeature.id, wallId: wall.id, offset: Math.max(selectedFacadeFeature.width / 2, Math.min(selectedFacadeFeature.offset, wallLength(wall) - selectedFacadeFeature.width / 2)) }); }}>{project.walls.filter((wall) => wall.exterior && wallLength(wall) >= selectedFacadeFeature.width).map((wall) => <option key={wall.id} value={wall.id}>{project.floors.find((floor) => floor.id === wall.floorId)?.name} · {wallCardinalFacing(project, wall)} · {wallLength(wall).toFixed(1)} ft</option>)}</select></label>
                      <label className="field field-full"><span>Material</span><select value={selectedFacadeFeature.finish} onChange={(event) => safeCommit({ type: "update_facade_feature", featureId: selectedFacadeFeature.id, finish: event.target.value as ExteriorFinishId })}>{Object.entries(exteriorFinishPresets).map(([id, finish]) => <option key={id} value={id}>{finish.label}</option>)}</select></label>
                    </Section>
                  </>
                ) : (
                  <>
                    <Section title="Plot dimensions">
                      <div className="field-grid">
                        <NumberField label="Width" value={project.plot.width} min={15} onCommit={(width) => safeCommit({ type: "set_plot", width })} />
                        <NumberField label="Length" value={project.plot.length} min={15} onCommit={(length) => safeCommit({ type: "set_plot", length })} />
                      </div>
                      <div className="area-result"><span>Plot area</span><b>{metrics.plotArea.toLocaleString()} sq ft</b></div>
                    </Section>
                    <Section title="Site orientation">
                      <label className="field field-full"><span>Front / access edge faces</span><select value={project.plot.orientation} onChange={(event) => safeCommit({ type: "set_plot_orientation", orientation: event.target.value as Project["plot"]["orientation"] })}>{(["North", "East", "South", "West"] as const).map((orientation) => <option key={orientation}>{orientation}</option>)}</select></label>
                    </Section>
                    <Section title="Exterior finish">
                      <label className="field field-full"><span>Façade palette</span><select value={project.exteriorFinish} onChange={(event) => safeCommit({ type: "set_exterior_finish", finish: event.target.value as ExteriorFinishId })}>{Object.entries(exteriorFinishPresets).map(([id, finish]) => <option key={id} value={id}>{finish.label}</option>)}</select></label>
                      <p className="technical-note">{exteriorFinishPresets[project.exteriorFinish].description}</p>
                    </Section>
                    <Section title="Flat roof + parapet">
                      <label className="field field-full"><span>Parapet</span><select value={project.roof.parapetEnabled ? "enabled" : "disabled"} onChange={(event) => safeCommit({ type: "set_roof", parapetEnabled: event.target.value === "enabled" })}><option value="enabled">Enabled</option><option value="disabled">Disabled</option></select></label>
                      <div className="field-grid"><NumberField label="Height" value={project.roof.parapetHeight} min={0.5} max={6} step={0.1} onCommit={(parapetHeight) => safeCommit({ type: "set_roof", parapetHeight })} /><NumberField label="Thickness" value={project.roof.parapetThickness} min={0.2} max={2} step={0.05} onCommit={(parapetThickness) => safeCommit({ type: "set_roof", parapetThickness })} /></div>
                      <label className="field field-full"><span>Finish</span><select value={project.roof.finish} onChange={(event) => safeCommit({ type: "set_roof", finish: event.target.value as ExteriorFinishId })}>{Object.entries(exteriorFinishPresets).map(([id, finish]) => <option key={id} value={id}>{finish.label}</option>)}</select></label>
                    </Section>
                    <Section title="Boundary wall + gate">
                      <label className="field field-full"><span>Boundary</span><select value={project.siteBoundary.enabled ? "enabled" : "disabled"} onChange={(event) => safeCommit({ type: "set_site_boundary", enabled: event.target.value === "enabled" })}><option value="enabled">Enabled</option><option value="disabled">Disabled</option></select></label>
                      <label className="field field-full"><span>Front gate</span><select value={project.siteBoundary.gate.enabled ? "enabled" : "disabled"} onChange={(event) => safeCommit({ type: "set_site_boundary", gateEnabled: event.target.value === "enabled" })}><option value="enabled">Enabled</option><option value="disabled">Disabled</option></select></label>
                      <div className="field-grid"><NumberField label="Wall height" value={project.siteBoundary.height} min={2} max={10} step={0.1} onCommit={(height) => safeCommit({ type: "set_site_boundary", height })} /><NumberField label="Wall thickness" value={project.siteBoundary.thickness} min={0.2} max={2} step={0.05} onCommit={(thickness) => safeCommit({ type: "set_site_boundary", thickness })} /><NumberField label="Gate offset" value={project.siteBoundary.gate.offset} min={0} onCommit={(gateOffset) => safeCommit({ type: "set_site_boundary", gateOffset })} /><NumberField label="Gate width" value={project.siteBoundary.gate.width} min={3} max={Math.max(3, project.plot.width - 1)} onCommit={(gateWidth) => safeCommit({ type: "set_site_boundary", gateWidth })} /><NumberField label="Gate height" value={project.siteBoundary.gate.height} min={3} max={10} onCommit={(gateHeight) => safeCommit({ type: "set_site_boundary", gateHeight })} /><label className="field"><span>Gate style</span><select value={project.siteBoundary.gate.style} onChange={(event) => safeCommit({ type: "set_site_boundary", gateStyle: event.target.value as "slatted" | "solid" })}><option value="slatted">Slatted</option><option value="solid">Solid</option></select></label></div>
                    </Section>
                    <Section title="Setbacks">
                      <div className="field-grid">
                        {(["front", "rear", "left", "right"] as const).map((side) => <NumberField key={side} label={side[0].toUpperCase() + side.slice(1)} value={project.plot.setbacks[side]} min={0} onCommit={(value) => safeCommit({ type: "set_plot", setbacks: { [side]: value } })} />)}
                      </div>
                    </Section>
                    <Section title="Live area schedule"><div className="detail-list"><span>Total net floor area <b>{metrics.totalNetFloorArea.toLocaleString()} sq ft</b></span><span>Gross covered area <b>{metrics.grossCoveredArea.toLocaleString()} sq ft</b></span><span>Balcony area <b>{metrics.balconyArea.toLocaleString()} sq ft</b></span><span>Terrace area <b>{metrics.terraceArea.toLocaleString()} sq ft</b></span><span>Open site area <b>{metrics.openSiteArea.toLocaleString()} sq ft</b></span><span>Plot area <b>{metrics.plotArea.toLocaleString()} sq ft</b></span><span>Buildable envelope <b>{metrics.buildableEnvelope.area.toLocaleString()} sq ft</b></span></div></Section>
                  </>
                )}
              </>
            )}

            {inspectorTab === "activity" && (
              <div className="activity-panel">
                <div className="panel-intro"><History size={17} /><div><h2>Shared activity</h2><p>Human and agent actions use the same project history.</p></div></div>
                <div className="activity-list">
                  {project.activity.map((entry) => (
                    <div key={entry.id} className={`activity-item actor-${entry.actor}`}>
                      <span className="activity-avatar">{entry.actor === "agent" ? <Sparkles size={12} /> : entry.actor === "human" ? "Y" : "S"}</span>
                      <div><p>{entry.description}</p><small>{formatTime(entry.timestamp)}{debugMode ? ` · v${entry.version}` : ""}</small></div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {inspectorTab === "checks" && (
              <div className="checks-panel">
                <div className={`check-summary ${validation.status === "pass" ? "is-pass" : ""}`}>
                  <span>{validation.status === "pass" ? <Check size={20} /> : <CircleAlert size={20} />}</span>
                  <div><h2>{validation.status === "pass" ? "Layout looks clear" : `${validation.issueCount} layout ${validation.issueCount === 1 ? "issue" : "issues"}`}</h2><p>{validation.status === "pass" ? "No obvious geometric issues detected." : `${validation.errors} errors · ${validation.warnings} warnings`}</p></div>
                </div>
                <button className="validate-button" type="button" onClick={runValidation}><Check size={15} /> Validate current layout</button>
                <div className="issue-list">
                  {validation.issues.map((issue) => (
                    <button key={issue.id} type="button" onClick={() => { setSelectedId(issue.elementIds[0]); setInspectorTab("properties"); safeCommit({ type: "focus_element", elementId: issue.elementIds[0] }); }}>
                      <span className={`issue-severity ${issue.severity}`}><CircleAlert size={14} /></span>
                      <div><b>{issue.code.replaceAll("_", " ")}</b><p>{issue.message}</p><small>{issue.suggestion}</small></div>
                    </button>
                  ))}
                </div>
                <p className="check-disclaimer">Geometric preflight only — not a building-code, structural, or permit review.</p>
              </div>
            )}
          </div>
        </aside>
      </div>

      {debugMode && debugOpen && (
        <div className="debug-drawer" role="dialog" aria-label="WebMCP developer console">
          <div className="debug-header">
            <div><span className="debug-icon"><Braces size={18} /></span><div><h2>WebMCP developer console</h2><p>Live tools operating the same project model as the editor</p></div></div>
            <div className="debug-status"><span className={nativeStatus ? "is-live" : ""} />{nativeStatus ? "Registered in browser" : "Local tool harness"} · {webTools.length} tools</div>
            <button type="button" onClick={() => setDebugOpen(false)} aria-label="Close developer console"><X size={18} /></button>
          </div>
          <div className="debug-body">
            <section className="debug-tools">
              <div className="debug-section-title"><h3>Registered tools</h3><span>document.modelContext.registerTool()</span></div>
              <div className="tool-registry">
                {(["inspect", "edit", "calculate", "present"] as const).map((category) => (
                  <div key={category}><h4>{category}</h4>{webTools.filter((item) => item.category === category).map((item) => <button key={item.name} type="button" className={debugToolName === item.name ? "is-active" : ""} onClick={() => { setDebugToolName(item.name); setDebugInput("{}"); }}><code>{item.name}</code><span>{item.annotations?.readOnlyHint ? "READ" : "WRITE"}</span></button>)}</div>
                ))}
              </div>
            </section>
            <section className="debug-calls">
              <div className="debug-section-title"><h3>Recent calls</h3><div><button type="button" onClick={() => void invokeTool("inspect_project", {})}><Eye size={13} /> Test inspect</button><button type="button" onClick={() => void invokeTool("validate_layout", {})}><Check size={13} /> Test validate</button></div></div>
              <div className="debug-runner">
                <label><span>Tool</span><select aria-label="WebMCP tool" value={debugToolName} onChange={(event) => { setDebugToolName(event.target.value); setDebugInput("{}"); }}>{webTools.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label>
                <label><span>Input JSON</span><textarea aria-label="WebMCP input JSON" spellCheck={false} value={debugInput} onChange={(event) => setDebugInput(event.target.value)} /></label>
                <button type="button" className="run-tool-button" onClick={() => void runDebugTool()}><Sparkles size={13} /> Execute tool</button>
              </div>
              {toolCalls.length ? <div className="call-list">{toolCalls.map((call) => <details key={call.id}><summary><span className={`call-dot ${call.status}`} /><code>{call.name}</code><b>{call.status}</b>{call.modified && <em>shared state changed</em>}<small>{call.duration !== undefined ? `${call.duration} ms` : "running"}</small></summary><pre>{compactJson(call.error ? { input: call.input, error: call.error } : { input: call.input, output: call.output })}</pre></details>)}</div> : <div className="empty-calls"><Code2 size={24} /><p>No tool calls yet</p><span>Connect a compatible agent, or test an inspection above.</span></div>}
            </section>
          </div>
          <div className="debug-foot"><span><span className="status-dot" />Shared model <code>{project.id}</code></span><span>Current version <b>{project.version}</b></span><span>Human changes and WebMCP calls share Undo / Redo</span></div>
        </div>
      )}

      {toast && <div className="toast"><Check size={15} />{toast}</div>}
    </main>
  );
}
