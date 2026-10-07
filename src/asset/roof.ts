import * as THREE from "three";
import { BP } from "./blueprint";
import type { AssetMaterials } from "./materials";
import { beam, box, cylinder, point, roofPolygon } from "./primitives";

/*
 * Agent 07 / Kerala roof system.
 *
 * Every tiled plane is derived from one set of datums so that hips, ridges, valleys and the
 * central gablet meet at computed points instead of hand-typed ones.
 *
 *  - Main roof: two equal hipped ranges (front and rear) at 30 degrees sharing one continuous
 *    eave line all round the building. Their inner slopes meet in a single level valley at Z = 0
 *    which discharges onto the end hips.
 *  - Central gablet (mukhappu): a steeper cross roof whose side planes cut the main front slope
 *    in two true valleys, a front hip at the main pitch over the balcony, a vertical timber
 *    screen above the front wall line and a second screen where it dies into the main ridge.
 *  - Ground-floor skirt roofs: 30 degree lean-tos bearing on the ground veranda posts and
 *    terminating against the first-floor spandrel, with a hip at each outer corner.
 */

export const ROOF_THICKNESS = .15;
const PITCH = THREE.MathUtils.degToRad(30);
const S = Math.tan(PITCH);

// Main envelope
const EAVE = BP.roofEave;
const EAVE_Z = 9.6;
const EAVE_X = 17.98;
const RIDGE = BP.roofRidge;
const RUN = (RIDGE - EAVE) / S;
const RIDGE_Z = EAVE_Z - RUN;
const RIDGE_END_X = EAVE_X - RUN;
const VALLEY_Y = RIDGE - RIDGE_Z * S;
const VALLEY_END_X = EAVE_X - (VALLEY_Y - EAVE) / S;

// Central gablet
const C_HALF = 5.55;
const C_EAVE = 9.525; // rests on the balcony roof bearer (top 9.59 at z 9.22)
const PEAK = BP.gablePeak;
const SC = (PEAK - C_EAVE) / C_HALF;
const GABLE_Z = BP.frontWallZ;
const GABLE_BASE = C_EAVE + (EAVE_Z - GABLE_Z) * S;
const GABLE_HALF = (PEAK - GABLE_BASE) / SC;

// Ground-floor skirt: one roof that wraps the veranda corner. Front and side planes both bear on the ground
// bearers (top 3.64) and butt the first-floor spandrel faces; they meet in a true 45 degree hip.
const SK_BEAM_TOP = 3.64; // top of the front and side ground bearers (verandas.ts)
const SK_BEAM_FRONT = 8.52; // front face of the front bearer
const SK_BEAM_SIDE = 17.0; // outer face of the side bearer (the building end plane)
const SK_WALL_Z = 8.485; // front face of the first-floor spandrel: front upper edge lands here
const SK_WALL_X = 16.965; // outer face of the side spandrel: side upper edge lands here
const SK_REAR_Z = BP.frontWallZ + BP.wall / 2; // building front face; the side roof ends against it
const SK_EAVE_Z = 9.2; // front tile edge; the fascia board sits just in front of it
const SK_EAVE_X = SK_WALL_X + (SK_EAVE_Z - SK_WALL_Z); // equal overhang on both faces => 45 degree hip
const SK_INNER_X = 5.15; // flush with the entrance arch wall side face
const SK_BARGE_T = .08;

const FASCIA_H = .22;
const FASCIA_T = .2;

