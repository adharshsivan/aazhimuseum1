import * as THREE from "three";
import { BP } from "./blueprint";
import { roundColumn, roundNewel, timberMats } from "./columns";
import { ENTRANCE } from "./entrance";
import { BALCONY_DOOR_LANTERN_MOUNT, placeLantern, VERANDA_LANTERN_MOUNTS } from "./lanterns";
import type { AssetMaterials } from "./materials";
import { beam, box, point } from "./primitives";

/*
 * Agent 05 / round timber posts, capitals, beams and railings.
 *
 * Vertical chain, with no gap:
 *   floor -> round base -> tapered shaft -> neck + bell capital -> round abacus -> beam underside
 *
 * Horizontal chain:
 *   post shaft -> top rail / balusters / bottom rail -> next post shaft (rails tenon 40 mm into the turning)
 *
 * The veranda wraps the corner: the front structure (spandrel, tie beam, ground bearer) has a matching
 * side structure on the end plane, so the ground skirt roof can bear on timber on both faces.
 */

const SHAFT = .26;
const SHAFT_CORNER = .28;
const SHAFT_BALCONY = .27;
const RAIL_TOP = 1.08;
const HANDRAIL_H = .08;
const HANDRAIL_W = .11;
const BOTTOMS_H = .07;
const BOTTOMS_Y = .20;
const BALUSTER_H = RAIL_TOP - HANDRAIL_H - BOTTOMS_Y - BOTTOMS_H / 2 - .02;
const RAIL_TENON = .04;

const WING_Z = 8.38;
const BALCONY_Z = 9.08;
const GROUND_BEAM_C = 3.55;
const GROUND_BEAM_H = .18;
const UPPER_BEAM_C = 9.02;
const UPPER_BEAM_H = .18;
const CENTER_BEAM_C = 9.5;
const CENTER_BEAM_H = .18;
const GROUND_BEARING = GROUND_BEAM_C - GROUND_BEAM_H / 2;
const UPPER_BEARING = UPPER_BEAM_C - UPPER_BEAM_H / 2;
const CENTER_BEARING = CENTER_BEAM_C - CENTER_BEAM_H / 2;

// The building's front wall face and the notch-free corner pier (see structure.ts).
const FRONT_WALL_FACE = BP.frontWallZ + BP.wall / 2;

// Four structural posts across the balcony colonnade, leaving an open central bay in front of the door.
const BALCONY_POSTS = [-3.45, -1.15, 1.15, 3.45];

/** Extended central balcony. Plan edges are taken from the porch entablature so they always align. */
export const BALCONY = {
  deckBottom: ENTRANCE.corniceTop, // 4.58: deck bears directly on the porch cornice
  backZ: 8.5, // butts the central upper veranda slab
  halfWidth: ENTRANCE.halfWidth, // 5.15: flush with the cornice ends
  frontZ: ENTRANCE.corniceFrontZ, // 10.68: kerb face flush with the cornice face
  kerb: .08,
  kerbTop: 4.85, // same top as the wing veranda floor edges
  deckFrontZ: ENTRANCE.corniceFrontZ - .08,
  railZ: 10.50,
  cornerX: 4.96, // right near the side edge of the deck (deck kerb inner face = 5.07)
  postX: BALCONY_POSTS,
  postZ: BALCONY_Z,
};

function post(
  group: THREE.Group,
  name: string,
  x: number,
  z: number,
  floor: number,
  bearing: number,
  m: AssetMaterials,
  opts: { diameter: number; plasterBase?: boolean },
) {
  roundColumn(group, name, x, z, floor, bearing, opts.diameter / 2, timberMats(m, opts.plasterBase ? m.trim : m.teakDark), {
    baseHeight: .18,
    capitalHeight: .3,
    baseFlare: .07,
  });
}

