import * as THREE from "three";
import { BP } from "./blueprint";
import { STAIR, stepTop1, stepTop2 } from "./interior";
import { BEARING_WALL } from "./structure";
import type { AssetMaterials } from "./materials";
import { box } from "./primitives";

export interface FootPosition { x: number; y: number; z: number }

export interface Collider {
  name: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export interface CollisionWorld {
  group: THREE.Group;
  colliders: Collider[];
  surfaceHeight: (x: number, z: number, fromY: number) => number | null;
  tryMove: (from: FootPosition, dx: number, dz: number) => FootPosition;
  serialize: () => object;
}

export interface TourPoint {
  x: number;
  z: number;
  stop?: string;
}

// One waypoint per tread: flight 1 climbs toward -Z on the west, flight 2 returns on the east.
const stairForward: TourPoint[] = Array.from({ length: 11 }, (_, i) => ({ x: -STAIR.flightX, z: STAIR.bottomZ - (i + .5) * STAIR.tread }));
const stairReturn: TourPoint[] = Array.from({ length: 11 }, (_, i) => ({ x: STAIR.flightX, z: STAIR.landingFrontZ + (i + .5) * STAIR.tread }));

// Every turn is explicit: the guided path never shortcuts through a closed wall.
export const tourPoints: TourPoint[] = [
  { x: 0, z: 14.2, stop: "outside" },
  { x: 0, z: 13.05 },
  { x: 0, z: 12.68 },
  { x: 0, z: 12.35 },
  { x: 0, z: 12.02 },
  { x: 0, z: 11.69, stop: "steps" },
  { x: 0, z: 11.36 },
  { x: 0, z: 10.95 },
  { x: 0, z: 7.65, stop: "portico" },
  { x: 0, z: 2.65, stop: "hall" },
  { x: 0, z: 1.65 },
  { x: -8.4, z: 1.65, stop: "ground-hall-west" },
  { x: 0, z: 1.65 },
  { x: 8.4, z: 1.65, stop: "ground-hall-east" },
  { x: 0, z: 1.65 },
  { x: -.95, z: -.2, stop: "stair-start" },
  ...stairForward,
  { x: -.95, z: -4.5 },
  { x: 0, z: -4.5, stop: "stair-landing" },
  { x: .95, z: -4.5 },
  ...stairReturn,
  { x: .95, z: .3, stop: "first-floor" },
  { x: .95, z: 1.65 },
  { x: 11.05, z: 1.65 },
  { x: 11.05, z: 7.4 },
  { x: 7.25, z: 7.4, stop: "veranda" },
  { x: 0, z: 7.4 },
  { x: 0, z: 9.95, stop: "balcony" },
];

export const fullWalkthrough: TourPoint[] = [
  ...tourPoints,
  ...tourPoints.slice(0, -1).reverse().map((p) => ({ ...p, stop: p.stop === "hall" ? "return" : undefined })),
];

export function buildCollision(m: AssetMaterials): CollisionWorld {
  const group = new THREE.Group();
  group.name = "Collision / Agent 09 / separate GLB and JSON";
  group.visible = false;
  const colliders: Collider[] = [];
  let navigationMeshes = 0;

  function nav(name: string, x: number, top: number, z: number, width: number, depth: number) {
    const mesh = box(group, `NAV_${name}`, x, top - .045, z, width, .09, depth, m.collision);
    mesh.userData.walkable = true;
    navigationMeshes++;
  }

  nav("exterior approach", 0, 0, 15.0, 8, 4.2);
  nav("ground rooms and verandas", 0, BP.floor, 0, 34, 17);
  const s = BP.stairVoid;
  nav("upper floor west of stairwell", (-17 + s.minX) / 2, BP.first, 0, s.minX + 17, 17);
  nav("upper floor east of stairwell", (17 + s.maxX) / 2, BP.first, 0, 17 - s.maxX, 17);
  nav("upper floor before stairwell", 0, BP.first, (s.maxZ + 8.5) / 2, s.maxX - s.minX, 8.5 - s.maxZ);
  nav("upper floor behind stairwell", 0, BP.first, (-8.5 + s.minZ) / 2, s.maxX - s.minX, s.minZ + 8.5);
  nav("balcony extended over the entrance porch", 0, BP.first, 9.55, 10.14, 2.1);
  nav("entry podium and landing", 0, BP.floor, 9.85, 10.3, 2.7);
  for (let i = 0; i < 5; i++) nav(`exterior stair tread ${i + 1}`, 0, (i + 1) * .15, 12.85 - (i + .5) * .33, 4.24, .33);
  nav("interior stair turn landing", 0, STAIR.landingY, (STAIR.landingFrontZ + STAIR.landingRearZ) / 2, 2 * (STAIR.flightX + STAIR.width / 2), STAIR.landingFrontZ - STAIR.landingRearZ);
  for (let i = 0; i < 11; i++) {
    nav(`interior flight 1 tread ${i + 1}`, -STAIR.flightX, BP.floor + (i + 1) * STAIR.rise, STAIR.bottomZ - (i + .5) * STAIR.tread, STAIR.width, STAIR.tread);
    nav(`interior flight 2 tread ${i + 1}`, STAIR.flightX, STAIR.landingY + (i + 1) * STAIR.rise, STAIR.landingFrontZ + (i + .5) * STAIR.tread, STAIR.width, STAIR.tread);
  }

  function add(name: string, minX: number, maxX: number, minZ: number, maxZ: number, minY: number, maxY: number) {
    const c = { name, minX, maxX, minY, maxY, minZ, maxZ };
    colliders.push(c);
    box(group, `UCX_${name.replace(/\W+/g, "_")}_${colliders.length}`, (minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2, maxX - minX, maxY - minY, maxZ - minZ, m.collision);
  }

  function xWall(name: string, start: number, end: number, z: number, thickness: number, base: number, doors: { center: number; width: number }[] = []) {
    let cursor = start;
    [...doors].sort((a, b) => a.center - b.center).forEach((door) => {
      const left = door.center - door.width / 2;
      if (left - cursor > .01) add(name, cursor, left, z - thickness / 2, z + thickness / 2, base, base + 2.85);
      cursor = door.center + door.width / 2;
    });
    if (end - cursor > .01) add(name, cursor, end, z - thickness / 2, z + thickness / 2, base, base + 2.85);
  }

  function zWall(name: string, start: number, end: number, x: number, thickness: number, base: number, doors: { center: number; width: number }[] = []) {
    let cursor = start;
    [...doors].sort((a, b) => a.center - b.center).forEach((door) => {
      const left = door.center - door.width / 2;
      if (left - cursor > .01) add(name, x - thickness / 2, x + thickness / 2, cursor, left, base, base + 2.85);
      cursor = door.center + door.width / 2;
    });
    if (end - cursor > .01) add(name, x - thickness / 2, x + thickness / 2, cursor, end, base, base + 2.85);
  }

  for (const level of [BP.floor, BP.first]) {
    const upper = level === BP.first;
    const tag = upper ? "upper" : "ground";
    xWall(`${tag} west facade`, -16.66, -5.15, BP.frontWallZ, BP.wall, level, [{ center: -11.05, width: upper ? 1.35 : 1.36 }]);
    xWall(`${tag} east facade`, 5.15, 16.66, BP.frontWallZ, BP.wall, level, [{ center: 11.05, width: upper ? 1.35 : 1.36 }]);
    xWall(`${tag} central facade`, -5.15, 5.15, BP.frontWallZ, BP.wall, level, [{ center: 0, width: upper ? 1.72 : 2.35 }]);
    xWall(`${tag} rear exterior`, -16.66, 16.66, BP.rearWallZ, BP.wall, level);
    for (const sign of [-1, 1]) {
      zWall(`${tag} side exterior`, -8.16, 5.53, sign * BP.sideWallX, BP.wall, level);
      // Full solid bearing walls from edge to edge on each side, with only one doorway at Z = 1.65
      zWall(`${tag} bearing wall`, BEARING_WALL.minZ, BEARING_WALL.maxZ, sign * BEARING_WALL.x, BEARING_WALL.thickness, level, [{ center: BEARING_WALL.door.center, width: BEARING_WALL.door.width }]);
      add(`${tag} front balustrade`, sign < 0 ? -16.82 : 5.28, sign < 0 ? -5.28 : 16.82, 8.32, 8.50, level + .15, level + 1.15);
      add(`${tag} side balustrade`, sign * 16.83 - .08, sign * 16.83 + .08, 5.87, 8.4, level + .15, level + 1.15);
      add(`${tag} corner pier`, sign * 16.83 - .17, sign * 16.83 + .17, 5.53, 5.87, level, level + 2.85);
      if (upper) add("upper balcony-wing link rail", sign < 0 ? -5.4 : 4.96, sign < 0 ? -4.96 : 5.4, 8.32, 8.44, level + .15, level + 1.15);
    }
  }
  xWall("full-depth entrance arch masonry", -5.15, 5.15, 8.67, .58, BP.floor, [{ center: 0, width: 3.12 }]);
  for (const sign of [-1, 1]) {
    add("portico solid side", sign * 5 - .15, sign * 5 + .15, 5.75, 8.55, BP.floor, 4.59);
    add("exterior stair balustrade", sign * 2.03 - .09, sign * 2.03 + .09, 11.2, 12.95, 0, 1.9);
    // Free-standing corner columns are solid: the player walks between them, not through them.
    add("entrance porch column", sign * 4.7 - .3, sign * 4.7 + .3, 10.15 - .3, 10.15 + .3, BP.floor, 4.2);
  }
  // Balcony extended over the porch: four roof posts, railing on the new front edge (±4.96) and side
  // returns along x = ±4.96 right near the deck kerb. Posts stand free on the deck.
  add("balcony front guard", -5.05, 5.05, 10.41, 10.59, BP.first + .15, BP.first + 1.15);
  for (const sign of [-1, 1]) {
    add("balcony side guard", sign * 4.96 - .09, sign * 4.96 + .09, 8.3, 10.59, BP.first + .15, BP.first + 1.15);
    for (const x of [1.15, 3.45]) add("balcony roof post", sign * x - .2, sign * x + .2, 9.08 - .2, 9.08 + .2, BP.first, BP.first + 2.85);
  }
  // Stair balustrades. Thin boxes on the rail lines; raked runs are given the full height band they
  // sweep through so a player can neither step off a flight sideways nor walk under flight 1.
  const o = STAIR.outerRailX;
  const n = STAIR.innerRailX;
  const lz = STAIR.landingNewelZ;
  const topL = STAIR.landingY + 1.15;
  const topU = BP.first + 1.15;
  add("flight 1 outer balustrade", -o - .05, -o + .05, lz, STAIR.bottomNewelZ + .05, BP.floor, topL);
  add("flight 1 inner balustrade", -n - .05, -n + .05, lz, STAIR.bottomNewelZ + .05, BP.floor, topL);
  add("flight 2 outer balustrade", o - .05, o + .05, lz, STAIR.guardFrontZ + .05, STAIR.landingY, topU);
  add("flight 2 inner balustrade", n - .05, n + .05, lz, STAIR.guardFrontZ + .05, STAIR.landingY, topU);
  add("landing west rail", -o - .05, -o + .05, STAIR.landingRailRearZ - .05, lz, STAIR.landingY, topL);
  add("landing east rail", o - .05, o + .05, STAIR.landingRailRearZ - .05, lz, STAIR.landingY, topL);
  add("landing rear rail", -o - .05, o + .05, STAIR.landingRailRearZ - .05, STAIR.landingRailRearZ + .05, STAIR.landingY, topL);
  add("landing well-edge rail", -n - .05, n + .05, lz - .05, lz + .05, STAIR.landingY, topL);
  for (const sign of [-1, 1]) {
    add("landing support post", sign * STAIR.columns.x - .1, sign * STAIR.columns.x + .1, STAIR.columns.z - .1, STAIR.columns.z + .1, BP.floor, STAIR.columns.bearing);
  }
  // First-floor void guards on every exposed edge; the arrival (x 0.2..1.7 at the front) stays open.
  const g = STAIR.guardX;
  const gr = STAIR.guardRearZ;
  const gf = STAIR.guardFrontZ;
  add("upper void guard west", -g - .05, -g + .05, gr - .05, gf + .05, BP.first, topU);
  add("upper void guard east", g - .05, g + .05, gr - .05, gf + .05, BP.first, topU);
  add("upper void guard rear", -g - .05, g + .05, gr - .05, gr + .05, BP.first, topU);
  add("upper void guard front west", -g - .05, n + .05, gf - .05, gf + .05, BP.first, topU);
  add("upper void guard front east", o - .05, g + .05, gf - .05, gf + .05, BP.first, topU);

  function surfaceHeight(x: number, z: number, fromY: number): number | null {
    // The upper balcony projects directly above the ground-level portico.
    // Resolve it first so a first-floor player never snaps to the entry landing.
    if (Math.abs(x) <= 5.15 && z > 8.5 && z <= 10.68 && fromY > 2.5) return BP.first;
    if (Math.abs(x) <= 2.12 && z >= 11.2 && z <= 12.85 && fromY < 2.5) {
      const step = Math.min(4, Math.floor((12.85 - z) / .33));
      return (step + 1) * .15;
    }
    // The podium now runs the full 10.3 m width forward to the stair head, so the porch between
    // the columns and the arch wall is walkable across its whole width.
    if (Math.abs(x) <= 5.15 && z > 8.5 && z <= 11.2 && fromY < 2.5) return BP.floor;
    if (Math.abs(x) <= BP.halfWidth && z >= BP.rearZ && z <= BP.frontZ) {
      const half = STAIR.width / 2;
      const onFlight1 = x >= -STAIR.flightX - half && x <= -STAIR.flightX + half && z >= STAIR.landingFrontZ && z <= STAIR.bottomZ;
      const onFlight2 = x >= STAIR.flightX - half && x <= STAIR.flightX + half && z >= STAIR.landingFrontZ && z <= STAIR.bottomZ;
      const onLanding = Math.abs(x) <= STAIR.flightX + half && z < STAIR.landingFrontZ && z >= STAIR.landingRearZ;
      const v = BP.stairVoid;
      const inVoid = x > v.minX && x < v.maxX && z >= v.minZ && z <= v.maxZ;
      if (fromY > 2.65) {
        // Upper floor, flight 2, the landing, or stepping down off the landing onto flight 1.
        if (onFlight2) return stepTop2(z);
        if (onLanding) return STAIR.landingY;
        if (onFlight1) return stepTop1(z);
        if (inVoid) return null; // open well and the side gaps between stair and slab edge
        return BP.first;
      }
      // Ground floor. Flight 1 is solid down to the floor, so its footprint is always the tread
      // height (a big step blocks entry from the side or the back). Flight 2 and the landing are
      // raised on their soffits, so the ground under them stays walkable (1.84 m clear).
      if (onFlight1) return stepTop1(z);
      if (onFlight2) return fromY > 2.0 ? stepTop2(z) : BP.floor;
      if (onLanding) return fromY > 2.0 ? STAIR.landingY : BP.floor;
      return BP.floor;
    }
    if (fromY > 2.65 && Math.abs(x) < 18.5 && z < 10.5) return null;
    return 0;
  }

  function blocked(x: number, z: number, footY: number, radius = .22) {
    for (const c of colliders) {
      if (footY + 1.7 < c.minY + .001 || footY > c.maxY - .001) continue;
      const nx = Math.max(c.minX, Math.min(x, c.maxX));
      const nz = Math.max(c.minZ, Math.min(z, c.maxZ));
      if ((nx - x) ** 2 + (nz - z) ** 2 < radius ** 2) return true;
    }
    return false;
  }

  function tryMove(from: FootPosition, dx: number, dz: number): FootPosition {
    let result = { ...from };
    for (const [axis, amount] of [["x", dx], ["z", dz]] as const) {
      if (!amount) continue;
      const candidate = { ...result, [axis]: result[axis] + amount };
      const y = surfaceHeight(candidate.x, candidate.z, result.y);
      if (y === null || y - result.y > .22 || result.y - y > .28) continue;
      if (blocked(candidate.x, candidate.z, y)) continue;
      result = { ...candidate, y };
    }
    return result;
  }

  return {
    group,
    colliders,
    surfaceHeight,
    tryMove,
    serialize: () => ({
      name: "Malabar House / gameplay collision",
      units: "metres",
      axes: "+Y up, +Z front, central entrance X=0",
      player: { radius: .22, standingHeight: 1.7, maximumStep: .22 },
      floorDatums: { grade: 0, ground: BP.floor, first: BP.first },
      stair: { risersPerFlight: STAIR.risersPerFlight, riserHeight: STAIR.rise, tread: STAIR.tread, width: STAIR.width, flightCentresX: [-STAIR.flightX, STAIR.flightX], flightZ: [STAIR.landingFrontZ, STAIR.bottomZ], landing: { z: [STAIR.landingRearZ, STAIR.landingFrontZ], y: STAIR.landingY } },
      exteriorStair: { risers: 5, riserHeight: .15, tread: .33, bottomNosingZ: 12.85, headZ: 11.2 },
      entrancePorch: { podium: { z: [8.5, 11.2], halfWidth: 5.15 }, columnZ: 10.15, columnX: [-4.7, 4.7], archClearWidth: 3.12 },
      surfaces: [
        { name: "ground floor and verandas", x: [-17, 17], z: [-8.5, 8.5], y: .75 },
        { name: "first floor except stairwell", x: [-17, 17], z: [-8.5, 8.5], y: 4.8, exclusion: BP.stairVoid },
        { name: "central balcony extended over the entrance porch", x: [-5.15, 5.15], z: [8.5, 10.68], y: 4.8 },
      ],
      blockers: colliders,
      navigationMeshes,
      guidedRoute: fullWalkthrough,
    }),
  };
}