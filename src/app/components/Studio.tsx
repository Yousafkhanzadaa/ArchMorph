"use client";
/* eslint-disable react-hooks/refs -- WebMCP callbacks need an imperative pointer to the latest shared project. */

import {
  Box,
  Braces,
  Building2,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleHelp,
  Copy,
  Code2,
  DoorOpen,
  Download,
  Eye,
  FileImage,
  FileJson,
  FilePlus2,
  Footprints,
  Grid2X2,
  History,
  FolderOpen,
  Layers3,
  Maximize2,
  Minus,
  MousePointer2,
  PanelLeftOpen,
  PanelRightOpen,
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
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
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
  stairAccessPolygon,
  stairEntryPoint,
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
  type StairType,
  type StairTurnSide,
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
type ActivityFilter = "design" | "view" | "all";
type LibraryTab = "spaces" | "levels" | "exterior" | "browse";
type ToastState = { message: string; action?: "undo" };
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
  { id: "stair", label: "Place stair", icon: Layers3, key: "S" },
  { id: "measure", label: "Measure", icon: Ruler, key: "M" },
];

const libraryTabs: Array<{ id: LibraryTab; label: string; description: string }> = [
  { id: "spaces", label: "Spaces", description: "Place room templates" },
  { id: "levels", label: "Levels", description: "Manage floors and stairs" },
  { id: "exterior", label: "Exterior", description: "Configure the site and building exterior" },
  { id: "browse", label: "Browse", description: "Find elements on the active floor" },
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

const stairTypeLabel: Record<StairType, string> = {
  straight: "Straight",
  "l-shaped": "L-shaped",
  "u-shaped": "U-shaped",
};

const subscribeHydration = () => () => undefined;
const getClientHydrationSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

const presentationOperations = new Set<ArchitectureOperation["type"]>([
  "set_active_floor",
  "switch_view",
  "set_navigation_mode",
  "set_camera",
  "focus_element",
]);

function isPresentationOperation(operation: ArchitectureOperation) {
  return presentationOperations.has(operation.type);
}

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

function formatSavedTime(timestamp: string) {
  const date = new Date(timestamp);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay ? `Saved ${formatTime(timestamp)}` : `Saved ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date)}`;
}

function elementLabel(project: Project, id?: string) {
  if (!id) return "Project site";
  const floorName = (floorId: string) => project.floors.find((floor) => floor.id === floorId)?.name ?? "Unknown floor";
  const room = project.rooms.find((item) => item.id === id);
  if (room) return `${room.name} · ${floorName(room.floorId)}`;
  const wall = project.walls.find((item) => item.id === id);
  if (wall) {
    const rooms = wall.roomIds.map((roomId) => project.rooms.find((item) => item.id === roomId)?.name).filter(Boolean).join(" / ");
    return `${wall.exterior ? `${wallCardinalFacing(project, wall) ?? "Exterior"} façade` : rooms || "Independent wall"} · ${floorName(wall.floorId)}`;
  }
  const opening = project.openings.find((item) => item.id === id);
  if (opening) {
    const host = project.walls.find((item) => item.id === opening.wallId);
    const rooms = host?.roomIds.map((roomId) => project.rooms.find((item) => item.id === roomId)?.name).filter(Boolean).join(" / ");
    return `${opening.kind === "door" ? "Door" : "Window"}${rooms ? ` · ${rooms}` : ""} · ${floorName(opening.floorId)}`;
  }
  const stair = project.stairs.find((item) => item.id === id);
  if (stair) {
    const connection = stairConnection(project, stair);
    return connection ? `Staircase · ${connection.lowerFloor.name} to ${connection.upperFloor.name}` : `Staircase · ${floorName(stair.floorId)}`;
  }
  const balcony = project.balconies.find((item) => item.id === id);
  if (balcony) return `${balcony.name} · ${floorName(balcony.floorId)}`;
  const feature = project.facadeFeatures.find((item) => item.id === id);
  if (feature) return `${feature.kind[0].toUpperCase()}${feature.kind.slice(1)} · exterior feature`;
  return id;
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
  buttonRef,
  children,
  onClick,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  buttonRef?: RefObject<HTMLButtonElement | null>;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      className={`icon-button ${active ? "is-active" : ""}`}
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
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
  const errorId = useId();
  const [error, setError] = useState<string>();
  const range = min !== undefined && max !== undefined
    ? `Enter a value from ${min} to ${max}.`
    : min !== undefined
      ? `Enter ${min} or more.`
      : max !== undefined
        ? `Enter ${max} or less.`
        : "Enter a valid number.";
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
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          onInput={() => setError(undefined)}
          onBlur={(event) => {
            const next = Number(event.currentTarget.value);
            const valid = Number.isFinite(next) && (min === undefined || next >= min) && (max === undefined || next <= max);
            if (valid && next !== value) onCommit(next);
            if (!valid) {
              setError(range);
              event.currentTarget.value = String(value);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
        <b>{unit}</b>
      </span>
      {error && <small className="field-error" id={errorId}>{error}</small>}
    </label>
  );
}

function Section({ title, children, action, id }: { title: string; children: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <section className="panel-section" id={id}>
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
  const hydrated = useSyncExternalStore(subscribeHydration, getClientHydrationSnapshot, getServerHydrationSnapshot);
  const [selectedId, setSelectedId] = useState<string>();
  const [tool, setTool] = useState<CanvasTool>("select");
  const [roomType, setRoomType] = useState<RoomType>("Living Room");
  const [roomShape, setRoomShape] = useState<Exclude<RoomShape, "custom">>("rectangle");
  const [stairType, setStairType] = useState<StairType>("straight");
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("properties");
  const [validation, setValidation] = useState<ValidationReport>(() => validateLayout(project));
  const [debugMode, setDebugMode] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [toolStatus, setToolStatus] = useState<ToolStatus>("registering");
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [debugToolName, setDebugToolName] = useState("inspect_project");
  const [debugInput, setDebugInput] = useState("{}");
  const [toast, setToast] = useState<ToastState>();
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryTab, setLibraryTab] = useState<LibraryTab>("spaces");
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [showPlanLabels, setShowPlanLabels] = useState(true);
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("design");
  const [activityActor, setActivityActor] = useState<"all" | "human" | "agent">("all");
  const [activeIssueId, setActiveIssueId] = useState<string>();
  const [savedProjects, setSavedProjects] = useState<SavedProjectSummary[]>([]);
  const [savedVersion, setSavedVersion] = useState(0);
  const [pastCount, setPastCount] = useState(0);
  const [futureCount, setFutureCount] = useState(0);
  const pastRef = useRef<Project[]>([]);
  const futureRef = useRef<Project[]>([]);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const projectButtonRef = useRef<HTMLButtonElement | null>(null);
  const projectMenuRef = useRef<HTMLDivElement | null>(null);
  const exportButtonRef = useRef<HTMLButtonElement | null>(null);
  const helpButtonRef = useRef<HTMLButtonElement | null>(null);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const helpCloseRef = useRef<HTMLButtonElement | null>(null);
  const debugCloseRef = useRef<HTMLButtonElement | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      setDebugMode(params.get("debug") === "1" || params.get("mode") === "debug");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const notify = useCallback((message: string, action?: ToastState["action"]) => {
    setToast({ message, action });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(undefined), action ? 6000 : 3200);
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
    setExportOpen(false);
    setActiveIssueId(undefined);
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
        if (isPresentationOperation(operation)) {
          const next: Project = {
            ...outcome.project,
            version: previous.version,
            updatedAt: previous.updatedAt,
            activity: previous.activity,
          };
          const presentationOutcome: OperationOutcome = {
            ...outcome,
            project: next,
            result: { ...outcome.result, projectVersion: previous.version },
          };
          projectRef.current = next;
          setProject(next);
          if (next.view.focusElementId !== previous.view.focusElementId) setSelectedId(next.view.focusElementId);
          return presentationOutcome;
        }
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
    const label = elementLabel(projectRef.current, selectedId);
    try {
      commit(room ? { type: "delete_room", roomId: selectedId } : { type: "delete_element", elementId: selectedId });
      setSelectedId(undefined);
      notify(`Deleted ${label}`, "undo");
    } catch {
      // The operation pipeline already provides the user-facing error.
    }
  }, [commit, notify, selectedId]);

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
      if (event.key === "?") {
        event.preventDefault();
        setHelpOpen(true);
        return;
      }
      if (["arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key) && selectedId) {
        const room = projectRef.current.rooms.find((item) => item.id === selectedId);
        if (room) {
          event.preventDefault();
          const amount = event.shiftKey ? 1 : 0.5;
          if (event.altKey) {
            const width = Math.max(3, room.width + (key === "arrowright" ? amount : key === "arrowleft" ? -amount : 0));
            const length = Math.max(3, room.length + (key === "arrowdown" ? amount : key === "arrowup" ? -amount : 0));
            try { commit({ type: "resize_room", roomId: room.id, width, length }); } catch { /* commit announces invalid geometry */ }
          } else {
            const x = Math.max(0, room.x + (key === "arrowright" ? amount : key === "arrowleft" ? -amount : 0));
            const y = Math.max(0, room.y + (key === "arrowdown" ? amount : key === "arrowup" ? -amount : 0));
            try { commit({ type: "move_room", roomId: room.id, x, y }); } catch { /* commit announces invalid geometry */ }
          }
          return;
        }
      }
      const shortcut = toolItems.find((item) => item.key.toLowerCase() === key);
      if (shortcut) {
        setTool(shortcut.id);
        if (shortcut.id === "room") setLibraryTab("spaces");
        if (shortcut.id === "stair") setLibraryTab("levels");
      }
      if ((event.key === "Backspace" || event.key === "Delete") && selectedId) deleteSelected();
      if (event.key === "Escape") {
        setSelectedId(undefined);
        setTool("select");
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [commit, deleteSelected, redo, selectedId, undo]);

  useEffect(() => {
    const handleDismiss = (event: KeyboardEvent | MouseEvent) => {
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;
      if (event instanceof MouseEvent) {
        const target = event.target as Node;
        if (projectMenuRef.current?.contains(target) || projectButtonRef.current?.contains(target)) return;
        if (exportMenuRef.current?.contains(target) || exportButtonRef.current?.contains(target)) return;
      }
      if (projectMenuOpen) {
        setProjectMenuOpen(false);
        if (event instanceof KeyboardEvent) projectButtonRef.current?.focus();
      }
      if (exportOpen) {
        setExportOpen(false);
        if (event instanceof KeyboardEvent) exportButtonRef.current?.focus();
      }
      if (event instanceof KeyboardEvent) {
        if (helpOpen) {
          setHelpOpen(false);
          helpButtonRef.current?.focus();
        }
        if (debugOpen) setDebugOpen(false);
        setLibraryOpen(false);
        setInspectorOpen(false);
      }
    };
    document.addEventListener("keydown", handleDismiss);
    document.addEventListener("pointerdown", handleDismiss);
    return () => {
      document.removeEventListener("keydown", handleDismiss);
      document.removeEventListener("pointerdown", handleDismiss);
    };
  }, [debugOpen, exportOpen, helpOpen, projectMenuOpen]);

  useEffect(() => {
    if (helpOpen) helpCloseRef.current?.focus();
  }, [helpOpen]);

  useEffect(() => {
    if (projectMenuOpen) projectMenuRef.current?.querySelector<HTMLElement>("input, button")?.focus();
  }, [projectMenuOpen]);

  useEffect(() => {
    if (exportOpen) exportMenuRef.current?.querySelector<HTMLElement>("button:not(:disabled)")?.focus();
  }, [exportOpen]);

  useEffect(() => {
    if (debugOpen) debugCloseRef.current?.focus();
  }, [debugOpen]);

  useEffect(() => {
    if (!helpOpen && !debugOpen) return;
    const dialog = (helpOpen ? helpCloseRef.current : debugCloseRef.current)?.closest<HTMLElement>("[role='dialog']");
    if (!dialog) return;
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex='-1'])"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    dialog.addEventListener("keydown", trapFocus);
    return () => dialog.removeEventListener("keydown", trapFocus);
  }, [debugOpen, helpOpen]);

  const selectedRoom = project.rooms.find((item) => item.id === selectedId);
  const selectedWall = project.walls.find((item) => item.id === selectedId);
  const selectedOpening = project.openings.find((item) => item.id === selectedId);
  const selectedStair = project.stairs.find((item) => item.id === selectedId);
  const selectedBalcony = project.balconies.find((item) => item.id === selectedId);
  const selectedFacadeFeature = project.facadeFeatures.find((item) => item.id === selectedId);
  const selectedStairConnection = selectedStair ? stairConnection(project, selectedStair) : undefined;
  const selectedStairRoom = selectedStair && selectedStairConnection ? (() => {
    const activeIsLower = selectedStairConnection.lowerFloor.id === project.view.activeFloorId;
    const level = activeIsLower ? "lower" : "upper";
    const point = stairEntryPoint(selectedStair, level, selectedStair.width / 2);
    return project.rooms.find((room) => room.floorId === project.view.activeFloorId && roomContainsPoint(room, point));
  })() : undefined;
  const selectedStairAccess = selectedStair && selectedStairConnection ? (["lower", "upper"] as const).map((level) => {
    const floor = level === "lower" ? selectedStairConnection.lowerFloor : selectedStairConnection.upperFloor;
    const center = stairEntryPoint(selectedStair, level, selectedStair.width / 2);
    const polygon = stairAccessPolygon(selectedStair, level);
    const room = project.rooms.find((candidate) => candidate.floorId === floor.id
      && roomContainsPoint(candidate, center)
      && polygon.every((point) => roomContainsPoint(candidate, point)));
    return { level, floor, room };
  }) : [];
  const selectedOpeningWall = selectedOpening ? project.walls.find((item) => item.id === selectedOpening.wallId) : undefined;
  const selectedFacadeFacing = selectedOpeningWall ? wallCardinalFacing(project, selectedOpeningWall) : undefined;
  const activeFloor = project.floors.find((item) => item.id === project.view.activeFloorId)!;
  const metrics = projectMetrics(project);
  const nativeStatus = toolStatus === "native";
  const navigationMode = project.view.navigationMode ?? "orbit";
  const activeIssue = validation.issues.find((issue) => issue.id === activeIssueId);
  const activeIssueIndex = activeIssue ? validation.issues.findIndex((issue) => issue.id === activeIssue.id) : -1;
  const filteredActivity = project.activity.filter((entry) => {
    const isView = presentationOperations.has(entry.operation as ArchitectureOperation["type"]);
    const matchesType = activityFilter === "all" || (activityFilter === "view" ? isView : !isView);
    const matchesActor = activityActor === "all" || entry.actor === activityActor;
    return matchesType && matchesActor;
  });
  const activeFloorRooms = project.rooms.filter((room) => room.floorId === activeFloor.id);
  const activeFloorWalls = project.walls.filter((wall) => wall.floorId === activeFloor.id);
  const activeFloorOpenings = project.openings.filter((opening) => opening.floorId === activeFloor.id);
  const activeFloorStairs = project.stairs.filter((stair) => stair.floorId === activeFloor.id || stairConnection(project, stair)?.targetFloor.id === activeFloor.id);
  const activeFloorBalconies = project.balconies.filter((balcony) => balcony.floorId === activeFloor.id);
  const activeFloorFeatures = project.facadeFeatures.filter((feature) => activeFloorWalls.some((wall) => wall.id === feature.wallId));
  const navigableElements = [
    ...activeFloorRooms.map((item) => ({ id: item.id, kind: "room" as const })),
    ...activeFloorWalls.map((item) => ({ id: item.id, kind: "wall" as const })),
    ...activeFloorOpenings.map((item) => ({ id: item.id, kind: "opening" as const })),
    ...activeFloorStairs.map((item) => ({ id: item.id, kind: "stair" as const })),
    ...activeFloorBalconies.map((item) => ({ id: item.id, kind: "exterior" as const })),
    ...activeFloorFeatures.map((item) => ({ id: item.id, kind: "exterior" as const })),
  ];

  const safeCommit = (operation: ArchitectureOperation) => {
    try {
      commit(operation);
    } catch {
      // Errors are surfaced by commit as a toast.
    }
  };

  const selectElement = (id: string) => {
    setSelectedId(id);
    setInspectorTab("properties");
    setInspectorOpen(true);
    setLibraryOpen(false);
    safeCommit({ type: "focus_element", elementId: id });
  };

  const focusIssue = (issueId: string) => {
    const issue = validation.issues.find((item) => item.id === issueId);
    if (!issue) return;
    setActiveIssueId(issue.id);
    setInspectorTab("properties");
    setInspectorOpen(true);
    if (issue.elementIds[0]) {
      setSelectedId(issue.elementIds[0]);
      safeCommit({ type: "focus_element", elementId: issue.elementIds[0] });
    }
  };

  const moveIssue = (direction: -1 | 1) => {
    if (!validation.issues.length) return;
    const index = activeIssueIndex < 0 ? 0 : (activeIssueIndex + direction + validation.issues.length) % validation.issues.length;
    focusIssue(validation.issues[index].id);
  };

  const openRoomLibrary = () => {
    setLibraryOpen(true);
    setLibraryTab("spaces");
    setTool("room");
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
    const length = recommendedStairRun(project, project.view.activeFloorId, direction, stairType);
    const upperFlightLength = length;
    const landingDepth = width;
    const wellWidth = 0.5;
    const footprintWidth = stairType === "u-shaped" ? width * 2 + wellWidth : stairType === "l-shaped" ? upperFlightLength + landingDepth : width;
    const footprintLength = stairType === "straight" ? length : length + landingDepth;
    const x = Math.max(0, Math.min(point.x - footprintWidth / 2, project.plot.width - footprintWidth));
    const y = Math.max(0, Math.min(point.y - footprintLength / 2, project.plot.length - footprintLength));
    try {
      const outcome = commit({
        type: "add_stairs",
        floorId: project.view.activeFloorId,
        x: Math.round(x * 2) / 2,
        y: Math.round(y * 2) / 2,
        width,
        length,
        upperFlightLength,
        direction,
        stairType,
        landingDepth,
        wellWidth,
        turnSide: "left",
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

  const loadExampleProject = () => {
    let next = createNewLocalProject("Example Courtyard Residence", projectRef.current.plot);
    const floorId = next.view.activeFloorId;
    const roomOperations: ArchitectureOperation[] = [
      { type: "create_room", floorId, name: "Living Room", roomType: "Living Room", x: 3, y: 10, width: 12, length: 14 },
      { type: "create_room", floorId, name: "Kitchen", roomType: "Kitchen", x: 15, y: 10, width: 12, length: 12 },
      { type: "create_room", floorId, name: "Primary Bedroom", roomType: "Bedroom", x: 3, y: 24, width: 12, length: 13 },
      { type: "create_room", floorId, name: "Bathroom", roomType: "Bathroom", x: 15, y: 22, width: 7, length: 8 },
    ];
    for (const operation of roomOperations) next = applyOperation(next, operation, "system").project;
    const frontWall = next.walls.find((wall) => wall.exterior && wall.floorId === floorId && wall.y1 === 10 && wall.y2 === 10);
    const sharedWall = next.walls.find((wall) => wall.floorId === floorId && wall.roomIds.length > 1 && wallLength(wall) >= 4);
    const windowWall = next.walls.find((wall) => wall.exterior && wall.floorId === floorId && wallLength(wall) >= 8 && wall.id !== frontWall?.id);
    if (frontWall) next = applyOperation(next, { type: "add_opening", kind: "door", wallId: frontWall.id, offset: wallLength(frontWall) / 2 }, "system").project;
    if (sharedWall) next = applyOperation(next, { type: "add_opening", kind: "door", wallId: sharedWall.id, offset: wallLength(sharedWall) / 2 }, "system").project;
    if (windowWall) next = applyOperation(next, { type: "add_opening", kind: "window", wallId: windowWall.id, offset: wallLength(windowWall) / 2, width: 4 }, "system").project;
    saveProjectLocally(next);
    replaceProject(next, "Loaded an editable example residence");
  };

  const restoreSnapshot = (snapshot: Project) => {
    const index = pastRef.current.findIndex((item) => item.version === snapshot.version && item.updatedAt === snapshot.updatedAt);
    if (index < 0) return;
    const current = cloneProject(projectRef.current);
    const newer = pastRef.current.slice(index + 1).map(cloneProject).reverse();
    pastRef.current = pastRef.current.slice(0, index).map(cloneProject);
    futureRef.current = [current, ...newer];
    const restored = cloneProject(snapshot);
    projectRef.current = restored;
    setProject(restored);
    saveProjectLocally(restored);
    setSavedVersion(restored.version);
    setValidation(validateLayout(restored));
    setSelectedId(undefined);
    setPastCount(pastRef.current.length);
    setFutureCount(futureRef.current.length);
    notify(`Restored design version ${restored.version}`);
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
    <main className={`studio-shell ${libraryOpen ? "is-library-open" : ""} ${inspectorOpen ? "is-inspector-open" : ""}`}>
      <div className="visually-hidden" aria-live="polite" aria-atomic="true">{selectedId ? `Selected ${elementLabel(project, selectedId)}${selectedRoom ? `. Position ${selectedRoom.x} by ${selectedRoom.y} feet. Size ${selectedRoom.width} by ${selectedRoom.length} feet.` : ""}` : `No element selected. ${validation.issueCount} layout ${validation.issueCount === 1 ? "issue" : "issues"}.`}</div>
      <header className="topbar">
        <Link className="brand" href="/" aria-label="ArchMorph home">
          <div className="brand-mark" aria-hidden="true"><span>AM</span></div>
          <div>
            <strong>ArchMorph</strong>
            <span>RESIDENTIAL STUDIO</span>
          </div>
        </Link>
        <div className="project-switcher">
          <button ref={projectButtonRef} className="project-title" type="button" title="Project files" aria-haspopup="dialog" aria-controls="project-file-menu" aria-expanded={projectMenuOpen} onClick={() => { setSavedProjects(listSavedProjects()); setProjectMenuOpen((value) => !value); setExportOpen(false); }}>
            <Building2 size={14} />
            <span>{project.name}</span>
            <i title={hydrated ? `Autosaved on this device · ${new Date(project.updatedAt).toLocaleString()}` : "Autosaved on this device"}>{hydrated ? savedVersion === project.version ? formatSavedTime(project.updatedAt) : `Saving v${project.version}…` : "Saved locally"}</i>
            <ChevronDown size={13} />
          </button>
          {projectMenuOpen && (
            <div ref={projectMenuRef} id="project-file-menu" className="project-menu" role="dialog" aria-label="Project files">
              <label className="project-name-field"><span>Project name</span><input key={`${project.id}:${project.name}`} defaultValue={project.name} onBlur={(event) => { const name = event.currentTarget.value.trim(); if (name && name !== project.name) safeCommit({ type: "rename_project", name }); else event.currentTarget.value = project.name; }} /></label>
              <p className="menu-note">Changes autosave on this device. Use Save now for reassurance or export a JSON backup.</p>
              <div className="project-menu-actions">
                <button type="button" onClick={saveCurrentProject}><Save size={14} />Save now</button>
                <button type="button" onClick={createProject}><FilePlus2 size={14} />New</button>
                <button type="button" onClick={duplicateProject}><Copy size={14} />Duplicate</button>
                <button type="button" onClick={() => { exportPlan("json", true); setProjectMenuOpen(false); notify("Project JSON exported"); }}><FileJson size={14} />Project JSON</button>
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
          <button type="button" aria-pressed={project.view.mode === "2d"} className={project.view.mode === "2d" ? "is-active" : ""} onClick={() => safeCommit({ type: "switch_view", mode: "2d" })}>
            <Grid2X2 size={14} /> Floor plan
          </button>
          <button type="button" aria-pressed={project.view.mode === "3d" && navigationMode === "orbit"} className={project.view.mode === "3d" && navigationMode === "orbit" ? "is-active" : ""} onClick={() => safeCommit({ type: "set_navigation_mode", mode: "orbit" })}>
            <Box size={15} /> 3D Orbit
          </button>
          <button type="button" aria-pressed={project.view.mode === "3d" && navigationMode === "walk"} className={project.view.mode === "3d" && navigationMode === "walk" ? "is-active" : ""} onClick={() => safeCommit({ type: "set_navigation_mode", mode: "walk", roomId: selectedRoom?.id })}>
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
          <IconButton buttonRef={helpButtonRef} label="Help and keyboard shortcuts (?)" onClick={() => setHelpOpen(true)}><CircleHelp size={17} /></IconButton>
          <div className="export-switcher">
            <button ref={exportButtonRef} type="button" className="export-button" aria-haspopup="menu" aria-controls="export-menu" aria-expanded={exportOpen} onClick={() => { setExportOpen((value) => !value); setProjectMenuOpen(false); }}>
              <Download size={15} /> Export <ChevronDown size={13} />
            </button>
            {exportOpen && (
              <div ref={exportMenuRef} id="export-menu" className="export-menu" role="menu" aria-label="Export options">
                <button type="button" role="menuitem" onClick={() => { exportPlan("json", true); setExportOpen(false); notify("Project JSON exported"); }}><FileJson size={17} /><span><b>Project JSON</b><small>archmorph-project-v{project.version}.json · editable backup</small></span></button>
                <button type="button" role="menuitem" disabled={project.view.mode !== "2d"} onClick={() => { exportPlan("svg", true); setExportOpen(false); notify("Floor plan SVG exported"); }}><FileImage size={17} /><span><b>Floor plan SVG</b><small>{project.view.mode === "2d" ? `archmorph-plan-v${project.version}.svg · active floor` : "Switch to Floor plan first"}</small></span></button>
                <button type="button" role="menuitem" onClick={() => { void captureSnapshot({ download: true }); setExportOpen(false); }}><Maximize2 size={17} /><span><b>Current view PNG</b><small>archmorph-{project.view.mode === "2d" ? "2d" : `3d-${navigationMode}`}-v{project.version}.png</small></span></button>
              </div>
            )}
          </div>
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
                  onClick={() => {
                    setTool(item.id);
                    if (item.id === "room") setLibraryTab("spaces");
                    if (item.id === "stair") setLibraryTab("levels");
                  }}
                  title={`${item.label} (${item.key})`}
                  aria-label={`${item.label} (${item.key})`}
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

        <aside id="design-library" className="library-panel" aria-label="Design library">
          <div className="panel-mobile-head"><div><small>Design library</small><b>{activeFloor.name}</b></div><button type="button" onClick={() => setLibraryOpen(false)} aria-label="Close design library"><X size={18} /></button></div>
          <div className="library-tabs" role="tablist" aria-label="Design library categories">
            {libraryTabs.map((item, index) => (
              <button
                key={item.id}
                id={`library-tab-${item.id}`}
                type="button"
                role="tab"
                className={libraryTab === item.id ? "is-active" : ""}
                aria-selected={libraryTab === item.id}
                aria-controls={`library-panel-${item.id}`}
                aria-label={`${item.label}: ${item.description}`}
                tabIndex={libraryTab === item.id ? 0 : -1}
                onClick={() => setLibraryTab(item.id)}
                onKeyDown={(event) => {
                  let nextIndex = index;
                  if (event.key === "ArrowRight") nextIndex = (index + 1) % libraryTabs.length;
                  else if (event.key === "ArrowLeft") nextIndex = (index - 1 + libraryTabs.length) % libraryTabs.length;
                  else if (event.key === "Home") nextIndex = 0;
                  else if (event.key === "End") nextIndex = libraryTabs.length - 1;
                  else return;
                  event.preventDefault();
                  const nextTab = libraryTabs[nextIndex].id;
                  setLibraryTab(nextTab);
                  window.requestAnimationFrame(() => document.getElementById(`library-tab-${nextTab}`)?.focus());
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div id="library-panel-spaces" className="panel-scroll" role="tabpanel" aria-labelledby="library-tab-spaces" tabIndex={0} hidden={libraryTab !== "spaces"}>
            <Section id="room-library-section" title="Rooms" action={<span className="section-hint">CLICK TO PLACE</span>}>
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
          </div>

          <div id="library-panel-levels" className="panel-scroll" role="tabpanel" aria-labelledby="library-tab-levels" tabIndex={0} hidden={libraryTab !== "levels"}>
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
                      aria-current={floor.id === project.view.activeFloorId ? "true" : undefined}
                      onClick={() => safeCommit({ type: "set_active_floor", floorId: floor.id })}
                    >
                      <Layers3 size={15} /><span><b>{floor.name}</b><small>{roomCount} {roomCount === 1 ? "room" : "rooms"} · {floor.height} ft{stairCount ? ` · ${stairCount} stair connection${stairCount === 1 ? "" : "s"}` : ""}</small></span>
                    </button>
                  );
                })}
              </div>
              <NumberField
                label="Storey height"
                unit="ft"
                value={activeFloor?.height ?? 9}
                min={7}
                max={16}
                step={0.5}
                onCommit={(height) => safeCommit({ type: "set_floor_height", floorId: project.view.activeFloorId, height })}
              />
              <p className="technical-note">Changing a storey height re-levels every floor above it and recomputes each connected stair&rsquo;s rise, riser count, and tread depth.</p>
            </Section>

            <Section title="Stairs" action={<span className="section-hint">CLICK TO PLACE</span>}>
              <label className="field field-full"><span>Stair configuration</span><select value={stairType} onChange={(event) => { setStairType(event.target.value as StairType); setTool("stair"); }}><option value="straight">Straight · one flight</option><option value="l-shaped">L-shaped · 90° quarter turn</option><option value="u-shaped">U-shaped · 180° half turn</option></select></label>
              <button type="button" className={`walk-inside-button ${tool === "stair" ? "is-active" : ""}`} onClick={() => setTool("stair")}><Layers3 size={15} /> Place {stairTypeLabel[stairType]} stair</button>
              <p className="technical-note">{stairType === "u-shaped" ? "Two parallel flights reverse 180° at a half landing for a compact stacked stair core." : stairType === "l-shaped" ? "Two perpendicular flights turn 90° at a quarter landing to fit a room corner." : "One continuous flight with access at opposite ends."} Both connected floors require a clear approach outside the stair.</p>
            </Section>
          </div>

          <div id="library-panel-exterior" className="panel-scroll" role="tabpanel" aria-labelledby="library-tab-exterior" tabIndex={0} hidden={libraryTab !== "exterior"}>
            <Section title="Site">
              <div className="site-line"><span>Rectangular plot</span><b>{project.plot.width}&apos; × {project.plot.length}&apos;</b></div>
              <div className="site-line"><span>Front faces</span><b>{project.plot.orientation}</b></div>
            </Section>

            <Section title="Exterior finish">
              <label className="field field-full"><span>Façade palette</span><select value={project.exteriorFinish} onChange={(event) => safeCommit({ type: "set_exterior_finish", finish: event.target.value as ExteriorFinishId })}>{Object.entries(exteriorFinishPresets).map(([id, finish]) => <option key={id} value={id}>{finish.label}</option>)}</select></label>
              <p className="technical-note">Project default with optional per-wall overrides; lightweight visual materials only.</p>
            </Section>

            <Section title="Exterior systems" action={<span className="section-hint">LIGHTWEIGHT</span>}>
              {!activeFloorRooms.length && <p className="technical-note is-locked">Place the first room to unlock hosted balconies and façade features.</p>}
              <div className="room-library">
                <button type="button" disabled={!activeFloorRooms.length} onClick={() => addDefaultBalcony(activeFloor.level > 0 ? "balcony" : "terrace")}>
                  <span style={{ background: "#b8aea0" }} /><div><b>{activeFloor.level > 0 ? "Add balcony" : "Add terrace"}</b><small>Slab + configurable railing</small></div><Plus size={14} />
                </button>
                {(["canopy", "frame", "sunshade"] as FacadeFeatureKind[]).map((kind) => (
                  <button type="button" key={kind} disabled={!activeFloorRooms.length} onClick={() => addDefaultFacadeFeature(kind)}>
                    <span style={{ background: kind === "frame" ? "#9f6653" : kind === "canopy" ? "#69756f" : "#aaa79f" }} /><div><b>Add {kind}</b><small>Exterior-wall hosted feature</small></div><Plus size={14} />
                  </button>
                ))}
              </div>
              <button type="button" className="walk-inside-button" onClick={() => safeCommit({ type: "set_site_boundary", enabled: !project.siteBoundary.enabled })}>
                <Building2 size={15} /> {project.siteBoundary.enabled ? "Hide" : "Add"} boundary wall + gate
              </button>
            </Section>
          </div>

          <div id="library-panel-browse" className="panel-scroll" role="tabpanel" aria-labelledby="library-tab-browse" tabIndex={0} hidden={libraryTab !== "browse"}>
            <Section title="Elements" action={<span className="section-hint">KEYBOARD ACCESSIBLE</span>}>
              <p className="technical-note element-intro">Select an element here to inspect it without using the drawing canvas.</p>
              <div className="element-navigator">
                {navigableElements.map((element) => (
                  <button key={element.id} type="button" className={selectedId === element.id ? "is-active" : ""} aria-current={selectedId === element.id ? "true" : undefined} onClick={() => selectElement(element.id)}>
                    {element.kind === "room" ? <Square size={14} /> : element.kind === "wall" ? <Minus size={14} /> : element.kind === "opening" ? <DoorOpen size={14} /> : element.kind === "stair" ? <Layers3 size={14} /> : <PanelTop size={14} />}
                    <span><b>{elementLabel(project, element.id).split(" · ")[0]}</b><small>{elementLabel(project, element.id).split(" · ").slice(1).join(" · ") || activeFloor.name}</small></span>
                    <ChevronRight size={14} />
                  </button>
                ))}
                {!navigableElements.length && <p className="empty-elements">No elements on this floor yet.</p>}
              </div>
            </Section>
          </div>
          <div className="library-foot">
            <span>Grid 1 ft</span><span>Snap 6 in</span><span>Units ft</span>
          </div>
        </aside>

        <section className="canvas-stage">
          <div className="canvas-toolbar">
            <IconButton label="Open design library" onClick={() => setLibraryOpen(true)}><PanelLeftOpen size={17} /></IconButton>
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
              {project.view.mode === "2d" && <IconButton label={showPlanLabels ? "Hide room labels" : "Show room labels"} active={showPlanLabels} onClick={() => setShowPlanLabels((value) => !value)}><Eye size={16} /></IconButton>}
              <button type="button" className="labeled-control" aria-label="Focus whole project" onClick={() => safeCommit({ type: "focus_element" })}><Scan size={16} /><span>Fit</span></button>
              <button type="button" className="labeled-control" aria-label="Capture current view as PNG" onClick={() => void captureSnapshot({ download: true })}><Maximize2 size={16} /><span>Snapshot</span></button>
              <IconButton label="Open inspector" onClick={() => setInspectorOpen(true)}><PanelRightOpen size={17} /></IconButton>
            </div>
          </div>

          <div className={`design-viewport mode-${project.view.mode} navigation-${navigationMode}`}>
            {project.view.mode === "2d" ? (
              <FloorPlan
                project={project}
                tool={tool}
                roomType={roomType}
                showLabels={showPlanLabels}
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
            {project.view.mode === "2d" && !project.rooms.length && !project.walls.length && !project.stairs.length && (
              <div className="starter-card" role="region" aria-label="Getting started">
                <span className="starter-kicker">START HERE</span>
                <h2>Build your first floor in four steps.</h2>
                <ol><li>Choose a room and place it on the plot.</li><li>Add walls, doors, and windows.</li><li>Create another floor and connect it with stairs.</li><li>Review Checks, then explore in 3D.</li></ol>
                <button type="button" onClick={openRoomLibrary}><Square size={15} /> Choose a room</button>
                <button type="button" className="starter-secondary" onClick={loadExampleProject}><Building2 size={15} /> Load example residence</button>
                <small>Shortcuts: R room · W wall · D door · N window · S stair</small>
              </div>
            )}
          </div>

          <div className="statusbar">
            <span><span className="status-dot" /> {activeFloor.name}</span>
            <span>{toolItems.find((item) => item.id === tool)?.label}</span>
            <span className="status-message">{project.view.mode === "3d" && navigationMode === "walk" ? "WASD / arrows to move · Follow the stair flights and landing to change levels · Minimap tracks your floor and room" : tool === "room" ? `Click the plot to place a ${roomType.toLowerCase()}` : tool === "stair" ? `Click the plan to place a ${stairTypeLabel[stairType]} stair between adjacent floors` : tool === "door" || tool === "window" ? `Click a wall to add a ${tool} · Click an existing ${tool} to remove it` : project.view.mode === "3d" ? "Drag to orbit · Right-drag or Shift-drag to pan · Scroll to zoom" : "Drag rooms and stairs to move · Draw walls with orthogonal / 45° snapping"}</span>
            {debugMode && <span>Project v{project.version}</span>}
          </div>
        </section>

        <aside id="studio-inspector" className="inspector" aria-label="Project inspector">
          <div className="panel-mobile-head"><div><small>Inspector</small><b>{selectedId ? elementLabel(project, selectedId).split(" · ")[0] : project.name}</b></div><button type="button" onClick={() => setInspectorOpen(false)} aria-label="Close inspector"><X size={18} /></button></div>
          <div className="inspector-tabs" role="tablist" aria-label="Inspector views" onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const tabs: InspectorTab[] = ["properties", "activity", "checks"];
            const current = tabs.indexOf(inspectorTab);
            const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
            setInspectorTab(tabs[next]);
            window.requestAnimationFrame(() => document.getElementById(`inspector-tab-${tabs[next]}`)?.focus());
          }}>
            <button id="inspector-tab-properties" type="button" role="tab" tabIndex={inspectorTab === "properties" ? 0 : -1} aria-selected={inspectorTab === "properties"} aria-controls="inspector-panel" className={inspectorTab === "properties" ? "is-active" : ""} onClick={() => setInspectorTab("properties")}>Properties</button>
            <button id="inspector-tab-activity" type="button" role="tab" tabIndex={inspectorTab === "activity" ? 0 : -1} aria-selected={inspectorTab === "activity"} aria-controls="inspector-panel" className={inspectorTab === "activity" ? "is-active" : ""} onClick={() => setInspectorTab("activity")}>History</button>
            <button id="inspector-tab-checks" type="button" role="tab" tabIndex={inspectorTab === "checks" ? 0 : -1} aria-selected={inspectorTab === "checks"} aria-controls="inspector-panel" className={inspectorTab === "checks" ? "is-active" : ""} onClick={() => setInspectorTab("checks")}>
              Checks {validation.issueCount > 0 && <em>{validation.issueCount}</em>}
            </button>
          </div>
          <div id="inspector-panel" className="inspector-scroll" role="tabpanel" aria-labelledby={`inspector-tab-${inspectorTab}`}>
            {inspectorTab === "properties" && (
              <>
                {activeIssue && (
                  <div className="active-issue" role="region" aria-label="Selected layout issue">
                    <div><span className={`issue-severity ${activeIssue.severity}`}><CircleAlert size={14} /></span><small>ISSUE {activeIssueIndex + 1} OF {validation.issueCount}</small></div>
                    <h2>{activeIssue.code.replaceAll("_", " ")}</h2>
                    <b>{activeIssue.elementIds.map((id) => elementLabel(project, id)).join(" + ")}</b>
                    <p>{activeIssue.message}</p>
                    <small>{activeIssue.suggestion}</small>
                    <div className="issue-navigation">
                      <button type="button" onClick={() => { setInspectorTab("checks"); setActiveIssueId(undefined); }}><ChevronLeft size={14} /> All checks</button>
                      <span><button type="button" aria-label="Previous issue" onClick={() => moveIssue(-1)}><ChevronLeft size={14} /></button><button type="button" aria-label="Next issue" onClick={() => moveIssue(1)}><ChevronRight size={14} /></button></span>
                    </div>
                  </div>
                )}
                <div className="selection-title">
                  <span className="selection-icon">
                    {selectedRoom ? <Square size={17} /> : selectedWall ? <Minus size={17} /> : selectedOpening ? <DoorOpen size={17} /> : selectedStair ? <Layers3 size={17} /> : selectedBalcony ? <PanelTop size={17} /> : selectedFacadeFeature ? <Maximize2 size={17} /> : <Grid2X2 size={17} />}
                  </span>
                  <div>
                    <small>{selectedRoom ? selectedRoom.type : selectedWall ? "Wall" : selectedOpening ? selectedOpening.kind : selectedStair ? "Staircase" : selectedBalcony ? selectedBalcony.kind : selectedFacadeFeature ? "Façade feature" : "Project site"}</small>
                    <h2>{selectedRoom?.name ?? (selectedWall ? selectedWall.roomIds.length > 1 ? "Shared wall" : selectedWall.side ? `${selectedWall.side} wall` : "Independent wall" : selectedOpening ? `${selectedOpening.kind[0].toUpperCase()}${selectedOpening.kind.slice(1)}` : selectedStair ? "Staircase" : selectedBalcony ? selectedBalcony.name : selectedFacadeFeature ? selectedFacadeFeature.kind[0].toUpperCase() + selectedFacadeFeature.kind.slice(1) : project.name)}</h2>
                  </div>
                  {selectedId && <button type="button" onClick={deleteSelected} title="Delete selected element" aria-label={`Delete ${elementLabel(project, selectedId)}`}><Trash2 size={16} /></button>}
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
                    <Section title={`${stairTypeLabel[selectedStair.stairType]} stair geometry`}>
                      <label className="field field-full"><span>Stair type</span><select value={selectedStair.stairType} onChange={(event) => safeCommit({ type: "update_stairs", stairId: selectedStair.id, stairType: event.target.value as StairType })}><option value="straight">Straight · one flight</option><option value="l-shaped">L-shaped · 90° quarter turn</option><option value="u-shaped">U-shaped · 180° half turn</option></select></label>
                      <div className="field-grid">
                        <NumberField label="Clear flight width" value={selectedStair.width} min={3} onCommit={(width) => safeCommit({ type: "update_stairs", stairId: selectedStair.id, width })} />
                        <NumberField label={selectedStair.stairType === "u-shaped" ? "Run per flight" : selectedStair.stairType === "l-shaped" ? "Lower-flight run" : "Run length"} value={selectedStair.length} min={selectedStair.stairType === "straight" ? 6 : 3} onCommit={(length) => safeCommit({ type: "update_stairs", stairId: selectedStair.id, length })} />
                        {selectedStair.stairType === "l-shaped" && <NumberField label="Upper-flight run" value={selectedStair.upperFlightLength} min={3} onCommit={(upperFlightLength) => safeCommit({ type: "update_stairs", stairId: selectedStair.id, upperFlightLength })} />}
                        <NumberField label="X position" value={selectedStair.x} min={0} onCommit={(x) => safeCommit({ type: "update_stairs", stairId: selectedStair.id, x })} />
                        <NumberField label="Y position" value={selectedStair.y} min={0} onCommit={(y) => safeCommit({ type: "update_stairs", stairId: selectedStair.id, y })} />
                      </div>
                      {selectedStair.stairType !== "straight" && <>
                        <div className="field-grid stair-direction-field">
                          <NumberField label={selectedStair.stairType === "u-shaped" ? "Half-landing depth" : "Quarter-landing size"} value={selectedStair.landingDepth} min={selectedStair.width} onCommit={(landingDepth) => safeCommit({ type: "update_stairs", stairId: selectedStair.id, landingDepth })} />
                          {selectedStair.stairType === "u-shaped" && <NumberField label="Center well" value={selectedStair.wellWidth} min={0} max={8} step={0.25} onCommit={(wellWidth) => safeCommit({ type: "update_stairs", stairId: selectedStair.id, wellWidth })} />}
                        </div>
                        <label className="field field-full stair-direction-field"><span>{selectedStair.stairType === "u-shaped" ? "Return direction" : "Quarter-turn direction"}</span><select value={selectedStair.turnSide} onChange={(event) => safeCommit({ type: "update_stairs", stairId: selectedStair.id, turnSide: event.target.value as StairTurnSide })}><option value="left">Turn left while ascending</option><option value="right">Turn right while ascending</option></select></label>
                      </>}
                      <label className="field field-full stair-direction-field"><span>Connection direction</span><select value={selectedStair.direction} onChange={(event) => safeCommit({ type: "update_stairs", stairId: selectedStair.id, direction: event.target.value as "up" | "down" })}><option value="up">Up to next floor</option><option value="down">Down to previous floor</option></select></label>
                      <label className="field field-full stair-direction-field"><span>Plan rotation</span><select value={selectedStair.rotation} onChange={(event) => safeCommit({ type: "update_stairs", stairId: selectedStair.id, rotation: Number(event.target.value) as StairRotation })}><option value={0}>0°</option><option value={90}>90°</option><option value={180}>180°</option><option value={270}>270°</option></select></label>
                      <button type="button" className="walk-inside-button" onClick={() => safeCommit({ type: "update_stairs", stairId: selectedStair.id, rotation: ((selectedStair.rotation + 90) % 360) as StairRotation })}><RotateCw size={15} /> Rotate 90°</button>
                    </Section>
                    <Section title="Vertical connection">
                      {selectedStairConnection ? (
                        <div className="detail-list"><span>Connects <b>{selectedStairConnection.sourceFloor.name} → {selectedStairConnection.targetFloor.name}</b></span><span>Configuration <b>{selectedStairConnection.flightCount} flight{selectedStairConnection.flightCount === 1 ? "" : "s"}{selectedStair.stairType === "l-shaped" ? " + quarter landing" : selectedStair.stairType === "u-shaped" ? " + half landing" : ""}</b></span><span>Floor-to-floor rise <b>{selectedStairConnection.rise} ft</b></span><span>Concept risers <b>{selectedStairConnection.riserCount} × {(selectedStairConnection.riserHeight * 12).toFixed(2)} in</b></span><span>Concept tread depth{selectedStairConnection.flightCount === 2 ? "s" : ""} <b>{selectedStairConnection.treadDepths.map((depth) => `${(depth * 12).toFixed(2)} in`).join(" / ")}</b></span>{selectedStairConnection.landingElevation !== undefined && <span>Landing elevation <b>{selectedStairConnection.landingElevation} ft</b></span>}<span>Recommended run{selectedStairConnection.flightCount === 2 ? "s" : ""} <b>{selectedStairConnection.recommendedRuns.map((run) => `${run} ft`).join(" / ")}</b></span></div>
                      ) : <p className="technical-note is-warning">This stair has no adjacent destination floor in its current direction.</p>}
                      <p className="technical-note">Concept check uses a 7¾ in maximum riser and 10 in minimum tread. Turning stairs split the rise across two flights and require a landing at least as large as the clear flight width. Validation also checks a full-width approach on both floors and walls crossing the stairwell. Headroom, handrails, guards, structure, and local code still require project-specific review.</p>
                    </Section>
                    {selectedStairConnection && <Section title="Entry and exit clearance">
                      <div className="detail-list">
                        {selectedStairAccess.map(({ level, floor, room }) => <span key={level}>{level === "lower" ? "Lower entry" : "Upper exit"} · {floor.name} <b>{room ? `Clear in ${room.name}` : "Needs a clear stair hall"}</b></span>)}
                        <span>Required approach <b>{selectedStair.width} × {selectedStair.width} ft</b></span>
                      </div>
                      <p className="technical-note">The dashed plan rectangle is usable floor area outside the stair—not part of the flight. Keep it inside one room and free of crossing walls.</p>
                    </Section>}
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
                <div className="panel-intro"><History size={17} /><div><h2>Project history</h2><p>Design edits are separated from temporary view changes. Human and agent edits share Undo and Redo.</p></div></div>
                <div className="activity-filters" role="group" aria-label="Filter history">
                  {(["design", "view", "all"] as ActivityFilter[]).map((filter) => <button key={filter} type="button" aria-pressed={activityFilter === filter} className={activityFilter === filter ? "is-active" : ""} onClick={() => setActivityFilter(filter)}>{filter[0].toUpperCase() + filter.slice(1)}</button>)}
                </div>
                <div className="activity-filters is-secondary" role="group" aria-label="Filter history by actor">
                  {(["all", "human", "agent"] as const).map((actor) => <button key={actor} type="button" aria-pressed={activityActor === actor} className={activityActor === actor ? "is-active" : ""} onClick={() => setActivityActor(actor)}>{actor[0].toUpperCase() + actor.slice(1)}</button>)}
                </div>
                {pastCount > 0 && <details className="history-milestones"><summary>Restore an earlier design version</summary><div>{pastRef.current.slice(-5).reverse().map((snapshot) => <button key={`${snapshot.version}:${snapshot.updatedAt}`} type="button" onClick={() => restoreSnapshot(snapshot)}><span><b>Version {snapshot.version}</b><small>{snapshot.activity[0]?.description.replace(/^You /, "") ?? "Saved design state"}</small></span><History size={14} /></button>)}</div></details>}
                <div className="activity-list">
                  {filteredActivity.map((entry) => (
                    <div key={entry.id} className={`activity-item actor-${entry.actor}`}>
                      <span className="activity-avatar">{entry.actor === "agent" ? <Sparkles size={12} /> : entry.actor === "human" ? "Y" : "S"}</span>
                      <div><p>{entry.description}</p><small>{formatTime(entry.timestamp)}{debugMode ? ` · v${entry.version}` : ""}</small></div>
                    </div>
                  ))}
                  {!filteredActivity.length && <p className="empty-activity">No {activityFilter} activity yet.</p>}
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
                  {validation.issues.map((issue) => {
                    const matchingIssues = validation.issues.filter((item) => item.code === issue.code);
                    const matchingIndex = matchingIssues.findIndex((item) => item.id === issue.id);
                    return (
                    <button key={issue.id} type="button" onClick={() => focusIssue(issue.id)}>
                      <span className={`issue-severity ${issue.severity}`}><CircleAlert size={14} /></span>
                      <div><b>{issue.code.replaceAll("_", " ")}{matchingIssues.length > 1 ? ` · ${matchingIndex + 1}/${matchingIssues.length}` : ""}</b><strong>{issue.elementIds.map((id) => elementLabel(project, id)).join(" + ") || "Project site"}</strong><p>{issue.message}</p><small>{issue.suggestion}</small></div>
                    </button>
                  );})}
                </div>
                <p className="check-disclaimer">Geometric preflight only — not a building-code, structural, or permit review.</p>
              </div>
            )}
          </div>
        </aside>
      </div>

      {(libraryOpen || inspectorOpen) && <button type="button" className="panel-backdrop" aria-label="Close open panel" onClick={() => { setLibraryOpen(false); setInspectorOpen(false); }} />}

      {helpOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setHelpOpen(false); }}>
          <section className="help-dialog" role="dialog" aria-modal="true" aria-labelledby="studio-help-title">
            <div className="modal-heading"><div><span><CircleHelp size={18} /></span><div><small>STUDIO GUIDE</small><h2 id="studio-help-title">Design with confidence</h2></div></div><button ref={helpCloseRef} type="button" onClick={() => setHelpOpen(false)} aria-label="Close help"><X size={18} /></button></div>
            <div className="help-grid">
              <div><h3>Getting started</h3><ol><li>Place rooms from the Design library.</li><li>Add openings and stairs directly on the plan.</li><li>Use Properties for precise dimensions.</li><li>Run Checks, then explore the model in 3D.</li></ol></div>
              <div><h3>Keyboard shortcuts</h3><dl>{toolItems.map((item) => <div key={item.id}><dt><kbd>{item.key}</kbd></dt><dd>{item.label}</dd></div>)}<div><dt><kbd>Arrows</kbd></dt><dd>Move a selected room by 6 in; hold Shift for 1 ft</dd></div><div><dt><kbd>⌥ + ↑</kbd></dt><dd>Resize a selected room; hold Shift for 1 ft</dd></div><div><dt><kbd>⌘Z</kbd></dt><dd>Undo design edit</dd></div><div><dt><kbd>?</kbd></dt><dd>Open this guide</dd></div><div><dt><kbd>Esc</kbd></dt><dd>Close or return to Select</dd></div></dl></div>
            </div>
            <p className="help-note"><b>Your work stays on this device.</b> ArchMorph autosaves locally. Export Project JSON for a portable backup. Layout Checks are geometric guidance, not building-code, structural, or permit approval.</p>
          </section>
        </div>
      )}

      {debugMode && debugOpen && (
        <div className="debug-drawer" role="dialog" aria-modal="true" aria-label="WebMCP developer console">
          <div className="debug-header">
            <div><span className="debug-icon"><Braces size={18} /></span><div><h2>WebMCP developer console</h2><p>Live tools operating the same project model as the editor</p></div></div>
            <div className="debug-status"><span className={nativeStatus ? "is-live" : ""} />{nativeStatus ? "Registered in browser" : "Local tool harness"} · {webTools.length} tools</div>
            <button ref={debugCloseRef} type="button" onClick={() => setDebugOpen(false)} aria-label="Close developer console"><X size={18} /></button>
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
              {!webTools.find((item) => item.name === debugToolName)?.annotations?.readOnlyHint && <p className="debug-write-warning"><CircleAlert size={13} /> This tool can change the shared project or view. Design edits create an Undo step.</p>}
              {toolCalls.length ? <div className="call-list">{toolCalls.map((call) => <details key={call.id}><summary><span className={`call-dot ${call.status}`} /><code>{call.name}</code><b>{call.status}</b>{call.modified && <em>shared state changed</em>}<small>{call.duration !== undefined ? `${call.duration} ms` : "running"}</small></summary><pre>{compactJson(call.error ? { input: call.input, error: call.error } : { input: call.input, output: call.output })}</pre></details>)}</div> : <div className="empty-calls"><Code2 size={24} /><p>No tool calls yet</p><span>Connect a compatible agent, or test an inspection above.</span></div>}
            </section>
          </div>
          <div className="debug-foot"><span><span className="status-dot" />Shared model <code>{project.id}</code></span><span>Current version <b>{project.version}</b></span><span>Human and WebMCP design edits share Undo / Redo</span></div>
        </div>
      )}

      {toast && <div className="toast" role="status" aria-live="polite"><Check size={15} /><span>{toast.message}</span>{toast.action === "undo" && <button type="button" onClick={() => { undo(); setToast(undefined); }}>Undo</button>}</div>}
    </main>
  );
}
