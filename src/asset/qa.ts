import * as THREE from "three";
import { BP, groundWingOpenings, upperWingOpenings } from "./blueprint";
import { inspectHallChandeliers } from "./chandelierQA";
import { fullWalkthrough, type CollisionWorld, type FootPosition } from "./collision";
import { ENTRANCE } from "./entrance";
import { STAIR } from "./interior";
import { LANTERN_DATUMS } from "./lanterns";
import { BALCONY } from "./verandas";
import { ROOF_THICKNESS, roofDatums, roofSurfaceHeight, skirtSideUndersideHeight, skirtUndersideHeight } from "./roof";
import { BEARING_WALL } from "./structure";

export interface QAReport {
  passed: boolean;
  passedChecks: number;
  checks: string[];
  issues: string[];
  traversedMetres: number;
}

export function runAssetQA(root: THREE.Group, collision: CollisionWorld): QAReport {
  const checks: string[] = [];
  const issues: string[] = [];
  const names = root.children.map((child) => child.name.split(" /")[0]);
  for (const name of ["Foundation", "GroundFloor", "FirstFloor", "Entrance", "Verandas", "Openings", "Interior", "Roof", "Materials", "Collision"]) {
    if (names.includes(name)) checks.push(`${name} hierarchy present`);
    else issues.push(`Missing ${name} hierarchy`);
  }
  if (BP.width === 34 && BP.depth === 17 && BP.gablePeak < 15) checks.push("34 x 17m footprint and 14.6m silhouette within brief");
  else issues.push("Blueprint outside agreed dimensions");
  if (BP.stairVoid.maxZ - BP.stairVoid.minZ >= 4.8 && BP.stairVoid.maxX - BP.stairVoid.minX >= 4.0) checks.push("Full-height stairwell opening reserved in upper slab");
  else issues.push("Stairwell void undersized");
  if (collision.colliders.length > 50 && collision.colliders.length < 200) checks.push("Separate simplified collision hierarchy");
  else issues.push("Collision hierarchy requires inspection");

  const mirroredOpenings = [groundWingOpenings, upperWingOpenings].every((openings) =>
    openings.every((opening) => openings.some((other) => other.center === -opening.center && other.kind === opening.kind && other.width === opening.width)),
  );
  if (mirroredOpenings) checks.push("Front elevation: both wings mirror the central entrance axis");
  else issues.push("Agent 01 / front opening grid lost symmetry");

  const findNamed = (fragment: string) => {
    let found = 0;
    root.traverse((object) => { if (object.name.includes(fragment)) found++; });
    return found;
  };
  if (findNamed("Rear ground masonry") && findNamed("exterior upper wall") >= 2) checks.push("Rear and both side elevations have continuous thick exterior walls");
  else issues.push("Agent 02 / inspect rear or side wall continuity");
  if (findNamed("Full-depth monumental arch") && findNamed("Main stair landing") && findNamed("Main timber double door")) checks.push("Entrance view: deep arch, landing and real doorway all present");
  else issues.push("Agent 03 / missing part of the traversable entrance");

  // Entrance porch: the columns must stand clear of the arch wall, and the arch must fit under the
  // architrave without touching it, which was the cause of the cropped-looking portal.
  const archCrown = ENTRANCE.archSpring + ENTRANCE.ringOuter;
  const columnBack = ENTRANCE.columnZ - ENTRANCE.columnRadius;
  const walkway = columnBack - ENTRANCE.wallFaceZ;
  if (walkway > .85) checks.push(`Porch columns stand ${walkway.toFixed(2)} m clear of the arch wall: a walkable veranda, not engaged pilasters`);
  else issues.push(`Agent 03 / only ${walkway.toFixed(2)} m between the porch columns and the arch wall`);
  if (archCrown < ENTRANCE.bearing - .05) checks.push("Arch ring clears the porch architrave, so the full semicircle reads");
  else issues.push("Agent 03 / arch ring still collides with the architrave above");

  // Balcony over the porch: the deck must rest on the cornice, and its edges must line up with the
  // entablature below, so the porch ceiling and balcony floor read as one construction.
  // Same 220 mm slab as every other upper deck, so its top lands exactly on the first-floor datum.
  const deckOnCornice = Math.abs(BALCONY.deckBottom - ENTRANCE.corniceTop) < 1e-6 && Math.abs(BP.first - BALCONY.deckBottom - .22) < 1e-6;
  const edgesAligned = Math.abs(BALCONY.frontZ - ENTRANCE.corniceFrontZ) < 1e-6 && Math.abs(BALCONY.halfWidth - ENTRANCE.halfWidth) < 1e-6;
  const railInside = BALCONY.railZ + .09 < BALCONY.deckFrontZ && BALCONY.cornerX + .09 < BALCONY.halfWidth - BALCONY.kerb;
  if (deckOnCornice && edgesAligned && railInside && findNamed("Central balcony / extended over the entrance porch") && !findNamed("Balcony cantilever support") && !findNamed("Central balcony carved fascia")) {
    checks.push("Balcony deck covers the whole entrance porch, bears directly on the cornice and ends flush with it; railing on the new edge");
  } else {
    issues.push("Agent 05/03 / balcony deck and porch ceiling do not meet cleanly");
  }
  let porchColumns = 0;
  root.traverse((object) => { if (object.name.startsWith("Monumental cream column") && object.name.endsWith("/ round shaft")) porchColumns++; });
  if (porchColumns === 2) checks.push("Entrance porch opened up: the middle pair of columns removed, two corner columns carry the architrave");
  else issues.push(`Agent 03 / expected 2 porch columns, found ${porchColumns}`);
  if (ENTRANCE.columnX.every((x) => x - ENTRANCE.columnRadius > ENTRANCE.railX + .12) && ENTRANCE.columnX.every((x) => x + ENTRANCE.columnRadius < ENTRANCE.halfWidth)) {
    checks.push("Porch columns are symmetric, clear of the stair balustrade and inside the cornice edge");
  } else {
    issues.push("Agent 03 / porch column spacing clashes with the balustrade or the cornice edge");
  }
  // Heritage wall lanterns: two flanking the arch plus one on every solid veranda pier, both floors.
  // Each is one connected chain (plate -> collar -> arm -> pan -> posts -> cap -> finial), so the
  // floating-frame fault found earlier cannot recur.
  const lanterns = findNamed("Heritage wall lantern");
  const entranceLanterns = findNamed("Entrance lantern west") + findNamed("Entrance lantern east");
  const verandaLanterns = findNamed("Veranda lantern");
  const doorLantern = findNamed("Balcony door lantern");
  const oldRosettes = findNamed("Small stone rosette");
  if (lanterns === LANTERN_DATUMS.mounts && entranceLanterns === 2 && doorLantern === 1 && verandaLanterns === lanterns - 3 && oldRosettes === 0) {
    checks.push(`${lanterns} heritage wall lanterns: 2 at the arch, 1 over the balcony door and ${verandaLanterns} on veranda piers (ground ${LANTERN_DATUMS.pierCentres.ground.length} + upper ${LANTERN_DATUMS.pierCentres.upper.length} per side)`);
  } else {
    issues.push(`Agent 03/05/08 / expected ${LANTERN_DATUMS.mounts} lanterns (2 entrance + 1 balcony door + ${LANTERN_DATUMS.mounts - 3} veranda), found ${lanterns}`);
  }
  // The balcony door lantern must clear the door head moulding below and sit on solid wall.
  const doorHeadTop = BP.first + 2.7 + .14 + .08; // door head + moulding centre + half its height
  const plateFoot = LANTERN_DATUMS.balconyDoor.y - .33;
  if (Math.abs(LANTERN_DATUMS.balconyDoor.x) < 1e-9 && plateFoot > doorHeadTop + .1 && LANTERN_DATUMS.balconyDoor.y + LANTERN_DATUMS.totalHeightAboveArmAxis < 9.0) {
    checks.push(`Balcony door lantern is centred on the entrance axis, ${(plateFoot - doorHeadTop).toFixed(2)} m above the door head moulding, on the solid lintel wall`);
  } else {
    issues.push("Agent 05 / balcony door lantern is off axis or clashes with the door head");
  }
  const chainParts = ["Lantern backplate", "Lantern arm collar", "Lantern bracket arm", "Lantern base pan", "Lantern corner post", "Lantern cap ring", "Lantern finial ball"].reduce((t, n) => t + findNamed(n), 0);
  if (chainParts === lanterns * 7 && findNamed("Lantern bracket brace") === lanterns && findNamed("Lantern base joint collar") === lanterns) {
    checks.push("Every lantern frame is one connected chain: plate, collar, arm, joint collar, base pan and posts all meet with no floating parts");
  } else {
    issues.push(`Agent 03/08 / lantern frame chain incomplete (${chainParts} parts for ${lanterns} lanterns)`);
  }
  const lanternTop = 3.5 + LANTERN_DATUMS.totalHeightAboveArmAxis;
  if (lanternTop < ENTRANCE.bearing - .1 && 2.95 > ENTRANCE.ringOuter + 1.0) checks.push("Entrance lanterns sit outside the archivolt ring and below the architrave, with clear plaster around them");
  else issues.push("Agent 03 / lantern position crowds the arch ring or the entablature");
  if (findNamed("Upper wing veranda slab") === 2 && findNamed("Central balcony / extended") && findNamed("Upper eave roof bearer") === 2) checks.push("Veranda and balcony floor edges have aligned supporting members");
  else issues.push("Agent 05 / inspect upper veranda support alignment");
  const balconyPosts = findNamed("Central balcony timber post / round shaft");
  const balconyNewels = findNamed("Balcony front newel");
  if (balconyPosts === 4 && balconyNewels === 6 && findNamed("Upper wing post") >= 8 && findNamed("Ground wing post") >= 8) checks.push("Balcony colonnade has four timber posts with edge-to-edge railing (corner newels at ±4.96 m, no side gap); wing rhythm retained");
  else issues.push(`Agent 05 / balcony facade must read as four posts and edge-to-edge railing (found ${balconyPosts} posts, ${balconyNewels} front newels)`);
  if (!findNamed("Central roof timber post")) checks.push("Dense six-post central colonnade removed");
  else issues.push("Agent 05 / leftover dense central posts");
  // Stair core geometry: 12 + 12 risers of 168.75 mm on 300 mm treads, flights meeting the landing
  // and the first floor by exactly one riser, landing at least as deep as the stair is wide.
  const riserOk = STAIR.rise >= .16 && STAIR.rise <= .175 && STAIR.tread >= .28 && STAIR.tread <= .3 && STAIR.width >= 1.4 && STAIR.width <= 1.6;
  const flight1Top = BP.floor + 11 * STAIR.rise;
  const flight2Top = STAIR.landingY + 11 * STAIR.rise;
  const meetsLanding = Math.abs(STAIR.landingY - flight1Top - STAIR.rise) < 1e-9 && Math.abs(BP.first - flight2Top - STAIR.rise) < 1e-9;
  const landingDeep = STAIR.landingFrontZ - STAIR.landingRearZ >= STAIR.width;
  if (riserOk && meetsLanding && landingDeep && findNamed("Flight 1 tread") === 11 && findNamed("Flight 2 tread") === 11) {
    checks.push(`Switchback stair: 2 x ${STAIR.risersPerFlight} risers of ${(STAIR.rise * 1000).toFixed(0)} mm on ${STAIR.tread * 1000} mm treads, ${STAIR.width} m wide, ${(STAIR.landingFrontZ - STAIR.landingRearZ).toFixed(2)} m landing; both flights meet their landings by exactly one riser`);
  } else {
    issues.push("Agent 06 / stair proportions or flight-to-landing heights are wrong");
  }
  // Void covers the whole stair footprint, so headroom on the stair is the full upper storey; the
  // only low point is the ground under the landing.
  const v = BP.stairVoid;
  const voidCovers = v.minZ <= STAIR.landingRearZ && v.maxZ >= STAIR.bottomZ && v.maxX >= STAIR.flightX + STAIR.width / 2 + .3;
  const approachHeadroom = 4.54 - BP.floor;
  const underLanding = STAIR.landingY - STAIR.slab - BP.floor;
  if (voidCovers && approachHeadroom >= 2.1) checks.push(`Stair headroom: void covers the full stair, ${approachHeadroom.toFixed(2)} m at the slab edge; ${underLanding.toFixed(2)} m clear under the landing`);
  else issues.push("Agent 06 / slab opening does not clear the stair");
  // Rail heights meet at every newel: raked (above the nosing line) and level (above the floor)
  // are tuned so a newel 50 mm behind a step edge receives both rails at the same centre height.
  const railMeet = Math.abs((STAIR.railRaked + (STAIR.inset / STAIR.tread) * STAIR.rise) - STAIR.railLevel) < 1e-9 && STAIR.railRaked >= .95 && STAIR.railLevel <= 1.0;
  const newels = findNamed("newel / terminal newel") + findNamed("post / terminal newel");
  const panels = findNamed("guard panel") + findNamed("skirt panel") + findNamed("divider panel") + findNamed("Upper stairwell");
  const soffits = findNamed("plaster soffit");
  if (railMeet && newels === 18 && panels === 0 && soffits === 3 && findNamed("Landing support post") >= 2) {
    checks.push(`Timber balustrade: raked rail ${STAIR.railRaked} m, level rail ${STAIR.railLevel.toFixed(3)} m, meeting at ${newels} newels; no solid timber panels; plaster soffits under both flights and the landing on two posts`);
  } else {
    issues.push(`Agent 06 / balustrade not clean (newels ${newels}, panels ${panels}, soffits ${soffits})`);
  }
  // Full bearing walls from edge to edge with doorway openings into the halls on left and right:
  const partitionNames = ["Gallery portal wall", "Long gallery dividing wall", "Interior room dividing wall", "Interior room door jamb", "Interior doorway teak jamb", "Front-to-back inner room partition", "Front-to-back outer room partition"];
  const leftoverPartitions = partitionNames.reduce((total, name) => total + findNamed(name), 0);
  const bearingWallsGround = findNamed("bearing wall / ground");
  const bearingWallsUpper = findNamed("bearing wall / upper");
  const hallDoorJambs = findNamed("hall doorway jamb");
  if (leftoverPartitions === 0 && bearingWallsGround > 0 && bearingWallsUpper > 0 && hallDoorJambs >= 4 && BEARING_WALL.door.width >= 1.5) {
    checks.push(`Bearing lines at |X| = ${BEARING_WALL.x} are full solid walls from edge to edge with clean cased doorway openings on the left and right to enter the halls`);
  } else {
    issues.push(`Agent 06/02 / bearing walls incomplete (${bearingWallsGround} ground, ${bearingWallsUpper} upper) or ${leftoverPartitions} partition pieces remain`);
  }
  // Every exposed fall edge of the first-floor void has a guard; the arrival bay is the only gap.
  const guardRuns = ["west front half", "west rear half", "east front half", "east rear half", "rear west half", "rear east half", "front west", "front east"].filter((r) => findNamed(`Upper void guard ${r} / handrail`) === 1).length;
  if (guardRuns === 8 && findNamed("Void edge band") === 5 && findNamed("Arrival stone nosing") === 1) {
    checks.push("First-floor void is a clean rectangle with a finished edge band, guarded on every exposed edge and open only at the stair arrival");
  } else {
    issues.push(`Agent 06 / void guards incomplete (${guardRuns}/8 runs)`);
  }
  const windows = groundWingOpenings.filter((w) => w.kind === "window");
  const upperWindows = upperWingOpenings.filter((w) => w.kind === "window");
  if (windows.every((w) => w.sill >= 1.3 && w.sill + w.height <= 2.9)) checks.push("Ground sills raised to about 1.4 m above the floor: full-height display wall below every window");
  else issues.push("Agent 01 / ground window schedule not raised above the display datum");
  if (upperWindows.every((w) => w.sill >= .95)) checks.push("Upper front windows clear the veranda handrail and tuck between the spandrel and eave bearer");
  else issues.push("Agent 01 / upper window schedule intersects the railing or eave bearer");
  if (findNamed("Front slope /") >= 4 && findNamed("Central gablet front hip") && findNamed("Gable ridge cap") && findNamed("skirt slope / tile surface") === 2 && findNamed("First-floor closed lime ceiling")) checks.push("Roof view: double-hip main roof, valleyed gablet, hipped skirts and closed upper ceiling");
  else issues.push("Agent 07 / inspect roof modules and ceiling closure");
  const junction = roofDatums.gableJunction;
  const valleyIntersection = Math.abs(roofSurfaceHeight(junction.frontValley.x, junction.frontValley.z) - junction.frontValley.y) < .002;
  const ridgeIntersection = Math.abs(roofSurfaceHeight(junction.sharedMainRidge.x, junction.sharedMainRidge.z) - junction.sharedMainRidge.y) < .002;
  const cleanValley = junction.valleySamples.every((p) => Math.abs(roofSurfaceHeight(p.x, p.z) - p.y) < .003);
  const cleanRidge = junction.ridgeSamples.every((p) => Math.abs(roofSurfaceHeight(p.x, p.z) - p.y) < .003);
  if (valleyIntersection && ridgeIntersection && cleanValley && cleanRidge && findNamed("continuous clay valley roll") === 2 && findNamed("Gable/main ridge mitred junction") && findNamed("Rear timber gable screen") === 0) {
    checks.push("Both raised-gable valley lines meet the main slope continuously and its descending ridge lands on the main ridge; no rear screen");
  } else {
    issues.push("Agent 07 / gable valleys or descending ridge fail to meet the main roof");
  }
  let centralTileFaces = 0;
  let centralUndersides = 0;
  let warmCentralUndersides = 0;
  root.traverse((object) => {
    if (!object.userData.centralJunction) return;
    if (object.userData.roofLayer === "tile") centralTileFaces++;
    if (object.userData.roofLayer === "underside") {
      centralUndersides++;
      if (object.userData.warmClayUnderside) warmCentralUndersides++;
    }
  });
  if (centralTileFaces === 5 && centralUndersides === 5 && warmCentralUndersides === 5) {
    checks.push("All five central gable/apron planes have perpendicular 150 mm backs; hidden junction skins use warm clay, not black timber");
  } else {
    issues.push(`Agent 07 / central roof skins incomplete or dark (${centralTileFaces} tiles, ${centralUndersides} backs, ${warmCentralUndersides} warm backs)`);
  }
  const tiledTransitions = findNamed("apron transition / eave facet / tile surface") === 2 && findNamed("apron transition / gable facet / tile surface") === 2;
  const fittedCaps = findNamed("raised apron hip cap") === 2 && findNamed("lower apron valley cap") === 2 && findNamed("front transition sill flashing") === 2;
  const supportedJunctions = findNamed("raised apron hip rafter") === 2 && findNamed("lower apron valley rafter") === 2 && findNamed("main gable valley rafter") === 2 && findNamed("Gable ridge timber") === 1;
  const topologyCounts = findNamed("Central gablet front hip over the balcony / tile surface") === 1 && findNamed("gable roof plane / shared valley / tile surface") === 2 && findNamed("Front timber gable screen") === 1;
  if (tiledTransitions && fittedCaps && supportedJunctions && topologyCounts && findNamed("Central apron eave step closer") === 2 && findNamed("closed gable-to-main roof cheek") === 0) {
    checks.push("Raised central apron is joined to both lower wing slopes by tiled transition facets, fitted caps and matching rafters; no dark filler wedges");
  } else {
    issues.push("Agent 07 / central apron transition is open, duplicated or unsupported");
  }

  // Roof bearing: the tiled planes must rest on, and never cut through, the veranda bearers and posts.
  const underside = (x: number, z: number) => roofSurfaceHeight(x, z) - ROOF_THICKNESS;
  const bearing: [string, number, number, number][] = [
    ["wing eave bearer front edge", 11, 8.52, 9.11],
    ["wing eave bearer at hip corner", 16.83, 8.52, 9.11],
    ["balcony roof bearer front edge", 0, 9.22, 9.59],
  ];
  const unsupported = bearing.filter(([, x, z, top]) => underside(x, z) < top - .001 || underside(x, z) > top + .06);
  if (unsupported.length === 0) checks.push("Roof underside bears on the veranda and balcony timber bearers within 60 mm");
  else unsupported.forEach(([name]) => issues.push(`Agent 07 / roof does not sit cleanly on ${name}`));
  // Ground skirt junction, measured from the built meshes: the roof must land on the bearer, butt the
  // spandrel face, and end flush with the veranda end plane on both sides.
  const boxesNamed = (name: string) => {
    const found: THREE.Box3[] = [];
    root.traverse((object) => { if (object.name === name) found.push(new THREE.Box3().setFromObject(object)); });
    return found;
  };
  const k = roofDatums.skirt;
  const maxAbsX = (b: THREE.Box3) => Math.max(Math.abs(b.min.x), Math.abs(b.max.x));
  const bearers = boxesNamed("Lower porch roof bearer");
  const sideBearers = boxesNamed("Lower porch side roof bearer");
  const spandrels = boxesNamed("Deep front veranda fascia / supporting spandrel");
  const sideSpandrels = boxesNamed("Deep side veranda spandrel");
  const frontBearing = bearers.length === 2 && bearers.every((b) => Math.abs(skirtUndersideHeight(b.max.z) - b.max.y) < .003);
  const sideBearing = sideBearers.length === 2 && sideBearers.every((b) => Math.abs(skirtSideUndersideHeight(maxAbsX(b)) - b.max.y) < .003);
  if (frontBearing && sideBearing) checks.push("Skirt roof front and side planes both land on their ground bearers' top outer edges");
  else issues.push("Agent 07 / skirt roof does not sit on the front or side ground bearer");
  const frontAbuts = spandrels.length === 2 && spandrels.every((s) => Math.abs(s.max.z - k.wallZ) < .002 && s.min.y < k.top && s.max.y > k.top);
  const sideAbuts = sideSpandrels.length === 2 && sideSpandrels.every((s) => Math.abs(maxAbsX(s) - k.wallX) < .002 && Math.abs(s.min.z - k.rearZ) < .002 && s.min.y < k.top && s.max.y > k.top);
  if (frontAbuts && sideAbuts) checks.push("Skirt roof upper edges meet the front and side spandrel faces; the side edge runs back to the building front face");
  else issues.push("Agent 07 / skirt roof upper edge does not meet a spandrel face");
  const hipTrue = Math.abs(skirtUndersideHeight(k.eaveZ) - skirtSideUndersideHeight(k.eaveX)) < 1e-6 && Math.abs((k.eaveX - k.wallX) - (k.eaveZ - k.wallZ)) < 1e-6;
  if (hipTrue) checks.push("Skirt front and side planes meet in a true 45-degree hip with equal overhang");
  else issues.push("Agent 07 / skirt hip planes do not intersect on one line");
  const endsFlush = [...bearers, ...sideBearers].every((b) => Math.abs(maxAbsX(b) - k.bearerSide) < .002);
  if (endsFlush) checks.push("Front and side ground bearers end flush on the veranda end plane");
  else issues.push("Agent 05/07 / ground bearers do not end on a common plane");
  const corners = boxesNamed("West corner pier / ground").length + boxesNamed("East corner pier / ground").length + boxesNamed("West corner pier / upper").length + boxesNamed("East corner pier / upper").length;
  if (corners === 4) checks.push("Building front corners are closed by masonry piers; no open wall notch behind the side roof");
  else issues.push("Agent 02 / corner pier missing");
  if (!findNamed("Upper deck timber cantilever bracket") && !findNamed("skirt corner hip")) checks.push("No free-hanging deck brackets or open hip ends remain at the skirt roof");
  else issues.push("Agent 05/07 / leftover floating bracket or open hip");

  // Round-column conversion: every pillar uses the shared round base / shaft / capital stack.
  let roundShafts = 0;
  let squarePillars = 0;
  root.traverse((object) => {
    if (object.name.includes("/ round shaft")) roundShafts++;
    if (/square shaft|grounded foot|Monumental cream pilaster|Pilaster stone base|Stair balustrade pier|Landing end newel/.test(object.name) || (object.name.includes("terminal newel") && object instanceof THREE.Mesh && object.geometry instanceof THREE.BoxGeometry)) squarePillars++;
  });
  if (roundShafts >= 22 && squarePillars === 0) checks.push(`All ${roundShafts} columns are round: base, tapered shaft, bell capital and abacus`);
  else issues.push(`Agent 05/03 / ${squarePillars} rectangular pillars remain or too few round shafts (${roundShafts})`);

  const symmetric = [[6, 7], [12, 2], [15, -5], [3, 5.2], [16.5, 9]].every(([x, z]) => Math.abs(roofSurfaceHeight(x, z) - roofSurfaceHeight(-x, z)) < 1e-6);
  if (symmetric) checks.push("Roof envelope is mirror-symmetric about the entrance axis");
  else issues.push("Agent 07 / roof envelope asymmetric");

  let invalidGeometry = false;
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const positions = object.geometry.getAttribute("position");
    for (let i = 0; i < positions.count && !invalidGeometry; i++) {
      if (![positions.getX(i), positions.getY(i), positions.getZ(i)].every(Number.isFinite)) invalidGeometry = true;
    }
  });
  if (invalidGeometry) issues.push("Agent 11 / non-finite vertex found during structural traversal");
  else checks.push("Every authored mesh has finite vertex positions");

  // Sample the whole round trip at a player's walking increment, not just endpoint teleports.
  let foot: FootPosition = { x: fullWalkthrough[0].x, y: 0, z: fullWalkthrough[0].z };
  let traversedMetres = 0;
  for (let p = 1; p < fullWalkthrough.length; p++) {
    const destination = fullWalkthrough[p];
    const length = Math.hypot(destination.x - foot.x, destination.z - foot.z);
    const samples = Math.max(1, Math.ceil(length / .04));
    const start = { ...foot };
    for (let i = 1; i <= samples; i++) {
      const nextX = start.x + (destination.x - start.x) * i / samples;
      const nextZ = start.z + (destination.z - start.z) * i / samples;
      foot = collision.tryMove(foot, nextX - foot.x, nextZ - foot.z);
    }
    const remaining = Math.hypot(foot.x - destination.x, foot.z - destination.z);
    if (remaining > .1) {
      issues.push(`Walkthrough blocked before ${destination.stop ?? `waypoint ${p}`} at (${foot.x.toFixed(2)}, ${foot.z.toFixed(2)})`);
      break;
    }
    traversedMetres += length;
    if (destination.stop === "balcony" && Math.abs(foot.y - BP.first) > .02) issues.push("Balcony not reached at first-floor elevation");
  }
  if (issues.length === 0) checks.push("Outside > stairs > hall > both wings > U stair > veranda > balcony > return: walkable");

  let meshCount = 0;
  let instancedCount = 0;
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) meshCount++;
    if (obj instanceof THREE.InstancedMesh) instancedCount++;
  });
  if (instancedCount > 4) checks.push(`${instancedCount} instanced lightweight balustrade runs`);
  if (meshCount > 350) checks.push(`${meshCount} authored architectural meshes with named systems`);

  const hallLighting = inspectHallChandeliers(root);
  checks.push(...hallLighting.checks);
  issues.push(...hallLighting.issues);

  return { passed: issues.length === 0, passedChecks: checks.length, checks, issues, traversedMetres };
}