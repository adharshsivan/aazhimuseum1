import * as THREE from "three";
import { BP } from "./blueprint";
import { addHallChandeliers } from "./chandeliers";
import { roundColumn, roundNewel, timberMats } from "./columns";
import type { AssetMaterials } from "./materials";
import { beam, box, point } from "./primitives";

/*
 * Agent 06 / interior: the central switchback staircase and four hall chandeliers.
 *
 * The stair remains between the two halls on each floor. It is a two-flight dog-leg with a
 * 0.4 m open well between the flights and a full-width rear landing.
 *
 *   24 risers x 168.75 mm = 4.05 m (floor 0.75 -> first floor 4.80), 11 treads x 300 mm per flight
 *   flight 1 climbs toward -Z on the west (x -1.7..-0.2), flight 2 returns toward +Z on the east
 *   landing 3.4 x 1.55 m at 2.775, carried on two round timber posts and a bearer
 *   plaster soffits under both flights and the landing, no solid masses
 *
 * Balustrades are one continuous slim timber system: a handrail 0.97 m above the nosing line on
 * the flights and 0.998 m above the floor on level runs. Those two heights are chosen so that at
 * every newel (set 50 mm back from a step edge) the raked rail and the level rail arrive at exactly
 * the same height. Balusters stand on the tread or floor directly under the rail at 150 mm centres.
 */

const RISE = (BP.first - BP.floor) / 24;
const TREAD = .3;

export const STAIR = {
  risersPerFlight: 12,
  rise: RISE,
  tread: TREAD,
  width: 1.5,
  flightX: .95, // flight centre lines; flights span |x| = 0.2..1.7
  bottomZ: -.45, // first riser of flight 1 and the arrival riser of flight 2
  landingFrontZ: -.45 - 11 * TREAD, // -3.75
  landingRearZ: -5.3,
  landingY: BP.floor + 12 * RISE, // 2.775
  slab: .184, // vertical thickness of the flight soffits and the landing
  railRaked: .97,
  railLevel: .97 + (.05 / TREAD) * RISE, // 0.998: meets the raked rail at newels 50 mm behind an edge
  inset: .05,
  outerRailX: 1.65,
  innerRailX: .25,
  bottomNewelZ: -.35,
  landingNewelZ: -.45 - 11 * TREAD - .05, // -3.80
  landingRailRearZ: -5.25,
  guardX: BP.stairVoid.maxX - .05, // 2.05
  guardRearZ: BP.stairVoid.minZ + .05, // -5.25
  guardFrontZ: BP.stairVoid.maxZ + .05, // -0.40
  newelRadius: .055,
  midPostRadius: .045,
  columns: { x: 1.45, z: -5.05, radius: .1, bearing: 2.44 },
};

const S = STAIR;

/** Line through the tread nosings of flight 1 (climbing toward -Z). */
export const nosingLine1 = (z: number) => BP.floor + RISE + ((S.bottomZ - z) / TREAD) * RISE;
/** Line through the tread nosings of flight 2 (climbing toward +Z). */
export const nosingLine2 = (z: number) => S.landingY + RISE + ((z - S.landingFrontZ) / TREAD) * RISE;

/** Walking surface on flight 1 at plan position z (floor in front of it, landing behind it). */
export function stepTop1(z: number) {
  if (z > S.bottomZ) return BP.floor;
  if (z < S.landingFrontZ) return S.landingY;
  const i = Math.min(10, Math.floor((S.bottomZ - z) / TREAD));
  return BP.floor + (i + 1) * RISE;
}

/** Walking surface on flight 2 at plan position z (landing before it, first floor beyond it). */
export function stepTop2(z: number) {
  if (z < S.landingFrontZ) return S.landingY;
  if (z > S.bottomZ) return BP.first;
  const j = Math.min(10, Math.floor((z - S.landingFrontZ) / TREAD));
  return S.landingY + (j + 1) * RISE;
}

