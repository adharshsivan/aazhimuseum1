import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUpRight, Box, Check,
  ChevronLeft, ChevronRight, Eye, EyeOff, Footprints, Layers3,
  Maximize2, Moon, MousePointer2, RotateCcw, ShieldCheck, Sun, X,
} from "lucide-react";
import SceneViewer, { type ViewerApi, type ViewerMode, type ViewPreset } from "./viewer/SceneViewer";
import type { QAReport } from "./asset/qa";
import { BP, groundWingOpenings, upperWingOpenings } from "./asset/blueprint";
import { CHANDELIER, CHANDELIER_MOUNTS } from "./asset/chandeliers";

type Panel = "overview" | "specification" | "quality";

const views: { id: ViewPreset; label: string }[] = [
  { id: "three-quarter", label: "3/4 view" },
  { id: "front", label: "Front" },
  { id: "side", label: "Side" },
  { id: "rear", label: "Rear" },
  { id: "top", label: "Plan" },
];

const stopLabels: Record<string, string> = {
  outside: "Outside the house",
  steps: "Main stone staircase",
  portico: "Recessed entrance",
  hall: "Central entrance hall",
  "ground-hall-west": "Ground hall / west end",
  "ground-hall-east": "Ground hall / east end",
  "stair-start": "Interior U-stair",
  "stair-landing": "Turn landing",
  "first-floor": "First-floor hall",
  veranda: "Upper timber veranda",
  balcony: "Central balcony",
  return: "Back downstairs",
};