function rail(
  group: THREE.Group,
  name: string,
  ax: number,
  az: number,
  bx: number,
  bz: number,
  floor: number,
  startRadius: number,
  endRadius: number,
  m: AssetMaterials,
  minBalusters = 2,
) {
  const dx = bx - ax;
  const dz = bz - az;
  const length = Math.hypot(dx, dz);
  if (length < .28) return;
  const ux = dx / length;
  const uz = dz / length;
  // Rails run into the round shafts by a tenon so the joint closes at the rail corners as well.
  const x0 = ax + ux * (startRadius - RAIL_TENON);
  const z0 = az + uz * (startRadius - RAIL_TENON);
  const x1 = bx - ux * (endRadius - RAIL_TENON);
  const z1 = bz - uz * (endRadius - RAIL_TENON);
  const span = Math.hypot(x1 - x0, z1 - z0);
  if (span < .18) return;
  const mx = (x0 + x1) / 2;
  const mz = (z0 + z1) / 2;
  const alongX = Math.abs(dx) >= Math.abs(dz);
  const handY = floor + RAIL_TOP - HANDRAIL_H / 2;
  const botY = floor + BOTTOMS_Y;
  if (alongX) {
    box(group, `${name} / continuous handrail`, mx, handY, mz, span, HANDRAIL_H, HANDRAIL_W, m.teakDark);
    box(group, `${name} / lower rail`, mx, botY, mz, span, BOTTOMS_H, HANDRAIL_W - .02, m.teakDark);
  } else {
    box(group, `${name} / continuous handrail`, mx, handY, mz, HANDRAIL_W, HANDRAIL_H, span, m.teakDark);
    box(group, `${name} / lower rail`, mx, botY, mz, HANDRAIL_W - .02, BOTTOMS_H, span, m.teakDark);
  }

  const clear = span - .1;
  const count = Math.max(minBalusters, Math.round(clear / .22));
  if (count === 0) return;
  const geo = new THREE.CylinderGeometry(.036, .042, BALUSTER_H, 8);
  const instances = new THREE.InstancedMesh(geo, m.teak, count);
  instances.name = `${name} / instanced turned balusters`;
  instances.castShadow = true;
  const dummy = new THREE.Object3D();
  const balY = botY + BOTTOMS_H / 2 + BALUSTER_H / 2;
  for (let i = 0; i < count; i++) {
    const t = (i + 1) / (count + 1);
    dummy.position.set(x0 + (x1 - x0) * t, balY, z0 + (z1 - z0) * t);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    instances.setMatrixAt(i, dummy.matrix);
  }
  instances.instanceMatrix.needsUpdate = true;
  group.add(instances);
}

export interface VerandaGroups {
  group: THREE.Group;
  ground: THREE.Group;
  upper: THREE.Group;
}