/** Inclined slab in the Y-Z plane with vertical ends, extruded across X. */
function slopedSlab(group: THREE.Group, name: string, zA: number, yA: number, zB: number, yB: number, thickness: number, xMin: number, xMax: number, material: THREE.Material) {
  const shape = new THREE.Shape();
  shape.moveTo(zA, yA);
  shape.lineTo(zB, yB);
  shape.lineTo(zB, yB - thickness);
  shape.lineTo(zA, yA - thickness);
  shape.closePath();
  const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: xMax - xMin, bevelEnabled: false }), material);
  mesh.name = name;
  mesh.rotation.y = -Math.PI / 2; // local x -> world z, extrusion -> world -x
  mesh.position.x = xMax;
  mesh.castShadow = mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

/** Handrail from newel centre a to newel centre b, with balusters standing on baseAt(x, z). */
function railRun(group: THREE.Group, name: string, a: THREE.Vector3, b: THREE.Vector3, baseAt: (x: number, z: number) => number, m: AssetMaterials) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  const run = Math.hypot(dx, dz);
  const alongX = Math.abs(dx) >= Math.abs(dz);
  beam(group, `${name} / handrail`, a, b, alongX ? .065 : .08, alongX ? .08 : .065, m.teakDark);
  const count = Math.max(1, Math.round(run / .15));
  if (count < 2) return;
  const geometry = new THREE.CylinderGeometry(.017, .021, 1, 8).translate(0, .5, 0);
  const balusters = new THREE.InstancedMesh(geometry, m.teak, count - 1);
  balusters.name = `${name} / balusters`;
  balusters.castShadow = true;
  const dummy = new THREE.Object3D();
  for (let k = 1; k < count; k++) {
    const t = k / count;
    const x = a.x + dx * t;
    const z = a.z + dz * t;
    const railY = a.y + dy * t;
    const base = baseAt(x, z);
    dummy.position.set(x, base, z);
    dummy.scale.set(1, railY - .0325 - base, 1);
    dummy.updateMatrix();
    balusters.setMatrixAt(k - 1, dummy.matrix);
  }
  balusters.instanceMatrix.needsUpdate = true;
  group.add(balusters);
}

function newel(group: THREE.Group, name: string, x: number, z: number, standsOn: number, railY: number, m: AssetMaterials, radius = S.newelRadius) {
  roundNewel(group, name, x, z, standsOn, railY + .09 - standsOn, radius, m);
}

function flights(group: THREE.Group, m: AssetMaterials) {
  const half = S.width / 2;
  for (let i = 0; i < 11; i++) {
    // Flight 1: riser i face at z0, tread i behind it (toward -Z).
    const z0 = S.bottomZ - i * TREAD;
    box(group, `Flight 1 tread ${i + 1}`, -S.flightX, BP.floor + (i + .5) * RISE, z0 - TREAD / 2, S.width, RISE, TREAD, m.stone);
    box(group, `Flight 1 nosing ${i + 1}`, -S.flightX, BP.floor + (i + 1) * RISE + .008, z0 - .0225, S.width, .016, .045, m.stoneLight);
    // Flight 2: riser j face at z1, tread j beyond it (toward +Z).
    const z1 = S.landingFrontZ + i * TREAD;
    box(group, `Flight 2 tread ${i + 1}`, S.flightX, S.landingY + (i + .5) * RISE, z1 + TREAD / 2, S.width, RISE, TREAD, m.stone);
    box(group, `Flight 2 nosing ${i + 1}`, S.flightX, S.landingY + (i + 1) * RISE + .008, z1 + .0225, S.width, .016, .045, m.stoneLight);
  }
  // Plaster soffits follow the line through the riser feet, so every tread sits on them with no gap.
  slopedSlab(group, "Flight 1 plaster soffit", S.bottomZ, BP.floor, S.landingFrontZ, S.landingY, S.slab, -S.flightX - half, -S.flightX + half, m.plaster);
  slopedSlab(group, "Flight 2 plaster soffit", S.landingFrontZ, S.landingY, S.bottomZ, S.landingY + 11 * RISE, S.slab, S.flightX - half, S.flightX + half, m.plaster);

  // Landing: stone top on a plaster soffit, bearing on a timber bearer and two round posts.
  const landingW = 2 * (S.flightX + half);
  const landingD = S.landingFrontZ - S.landingRearZ;
  const landingMidZ = (S.landingFrontZ + S.landingRearZ) / 2;
  const soffitBottom = S.landingY - S.slab;
  box(group, "Turn landing / stone deck", 0, (soffitBottom + .03 + S.landingY) / 2, landingMidZ, landingW, S.landingY - soffitBottom - .03, landingD, m.stone);
  box(group, "Turn landing / plaster soffit", 0, soffitBottom + .015, landingMidZ, landingW, .03, landingD, m.plaster);
  box(group, "Landing timber bearer", 0, (S.columns.bearing + soffitBottom) / 2, S.columns.z, landingW, soffitBottom - S.columns.bearing, .24, m.teakDark);
  for (const sign of [-1, 1]) {
    roundColumn(group, `Landing support post ${sign < 0 ? "west" : "east"}`, sign * S.columns.x, S.columns.z, BP.floor, S.columns.bearing, S.columns.radius, timberMats(m), { baseHeight: .16, capitalHeight: .26, baseFlare: .06 });
  }
}

