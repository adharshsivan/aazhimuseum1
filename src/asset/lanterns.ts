import * as THREE from "three";
import { BP, groundWingOpenings, upperWingOpenings } from "./blueprint";
import type { AssetMaterials } from "./materials";
import { beam, box, cylinder, point } from "./primitives";

/*
 * Agent 03/05/08 / heritage wall lanterns.
 *
 * One lantern is built once in local space and cloned to every mount, so all of them are identical
 * and share geometry. Local axes: wall face at z = 0, bracket arm axis at y = 0, lantern projects
 * along +z. Every part starts exactly where the previous one ends, so nothing floats:
 *
 *   wall plate (z 0..0.03) -> brass rosette + collar -> arm (z 0.09..0.36) -> base pan sits ON the
 *   arm top -> corner posts -> glass panes -> cap ring -> pyramidal cap -> stem -> finial ball
 *
 * A diagonal brace ties the arm back to the plate, and a joint collar covers the arm/pan meeting.
 */

const ARM_START = .09;
const ARM_TIP = .36;
const ARM_R = .022;
const PAN_H = .05;
const POST_H = .26;
const HALF = .105;

// Cumulative heights, each measured from the arm axis. No gaps anywhere in the stack.
const ARM_TOP = ARM_R;
const PAN_BOT = ARM_TOP;
const PAN_TOP = PAN_BOT + PAN_H;
const POST_BOT = PAN_TOP;
const POST_TOP = POST_BOT + POST_H;
const RING_BOT = POST_TOP - .011;
const RING_TOP = RING_BOT + .022;
const CAP_BOT = RING_TOP;
const CAP_TOP = CAP_BOT + .12;
const STEM_BOT = CAP_TOP - .02;
const STEM_TOP = STEM_BOT + .05;

/** Wall-facing plate silhouette, centred on the arm axis. */
function backplateShape() {
  const s = new THREE.Shape();
  s.moveTo(0, -.33);
  s.quadraticCurveTo(.17, -.22, .16, -.03);
  s.quadraticCurveTo(.155, .13, .08, .21);
  s.quadraticCurveTo(.045, .25, .05, .31);
  s.lineTo(-.05, .31);
  s.quadraticCurveTo(-.045, .25, -.08, .21);
  s.quadraticCurveTo(-.155, .13, -.16, -.03);
  s.quadraticCurveTo(-.17, -.22, 0, -.33);
  s.closePath();
  return s;
}

/** Centres of the solid masonry piers between openings on a wall run, widest first. */
function solidPierCentres(start: number, end: number, openings: { center: number; width: number }[]) {
  const sorted = [...openings].sort((a, b) => a.center - b.center);
  const centres: number[] = [];
  let cursor = start;
  for (const o of sorted) {
    const left = o.center - o.width / 2;
    if (left - cursor > 1.15) centres.push((cursor + left) / 2);
    cursor = Math.max(cursor, o.center + o.width / 2);
  }
  if (end - cursor > 1.15) centres.push((cursor + end) / 2);
  return centres;
}

export interface LanternMount {
  x: number;
  y: number;
  z: number;
}

