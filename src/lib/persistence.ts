import {
  cloneProject,
  createId,
  createInitialProject,
  migrateProject,
  type Project,
} from "./architecture.ts";

export const PROJECT_SCHEMA_VERSION = 7;
const LIBRARY_SCHEMA_VERSION = 1;
const STORAGE_KEY = "archmorph.project-library.v1";

export type SavedProjectSummary = {
  id: string;
  name: string;
  updatedAt: string;
  version: number;
  roomCount: number;
  floorCount: number;
};

type ProjectRecord = { project: Project; savedAt: string };
type ProjectLibrary = {
  schemaVersion: number;
  activeProjectId?: string;
  projects: ProjectRecord[];
};

export type ArchMorphProjectDocument = {
  format: "archmorph-project";
  schemaVersion: number;
  exportedAt: string;
  project: Project;
};

function storageAvailable() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function emptyLibrary(): ProjectLibrary {
  return { schemaVersion: LIBRARY_SCHEMA_VERSION, projects: [] };
}

function readLibrary(): ProjectLibrary {
  if (!storageAvailable()) return emptyLibrary();
  try {
    const text = window.localStorage.getItem(STORAGE_KEY);
    if (!text) return emptyLibrary();
    const parsed = JSON.parse(text) as Partial<ProjectLibrary>;
    const projects = Array.isArray(parsed.projects)
      ? parsed.projects.flatMap((record) => {
          try {
            const candidate = (record as ProjectRecord).project ?? record;
            return [{ project: migrateProject(candidate as Project), savedAt: (record as ProjectRecord).savedAt ?? new Date().toISOString() }];
          } catch {
            return [];
          }
        })
      : [];
    return {
      schemaVersion: LIBRARY_SCHEMA_VERSION,
      activeProjectId: parsed.activeProjectId,
      projects,
    };
  } catch {
    return emptyLibrary();
  }
}

function writeLibrary(library: ProjectLibrary) {
  if (!storageAvailable()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
}

export function architecturalProjectSnapshot(project: Project): Project {
  const copy = cloneProject(project);
  copy.schemaVersion = PROJECT_SCHEMA_VERSION;
  copy.view = {
    mode: "2d",
    navigationMode: "orbit",
    activeFloorId: copy.view.activeFloorId,
    cameraPreset: copy.view.cameraPreset,
  };
  return copy;
}

export function saveProjectLocally(project: Project) {
  const library = readLibrary();
  const snapshot = architecturalProjectSnapshot(project);
  const record = { project: snapshot, savedAt: new Date().toISOString() };
  const index = library.projects.findIndex((item) => item.project.id === project.id);
  if (index >= 0) library.projects[index] = record;
  else library.projects.push(record);
  library.activeProjectId = project.id;
  writeLibrary(library);
  return snapshot;
}

export function loadLatestProject() {
  const library = readLibrary();
  const record = library.projects.find((item) => item.project.id === library.activeProjectId)
    ?? [...library.projects].sort((a, b) => b.savedAt.localeCompare(a.savedAt))[0];
  return record ? migrateProject(record.project) : undefined;
}

export function loadSavedProject(projectId: string) {
  const library = readLibrary();
  const record = library.projects.find((item) => item.project.id === projectId);
  if (!record) throw new Error("Saved project not found on this device.");
  library.activeProjectId = projectId;
  writeLibrary(library);
  return migrateProject(record.project);
}

export function listSavedProjects(): SavedProjectSummary[] {
  return readLibrary().projects
    .map(({ project }) => ({
      id: project.id,
      name: project.name,
      updatedAt: project.updatedAt,
      version: project.version,
      roomCount: project.rooms.length,
      floorCount: project.floors.length,
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function createNewLocalProject(name = "Untitled Residence", plot?: Partial<Project["plot"]>) {
  const project = createInitialProject();
  project.id = createId("project");
  project.name = name;
  if (plot) {
    project.plot = {
      ...project.plot,
      ...plot,
      setbacks: { ...project.plot.setbacks, ...plot.setbacks },
    };
    project.siteBoundary.gate.offset = project.plot.width / 2;
    project.siteBoundary.gate.width = Math.min(project.siteBoundary.gate.width, project.plot.width - 1);
    project.activity[0].description = `Editable ${project.plot.width} × ${project.plot.length} ft residential site created`;
  }
  project.updatedAt = new Date().toISOString();
  saveProjectLocally(project);
  return project;
}

export function duplicateLocalProject(project: Project) {
  const duplicate = architecturalProjectSnapshot(project);
  duplicate.id = createId("project");
  duplicate.name = `${project.name} Copy`;
  duplicate.version = 1;
  duplicate.updatedAt = new Date().toISOString();
  duplicate.activity = [{
    id: createId("activity"),
    actor: "system",
    description: `Duplicated from ${project.name}`,
    operation: "duplicate_project",
    timestamp: duplicate.updatedAt,
    version: 1,
  }];
  saveProjectLocally(duplicate);
  return duplicate;
}

export function deleteLocalProject(projectId: string) {
  const library = readLibrary();
  const previousLength = library.projects.length;
  library.projects = library.projects.filter((item) => item.project.id !== projectId);
  if (library.projects.length === previousLength) throw new Error("Saved project not found on this device.");
  if (library.activeProjectId === projectId) library.activeProjectId = library.projects[0]?.project.id;
  writeLibrary(library);
  return library.activeProjectId ? loadSavedProject(library.activeProjectId) : undefined;
}

export function exportProjectDocument(project: Project) {
  const document: ArchMorphProjectDocument = {
    format: "archmorph-project",
    schemaVersion: PROJECT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    project: architecturalProjectSnapshot(project),
  };
  return JSON.stringify(document, null, 2);
}

export function importProjectDocument(text: string) {
  const parsed = JSON.parse(text) as Partial<ArchMorphProjectDocument> | Project;
  const candidate = "format" in parsed && parsed.format === "archmorph-project" ? parsed.project : parsed;
  if (!candidate || typeof candidate !== "object" || !Array.isArray((candidate as Project).floors)) {
    throw new Error("This file is not a valid ArchMorph project.");
  }
  const project = migrateProject(candidate as Project);
  project.id = createId("project");
  project.name = `${project.name} (Imported)`;
  project.updatedAt = new Date().toISOString();
  saveProjectLocally(project);
  return project;
}