const mainFront = (z: number) => EAVE + (EAVE_Z - z) * S;
const valleyX = (z: number) => (PEAK - mainFront(z)) / SC;
const VALLEY_FRONT_X = valleyX(GABLE_Z);
const VALLEY_FRONT_Y = mainFront(GABLE_Z);
// The projecting gable ridge descends from the front peak to the exact main ridge intersection.
const GABLE_RIDGE_SLOPE = (PEAK - RIDGE) / (GABLE_Z - RIDGE_Z);
const gableRidgeY = (z: number) => PEAK + GABLE_RIDGE_SLOPE * (z - GABLE_Z);
const gableHalfWidthAt = (z: number) => VALLEY_FRONT_X * (z - RIDGE_Z) / (GABLE_Z - RIDGE_Z);
// Underside plane passes through the bearer's top-front corner, then falls at the common 30 degrees.
export const skirtUndersideHeight = (z: number) => SK_BEAM_TOP + (SK_BEAM_FRONT - z) * S;
/** Same plane rotated onto the side face: passes through the side bearer's top-outer corner. */
export const skirtSideUndersideHeight = (x: number) => SK_BEAM_TOP + (SK_BEAM_SIDE - Math.abs(x)) * S;
const skirtUnder = skirtUndersideHeight;
const skirtSideUnder = skirtSideUndersideHeight;
const skirtHeight = (z: number) => skirtUnder(z) + ROOF_THICKNESS;
const SK_EAVE = skirtHeight(SK_EAVE_Z);
const SK_TOP = skirtHeight(SK_WALL_Z);

export const roofDatums = {
  pitchDegrees: 30,
  gabletCheekDegrees: Math.round(THREE.MathUtils.radToDeg(Math.atan(SC)) * 10) / 10,
  thickness: ROOF_THICKNESS,
  eave: EAVE,
  eaveOverhang: { front: EAVE_Z - BP.frontZ, side: EAVE_X - BP.halfWidth },
  ridge: RIDGE,
  ridgeZ: [RIDGE_Z, -RIDGE_Z],
  valley: { y: VALLEY_Y, z: 0 },
  gable: {
    peak: PEAK,
    screenBase: VALLEY_FRONT_Y,
    screenWidth: 2 * VALLEY_FRONT_X,
    apronBase: GABLE_BASE,
    apronTopWidth: 2 * GABLE_HALF,
    z: GABLE_Z,
  },
  gableJunction: {
    frontValley: { x: VALLEY_FRONT_X, y: VALLEY_FRONT_Y, z: GABLE_Z },
    sharedMainRidge: { x: 0, y: RIDGE, z: RIDGE_Z },
    ridgeSlope: GABLE_RIDGE_SLOPE,
    valleySamples: Array.from({ length: 5 }, (_, i) => {
      const t = i / 4;
      const z = THREE.MathUtils.lerp(RIDGE_Z, GABLE_Z, t);
      return { x: VALLEY_FRONT_X * t, y: mainFront(z), z };
    }),
    ridgeSamples: Array.from({ length: 5 }, (_, i) => {
      const t = i / 4;
      const z = THREE.MathUtils.lerp(RIDGE_Z, GABLE_Z, t);
      return { x: 0, y: gableRidgeY(z), z };
    }),
  },
  skirt: {
    eave: SK_EAVE,
    top: SK_TOP,
    wallZ: SK_WALL_Z,
    wallX: SK_WALL_X,
    rearZ: SK_REAR_Z,
    innerX: SK_INNER_X,
    eaveX: SK_EAVE_X,
    eaveZ: SK_EAVE_Z,
    bearerTop: SK_BEAM_TOP,
    bearerFront: SK_BEAM_FRONT,
    bearerSide: SK_BEAM_SIDE,
  },
};

/** Top surface of the composite roof at any plan position (metres). */
export function roofSurfaceHeight(x: number, z: number): number {
  const ax = Math.abs(x);
  const hip = EAVE + (EAVE_X - ax) * S;
  const frontRange = Math.min(RIDGE - Math.abs(z - RIDGE_Z) * S, hip);
  const rearRange = Math.min(RIDGE - Math.abs(z + RIDGE_Z) * S, hip);
  let height = Math.max(frontRange, rearRange);
  if (z >= RIDGE_Z && z <= GABLE_Z) {
    const width = gableHalfWidthAt(z);
    if (ax <= width) height = Math.max(height, gableRidgeY(z) - SC * ax);
  }
  if (z >= GABLE_Z && z <= EAVE_Z) {
    const t = (z - GABLE_Z) / (EAVE_Z - GABLE_Z);
    const width = THREE.MathUtils.lerp(GABLE_HALF, C_HALF, t);
    if (ax <= width) height = Math.max(height, C_EAVE + (EAVE_Z - z) * S);
  }
  return height;
}

