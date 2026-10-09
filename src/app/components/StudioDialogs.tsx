"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, History, X } from "lucide-react";
import { projectMetrics, type Project } from "@/lib/architecture";
import type { ProjectCheckpoint } from "@/lib/persistence";

export function useDialogFocus(ref: React.RefObject<HTMLElement | null>, open: boolean) {
  useEffect(() => {
    if (!open || !ref.current) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    const controls = () => Array.from(dialog.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href], [tabindex='0']")).filter((element) => element.getClientRects().length > 0);
    controls()[0]?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = controls();
      const first = items[0];
      const last = items.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    dialog.addEventListener("keydown", trap);
    return () => { dialog.removeEventListener("keydown", trap); if (previous?.isConnected) previous.focus(); };
  }, [open, ref]);
}

export function LandSetupDialog({ plot, onCreate, onClose }: {
  plot: Project["plot"];
  onCreate: (name: string, plot: Project["plot"]) => Promise<void>;
  onClose: () => void;
}) {
  const ref = useRef<HTMLElement | null>(null);
  useDialogFocus(ref, true);
  const [name, setName] = useState("My Residence");
  const [site, setSite] = useState(plot);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  return <div className="modal-backdrop" onKeyDown={(event) => { if (event.key === "Escape" && !busy) { event.stopPropagation(); onClose(); } }}>
    <section ref={ref} className="help-dialog land-dialog" role="dialog" aria-modal="true" aria-labelledby="land-setup-title">
      <div className="modal-heading"><div><span><Building2 size={18} /></span><div><small>YOUR NEW HOME · STEP 1</small><h2 id="land-setup-title">Start with your land</h2></div></div><button type="button" disabled={busy} onClick={onClose} aria-label="Close land setup"><X size={18} /></button></div>
      <form className="land-form" onSubmit={async (event) => {
        event.preventDefault(); setError(undefined); setBusy(true);
        try { await onCreate(name, site); }
        catch (reason) { setError(reason instanceof Error ? reason.message : "Could not create your home."); }
        finally { setBusy(false); }
      }}>
        <p>Set the plot size, then choose where your rooms go. You can revise the land settings later.</p>
        <label className="field field-full"><span>Home name</span><input required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} /></label>
        <div className="field-grid">{(["width", "length"] as const).map((dimension) => <label className="field" key={dimension}><span>Land {dimension}</span><span className="number-control"><input type="number" required min={15} max={1000} step="any" value={Number.isNaN(site[dimension]) ? "" : site[dimension]} onChange={(event) => setSite({ ...site, [dimension]: event.target.valueAsNumber })} /><b>ft</b></span></label>)}</div>
        <label className="field field-full"><span>Front / access edge faces</span><select value={site.orientation} onChange={(event) => setSite({ ...site, orientation: event.target.value as Project["plot"]["orientation"] })}>{["North", "East", "South", "West"].map((side) => <option key={side}>{side}</option>)}</select></label>
        <details className="architectural-details"><summary>Planning setbacks</summary><p className="technical-note">These are editable planning assumptions. Enter known setbacks, or confirm the displayed values later with your architect.</p><div className="field-grid">{(["front", "rear", "left", "right"] as const).map((side) => <label className="field" key={side}><span>{side[0].toUpperCase() + side.slice(1)}</span><span className="number-control"><input type="number" required min={0} step="any" value={Number.isNaN(site.setbacks[side]) ? "" : site.setbacks[side]} onChange={(event) => setSite({ ...site, setbacks: { ...site.setbacks, [side]: event.target.valueAsNumber } })} /><b>ft</b></span></label>)}</div></details>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-studio-action" type="submit" disabled={busy}>{busy ? "Creating your home…" : "Create home and arrange rooms"}</button>
        <small>Saved in this browser on this device. Export JSON for a portable backup.</small>
      </form>
    </section>
  </div>;
}

export function CheckpointPreview({ checkpoint, current, onRestore, onClose }: {
  checkpoint: ProjectCheckpoint; current: Project; onRestore: () => void; onClose: () => void;
}) {
  const ref = useRef<HTMLElement | null>(null);
  useDialogFocus(ref, true);
  const old = projectMetrics(checkpoint.project);
  const now = projectMetrics(current);
  return <div className="modal-backdrop" onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } }}>
    <section ref={ref} className="help-dialog checkpoint-dialog" role="dialog" aria-modal="true" aria-labelledby="checkpoint-title">
      <div className="modal-heading"><div><span><History size={18} /></span><div><small>SAVED CHECKPOINT</small><h2 id="checkpoint-title">{checkpoint.name}</h2></div></div><button type="button" onClick={onClose} aria-label="Close checkpoint preview"><X size={18} /></button></div>
      <div className="land-form"><p>Saved {new Date(checkpoint.createdAt).toLocaleString()}. Restore creates a new revision. Your current design remains available through Undo in this session.</p>
        <table className="checkpoint-comparison"><thead><tr><th>Whole home</th><th>Current</th><th>Checkpoint</th></tr></thead><tbody>
          <tr><th>Rooms</th><td>{current.rooms.length}</td><td>{checkpoint.project.rooms.length}</td></tr>
          <tr><th>Floors</th><td>{current.floors.length}</td><td>{checkpoint.project.floors.length}</td></tr>
          <tr><th>Room area · sq ft</th><td>{now.totalNetBuildingArea}</td><td>{old.totalNetBuildingArea}</td></tr>
          <tr><th>Gross area · sq ft</th><td>{now.totalGrossCoveredArea}</td><td>{old.totalGrossCoveredArea}</td></tr>
        </tbody></table>
        <p className="technical-note">Room area uses wall centrelines. The stored design includes land, rooms, walls, openings, floors, stairs, and all exterior settings.</p>
        <button type="button" className="primary-studio-action" onClick={onRestore}>Restore as a new revision</button>
      </div>
    </section>
  </div>;
}
