import {
  cloneProject,
  createId,
  createInitialProject,
  migrateProject,
  type Project,
} from "./architecture.ts";

export const PROJECT_SCHEMA_VERSION = 7;
export const PROJECT_STORAGE_KEY = "archmorph.project-library.v1";
const LIBRARY_SCHEMA_VERSION = 2;
export const MAX_CHECKPOINTS = 8;

export type SavedProjectSummary = {
  id: string;
  name: string;
  updatedAt: string;
  version: number;
  roomCount: number;
  floorCount: number;
};
export type ProjectCheckpoint = { id: string; name: string; createdAt: string; project: Project };
type ProjectRecord = { project: Project; savedAt: string; checkpoints: ProjectCheckpoint[] };
type ProjectLibrary = { schemaVersion: number; activeProjectId?: string; projects: ProjectRecord[] };
export type ArchMorphProjectDocument = {
  format: "archmorph-project";
  schemaVersion: number;
  exportedAt: string;
  project: Project;
};

export class LocalSaveError extends Error {
  code: "unavailable" | "corrupt" | "conflict" | "quota";
  constructor(code: "unavailable" | "corrupt" | "conflict" | "quota", message: string) {
    super(message);
    this.code = code;
    this.name = "LocalSaveError";
  }
}

function storage(): Storage {
  try {
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  } catch { /* Browsers can deny access to the localStorage getter itself. */ }
  throw new LocalSaveError("unavailable", "Local saving is unavailable in this browser. Keep this tab open and export a Project JSON backup.");
}
function emptyLibrary(): ProjectLibrary { return { schemaVersion: LIBRARY_SCHEMA_VERSION, projects: [] }; }

function readLibrary(): ProjectLibrary {
  const store = storage();
  let text: string | null;
  try { text = store.getItem(PROJECT_STORAGE_KEY); }
  catch { throw new LocalSaveError("unavailable", "This browser denied access to saved projects. Your draft is still open; export a Project JSON backup."); }
  if (!text) return emptyLibrary();
  try {
    const parsed = JSON.parse(text) as Partial<ProjectLibrary>;
    if (!Array.isArray(parsed.projects) || (parsed.schemaVersion ?? 1) > LIBRARY_SCHEMA_VERSION) throw new Error("Unrecognized library");
    return {
      schemaVersion: LIBRARY_SCHEMA_VERSION,
      activeProjectId: parsed.activeProjectId,
      projects: parsed.projects.map((record) => {
        const candidate = (record as ProjectRecord).project ?? record;
        const project = migrateProject(candidate as Project);
        // Deterministic identity lets old libraries participate in conflict checks before their first new save.
        project.revisionId ??= `legacy:${project.id}:${project.version}:${project.updatedAt}`;
        return {
          project,
          savedAt: record.savedAt ?? project.updatedAt,
          checkpoints: (record.checkpoints ?? []).map((checkpoint) => ({ ...checkpoint, project: migrateProject(checkpoint.project) })),
        };
      }),
    };
  } catch {
    throw new LocalSaveError("corrupt", "The saved library could not be read. Existing data has been kept. Export this draft before repairing or importing your backup.");
  }
}
function writeLibrary(library: ProjectLibrary) {
  try { storage().setItem(PROJECT_STORAGE_KEY, JSON.stringify(library)); }
  catch (error) {
    if (error instanceof LocalSaveError) throw error;
    throw new LocalSaveError("quota", "This browser could not save the project, possibly because storage is full. Your draft is still open; export a Project JSON backup or retry.");
  }
}

// Serialize the entire library's read/check/write transaction across tabs, including checkpoints and activity writes.
async function withLibraryLock<T>(action: () => T): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks) return navigator.locks.request(PROJECT_STORAGE_KEY, action);
  // Older browsers retain the revision guard, but cannot guarantee atomic writes across simultaneous tabs.
  return action();
}

export function architecturalProjectSnapshot(project: Project): Project {
  const copy = cloneProject(project);
  copy.schemaVersion = PROJECT_SCHEMA_VERSION;
  copy.view = { mode: "2d", navigationMode: "orbit", activeFloorId: copy.view.activeFloorId, cameraPreset: copy.view.cameraPreset };
  return copy;
}