function surface(group: THREE.Group, name: string, vertices: THREE.Vector3[], m: AssetMaterials, undersideMaterial: THREE.Material = m.roofUnder) {
  // Build the underside at a true perpendicular thickness. The old vertical drop pinched the inner
  // edge of pitched planes, letting dark duplicate faces show through tight roof junctions.
  const normal = new THREE.Vector3().crossVectors(
    vertices[1].clone().sub(vertices[0]),
    vertices[2].clone().sub(vertices[0]),
  ).normalize();
  if (normal.y < 0) normal.negate();
  const underside = vertices.map((p) => p.clone().addScaledVector(normal, -ROOF_THICKNESS));
  const top = roofPolygon(group, `${name} / tile surface`, vertices, m.roof);
  const bottom = roofPolygon(group, `${name} / closed roof underside`, underside, undersideMaterial, 3.1, normal.clone().negate());
  top.userData.roofLayer = "tile";
  bottom.userData.roofLayer = "underside";
  top.userData.normalThickness = bottom.userData.normalThickness = ROOF_THICKNESS;
  if (name.includes("Central gablet") || name.includes("apron transition") || name.includes("gable roof plane / shared valley")) {
    top.userData.centralJunction = true;
    bottom.userData.centralJunction = true;
    bottom.userData.warmClayUnderside = undersideMaterial === m.roofAlt;
  }
}

function cap(group: THREE.Group, name: string, a: THREE.Vector3, b: THREE.Vector3, radius: number, material: THREE.Material) {
  const direction = b.clone().sub(a);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), 9), material);
  mesh.name = name;
  mesh.position.copy(a).add(b).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(point(0, 1, 0), direction.normalize());
  mesh.castShadow = true;
  group.add(mesh);
}

function ball(group: THREE.Group, name: string, p: THREE.Vector3, radius: number, material: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 10, 8), material);
  mesh.name = name;
  mesh.position.copy(p);
  mesh.castShadow = true;
  group.add(mesh);
}

/** Horizontal fascia along X. Boards hang 10 mm below the tile edge and butt cleanly at corners. */
function fasciaX(group: THREE.Group, name: string, x0: number, x1: number, eaveY: number, z: number, m: AssetMaterials) {
  box(group, name, (x0 + x1) / 2, eaveY - .01 - FASCIA_H / 2, z, Math.abs(x1 - x0), FASCIA_H, FASCIA_T, m.teakDark);
}

function fasciaZ(group: THREE.Group, name: string, x: number, z0: number, z1: number, eaveY: number, m: AssetMaterials) {
  box(group, name, x, eaveY - .01 - FASCIA_H / 2, (z0 + z1) / 2, FASCIA_T, FASCIA_H, Math.abs(z1 - z0), m.teakDark);
}

