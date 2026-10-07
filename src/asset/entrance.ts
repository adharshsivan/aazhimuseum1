import * as THREE from "three";
import { BP } from "./blueprint";
import type { AssetMaterials } from "./materials";
import { roundColumn } from "./columns";
import { ENTRANCE_LANTERN_MOUNTS, placeLantern } from "./lanterns";
import { beam, box, cylinder, point } from "./primitives";

/*
 * Agent 03 / central entrance composition.
 *
 * Vertical order on the entrance axis. The porch ceiling and the upper balcony floor are one
 * construction: the balcony deck (verandas.ts) bears directly on the porch cornice.
 *
 *   arch opening crown 3.86  ->  archivolt crown 4.08 (continuous white voussoir ring)
 *   -> porch architrave 4.20..4.40  ->  porch cornice 4.40..4.58  ->  balcony deck 4.58..4.80
 *
 * In plan the porch is a real veranda rather than a row of pilasters stuck on the plaster:
 *
 *   arch wall face 8.96 | 0.95 m walking space | columns at 10.15 | podium edge 11.20
 *
 * Two corner columns stand free on the podium and carry the 9.4 m architrave span; the arch wall
 * carries its back edge. The centre is left fully open so the arch reads from the steps. Steps are
 * 5 x 150 mm risers on 330 mm treads.
 */

export const ENTRANCE = {
  wallBackZ: 8.38,
  wallFaceZ: 8.96,
  wallTop: 4.59,
  archSpring: 2.30,
  archRadius: 1.56,
  ringInner: 1.60,
  ringOuter: 1.78,
  bearing: 4.20,
  architraveTop: 4.40,
  corniceTop: 4.58, // = balcony deck underside; the deck sits directly on the cornice
  canopyBackZ: 8.90,
  canopyFrontZ: 10.55,
  corniceFrontZ: 10.68,
  columnZ: 10.15,
  columnRadius: .24,
  columnX: [4.70],
  halfWidth: 5.15,
  podiumBackZ: 8.5,
  podiumFrontZ: 11.20,
  stairNoseZ: 12.85,
  stairHalfWidth: 2.12,
  railX: 2.03,
  riser: .15,
  tread: .33,
};

const E = ENTRANCE;
const ARCH_CROWN = E.archSpring + E.archRadius;

function archWall(group: THREE.Group, m: AssetMaterials) {
  const spring = E.archSpring;
  const radius = E.archRadius;
  const outline = new THREE.Shape();
  outline.moveTo(-E.halfWidth, BP.floor);
  outline.lineTo(-radius, BP.floor);
  outline.lineTo(-radius, spring);
  for (let i = 0; i <= 32; i++) {
    const angle = Math.PI - i * Math.PI / 32;
    outline.lineTo(radius * Math.cos(angle), spring + radius * Math.sin(angle));
  }
  outline.lineTo(radius, BP.floor);
  outline.lineTo(E.halfWidth, BP.floor);
  outline.lineTo(E.halfWidth, E.wallTop);
  outline.lineTo(-E.halfWidth, E.wallTop);
  outline.closePath();
  const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(outline, { depth: E.wallFaceZ - E.wallBackZ, bevelEnabled: false, curveSegments: 28 }), m.plaster);
  mesh.name = "Full-depth monumental arch / real passage";
  mesh.position.z = E.wallBackZ;
  mesh.castShadow = mesh.receiveShadow = true;
  group.add(mesh);

  // Archivolt ring standing proud of the real opening. Its crown (4.08) clears the architrave
  // underside (4.20), so the arch now reads as a complete semicircle.
  const surround = new THREE.Shape();
  surround.moveTo(-E.ringOuter, spring);
  for (let i = 0; i <= 36; i++) {
    const a = Math.PI - i * Math.PI / 36;
    surround.lineTo(E.ringOuter * Math.cos(a), spring + E.ringOuter * Math.sin(a));
  }
  surround.lineTo(E.ringInner, spring);
  for (let i = 0; i <= 36; i++) {
    const a = i * Math.PI / 36;
    surround.lineTo(E.ringInner * Math.cos(a), spring + E.ringInner * Math.sin(a));
  }
  surround.closePath();
  const archTrim = new THREE.Mesh(new THREE.ExtrudeGeometry(surround, { depth: .14, bevelEnabled: false }), m.trim);
  archTrim.name = "Deep carved stone arch surround";
  archTrim.position.z = E.wallFaceZ + .005;
  archTrim.castShadow = true;
  group.add(archTrim);

  // Evenly spaced voussoirs in the same white stucco as the arch wall itself, so the ring reads as
  // one continuous moulding. The former oversized crown block is gone and its slot is a regular stone.
  const ringMid = (E.ringInner + E.ringOuter) / 2;
  for (let i = 0; i < 13; i++) {
    const a = (i + .5) / 13 * Math.PI;
    const stone = box(group, `Arch voussoir ${i + 1}`, ringMid * Math.cos(a), spring + ringMid * Math.sin(a), E.wallFaceZ + .16, .175, .22, .06, m.trim);
    stone.rotation.z = a - Math.PI / 2;
  }

  for (const sign of [-1, 1]) {
    box(group, "Thick arch jamb", sign * ringMid, (spring + BP.floor) / 2, E.wallFaceZ + .075, E.ringOuter - E.ringInner, spring - BP.floor, .15, m.trim);
    box(group, "Inner jamb shadow line", sign * (E.ringInner - .005), (spring + BP.floor) / 2, E.wallFaceZ + .025, .055, spring - BP.floor, .045, m.trimShade);
    for (const mount of ENTRANCE_LANTERN_MOUNTS.filter((l) => Math.sign(l.x) === sign)) {
      placeLantern(group, m, mount.x, mount.y, mount.z, `Entrance lantern ${sign < 0 ? "west" : "east"}`);
    }
  }
}