function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export default function App() {
  const viewerRef = useRef<ViewerApi>(null);
  const stageRef = useRef<HTMLElement>(null);
  const [panel, setPanel] = useState<Panel>("overview");
  const [mode, setMode] = useState<ViewerMode>("orbit");
  const [view, setView] = useState<ViewPreset>("three-quarter");
  const [roofVisible, setRoofVisible] = useState(true);
  const [upperVisible, setUpperVisible] = useState(true);
  const [nightMode, setNightMode] = useState(false);
  const [qa, setQa] = useState<QAReport | null>(null);
  const [tourStop, setTourStop] = useState("outside");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 4800);
    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    const change = () => setFullScreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", change);
    return () => document.removeEventListener("fullscreenchange", change);
  }, []);

  useEffect(() => {
    if (!helpOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setHelpOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [helpOpen]);

  async function exportAsset(kind: "glb" | "package") {
    if (!viewerRef.current || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const high = await viewerRef.current.exportGLB(0);
      if (kind === "glb") {
        triggerDownload(new Blob([high], { type: "model/gltf-binary" }), "malabar-house-lod0.glb");
        setMessage("The full-detail GLB is ready.");
      } else {
        const { default: JSZip } = await import("jszip");
        const zip = new JSZip();
        zip.file("malabar-house-lod0.glb", high);
        zip.file("malabar-house-lod1.glb", await viewerRef.current.exportGLB(1));
        zip.file("malabar-house-collision.glb", await viewerRef.current.exportCollisionGLB());
        zip.file("collision.json", JSON.stringify(viewerRef.current.collisionJSON(), null, 2));
        zip.file("blueprint.json", JSON.stringify({ ...BP, groundWingOpenings, upperWingOpenings }, null, 2));
        zip.file("optimization.json", JSON.stringify(viewerRef.current.optimizationJSON(), null, 2));
        zip.file("quality-report.json", JSON.stringify(viewerRef.current.qualityJSON(), null, 2));
        zip.file("hall-lighting.json", JSON.stringify({ units: "metres", chandelier: CHANDELIER, mounts: CHANDELIER_MOUNTS, fixtureSelfShadow: false, note: "Geometry and emissive materials are in the GLBs. Recreate one point light per mount, ceilingY minus emitterDrop. Keep lightFixture meshes out of the aggregate emitter's shadow casters; walls and slabs still cast shadows." }, null, 2));
        zip.file("README.txt", [
          "MALABAR HOUSE / KERALA HERITAGE ARCHITECTURAL ASSET",
          "",
          "Units: metres. X is facade left/right, Y is up, +Z is the front entrance.",
          "Footprint: 34 x 17 m. Plinth: 0.75 m. Highest finial: about 14.6 m.",
          "",
          "malabar-house-lod0.glb: complete two-storey traversable building.",
          "malabar-house-lod1.glb: same silhouette without tiny decorative details.",
          "malabar-house-collision.glb: separate UCX blockers and NAV floor/step collision meshes.",
          "collision.json: simplified AABB blockers, floor surfaces, stair data, and guided route.",
          "blueprint.json: shared measured coordinate and exterior opening schedule.",
          "quality-report.json: structural checks and sampled walkthrough results.",
          "optimization.json: mobile detail-distance policy and shared material strategy.",
          "hall-lighting.json: four chandelier ceiling mounts and day/night point-light settings.",
          "",
          "The roof, first floor, rooms, doors, and stairwell are actual separate 3D geometry.",
          "Door leaves are held open. Collision is separate from visible render geometry.",
        ].join("\n"));
        const archive = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 4 } });
        triggerDownload(archive, "malabar-house-game-asset.zip");
        setMessage("Game asset package downloaded: 2 GLBs and collision data.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? `Export failed: ${error.message}` : "Export failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function selectView(next: ViewPreset) {
    setMode("orbit");
    setView(next);
  }

  function beginWalk() {
    setMode("walk");
    setTourStop("outside");
  }

  function toggleSection() {
    const next = !upperVisible;
    setUpperVisible(next);
    setRoofVisible(next);
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await stageRef.current?.requestFullscreen();
    } catch {
      setMessage("Fullscreen is not available in this browser.");
    }
  }

  const tourNumber = Math.max(1, Object.keys(stopLabels).indexOf(tourStop) + 1);

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="brand-lockup" aria-label="Malabar House archive">
          <span className="brand-symbol" aria-hidden="true">
            <svg viewBox="0 0 42 42" fill="none"><path d="M3 23 21 7l18 16M8 21v13h26V21M14 34V23h14v11M21 7v-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="square" strokeLinejoin="miter"/></svg>
          </span>
          <span className="brand-words"><strong>MALABAR</strong><small>HOUSE ARCHIVE</small></span>
        </div>
        <div className="header-center"><span className="header-line" /> AN ARCHITECTURAL ASSET STUDY <span className="header-edition">/ 001</span></div>
        <div className="header-actions">
          <span className="header-format">THREE.JS&nbsp; / &nbsp;WEB + MOBILE</span>
          <button className="mobile-package" title="Download complete game asset package" aria-label="Download complete game asset package" onClick={() => exportAsset("package")} disabled={busy || !qa}><Box size={16} strokeWidth={1.7} /></button>
          <button className="header-export" onClick={() => exportAsset("glb")} disabled={busy || !qa}>
            <ArrowDownToLine size={16} strokeWidth={1.8} />
            <span>{busy ? "Preparing..." : "Export GLB"}</span>
          </button>
        </div>
      </header>

      <main className="workspace">
        <aside className="inspector" aria-label="Building information">
          <div className="inspector-head"><span>ARCHIVE OBJECT&nbsp; 001</span><span className="inspector-head-mark">KL / IN</span></div>

          <div className="inspector-main">
            {panel === "overview" && (
              <div className="panel-content panel-enter">
                <div className="eyebrow"><span className="eyebrow-rule" /> A LIVING RECONSTRUCTION</div>
                <h1 className="asset-title">The<br />Malabar <br /><em>House.</em></h1>
                <p className="asset-description">A Kerala heritage mansion rebuilt at real scale, from its laterite plinth to the carved timber gable. Step inside and explore every floor.</p>
                <button className="primary-explore" onClick={beginWalk}>
                  <span>Walk through the house</span><ArrowUpRight size={18} strokeWidth={1.7} />
                </button>
                <div className="overview-detail"><span className="small-cross">+</span> REFERENCE-LED&nbsp; · &nbsp;FULLY TRAVERSABLE</div>
              </div>
            )}

            {panel === "specification" && (
              <div className="panel-content panel-enter specification-panel">
                <div className="eyebrow"><span className="eyebrow-rule" /> THE BLUEPRINT</div>
                <h2 className="panel-title">Built to<br /><em>belong.</em></h2>
                <p className="panel-intro">One shared metre-scale grid governs every specialist system. The facade stays symmetrical about its entrance axis.</p>
                <div className="spec-list">
                  <div><span>Footprint</span><strong>34.0 x 17.0 m</strong></div>
                  <div><span>Highest point</span><strong>14.6 m</strong></div>
                  <div><span>Raised plinth</span><strong>0.75 m</strong></div>
                  <div><span>Exterior masonry</span><strong>0.34 m</strong></div>
                  <div><span>Floor datums</span><strong>0.75 / 4.80 m</strong></div>
                  <div><span>Central axis</span><strong>X = 0</strong></div>
                </div>
                <p className="spec-note">Four halls with brass-and-opal chandeliers, a 24-riser switchback stair, cased hall doorways and heritage wall lanterns. Use Night mode to inspect the warm interior lighting.</p>
              </div>
            )}

            {panel === "quality" && (
              <div className="panel-content panel-enter qa-panel">
                <div className="eyebrow"><span className="eyebrow-rule" /> INTEGRATION REVIEW</div>
                <h2 className="panel-title">Made to<br /><em>move through.</em></h2>
                <div className={`qa-status ${qa?.passed ? "is-good" : "is-waiting"}`}>
                  <ShieldCheck size={19} strokeWidth={1.7} />
                  <div><strong>{!qa ? "Running checks" : qa.passed ? "Traversal verified" : "Review required"}</strong><span>{qa ? `${qa.passedChecks} structural checks · ${qa.traversedMetres.toFixed(0)}m route` : "Inspecting all systems"}</span></div>
                </div>
                <div className="qa-list">
                  {(qa?.issues.length ? qa.issues : qa?.checks.slice(-7) ?? []).map((item) => (
                    <div key={item}>{qa?.issues.length ? <X size={14} strokeWidth={1.8} /> : <Check size={14} strokeWidth={1.8} />}<span>{item}</span></div>
                  ))}
                </div>
                <p className="qa-footnote">The gameplay route is sampled through both ground-floor halls, the U-stair, upper veranda and central balcony, then back downstairs.</p>
              </div>
            )}
          </div>

          <div className="inspector-bottom">
            <nav className="panel-nav" aria-label="Inspector sections">
              <button onClick={() => setPanel("overview")} className={panel === "overview" ? "active" : ""}><span>01</span> Overview <ChevronRight size={15} /></button>
              <button onClick={() => setPanel("specification")} className={panel === "specification" ? "active" : ""}><span>02</span> Specification <ChevronRight size={15} /></button>
              <button onClick={() => setPanel("quality")} className={panel === "quality" ? "active" : ""}><span>03</span> Quality report <ChevronRight size={15} /></button>
            </nav>
            <div className="sidebar-export">
              <div><span className="sidebar-export-title">THE COMPLETE GAME ASSET</span><span className="sidebar-export-sub">High + mobile LOD · collision · guide</span></div>
              <button title="Download complete game asset package" aria-label="Download complete game asset package" onClick={() => exportAsset("package")} disabled={busy || !qa}><ArrowDownToLine size={18} strokeWidth={1.8} /></button>
            </div>
          </div>
        </aside>

        <section className="viewer-stage" ref={stageRef} aria-label="Interactive building viewer">
          <SceneViewer
            ref={viewerRef}
            preset={view}
            mode={mode}
            roofVisible={roofVisible}
            upperVisible={upperVisible}
            nightMode={nightMode}
            onReady={setQa}
            onTourStop={setTourStop}
          />
          <div className="stage-noise" aria-hidden="true" />
          <div className="viewer-topline">
            <div className="live-label"><span className="live-indicator" /> LIVE MODEL <span className="topline-divider">/</span> 1:1 SCALE</div>
            <div className="topline-right"><span>34.0 x 17.0 x 14.6 M</span><span className="topline-divider">/</span><span>WEBGL</span></div>
          </div>
          <div className="stage-actions">
            <button
              className={`icon-action ${nightMode ? "is-active" : ""}`}
              title={nightMode ? "Switch to daylight" : "Switch to night lighting"}
              aria-label={nightMode ? "Switch to daylight" : "Switch to night lighting"}
              aria-pressed={nightMode}
              onClick={() => setNightMode((value) => !value)}
            >
              {nightMode ? <Sun size={17} strokeWidth={1.7} /> : <Moon size={17} strokeWidth={1.7} />}
            </button>
            <button className="icon-action" title="Reset camera" aria-label="Reset camera" onClick={() => viewerRef.current?.resetCamera()}><RotateCcw size={17} strokeWidth={1.7} /></button>
            <button className="icon-action" title={fullScreen ? "Exit fullscreen" : "Fullscreen"} aria-label={fullScreen ? "Exit fullscreen" : "Fullscreen"} onClick={toggleFullscreen}><Maximize2 size={17} strokeWidth={1.7} /></button>
            <button className="icon-action" title="Controls help" aria-label="Controls help" onClick={() => setHelpOpen(true)}><span className="help-question">?</span></button>
          </div>

          {mode === "walk" ? (
            <>
              <div className="walk-hud">
                <div className="walk-current"><span>WALKTHROUGH <span className="walk-index">{String(tourNumber).padStart(2, "0")} / 12</span></span><strong>{stopLabels[tourStop] ?? tourStop}</strong></div>
                <div className="walk-navigation">
                  <button onClick={() => viewerRef.current?.previousTourStop()} aria-label="Previous walkthrough stop"><ChevronLeft size={18} /></button>
                  <button className="walk-next" onClick={() => viewerRef.current?.nextTourStop()}>Next stop <ArrowRight size={16} /></button>
                </div>
              </div>
              <div className="mobile-walk-controls" aria-label="Touch movement controls">
                <button aria-label="Move forward" onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); viewerRef.current?.setVirtualKey("w", true); }} onPointerUp={() => viewerRef.current?.setVirtualKey("w", false)} onPointerCancel={() => viewerRef.current?.setVirtualKey("w", false)}>↑</button>
                <div><button aria-label="Strafe left" onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); viewerRef.current?.setVirtualKey("a", true); }} onPointerUp={() => viewerRef.current?.setVirtualKey("a", false)} onPointerCancel={() => viewerRef.current?.setVirtualKey("a", false)}>←</button><button aria-label="Move backward" onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); viewerRef.current?.setVirtualKey("s", true); }} onPointerUp={() => viewerRef.current?.setVirtualKey("s", false)} onPointerCancel={() => viewerRef.current?.setVirtualKey("s", false)}>↓</button><button aria-label="Strafe right" onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); viewerRef.current?.setVirtualKey("d", true); }} onPointerUp={() => viewerRef.current?.setVirtualKey("d", false)} onPointerCancel={() => viewerRef.current?.setVirtualKey("d", false)}>→</button></div>
              </div>
            </>
          ) : (
            <div className="stage-caption"><span>01 / EXTERIOR STUDY</span><span>DRAG TO ORBIT &nbsp; · &nbsp; SCROLL TO ZOOM</span></div>
          )}

          <div className="viewer-toolbar">
            <div className="mode-control" role="group" aria-label="Navigation mode">
              <button className={mode === "orbit" ? "selected" : ""} onClick={() => setMode("orbit")}><MousePointer2 size={15} /> Orbit</button>
              <button className={mode === "walk" ? "selected" : ""} onClick={beginWalk}><Footprints size={16} /> Walk</button>
            </div>
            {mode === "orbit" ? (
              <>
                <div className="toolbar-divider" />
                <div className="view-control" role="group" aria-label="Camera viewpoints">
                  {views.map((item) => <button key={item.id} className={view === item.id ? "selected" : ""} onClick={() => selectView(item.id)}>{item.label}</button>)}
                </div>
                <div className="toolbar-spacer" />
                <div className="layer-control" role="group" aria-label="Building layers">
                  <button className={!roofVisible ? "selected" : ""} onClick={() => setRoofVisible((value) => !value)} title="Show or hide roof">{roofVisible ? <Eye size={15} /> : <EyeOff size={15} />} Roof</button>
                  <button className={!upperVisible ? "selected" : ""} onClick={toggleSection} title="Open or close ground-floor cutaway"><Layers3 size={15} /> Cutaway</button>
                </div>
              </>
            ) : (
              <div className="walk-toolbar-tip"><span>W A S D</span> TO MOVE <span className="walk-tip-divider">/</span> DRAG TO LOOK <span className="walk-tip-divider">/</span> USE THE MOON BUTTON FOR NIGHT LIGHTING</div>
            )}
          </div>
        </section>
      </main>

      <div className="page-footer"><span><Box size={13} strokeWidth={1.7} /> PROCEDURAL ARCHITECTURE, NOT A FACADE SHELL</span><span>KERALA HERITAGE / DIGITAL RECONSTRUCTION <ArrowLeft size={13} className="footer-left-arrow" /></span></div>

      {message && <div className="toast" role="status"><span className="toast-dot" />{message}<button aria-label="Dismiss message" onClick={() => setMessage("")}><X size={14} /></button></div>}

      {helpOpen && (
        <div className="modal-backdrop" onMouseDown={() => setHelpOpen(false)}>
          <div className="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setHelpOpen(false)} aria-label="Close help"><X size={18} /></button>
            <span className="eyebrow"><span className="eyebrow-rule" /> VIEWER GUIDE</span>
            <h2 id="help-title">Explore every<br /><em>corner.</em></h2>
            <div className="help-row"><MousePointer2 size={18} /><div><strong>Orbit mode</strong><span>Drag to rotate. Scroll or pinch to zoom. Use the views below for precise elevations.</span></div></div>
            <div className="help-row"><Layers3 size={18} /><div><strong>Inspect the interior</strong><span>Hide the roof, or select Cutaway to remove the upper floor and reveal the ground plan.</span></div></div>
            <div className="help-row"><Moon size={18} /><div><strong>Night lighting</strong><span>The moon button lights the wall lanterns and four hall chandeliers. Hide the roof to see the upper halls, or use Cutaway to inspect the ground-floor lighting.</span></div></div>
            <div className="help-row"><Footprints size={18} /><div><strong>Walk mode</strong><span>WASD or arrows to move, drag to look. Next stop follows the actual collision-checked route.</span></div></div>
            <button className="modal-done" onClick={() => setHelpOpen(false)}>Back to the model <ArrowRight size={16} /></button>
          </div>
        </div>
      )}
    </div>
  );
}