export function buildVerandas(m: AssetMaterials): VerandaGroups {
  const group = new THREE.Group();
  group.name = "Verandas / Agent 05";
  const ground = new THREE.Group();
  ground.name = "Ground porch and low roof supports";
  const upper = new THREE.Group();
  upper.name = "Upper verandas and central balcony";
  group.add(ground, upper);

  box(ground, "Central ground portico deck", 0, .69, 7.1, 10.3, .12, 2.8, m.interiorFloor);

  /** Centre/width for a box spanning from the arch wall to |x| = outer on one side. */
  const run = (sign: number, outer: number) => ({ c: sign * (5.15 + outer) / 2, w: outer - 5.15 });

  for (const sign of [-1, 1]) {
    const side = sign < 0 ? "west" : "east";
    const deck = run(sign, 17.0);
    box(ground, "Ground wing veranda stone deck", deck.c, .69, 7.1, deck.w, .12, 2.8, m.stoneLight);
    box(upper, "Upper wing veranda slab", deck.c, 4.69, 7.1, deck.w, .22, 2.8, m.interiorFloor);

    // Front structure. Everything ends on the same end plane: spandrel 16.965, tie 16.99, bearers 17.0.
    const spandrel = run(sign, 16.965);
    const tie = run(sign, 16.99);
    const edge = run(sign, 17.095);
    box(upper, "Deep front veranda fascia / supporting spandrel", spandrel.c, 4.095, 8.36, spandrel.w, .97, .25, m.plaster);
    box(upper, "Front veranda supporting tie beam", tie.c, 4.49, 8.35, tie.w, .16, .32, m.trimShade);
    box(ground, "Lower porch roof bearer", deck.c, GROUND_BEAM_C, WING_Z, deck.w, GROUND_BEAM_H, .28, m.teakDark);
    box(upper, "Upper eave roof bearer", deck.c, UPPER_BEAM_C, WING_Z, deck.w, UPPER_BEAM_H, .28, m.teakDark);
    box(upper, "Upper veranda timber floor edge", edge.c, 4.77, 8.52, edge.w, .16, .15, m.teakDark);
    box(ground, "Ground veranda low stone parapet", deck.c, .80, 8.62, deck.w, .10, .12, m.trim);

    // Matching side structure on the end plane (z from the building front face to the front structure).
    const sideLen = (a: number, b: number) => ({ c: (a + b) / 2, l: b - a });
    const bearer = sideLen(FRONT_WALL_FACE, WING_Z - .14);
    const sideSpandrel = sideLen(FRONT_WALL_FACE, 8.235);
    const sideTie = sideLen(FRONT_WALL_FACE, 8.19);
    const sideEdge = sideLen(FRONT_WALL_FACE, 8.445);
    box(ground, "Lower porch side roof bearer", sign * 16.83, GROUND_BEAM_C, bearer.c, .34, GROUND_BEAM_H, bearer.l, m.teakDark);
    box(upper, "Deep side veranda spandrel", sign * 16.84, 4.095, sideSpandrel.c, .25, .97, sideSpandrel.l, m.plaster);
    box(upper, "Side veranda supporting tie beam", sign * 16.84, 4.49, sideTie.c, .30, .16, sideTie.l, m.trimShade);
    box(upper, "Upper side veranda timber floor edge", sign * 17.02, 4.77, sideEdge.c, .15, .16, sideEdge.l, m.teakDark);

    const posts = BP.wingPosts.map((v) => sign * v).sort((a, b) => a - b);
    const lastIndex = posts.length - 1;
    const cornerIndex = sign < 0 ? 0 : lastIndex;
    const radii = posts.map((_, i) => (i === cornerIndex ? SHAFT_CORNER : SHAFT) / 2);

    posts.forEach((x, i) => {
      const diameter = i === cornerIndex ? SHAFT_CORNER : SHAFT;
      post(ground, `Ground wing post ${side} ${i + 1}`, x, WING_Z, BP.floor, GROUND_BEARING, m, { diameter, plasterBase: true });
      post(upper, `Upper wing post ${side} ${i + 1}`, x, WING_Z, BP.first, UPPER_BEARING, m, { diameter });
      if (i < lastIndex) {
        rail(ground, `Ground ${side} bay ${i + 1}`, x, WING_Z, posts[i + 1], WING_Z, BP.floor, radii[i], radii[i + 1], m);
        rail(upper, `Upper ${side} bay ${i + 1}`, x, WING_Z, posts[i + 1], WING_Z, BP.first, radii[i], radii[i + 1], m);
      }
    });

    // Side return: wall newel against the building front face, rail to the corner post.
    const cornerX = posts[cornerIndex];
    const cornerRadius = radii[cornerIndex];
    const newelZ = FRONT_WALL_FACE + .06;
    roundNewel(ground, `Ground ${side} wall terminal`, cornerX, newelZ, BP.floor, RAIL_TOP, .09, m);
    roundNewel(upper, `Upper ${side} wall terminal`, cornerX, newelZ, BP.first, RAIL_TOP, .09, m);
    rail(ground, `Ground ${side} side return`, cornerX, newelZ, cornerX, WING_Z, BP.floor, .09, cornerRadius, m);
    rail(upper, `Upper ${side} side return`, cornerX, newelZ, cornerX, WING_Z, BP.first, .09, cornerRadius, m);
  }

  box(upper, "Central upper veranda slab flush with wing decks", 0, 4.69, 7.1, 10.3, .22, 2.8, m.interiorFloor);

  // Veranda walkway lanterns, one on every solid pier between the front openings, on both floors.
  // They project from the front wall face and stop well clear of the railing line (z = 8.47).
  for (const mount of VERANDA_LANTERN_MOUNTS) {
    const onUpper = mount.y > 4;
    placeLantern(onUpper ? upper : ground, m, mount.x, mount.y, mount.z, `Veranda lantern ${onUpper ? "upper" : "ground"} ${mount.x > 0 ? "east" : "west"}`);
  }
  // Single lantern centred over the balcony access door, on the entrance axis.
  placeLantern(upper, m, BALCONY_DOOR_LANTERN_MOUNT.x, BALCONY_DOOR_LANTERN_MOUNT.y, BALCONY_DOOR_LANTERN_MOUNT.z, "Balcony door lantern");

  // Central balcony, extended forward over the whole entrance porch. The deck rests on the porch
  // cornice (entrance.ts), so the porch ceiling and the balcony floor are a single construction:
  // corner columns -> architrave -> cornice -> deck -> teak floor-edge kerb -> railing.
  const B = BALCONY;
  const deckMid = (B.backZ + B.deckFrontZ) / 2;
  const deckDepth = B.deckFrontZ - B.backZ;
  const deckInner = B.halfWidth - B.kerb;
  box(upper, "Central balcony / extended over the entrance porch", 0, (B.deckBottom + BP.first) / 2, deckMid, deckInner * 2, BP.first - B.deckBottom, deckDepth, m.interiorFloor);
  // Teak floor-edge kerb, flush with the cream cornice faces below, matching the wing floor edges.
  const kerbMid = (B.deckBottom + B.kerbTop) / 2;
  const kerbH = B.kerbTop - B.deckBottom;
  box(upper, "Balcony front floor-edge kerb", 0, kerbMid, (B.deckFrontZ + B.frontZ) / 2, B.halfWidth * 2, kerbH, B.frontZ - B.deckFrontZ, m.teakDark);
  for (const sign of [-1, 1]) {
    box(upper, "Balcony side floor-edge kerb", sign * (B.halfWidth - B.kerb / 2), kerbMid, deckMid, B.kerb, kerbH, deckDepth, m.teakDark);
  }

  // Four full-height posts carry the gable's eave bearer across the colonnade.
  box(upper, "Central portico roof bearer", 0, CENTER_BEAM_C, BALCONY_Z, 7.8, CENTER_BEAM_H, .28, m.teakDark);
  BALCONY_POSTS.forEach((x, i) => {
    post(upper, `Central balcony timber post ${i + 1}`, x, BALCONY_Z, BP.first, CENTER_BEARING, m, { diameter: SHAFT_BALCONY });
    beam(upper, "Central deep eave rafter", point(x, CENTER_BEAM_C + CENTER_BEAM_H / 2 + .02, BALCONY_Z), point(x, 9.18, 9.58), .10, .12, m.teakDark);
  });

  // Railing on the front edge extends all the way to cornerX (±4.96), so the side railing sits
  // right near the deck edge with no empty space on the left and right.
  const newelR = .09;
  const frontNewelPositions = [-B.cornerX, ...BALCONY_POSTS, B.cornerX];
  frontNewelPositions.forEach((x, i) => {
    roundNewel(upper, `Balcony front newel ${i + 1}`, x, B.railZ, BP.first, RAIL_TOP, newelR, m);
    if (i < frontNewelPositions.length - 1) rail(upper, `Balcony front bay ${i + 1}`, x, B.railZ, frontNewelPositions[i + 1], B.railZ, BP.first, newelR, newelR, m);
  });
  for (const sign of [-1, 1]) {
    const x = sign * B.cornerX; // ±4.96: right near the side edge of the balcony deck
    // Side return runs along the edge back to the wing railing line, then links to the first wing post.
    roundNewel(upper, "Balcony side return newel", x, WING_Z, BP.first, RAIL_TOP, .08, m);
    rail(upper, "Balcony side return", x, B.railZ, x, WING_Z, BP.first, newelR, .08, m);
    rail(upper, "Balcony-to-wing link", x, WING_Z, sign * BP.wingPosts[0], WING_Z, BP.first, .08, SHAFT / 2, m, 1);
  }

  return { group, ground, upper };
}