function porchCanopy(group: THREE.Group, m: AssetMaterials) {
  const width = E.halfWidth * 2;
  const slabZ0 = E.canopyBackZ;
  // Architrave: back edge buried in the arch wall, front edge carried by the two corner columns.
  box(group, "Porch architrave spanning between the corner columns", 0, (E.bearing + E.architraveTop) / 2, (slabZ0 + E.canopyFrontZ) / 2, width, E.architraveTop - E.bearing, E.canopyFrontZ - slabZ0, m.trim);
  // Cornice top = balcony deck underside, so the balcony floor rests on it with no gap and no ledge.
  box(group, "Porch cornice carrying the balcony deck", 0, (E.architraveTop + E.corniceTop) / 2, (slabZ0 + E.corniceFrontZ) / 2, width, E.corniceTop - E.architraveTop, E.corniceFrontZ - slabZ0, m.trimShade);
  // Bed moulding tucked under the cornice projection, set 40 mm back from the cornice face.
  const bedFront = E.corniceFrontZ - .04;
  box(group, "Cornice bed moulding", 0, E.architraveTop - .035, (E.canopyFrontZ + bedFront) / 2, width, .07, bedFront - E.canopyFrontZ, m.trim);
  // Sunk panel in the soffit, kept clear of the column abacus plates.
  const abacusRadius = E.columnRadius * .9 * 1.75;
  const panelHalf = E.columnX[E.columnX.length - 1] - abacusRadius - .25;
  box(group, "Porch soffit sunk panel", 0, E.bearing + .012, (E.wallFaceZ + E.columnZ) / 2, panelHalf * 2, .03, E.columnZ - E.wallFaceZ - .5, m.trimShade);
}

function mainDoor(group: THREE.Group, m: AssetMaterials) {
  const frame = new THREE.Group();
  frame.name = "Main timber double door / held open for traversal";
  frame.position.set(0, BP.floor, 5.91);
  group.add(frame);
  box(frame, "Door left jamb", -1.14, 1.5, 0, .18, 3.05, .21, m.teakDark);
  box(frame, "Door right jamb", 1.14, 1.5, 0, .18, 3.05, .21, m.teakDark);
  box(frame, "Timber door head", 0, 2.96, 0, 2.45, .15, .24, m.teakDark);
  box(frame, "Carved transom frame", 0, 2.67, -.06, 2.13, .09, .12, m.teakHighlight);
  box(frame, "Dark carved transom", 0, 2.82, -.09, 2.08, .25, .05, m.teakDark);
  for (const sign of [-1, 1]) {
    const leaf = new THREE.Group();
    leaf.name = `${sign < 0 ? "Left" : "Right"} open main door leaf`;
    leaf.position.x = sign * 1.085;
    leaf.rotation.y = sign < 0 ? -1.16 : 1.16;
    frame.add(leaf);
    const inward = sign < 0 ? .52 : -.52;
    box(leaf, "Teak door panel", inward, 1.26, .01, 1.04, 2.48, .105, m.teakDark);
    for (const y of [.48, 1.11, 1.9]) {
      box(leaf, "Raised carved panel", inward, y, .075, .84, .44, .035, m.teak);
      box(leaf, "Inset panel shadow", inward, y, .099, .66, .29, .012, m.teakDark);
    }
    cylinder(leaf, "Brass door pull", sign < 0 ? .79 : -.79, 1.27, .125, .038, .22, m.brass, 8).rotation.x = Math.PI / 2;
  }
  box(group, "Worn stone threshold", 0, BP.floor + .025, 5.66, 2.33, .05, .64, m.stoneLight);
}