export function lanternTemplate(m: AssetMaterials): THREE.Group {
  const g = new THREE.Group();
  g.name = "Heritage wall lantern";

  const plate = new THREE.Mesh(new THREE.ExtrudeGeometry(backplateShape(), { depth: .03, bevelEnabled: false }), m.lampIron);
  plate.name = "Lantern backplate";
  plate.castShadow = plate.receiveShadow = true;
  g.add(plate);

  const rosette = cylinder(g, "Lantern mounting rosette", 0, 0, .035, .085, .025, m.brass, 16);
  rosette.rotation.x = Math.PI / 2;
  const collar = cylinder(g, "Lantern arm collar", 0, 0, .04, .036, .12, m.brass, 12);
  collar.rotation.x = Math.PI / 2;

  // Bracket arm, from inside the collar out to the lantern centre line.
  const arm = cylinder(g, "Lantern bracket arm", 0, 0, (ARM_START + ARM_TIP) / 2, ARM_R, ARM_TIP - ARM_START, m.lampIron, 10);
  arm.rotation.x = Math.PI / 2;
  // Diagonal brace: lands on the plate, finishes under the arm tip.
  beam(g, "Lantern bracket brace", point(0, -.11, .035), point(0, -.008, ARM_TIP - .035), .026, .026, m.lampIron);
  // Joint collar covers the arm/pan meeting so the connection reads as made.
  const joint = cylinder(g, "Lantern base joint collar", 0, 0, ARM_TIP - .02, .042, .03, m.brass, 12);
  joint.rotation.x = Math.PI / 2;

  // Base pan sits directly on the arm top; the wider drip lip sheds water clear of the glass.
  cylinder(g, "Lantern base pan", 0, (PAN_BOT + PAN_TOP) / 2, ARM_TIP, .148, PAN_H, m.lampIron, 4).rotation.y = Math.PI / 4;
  cylinder(g, "Lantern base drip lip", 0, PAN_BOT + .01, ARM_TIP, .172, .02, m.brass, 4).rotation.y = Math.PI / 4;

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      box(g, "Lantern corner post", sx * HALF, (POST_BOT + POST_TOP) / 2, ARM_TIP + sz * HALF, .019, POST_H, .019, m.lampIron);
    }
    box(g, "Lantern glass pane", sx * HALF, (POST_BOT + POST_TOP) / 2, ARM_TIP, .012, POST_H - .02, HALF * 2 - .019, m.lampGlass);
    box(g, "Lantern glass pane", 0, (POST_BOT + POST_TOP) / 2, ARM_TIP + sx * HALF, HALF * 2 - .019, POST_H - .02, .012, m.lampGlass);
  }
  cylinder(g, "Lantern oil reservoir", 0, POST_BOT + .05, ARM_TIP, .048, .07, m.brass, 10);
  cylinder(g, "Lantern flame", 0, POST_BOT + .145, ARM_TIP, .026, .11, m.lampGlass, 8);

  cylinder(g, "Lantern cap ring", 0, (RING_BOT + RING_TOP) / 2, ARM_TIP, .148, RING_TOP - RING_BOT, m.lampIron, 4).rotation.y = Math.PI / 4;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(.15, .12, 4), m.lampIron);
  cap.name = "Lantern cap";
  cap.position.set(0, (CAP_BOT + CAP_TOP) / 2, ARM_TIP);
  cap.rotation.y = Math.PI / 4;
  cap.castShadow = true;
  g.add(cap);
  cylinder(g, "Lantern finial stem", 0, (STEM_BOT + STEM_TOP) / 2, ARM_TIP, .011, STEM_TOP - STEM_BOT, m.brass, 8);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(.026, 10, 8), m.brass);
  ball.name = "Lantern finial ball";
  ball.position.set(0, STEM_TOP, ARM_TIP);
  ball.castShadow = true;
  g.add(ball);
  return g;
}

export function placeLantern(parent: THREE.Group, m: AssetMaterials, x: number, y: number, z: number, name: string) {
  const lantern = lanternTemplate(m);
  lantern.name = name;
  lantern.position.set(x, y, z);
  parent.add(lantern);
  return lantern;
}

const WALL_FACE = BP.frontWallZ + BP.wall / 2; // front face of the front room wall
const WALL_END = 16.66;

// Two flanking the entrance arch, on the arch wall front face (ENTRANCE.wallFaceZ = 8.96).
export const ENTRANCE_LANTERN_MOUNTS: LanternMount[] = [-1, 1].map((sign) => ({
  x: sign * 2.95,
  y: 3.5,
  z: 8.96,
}));

// Veranda walkway lanterns, mounted on the solid piers between the front openings on both floors.
const GROUND_PIERS = solidPierCentres(BP.wingInnerX, WALL_END, groundWingOpenings.filter((o) => o.center > 0));
const UPPER_PIERS = solidPierCentres(BP.wingInnerX, WALL_END, upperWingOpenings.filter((o) => o.center > 0));

export const VERANDA_LANTERN_MOUNTS: LanternMount[] = [
  ...GROUND_PIERS.flatMap((x) => [-1, 1].map((sign) => ({ x: sign * x, y: 2.45, z: WALL_FACE }))),
  ...UPPER_PIERS.flatMap((x) => [-1, 1].map((sign) => ({ x: sign * x, y: 6.5, z: WALL_FACE }))),
];

// One lantern centred over the first-floor balcony door. The door head is at 7.50 and its cream head
// moulding tops out at 7.72; this arm axis puts the backplate foot at 7.87, so it clears the moulding
// by 0.15 m and sits on the solid lintel wall (7.50..8.40) continuing into the attic wall above.
export const BALCONY_DOOR_LANTERN_MOUNT: LanternMount = { x: 0, y: 8.2, z: WALL_FACE };

export const ALL_LANTERN_MOUNTS: LanternMount[] = [
  ...ENTRANCE_LANTERN_MOUNTS,
  ...VERANDA_LANTERN_MOUNTS,
  BALCONY_DOOR_LANTERN_MOUNT,
];

/** Where each lantern actually glows: mid-body, at the arm tip. */
export function lanternFlamePosition(mount: LanternMount) {
  return { x: mount.x, y: mount.y + POST_BOT + .15, z: mount.z + ARM_TIP };
}

export const LANTERN_DATUMS = {
  armLength: ARM_TIP,
  armAxisHeightAboveFloor: { ground: 2.45, upper: 6.5 },
  totalHeightAboveArmAxis: STEM_TOP + .026,
  wallFaceFront: WALL_FACE,
  pierCentres: { ground: GROUND_PIERS, upper: UPPER_PIERS },
  balconyDoor: BALCONY_DOOR_LANTERN_MOUNT,
  mounts: ALL_LANTERN_MOUNTS.length,
};