/** Vertical slab in the XY plane (gable screens). */
function screen(group: THREE.Group, name: string, outline: [number, number][], z: number, thickness: number, material: THREE.Material) {
  const shape = new THREE.Shape();
  outline.forEach(([x, y], i) => (i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)));
  shape.closePath();
  const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false }), material);
  mesh.name = name;
  mesh.position.z = z - thickness / 2;
  mesh.castShadow = mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function mainRoof(group: THREE.Group, m: AssetMaterials) {
  const main = new THREE.Group();
  main.name = "Main roof / two equal 30-degree hipped ranges on one continuous eave";
  group.add(main);

  // The main front slope is clipped on the exact two gable/main valley lines, not at a guessed ridge offset.
  const ridgeJunction = point(0, RIDGE, RIDGE_Z);
  for (const sign of [-1, 1]) {
    surface(main, `Front slope / ${sign < 0 ? "west" : "east"} wing`, [
      point(sign * EAVE_X, EAVE, EAVE_Z),
      point(sign * C_HALF, EAVE, EAVE_Z),
      point(sign * VALLEY_FRONT_X, VALLEY_FRONT_Y, GABLE_Z),
      ridgeJunction,
      point(sign * RIDGE_END_X, RIDGE, RIDGE_Z),
    ], m);
  }
  surface(main, "Front range / inner slope down to the valley", [
    point(-VALLEY_END_X, VALLEY_Y, 0), point(VALLEY_END_X, VALLEY_Y, 0),
    point(RIDGE_END_X, RIDGE, RIDGE_Z), point(-RIDGE_END_X, RIDGE, RIDGE_Z),
  ], m);
  surface(main, "Rear range / inner slope up from the valley", [
    point(-RIDGE_END_X, RIDGE, -RIDGE_Z), point(RIDGE_END_X, RIDGE, -RIDGE_Z),
    point(VALLEY_END_X, VALLEY_Y, 0), point(-VALLEY_END_X, VALLEY_Y, 0),
  ], m);
  surface(main, "Rear slope", [
    point(-EAVE_X, EAVE, -EAVE_Z), point(EAVE_X, EAVE, -EAVE_Z),
    point(RIDGE_END_X, RIDGE, -RIDGE_Z), point(-RIDGE_END_X, RIDGE, -RIDGE_Z),
  ], m);

  for (const sign of [-1, 1]) {
    const side = sign < 0 ? "West" : "East";
    const x = sign * EAVE_X;
    // Both ranges share one end plane, so the hip end is one surface split only at the valley point.
    surface(main, `${side} hip end / front half`, [
      point(x, EAVE, EAVE_Z), point(sign * RIDGE_END_X, RIDGE, RIDGE_Z),
      point(sign * VALLEY_END_X, VALLEY_Y, 0), point(x, EAVE, 0),
    ], m);
    surface(main, `${side} hip end / rear half`, [
      point(x, EAVE, 0), point(sign * VALLEY_END_X, VALLEY_Y, 0),
      point(sign * RIDGE_END_X, RIDGE, -RIDGE_Z), point(x, EAVE, -EAVE_Z),
    ], m);
    for (const zSign of [-1, 1]) {
      const corner = point(x, EAVE, zSign * EAVE_Z);
      const ridgeEnd = point(sign * RIDGE_END_X, RIDGE, zSign * RIDGE_Z);
      cap(main, `${side} ${zSign > 0 ? "front" : "rear"} hip cap`, corner, ridgeEnd, .095, m.roofEdge);
      ball(main, "Ridge end finial ball", ridgeEnd, .14, m.roofEdge);
    }
    fasciaX(main, `${side} front eave fascia`, sign * C_HALF, sign * (EAVE_X + FASCIA_T / 2), EAVE, EAVE_Z, m);
    fasciaZ(main, `${side} eave fascia`, x, -EAVE_Z + FASCIA_T / 2, EAVE_Z - FASCIA_T / 2, EAVE, m);
  }
  for (const sign of [-1, 1]) {
    cap(main, `${sign < 0 ? "West" : "East"} front ridge cap to central junction`, point(sign * .14, RIDGE, RIDGE_Z), point(sign * RIDGE_END_X, RIDGE, RIDGE_Z), .12, m.roofEdge);
  }
  ball(main, "Gable/main ridge mitred junction", ridgeJunction, .13, m.roofEdge);
  cap(main, "Rear ridge cap", point(-RIDGE_END_X, RIDGE, -RIDGE_Z), point(RIDGE_END_X, RIDGE, -RIDGE_Z), .14, m.roofEdge);
  fasciaX(main, "Rear eave fascia", -(EAVE_X + FASCIA_T / 2), EAVE_X + FASCIA_T / 2, EAVE, -EAVE_Z, m);
}

