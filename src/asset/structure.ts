import * as THREE from "three";
import { BP, centerGroundDoor, centerUpperDoor, groundRearOpenings, groundSideOpenings, groundWingOpenings, upperRearOpenings, upperSideOpenings, upperWingOpenings, type WallOpening } from "./blueprint";
import type { AssetMaterials } from "./materials";
import { box, wallX, wallZ } from "./primitives";
import { ROOF_THICKNESS, roofSurfaceHeight } from "./roof";

export interface StructuralGroups {
  foundation: THREE.Group;
  ground: THREE.Group;
  first: THREE.Group;
}

/*
 * Full bearing walls on the two structural lines (|X| = 4.89). They run continuously from edge
 * to edge (Z = -8.15 to Z = 5.53) on both ground and upper floors, carrying the upper floor slab
 * and the roof with only one clean door opening on each side (at Z = 1.65) to enter into the halls.
 */
export const BEARING_WALL = {
  x: 4.89,
  thickness: .3,
  minZ: -8.15,
  maxZ: 5.53,
  door: { center: 1.65, width: 1.6, sill: 0, height: 2.6, kind: "door" as const },
};

function atticInfill(parent: THREE.Group, m: AssetMaterials) {
  // Attic closure walls follow the roof underside sampled from the roof module, so they carry the
  // roof planes without ever piercing them. Profiles are taken at each wall's outer face.
  const base = 8.39;
  const clearance = .01;
  const underside = (x: number, z: number) => roofSurfaceHeight(x, z) - ROOF_THICKNESS - clearance;

  // Front attic wall along the first-floor front wall line, under both wings and the gablet.
  const frontFaceZ = BP.frontWallZ + BP.wall / 2;
  const front = new THREE.Shape();
  front.moveTo(-16.66, base);
  for (let x = -16.66; x <= 16.66 + 1e-6; x += .1) {
    const sampleX = Math.min(x, 16.66);
    // Kinks (valleys, hip breaks) fall between samples; hold the lower neighbour so no corner is cut.
    const y = Math.min(underside(sampleX, frontFaceZ), underside(Math.min(sampleX + .1, 16.66), frontFaceZ)) - .05;
    front.lineTo(sampleX, Math.max(base + .05, y));
  }
  front.lineTo(16.66, base);
  front.closePath();
  const frontWall = new THREE.Mesh(new THREE.ExtrudeGeometry(front, { depth: BP.wall, bevelEnabled: false }), m.plaster);
  frontWall.name = "Roof-profile attic front wall";
  frontWall.position.z = BP.frontWallZ - BP.wall / 2;
  frontWall.castShadow = frontWall.receiveShadow = true;
  parent.add(frontWall);

  // Side knee walls: planar tops parallel to the hip end planes.
  for (const sign of [-1, 1]) {
    const inner = sign * (BP.sideWallX - BP.wall / 2);
    const outer = sign * (BP.sideWallX + BP.wall / 2);
    const shape = new THREE.Shape();
    shape.moveTo(inner, base);
    shape.lineTo(outer, base);
    shape.lineTo(outer, underside(outer, 0));
    shape.lineTo(inner, underside(inner, 0));
    shape.closePath();
    const side = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 5.53 + 8.16, bevelEnabled: false }), m.plaster);
    side.name = `${sign < 0 ? "West" : "East"} attic knee wall under hip`;
    side.position.z = -8.16;
    side.castShadow = side.receiveShadow = true;
    parent.add(side);
  }

  // Rear knee wall: planar top parallel to the rear slope.
  const rearInner = BP.rearWallZ + BP.wall / 2;
  const rearOuter = BP.rearWallZ - BP.wall / 2;
  const rear = new THREE.Shape();
  rear.moveTo(rearOuter, base);
  rear.lineTo(rearInner, base);
  rear.lineTo(rearInner, underside(0, rearInner));
  rear.lineTo(rearOuter, underside(0, rearOuter));
  rear.closePath();
  const rearWall = new THREE.Mesh(new THREE.ExtrudeGeometry(rear, { depth: 33.32, bevelEnabled: false }), m.plaster);
  rearWall.name = "Rear attic knee wall under rear slope";
  rearWall.rotation.y = -Math.PI / 2;
  rearWall.position.x = 16.66;
  rearWall.castShadow = rearWall.receiveShadow = true;
  parent.add(rearWall);
}