export async function saveProjectLocally(project: Project, expectedRevision = project.revisionId) {
  const snapshot = architecturalProjectSnapshot(project);
  return withLibraryLock(() => {
    const library = readLibrary();
    const index = library.projects.findIndex((item) => item.project.id === snapshot.id);
    const existing = library.projects[index];
    if (existing ? existing.project.revisionId !== expectedRevision : Boolean(expectedRevision)) {
      throw new LocalSaveError("conflict", "This home was changed or deleted in another tab. Your draft is kept here. Save it as a copy or load the latest saved home.");
    }
    snapshot.revisionId = createId("revision");
    const record = { project: snapshot, savedAt: new Date().toISOString(), checkpoints: existing?.checkpoints ?? [] };
    if (index >= 0) library.projects[index] = record;
    else library.projects.push(record);
    library.activeProjectId = snapshot.id;
    writeLibrary(library);
    return snapshot;
  });
}
export function loadLatestProject() {
  const library = readLibrary();
  const record = library.projects.find((item) => item.project.id === library.activeProjectId)
    ?? [...library.projects].sort((a, b) => b.savedAt.localeCompare(a.savedAt))[0];
  return record ? cloneProject(record.project) : undefined;
}
export function loadSavedProject(projectId: string) {
  const record = readLibrary().projects.find((item) => item.project.id === projectId);
  if (!record) throw new Error("Saved project not found on this device.");
  return cloneProject(record.project);
}
export async function activateSavedProject(projectId: string) {
  return withLibraryLock(() => {
    const library = readLibrary();
    const record = library.projects.find((item) => item.project.id === projectId);
    if (!record) throw new Error("Saved project not found on this device.");
    library.activeProjectId = projectId;
    writeLibrary(library);
    return cloneProject(record.project);
  });
}
export function listSavedProjects(): SavedProjectSummary[] {
  return readLibrary().projects.map(({ project }) => ({
    id: project.id, name: project.name, updatedAt: project.updatedAt, version: project.version,
    roomCount: project.rooms.length, floorCount: project.floors.length,
  })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function createNewLocalProject(name = "Untitled Residence", plot?: Partial<Project["plot"]>) {
  const project = createInitialProject();
  project.id = createId("project");
  project.name = name.trim() || "Untitled Residence";
  if (plot) {
    project.plot = { ...project.plot, ...plot, setbacks: { ...project.plot.setbacks, ...plot.setbacks } };
    if (![project.plot.width, project.plot.length].every((value) => Number.isFinite(value) && value >= 15)) throw new Error("Enter land width and length of at least 15 ft.");
    if (Object.values(project.plot.setbacks).some((value) => !Number.isFinite(value) || value < 0)
      || project.plot.setbacks.left + project.plot.setbacks.right >= project.plot.width
      || project.plot.setbacks.front + project.plot.setbacks.rear >= project.plot.length) throw new Error("Setbacks must leave a usable land envelope.");
    project.siteBoundary.gate.offset = project.plot.width / 2;
    project.siteBoundary.gate.width = Math.min(project.siteBoundary.gate.width, project.plot.width - 1);
    project.activity[0].description = `Editable ${project.plot.width} × ${project.plot.length} ft residential site created`;
  }
  project.updatedAt = new Date().toISOString();
  return saveProjectLocally(project);
}
export async function duplicateLocalProject(project: Project) {
  const duplicate = architecturalProjectSnapshot(project);
  duplicate.id = createId("project");
  duplicate.revisionId = undefined;
  duplicate.name = `${project.name} Copy`;
  duplicate.version = 1;
  duplicate.updatedAt = new Date().toISOString();
  duplicate.activity = [{ id: createId("activity"), actor: "system", description: `Duplicated from ${project.name}`, operation: "duplicate_project", timestamp: duplicate.updatedAt, version: 1 }];
  return saveProjectLocally(duplicate);
}
export async function deleteLocalProject(projectId: string, expectedRevision?: string) {
  return withLibraryLock(() => {
    const library = readLibrary();
    const existing = library.projects.find((item) => item.project.id === projectId);
    if (!existing) throw new Error("Saved project not found on this device.");
    if (expectedRevision && expectedRevision !== existing.project.revisionId) throw new LocalSaveError("conflict", "This home changed in another tab. Load the latest saved home before deleting it.");
    library.projects = library.projects.filter((item) => item.project.id !== projectId);
    if (library.activeProjectId === projectId) library.activeProjectId = library.projects[0]?.project.id;
    writeLibrary(library);
    return library.projects.find((item) => item.project.id === library.activeProjectId)?.project;
  });
}
export function listProjectCheckpoints(projectId: string) {
  return (readLibrary().projects.find((item) => item.project.id === projectId)?.checkpoints ?? []).map((item) => ({ ...item, project: cloneProject(item.project) }));
}
export async function createProjectCheckpoint(project: Project, name: string) {
  const snapshot = architecturalProjectSnapshot(project);
  if (!name.trim()) throw new Error("Give your checkpoint a name.");
  return withLibraryLock(() => {
    const library = readLibrary();
    const record = library.projects.find((item) => item.project.id === snapshot.id);
    if (!record || record.project.revisionId !== snapshot.revisionId) throw new LocalSaveError("conflict", "Save the current draft before creating a checkpoint.");
    if (record.checkpoints.length >= MAX_CHECKPOINTS) throw new Error(`This home has ${MAX_CHECKPOINTS} checkpoints. Remove one you no longer need before saving another.`);
    const checkpoint: ProjectCheckpoint = { id: createId("checkpoint"), name: name.trim().slice(0, 120), createdAt: new Date().toISOString(), project: snapshot };
    record.checkpoints.unshift(checkpoint);
    writeLibrary(library);
    return checkpoint;
  });
}
export async function deleteProjectCheckpoint(projectId: string, checkpointId: string) {
  return withLibraryLock(() => {
    const library = readLibrary();
    const record = library.projects.find((item) => item.project.id === projectId);
    if (!record) throw new Error("Saved project not found on this device.");
    record.checkpoints = record.checkpoints.filter((item) => item.id !== checkpointId);
    writeLibrary(library);
  });
}
export function exportProjectDocument(project: Project) {
  const document: ArchMorphProjectDocument = { format: "archmorph-project", schemaVersion: PROJECT_SCHEMA_VERSION, exportedAt: new Date().toISOString(), project: architecturalProjectSnapshot(project) };
  return JSON.stringify(document, null, 2);
}
export async function importProjectDocument(text: string) {
  const parsed = JSON.parse(text) as Partial<ArchMorphProjectDocument> | Project;
  const candidate = "format" in parsed && parsed.format === "archmorph-project" ? parsed.project : parsed;
  if (!candidate || typeof candidate !== "object" || !Array.isArray((candidate as Project).floors)) throw new Error("This file is not a valid ArchMorph project.");
  const project = migrateProject(candidate as Project);
  project.id = createId("project");
  project.revisionId = undefined;
  project.name = `${project.name} (Imported)`;
  project.updatedAt = new Date().toISOString();
  return saveProjectLocally(project);
}