function centralGablet(group: THREE.Group, m: AssetMaterials) {
  const c = new THREE.Group();
  c.name = "Central gablet / tiled apron transitions with continuous valleys to the main ridge";
  group.add(c);

  const ridgeFront = point(0, PEAK, GABLE_Z);
  const ridgeRear = point(0, RIDGE, RIDGE_Z);
  // The gable's timber face sits proud of the dark screen so frame, louvers and finial read cleanly.
  const FRAME_Z = GABLE_Z + .13;
  const peak = point(0, PEAK, FRAME_Z);
  const apronLeft = point(-C_HALF, C_EAVE, EAVE_Z);
  const apronRight = point(C_HALF, C_EAVE, EAVE_Z);
  const gableBaseLeft = point(-GABLE_HALF, GABLE_BASE, GABLE_Z);
  const gableBaseRight = point(GABLE_HALF, GABLE_BASE, GABLE_Z);
  surface(c, "Central gablet front hip over the balcony", [
    apronLeft, apronRight, gableBaseRight, gableBaseLeft,
  ], m, m.roofAlt);
  for (const sign of [-1, 1]) {
    const side = sign < 0 ? "West" : "East";
    const valleyFront = point(sign * VALLEY_FRONT_X, VALLEY_FRONT_Y, GABLE_Z);
    const gableBase = point(sign * GABLE_HALF, GABLE_BASE, GABLE_Z);
    const wingEave = point(sign * C_HALF, EAVE, EAVE_Z);
    const raisedEave = point(sign * C_HALF, C_EAVE, EAVE_Z);

    // The raised apron and lower wing roof are parallel planes. Two tiled transition facets bridge
    // them without overlap: A-B-V and A-V-F share one fold and close the former dark triangular gap.
    // Every outer edge is also an edge of an adjoining roof plane.
    surface(c, `${side} apron transition / eave facet`, [raisedEave, wingEave, valleyFront], m, m.roofAlt);
    surface(c, `${side} apron transition / gable facet`, [raisedEave, valleyFront, gableBase], m, m.roofAlt);

    // The raised gable cheek starts at the outer valley point, so its lower edge V-P is exactly the
    // same edge as the clipped main slope. The front screen extends to V and closes this roof fully.
    surface(c, `${side} gable roof plane / shared valley`, [ridgeFront, ridgeRear, valleyFront], m, m.roofAlt);
    const valleyDirection = ridgeRear.clone().sub(valleyFront).normalize();
    cap(c, `${side} continuous clay valley roll`, valleyFront.clone().addScaledVector(valleyDirection, .09), ridgeRear.clone().addScaledVector(valleyDirection, -.13), .075, m.roofEdge);
    ball(c, `${side} mitred gable valley head`, valleyFront, .09, m.roofEdge);

    // Raised apron hip and lower main valley terminate together at the front gable face.
    cap(c, `${side} raised apron hip cap`, raisedEave, gableBase, .085, m.roofEdge);
    cap(c, `${side} lower apron valley cap`, wingEave, valleyFront, .075, m.roofEdge);
    cap(c, `${side} front transition sill flashing`, gableBase, valleyFront, .055, m.roofEdge);

    // Rafters directly under every junction line. Their top edges touch the roof underside and
    // their ends terminate at the same shared vertices as the tiles and caps.
    const supportLine = (name: string, a: THREE.Vector3, b: THREE.Vector3, width: number) => {
      beam(c, name, point(a.x, a.y - ROOF_THICKNESS - .055, a.z), point(b.x, b.y - ROOF_THICKNESS - .055, b.z), width, .1, m.teak);
    };
    supportLine(`${side} raised apron hip rafter`, raisedEave, gableBase, .11);
    supportLine(`${side} lower apron valley rafter`, wingEave, valleyFront, .11);
    supportLine(`${side} main gable valley rafter`, valleyFront, ridgeRear, .12);

    // One strong triangular timber frame whose members sit exactly on the roof pitch, from the
    // valley point up to the peak. Clay rolls continue the main-roof ridge language around the gable.
    const basePt = point(sign * VALLEY_FRONT_X, VALLEY_FRONT_Y, FRAME_Z);
    beam(c, `${side} gable verge frame`, basePt, peak, .17, .15, m.teak);
    cap(c, `${side} gable verge cap`, point(sign * VALLEY_FRONT_X, VALLEY_FRONT_Y, FRAME_Z + .06), point(0, PEAK + .06, FRAME_Z), .085, m.roofEdge);
  }
  fasciaX(c, "Gablet front eave fascia", -(C_HALF + FASCIA_T / 2), C_HALF + FASCIA_T / 2, C_EAVE, EAVE_Z, m);
  // Closed end boards join the raised central fascia to each lower wing fascia. They occupy only
  // the true vertical eave step and do not extend into the sloping tiled transition.
  for (const sign of [-1, 1]) {
    box(c, "Central apron eave step closer", sign * C_HALF, (EAVE + C_EAVE) / 2, EAVE_Z + .015, .16, C_EAVE - EAVE, .15, m.teakDark);
  }
  for (let x = -4.5; x <= 4.51; x += .75) {
    box(c, "Small carved front eave brackets", x, C_EAVE - .01 - FASCIA_H - .075, EAVE_Z - .11, .11, .21, .17, m.teakDark);
  }

  // The single front screen closes the gable. At the back, the roof sheets converge directly
  // onto the main ridge instead of ending on the old floating rear screen.
  screen(c, "Front timber gable screen", [
    [-VALLEY_FRONT_X, VALLEY_FRONT_Y], [-VALLEY_FRONT_X, VALLEY_FRONT_Y - .14],
    [VALLEY_FRONT_X, VALLEY_FRONT_Y - .14], [VALLEY_FRONT_X, VALLEY_FRONT_Y], [0, PEAK],
  ], GABLE_Z, .12, m.teakDark);

  // --- Clean traditional gable face ---------------------------------------------------------
  // Base sill sits directly on the roof where the triangle rises, closing the screen's bottom edge.
  beam(c, "Gable base sill", point(-VALLEY_FRONT_X + .04, VALLEY_FRONT_Y - .03, FRAME_Z), point(VALLEY_FRONT_X - .04, VALLEY_FRONT_Y - .03, FRAME_Z), .15, .16, m.teak);
  // One centred vertical post from base to ridge, with squared base and head blocks.
  beam(c, "Gable centre post", point(0, VALLEY_FRONT_Y + .01, FRAME_Z), point(0, PEAK - .05, FRAME_Z), .15, .15, m.teak);
  box(c, "Gable post base block", 0, VALLEY_FRONT_Y + .10, FRAME_Z + .06, .27, .15, .13, m.teakDark);
  box(c, "Gable post head block", 0, PEAK - .17, FRAME_Z + .06, .25, .14, .13, m.teakDark);
  // Five evenly spaced horizontal ventilation louvers, stopping clear of the raking frame.
  const louvreBase = VALLEY_FRONT_Y + .5;
  const louvreTop = PEAK - .95;
  for (let i = 0; i < 5; i++) {
    const y = louvreBase + (i * (louvreTop - louvreBase)) / 4;
    const half = (PEAK - y) / SC - .26;
    if (half > .12) box(c, `Ventilated teak gable louvre ${i + 1}`, 0, y, FRAME_Z + .02, half * 2, .09, .05, m.teakHighlight);
  }
  // Subtle carved spandrels flanking the post near the peak only, one per side, mirrored.
  for (const sign of [-1, 1]) {
    const s = new THREE.Shape();
    if (sign > 0) {
      s.moveTo(0, 0);
      s.lineTo(.62, 0);
      s.quadraticCurveTo(.30, .05, .20, .17);
      s.quadraticCurveTo(.12, .31, 0, .52);
    } else {
      s.moveTo(0, 0);
      s.lineTo(0, .52);
      s.quadraticCurveTo(-.12, .31, -.20, .17);
      s.quadraticCurveTo(-.30, .05, -.62, 0);
    }
    s.closePath();
    const bracket = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: .05, bevelEnabled: false }), m.teak);
    bracket.name = `${sign < 0 ? "West" : "East"} gable carved spandrel`;
    bracket.position.set(0, PEAK - .80, FRAME_Z + .07);
    bracket.castShadow = true;
    c.add(bracket);
  }
  // --- Ridge and finial ---------------------------------------------------------------------
  const ridgeDirection = ridgeFront.clone().sub(ridgeRear).normalize();
  cap(c, "Gable ridge cap / descending to main ridge", ridgeRear.clone().addScaledVector(ridgeDirection, .13), ridgeFront.clone().addScaledVector(ridgeDirection, -.18), .12, m.roofEdge);
  beam(c, "Gable ridge timber under the clay cap", point(ridgeRear.x, ridgeRear.y - ROOF_THICKNESS - .065, ridgeRear.z), point(ridgeFront.x, ridgeFront.y - ROOF_THICKNESS - .065, ridgeFront.z), .13, .11, m.roofUnder);
  // Traditional finial: square plinth on the ridge, turned neck, cone tip.
  box(c, "Gable finial plinth", 0, PEAK + .07, FRAME_Z, .21, .14, .21, m.teakDark);
  cylinder(c, "Gable finial neck", 0, PEAK + .19, FRAME_Z, .05, .11, m.brass, 10);
  const finial = new THREE.Mesh(new THREE.ConeGeometry(.09, .27, 10), m.brass);
  finial.name = "Traditional ridge finial / 14.6m total";
  finial.position.set(0, PEAK + .37, FRAME_Z);
  finial.castShadow = true;
  c.add(finial);
}