function balustrades(stairs: THREE.Group, upper: THREE.Group, m: AssetMaterials) {
  const L = S.landingY + S.railLevel; // level rail centre on the landing
  const U = BP.first + S.railLevel; // level rail centre on the first floor
  const raked1 = (z: number) => nosingLine1(z) + S.railRaked;
  const raked2 = (z: number) => nosingLine2(z) + S.railRaked;
  const onLanding = () => S.landingY;
  const onFloor = () => BP.first;

  // Flight 1 (west): outer and inner raked rails, bottom newels on the floor, top newels on the landing.
  for (const x of [-S.outerRailX, -S.innerRailX]) {
    const side = x < -1 ? "outer" : "inner";
    const a = point(x, raked1(S.bottomNewelZ), S.bottomNewelZ);
    const b = point(x, raked1(S.landingNewelZ), S.landingNewelZ);
    newel(stairs, `Flight 1 ${side} bottom newel`, x, S.bottomNewelZ, BP.floor, a.y, m);
    railRun(stairs, `Flight 1 ${side} balustrade`, a, b, (_x, z) => stepTop1(z), m);
    newel(stairs, `Flight 1 ${side} landing newel`, x, S.landingNewelZ, S.landingY, b.y, m);
  }
  // Flight 2 (east): raked rails from the landing newels up to the arrival newels on the first floor.
  for (const x of [S.outerRailX, S.innerRailX]) {
    const side = x > 1 ? "outer" : "inner";
    const a = point(x, raked2(S.landingNewelZ), S.landingNewelZ);
    const b = point(x, raked2(S.guardFrontZ), S.guardFrontZ);
    newel(stairs, `Flight 2 ${side} landing newel`, x, S.landingNewelZ, S.landingY, a.y, m);
    railRun(stairs, `Flight 2 ${side} balustrade`, a, b, (_x, z) => stepTop2(z), m);
    newel(stairs, `Flight 2 ${side} arrival newel`, x, S.guardFrontZ, BP.first, b.y, m);
  }
  // Landing: level rails around the three exposed edges, plus the short rail across the open well.
  const rearZ = S.landingRailRearZ;
  for (const sign of [-1, 1]) {
    const x = sign * S.outerRailX;
    railRun(stairs, `Landing ${sign < 0 ? "west" : "east"} rail`, point(x, L, S.landingNewelZ), point(x, L, rearZ), onLanding, m);
    newel(stairs, `Landing ${sign < 0 ? "west" : "east"} rear corner newel`, x, rearZ, S.landingY, L, m);
  }
  railRun(stairs, "Landing rear rail west half", point(-S.outerRailX, L, rearZ), point(0, L, rearZ), onLanding, m);
  railRun(stairs, "Landing rear rail east half", point(0, L, rearZ), point(S.outerRailX, L, rearZ), onLanding, m);
  newel(stairs, "Landing rear mid post", 0, rearZ, S.landingY, L, m, S.midPostRadius);
  railRun(stairs, "Landing well-edge rail", point(-S.innerRailX, L, S.landingNewelZ), point(S.innerRailX, L, S.landingNewelZ), onLanding, m);

  // First floor: guard rails on every exposed edge of the rectangular void. The front edge is open
  // only where flight 2 arrives (x 0.2..1.7); the two short front runs end on the arrival newels.
  const gX = S.guardX;
  const gRear = S.guardRearZ;
  const gFront = S.guardFrontZ;
  const midZ = (gRear + gFront) / 2;
  for (const sign of [-1, 1]) {
    const x = sign * gX;
    const side = sign < 0 ? "west" : "east";
    newel(upper, `Upper void ${side} front corner newel`, x, gFront, BP.first, U, m);
    newel(upper, `Upper void ${side} rear corner newel`, x, gRear, BP.first, U, m);
    newel(upper, `Upper void ${side} mid post`, x, midZ, BP.first, U, m, S.midPostRadius);
    railRun(upper, `Upper void guard ${side} front half`, point(x, U, gFront), point(x, U, midZ), onFloor, m);
    railRun(upper, `Upper void guard ${side} rear half`, point(x, U, midZ), point(x, U, gRear), onFloor, m);
  }
  newel(upper, "Upper void rear mid post", 0, gRear, BP.first, U, m, S.midPostRadius);
  railRun(upper, "Upper void guard rear west half", point(-gX, U, gRear), point(0, U, gRear), onFloor, m);
  railRun(upper, "Upper void guard rear east half", point(0, U, gRear), point(gX, U, gRear), onFloor, m);
  railRun(upper, "Upper void guard front west", point(-gX, U, gFront), point(S.innerRailX, U, gFront), onFloor, m);
  railRun(upper, "Upper void guard front east", point(S.outerRailX, U, gFront), point(gX, U, gFront), onFloor, m);

  // Slab edge finish: a teak nosing band around the void, stopped at the arrival where a stone
  // nosing lip matches the treads instead.
  const v = BP.stairVoid;
  const bandY = BP.first - .13;
  const bandH = .28;
  box(upper, "Void edge band west", v.minX - .02, bandY, (v.minZ + v.maxZ) / 2, .04, bandH, v.maxZ - v.minZ + .08, m.teakDark);
  box(upper, "Void edge band east", v.maxX + .02, bandY, (v.minZ + v.maxZ) / 2, .04, bandH, v.maxZ - v.minZ + .08, m.teakDark);
  box(upper, "Void edge band rear", 0, bandY, v.minZ - .02, v.maxX - v.minX, bandH, .04, m.teakDark);
  const arrivalMin = S.flightX - S.width / 2;
  const arrivalMax = S.flightX + S.width / 2;
  box(upper, "Void edge band front west", (v.minX + arrivalMin) / 2, bandY, v.maxZ - .02, arrivalMin - v.minX, bandH, .04, m.teakDark);
  box(upper, "Void edge band front east", (arrivalMax + v.maxX) / 2, bandY, v.maxZ - .02, v.maxX - arrivalMax, bandH, .04, m.teakDark);
  box(upper, "Arrival stone nosing", S.flightX, BP.first + .008, v.maxZ + .0225, S.width, .016, .045, m.stoneLight);
}

export interface InteriorGroups {
  group: THREE.Group;
  ground: THREE.Group;
  upper: THREE.Group;
  stairs: THREE.Group;
  chandeliers: THREE.Group[];
}

export function buildInterior(m: AssetMaterials): InteriorGroups {
  const group = new THREE.Group();
  group.name = "Interior / Agent 06";
  const ground = new THREE.Group();
  ground.name = "Ground floor / west and east hall chandeliers";
  const upper = new THREE.Group();
  upper.name = "First floor / hall chandeliers and stair void guards";
  const stairs = new THREE.Group();
  stairs.name = "24-riser switchback stair / open well, plaster soffits, timber balustrade";
  group.add(ground, upper, stairs);
  flights(stairs, m);
  balustrades(stairs, upper, m);
  const chandeliers = addHallChandeliers(ground, upper, m);
  return { group, ground, upper, stairs, chandeliers };
}