/*
 * Balustrade. One slim handrail whose slope is exactly the stair pitch (150/330), a turned newel at
 * each end sitting on real ground, and one baluster centred on every tread. Because the rail slope
 * matches the steps, every baluster is the same length and the rhythm stays even.
 */
function stairBalustrade(group: THREE.Group, sign: number, m: AssetMaterials) {
  const x = sign * E.railX;
  const slope = E.riser / E.tread;
  const bottomZ = E.stairNoseZ + .05;
  const topZ = E.stairNoseZ - 4 * E.tread - .19;
  const railBottomY = 1.02;
  const railTopY = railBottomY + (bottomZ - topZ) * slope;
  const railHalf = .0425;

  beam(group, "Sloped timber handrail", point(x, railBottomY, bottomZ), point(x, railTopY, topZ), .09, .085, m.teakDark);

  const newel = (z: number, standsOn: number, railY: number, label: string) => {
    const top = railY + railHalf + .075;
    cylinder(group, `Stair newel post / ${label}`, x, (standsOn + top) / 2, z, .085, top - standsOn, m.teakDark, 16);
    cylinder(group, `Stair newel cap / ${label}`, x, top + .022, z, .105, .045, m.teakHighlight, 16);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(.05, 10, 8), m.teakHighlight);
    ball.name = `Stair newel finial / ${label}`;
    ball.position.set(x, top + .088, z);
    ball.castShadow = true;
    group.add(ball);
  };
  newel(bottomZ, 0, railBottomY, "foot of flight");
  newel(topZ, BP.floor, railTopY, "head of flight");

  for (let i = 0; i < 4; i++) {
    const treadZ = E.stairNoseZ - (i + .5) * E.tread;
    const treadY = E.riser * (i + 1);
    const railY = railBottomY + (bottomZ - treadZ) * slope;
    const height = railY - railHalf - treadY;
    cylinder(group, "Turned stair baluster", x, treadY + height / 2, treadZ, .032, height, m.teak, 12);
  }
}

function frontSteps(group: THREE.Group, m: AssetMaterials) {
  const depth = E.podiumFrontZ - E.podiumBackZ;
  const centre = (E.podiumBackZ + E.podiumFrontZ) / 2;
  box(group, "Entry podium / Main stair landing continuous with plinth", 0, .315, centre, E.halfWidth * 2, .63, depth, m.laterite);
  box(group, "Stone entry podium cap", 0, .69, centre, E.halfWidth * 2 - .02, .12, depth, m.stone);
  for (let i = 0; i < 5; i++) {
    const height = E.riser * (i + 1);
    const z = E.stairNoseZ - (i + .5) * E.tread;
    box(group, `Exterior step ${i + 1} / solid riser`, 0, height / 2, z, E.stairHalfWidth * 2, height, E.tread, m.stone);
    box(group, `Exterior step ${i + 1} / worn nosing`, 0, height + .013, z + E.tread / 2 - .03, E.stairHalfWidth * 2 + .02, .026, .052, m.stoneLight);
  }
  for (const sign of [-1, 1]) stairBalustrade(group, sign, m);
}

export function buildEntrance(m: AssetMaterials) {
  const group = new THREE.Group();
  group.name = "Entrance / Agent 03";
  archWall(group, m);
  frontSteps(group, m);
  for (const sign of [-1, 1]) {
    box(group, "Portico side wall", sign * 5.0, 2.67, 7.08, .3, 3.84, 2.65, m.plaster);
    for (const x of E.columnX) {
      // Free-standing corner column on the podium: nothing touches the arch wall behind it, and the
      // architrave end sits directly over it.
      roundColumn(group, `Monumental cream column ${sign < 0 ? "west" : "east"} ${x}`, sign * x, E.columnZ, BP.floor, E.bearing, E.columnRadius,
        { base: m.trimShade, shaft: m.trim, capital: m.trim, abacus: m.trimShade },
        { baseHeight: .34, capitalHeight: .34, baseFlare: .14 });
    }
  }
  porchCanopy(group, m);
  mainDoor(group, m);
  group.userData = { ...ENTRANCE, archCrown: ARCH_CROWN, archClearWidth: E.archRadius * 2 };
  return group;
}