function skirtRoofs(group: THREE.Group, m: AssetMaterials) {
  for (const sign of [-1, 1]) {
    const side = sign < 0 ? "West" : "East";
    const skirt = new THREE.Group();
    skirt.name = `${side} ground veranda skirt roof / wraps the corner: front plane + side plane meeting in a 45-degree hip`;
    group.add(skirt);

    const X = (x: number) => sign * x;
    const xIn = X(SK_INNER_X + SK_BARGE_T); // front sheet starts inside the arch-wall barge board
    const xWall = X(SK_WALL_X); // side spandrel face = hip apex
    const xEave = X(SK_EAVE_X); // side tile edge
    const zRear = SK_REAR_Z + SK_BARGE_T; // side sheet starts inside the rear barge board

    // Two planar sheets share the hip edge (xWall, SK_TOP, SK_WALL_Z) -> (xEave, SK_EAVE, SK_EAVE_Z).
    surface(skirt, `${side} skirt slope`, [
      point(xIn, SK_EAVE, SK_EAVE_Z), point(xEave, SK_EAVE, SK_EAVE_Z),
      point(xWall, SK_TOP, SK_WALL_Z), point(xIn, SK_TOP, SK_WALL_Z),
    ], m);
    surface(skirt, `${side} skirt side slope`, [
      point(xWall, SK_TOP, zRear), point(xWall, SK_TOP, SK_WALL_Z),
      point(xEave, SK_EAVE, SK_EAVE_Z), point(xEave, SK_EAVE, zRear),
    ], m);

    // Hip: a clay roll along the intersection, ending at the apex and at the eave corner.
    cap(skirt, `${side} skirt hip roll`, point(xWall, SK_TOP + .01, SK_WALL_Z), point(xEave, SK_EAVE + .01, SK_EAVE_Z), .085, m.roofEdge);

    // Upper edges: clay flashing rolls along both spandrel faces, closed at the corner by one ball.
    const rollZ = SK_WALL_Z + .025;
    const rollX = X(SK_WALL_X + .025);
    const rollY = skirtHeight(rollZ) + .01; // equals skirtSideHeight(SK_WALL_X + .025) + .01 by construction
    cap(skirt, `${side} skirt front flashing roll`, point(xIn, rollY, rollZ), point(rollX, rollY, rollZ), .07, m.roofEdge);
    cap(skirt, `${side} skirt side flashing roll`, point(rollX, rollY, zRear), point(rollX, rollY, rollZ), .07, m.roofEdge);
    ball(skirt, `${side} skirt flashing corner`, point(rollX, rollY, rollZ), .07, m.roofEdge);

    // Closed ends: a barge board on the arch-wall end and one on the rear end against the building front face.
    const frontMid = (z: number) => skirtUnder(z) + ROOF_THICKNESS / 2;
    const sideMid = (x: number) => skirtSideUnder(x) + ROOF_THICKNESS / 2;
    const bargeX = X(SK_INNER_X + SK_BARGE_T / 2);
    beam(skirt, `${side} skirt barge board arch end`, point(bargeX, frontMid(SK_WALL_Z), SK_WALL_Z), point(bargeX, frontMid(SK_EAVE_Z), SK_EAVE_Z), SK_BARGE_T, .24, m.teakDark);
    const bargeZ = SK_REAR_Z + SK_BARGE_T / 2;
    beam(skirt, `${side} skirt barge board rear end`, point(xWall, sideMid(SK_WALL_X), bargeZ), point(xEave, sideMid(SK_EAVE_X), bargeZ), .24, SK_BARGE_T, m.teakDark);

    // Eave fascia wraps the corner as a butt joint: the front board stops at the side board's inner face.
    const frontLen = SK_EAVE_X - SK_INNER_X;
    box(skirt, `${side} skirt eave fascia front`, X((SK_INNER_X + SK_EAVE_X) / 2), SK_EAVE - FASCIA_H / 2, SK_EAVE_Z + .06, frontLen, FASCIA_H, .12, m.teakDark);
    const sideLen = SK_EAVE_Z + .12 - SK_REAR_Z;
    box(skirt, `${side} skirt eave fascia side`, X(SK_EAVE_X + .06), SK_EAVE - FASCIA_H / 2, (SK_REAR_Z + SK_EAVE_Z + .12) / 2, .12, FASCIA_H, sideLen, m.teakDark);

    // Rafters. Front and side runs are seated in their bearers with tops flush to the tile underside; one hip
    // rafter carries the corner so the two planes are framed as one roof.
    const drop = .06 / Math.cos(PITCH);
    const z0 = SK_WALL_Z + .005;
    const z1 = SK_EAVE_Z - .03;
    const firstX = SK_INNER_X + SK_BARGE_T + .05;
    const lastX = SK_WALL_X - .3;
    const frontBays = Math.round((lastX - firstX) / .78);
    for (let k = 0; k <= frontBays; k++) {
      const x = X(firstX + (k * (lastX - firstX)) / frontBays);
      beam(skirt, "Exposed lean-to rafter tail", point(x, skirtUnder(z0) - drop, z0), point(x, skirtUnder(z1) - drop, z1), .1, .12, m.teakDark);
    }
    const x0 = X(SK_WALL_X + .005);
    const x1 = X(SK_EAVE_X - .03);
    const firstZ = SK_REAR_Z + SK_BARGE_T + .05;
    const lastZ = SK_WALL_Z - .3;
    const sideBays = Math.ceil((lastZ - firstZ) / .78);
    for (let k = 0; k <= sideBays; k++) {
      const z = firstZ + (k * (lastZ - firstZ)) / sideBays;
      beam(skirt, "Exposed lean-to side rafter tail", point(x0, skirtSideUnder(SK_WALL_X + .005) - drop, z), point(x1, skirtSideUnder(SK_EAVE_X - .03) - drop, z), .12, .1, m.teakDark);
    }
    const hipStart = .06;
    const hipEnd = SK_EAVE_Z - SK_WALL_Z - .05;
    const hipPoint = (d: number) => point(X(SK_WALL_X + d), skirtUnder(SK_WALL_Z + d) - drop - .02, SK_WALL_Z + d);
    beam(skirt, "Exposed lean-to hip rafter", hipPoint(-hipStart), hipPoint(hipEnd), .12, .14, m.teakDark);
  }
}

export function buildRoof(m: AssetMaterials) {
  const group = new THREE.Group();
  group.name = "Roof / Agent 07";
  group.userData = { ...roofDatums };
  // A continuous ceiling closes the habitable upper rooms; it disappears with the roof in cutaway mode.
  box(group, "First-floor closed lime ceiling below ventilated attic", 0, 8.425, -1.315, 33.66, .1, 14.03, m.plaster);
  mainRoof(group, m);
  centralGablet(group, m);
  skirtRoofs(group, m);
  return group;
}