export function buildStructure(m: AssetMaterials): StructuralGroups {
  const foundation = new THREE.Group();
  foundation.name = "Foundation / Agent 02";
  const ground = new THREE.Group();
  ground.name = "GroundFloor / Agent 02";
  const first = new THREE.Group();
  first.name = "FirstFloor / Agent 02";

  box(foundation, "Continuous laterite plinth", 0, .26, 0, BP.width, .52, BP.depth, m.laterite);
  box(foundation, "Plinth cap / building datum", 0, .575, 0, BP.width, .11, BP.depth, m.trimShade);
  box(foundation, "Ground stone slab / rooms", 0, .69, (BP.rearZ + BP.frontWallZ) / 2, 33.66, .12, BP.frontWallZ - BP.rearZ, m.interiorFloor);
  // The upper floor is four slabs around a true, open stairwell.
  const s = BP.stairVoid;
  const slabY = BP.first - .13;
  const minX = -16.66;
  const maxX = 16.66;
  box(first, "Upper slab / west of stairwell", (minX + s.minX) / 2, slabY, (BP.rearZ + BP.frontWallZ) / 2, s.minX - minX, .26, BP.frontWallZ - BP.rearZ, m.interiorFloor);
  box(first, "Upper slab / east of stairwell", (maxX + s.maxX) / 2, slabY, (BP.rearZ + BP.frontWallZ) / 2, maxX - s.maxX, .26, BP.frontWallZ - BP.rearZ, m.interiorFloor);
  box(first, "Upper slab / before stairwell", 0, slabY, (s.maxZ + BP.frontWallZ) / 2, s.maxX - s.minX, .26, BP.frontWallZ - s.maxZ, m.interiorFloor);
  box(first, "Upper slab / behind stairwell", 0, slabY, (BP.rearZ + s.minZ) / 2, s.maxX - s.minX, .26, s.minZ - BP.rearZ, m.interiorFloor);

  const lowerHeight = BP.first - .25 - BP.floor;
  const upperHeight = BP.upperTop - BP.first;
  for (const sign of [-1, 1]) {
    const left = sign < 0 ? -16.66 : BP.wingInnerX;
    const right = sign < 0 ? -BP.wingInnerX : 16.66;
    wallX(ground, `${sign < 0 ? "West" : "East"} front ground masonry`, left, right, BP.frontWallZ, BP.floor, lowerHeight, BP.wall, groundWingOpenings, m.plaster);
    wallX(first, `${sign < 0 ? "West" : "East"} front upper masonry`, left, right, BP.frontWallZ, BP.first, upperHeight, BP.wall, upperWingOpenings, m.plaster);
    wallZ(ground, `${sign < 0 ? "West" : "East"} exterior ground wall`, -8.16, 5.53, sign * BP.sideWallX, BP.floor, lowerHeight, BP.wall, groundSideOpenings, m.plaster);
    wallZ(first, `${sign < 0 ? "West" : "East"} exterior upper wall`, -8.16, 5.53, sign * BP.sideWallX, BP.first, upperHeight, BP.wall, upperSideOpenings, m.plaster);
  }
  wallX(ground, "Central entry back wall / clear door", -BP.wingInnerX, BP.wingInnerX, BP.frontWallZ, BP.floor, lowerHeight, BP.wall, [centerGroundDoor], m.plaster);
  const upperCenterWindows: WallOpening[] = [
    // Flanking lights sit between the centre and the bearing walls (|x| = 4.4), clear of the portal.
    { center: -3.6, width: .98, sill: .90, height: 1.32, kind: "window" },
    centerUpperDoor,
    { center: 3.6, width: .98, sill: .90, height: 1.32, kind: "window" },
  ];
  wallX(first, "Central balcony back wall / access door", -BP.wingInnerX, BP.wingInnerX, BP.frontWallZ, BP.first, upperHeight, BP.wall, upperCenterWindows, m.plaster);
  wallX(ground, "Rear ground masonry", -16.66, 16.66, BP.rearWallZ, BP.floor, lowerHeight, BP.wall, groundRearOpenings, m.plaster);
  wallX(first, "Rear upper masonry", -16.66, 16.66, BP.rearWallZ, BP.first, upperHeight, BP.wall, upperRearOpenings, m.plaster);

  // Two full solid bearing walls from edge to edge (Z = -8.15 to Z = 5.53) on both ground and upper floors,
  // with only one clean door opening on each side (at Z = 1.65) to enter into the halls.
  const bearingDoor = BEARING_WALL.door;
  for (const sign of [-1, 1]) {
    const tag = sign < 0 ? "West" : "East";
    const x = sign * BEARING_WALL.x;
    wallZ(ground, `${tag} bearing wall / ground`, BEARING_WALL.minZ, BEARING_WALL.maxZ, x, BP.floor, lowerHeight, BEARING_WALL.thickness, [bearingDoor], m.plaster);
    wallZ(first, `${tag} bearing wall / upper`, BEARING_WALL.minZ, BEARING_WALL.maxZ, x, BP.first, upperHeight, BEARING_WALL.thickness, [bearingDoor], m.plaster);
    // Clean teak door frame around the doorway on both levels
    for (const level of [BP.floor, BP.first]) {
      const parent = level === BP.floor ? ground : first;
      const top = level + bearingDoor.height;
      for (const s of [-1, 1]) {
        box(parent, `${tag} hall doorway jamb`, x, level + bearingDoor.height / 2, bearingDoor.center + s * (bearingDoor.width / 2 - .045), BEARING_WALL.thickness + .04, bearingDoor.height, .09, m.teakDark);
      }
      box(parent, `${tag} hall doorway lintel`, x, top - .045, bearingDoor.center, BEARING_WALL.thickness + .04, .09, bearingDoor.width, m.teakDark);
    }
  }

  // Continuous horizontal ties meet, but do not duplicate, the floor-slab edges.
  box(first, "Rear roof bearing beam", 0, 8.44, -8.32, 33.66, .16, .27, m.trimShade);
  for (const sign of [-1, 1]) {
    box(first, `${sign < 0 ? "West" : "East"} front roof bearing beam`, sign * 11.0, 8.44, BP.frontWallZ, 11.66, .16, .27, m.trimShade);
  }
  // The front wall ends at |x| = 16.66 and the side wall at z = 5.53, which left an open 340 mm notch at each
  // front corner. A corner pier closes it flush with both faces on both storeys.
  for (const sign of [-1, 1]) {
    const tag = sign < 0 ? "West" : "East";
    box(ground, `${tag} corner pier / ground`, sign * BP.sideWallX, BP.floor + lowerHeight / 2, BP.frontWallZ, BP.wall, lowerHeight, BP.wall, m.plaster);
    box(first, `${tag} corner pier / upper`, sign * BP.sideWallX, BP.first + upperHeight / 2, BP.frontWallZ, BP.wall, upperHeight, BP.wall, m.plaster);
  }
  atticInfill(first, m);
  return { foundation, ground, first };
}