import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { BP } from "./blueprint";
import { BEARING_WALL } from "./structure";
import type { AssetMaterials } from "./materials";

export interface ChandelierMount {
  id: string;
  label: string;
  level: "ground" | "upper";
  x: number;
  z: number;
  ceilingY: number;
  floorY: number;
}

const hallInnerX = BEARING_WALL.x + BEARING_WALL.thickness / 2;
const hallOuterX = BP.sideWallX - BP.wall / 2;
const hallFrontZ = BP.frontWallZ - BP.wall / 2;
const hallRearZ = BP.rearWallZ + BP.wall / 2;
const hallCentreX = (hallInnerX + hallOuterX) / 2;
const hallCentreZ = (hallFrontZ + hallRearZ) / 2;

export const CHANDELIER = {
  arms: 8,
  armRadius: .78,
  radius: .92,
  drop: 1.15,
  minimumClearance: 2.4,
  emitterDrop: .57,
  colour: "#ffd3a0",
  dayIntensity: 28,
  nightIntensity: 110,
  lightRange: 12.5,
  decay: 2,
  hallBounds: { innerX: hallInnerX, outerX: hallOuterX, frontZ: hallFrontZ, rearZ: hallRearZ },
} as const;

// These are the actual soffit faces, not the tops of the slabs. The fixtures touch both ceilings.
export const CHANDELIER_MOUNTS: ChandelierMount[] = (["ground", "upper"] as const).flatMap((level) =>
  [-1, 1].map((sign) => ({
    id: `chandelier-${level}-${sign < 0 ? "west" : "east"}`,
    label: `${level === "ground" ? "Ground-floor" : "First-floor"} ${sign < 0 ? "west" : "east"} hall chandelier`,
    level,
    x: sign * hallCentreX,
    z: hallCentreZ,
    ceilingY: level === "ground" ? BP.first - .26 : BP.upperTop - .025,
    floorY: level === "ground" ? BP.floor : BP.first,
  })),
);

const profile = (points: [number, number][], segments = 24) =>
  new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), segments);

function makeTemplate(m: AssetMaterials) {
  const template = new THREE.Group();
  template.name = "Eight-arm lotus chandelier";
  const brass = m.chandelierBrass;

  function part(parent: THREE.Group, name: string, geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(x, y, z);
    mesh.receiveShadow = material !== m.chandelierFlame;
    // A fixture-level light represents all eight bulbs, so the fixture does not self-occlude it.
    mesh.castShadow = false;
    parent.add(mesh);
    return mesh;
  }

  function ring(parent: THREE.Group, name: string, radius: number, tube: number, x: number, y: number, z: number, material = brass) {
    const mesh = part(parent, name, new THREE.TorusGeometry(radius, tube, 6, 24), material, x, y, z);
    mesh.rotation.x = Math.PI / 2;
    return mesh;
  }

  // Ceiling rose -> collar -> continuous suspension stem -> turned urn -> arm hub.
  part(template, "Ceiling rose / flush mounting", profile([
    [0, -.068], [.06, -.068], [.115, -.056], [.16, -.032], [.21, -.012], [.21, 0], [0, 0],
  ]), brass);
  ring(template, "Ceiling rose rolled edge", .192, .01, 0, -.018, 0, m.brass);
  part(template, "Suspension socket", new THREE.CylinderGeometry(.035, .032, .052, 16), m.lampIron, 0, -.08);
  part(template, "Continuous brass suspension stem", new THREE.CylinderGeometry(.019, .019, .30, 16), brass, 0, -.22);
  for (const y of [-.125, -.24, -.355]) {
    part(template, "Turned suspension collar", new THREE.CylinderGeometry(.028, .028, .024, 16), m.brass, 0, y);
  }
  part(template, "Turned lotus centre and arm hub", profile([
    [0, -.918], [.03, -.918], [.075, -.868], [.115, -.83], [.14, -.79],
    [.092, -.746], [.052, -.70], [.059, -.655], [.105, -.603], [.132, -.563],
    [.11, -.515], [.055, -.484], [.036, -.445], [.03, -.358], [0, -.358],
  ]), brass);
  ring(template, "Arm hub collar", .127, .012, 0, -.798, 0, m.brass);
  ring(template, "Upper urn collar", .113, .009, 0, -.555, 0, m.brass);

  const arm = new THREE.Group();
  arm.name = "Curved brass arm and opal lotus light";
  const path = new THREE.CurvePath<THREE.Vector3>();
  path.add(new THREE.CubicBezierCurve3(
    new THREE.Vector3(.122, -.79, 0), new THREE.Vector3(.28, -.79, 0),
    new THREE.Vector3(.31, -.965, 0), new THREE.Vector3(.48, -.945, 0),
  ));
  path.add(new THREE.CubicBezierCurve3(
    new THREE.Vector3(.48, -.945, 0), new THREE.Vector3(.64, -.925, 0),
    new THREE.Vector3(.78, -.88, 0), new THREE.Vector3(CHANDELIER.armRadius, -.72, 0),
  ));
  part(arm, "Swept swan-neck arm", new THREE.TubeGeometry(path, 28, .017, 8, false), brass);
  const curl = new THREE.CubicBezierCurve3(
    new THREE.Vector3(.112, -.587, 0), new THREE.Vector3(.32, -.55, 0),
    new THREE.Vector3(.29, -.84, 0), path.getPoint(.57),
  );
  part(arm, "Attached scroll brace", new THREE.TubeGeometry(curl, 18, .009, 6, false), m.brass);

  const r = CHANDELIER.armRadius;
  part(arm, "Lamp socket on arm tip", new THREE.CylinderGeometry(.028, .025, .076, 16), brass, r, -.697);
  part(arm, "Flared brass drip dish", profile([
    [0, -.017], [.029, -.017], [.066, -.007], [.10, .009], [.119, .028],
    [.119, .041], [.102, .035], [.064, .021], [.026, .01], [0, .01],
  ], 20), brass, r, -.655);
  part(arm, "Opal lotus shade", profile([
    [.035, 0], [.063, .017], [.083, .078], [.11, .17], [.117, .206], [.114, .213],
    [.102, .207], [.097, .174], [.071, .08], [.051, .025], [.035, .013], [.035, 0],
  ], 20), m.chandelierOpal, r, -.632);
  ring(arm, "Fine brass shade rim", .111, .006, r, -.425, 0, m.brass);
  part(arm, "Candle socket", new THREE.CylinderGeometry(.019, .021, .09, 12), brass, r, -.587);
  const bulb = part(arm, "Warm candle-shaped bulb", new THREE.SphereGeometry(.033, 12, 10), m.chandelierFlame, r, -.507);
  bulb.scale.set(1, 1.8, 1);

  // Small faceted drops attach through a brass eye at the low point of every arm.
  const suspension = path.getPoint(.61);
  part(arm, "Crystal suspension eye", new THREE.TorusGeometry(.017, .004, 5, 12), brass,
    suspension.x, suspension.y - .03, suspension.z);
  const crystalShape: [number, number][] = [[0, -.102], [.018, -.083], [.036, -.045], [.032, -.026], [.009, 0], [0, 0]];
  const crystal = profile(crystalShape, 8).toNonIndexed();
  crystal.computeVertexNormals();
  part(arm, "Faceted crystal drop", crystal, m.chandelierCrystal, suspension.x, suspension.y - .044, suspension.z);

  for (let i = 0; i < CHANDELIER.arms; i++) {
    const armInstance = arm.clone(true);
    armInstance.name = `Lotus lamp arm ${i + 1}`;
    armInstance.rotation.y = i * Math.PI * 2 / CHANDELIER.arms;
    template.add(armInstance);
  }
  part(template, "Central pendant collar", new THREE.CylinderGeometry(.021, .021, .043, 12), brass, 0, -.934);
  const drop = part(template, "Central crystal pendant", crystal, m.chandelierCrystal, 0, -.955);
  drop.scale.set(1.35, 1.3, 1.35);

  // Merge by shared material, then clone this template for all four halls. No light per bulb.
  template.updateMatrixWorld(true);
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const sourceGeometries = new Set<THREE.BufferGeometry>();
  template.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const material = object.material as THREE.Material;
    const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
    geometry.applyMatrix4(object.matrixWorld);
    const geometries = batches.get(material) ?? [];
    geometries.push(geometry);
    batches.set(material, geometries);
    sourceGeometries.add(object.geometry);
  });
  const result = new THREE.Group();
  for (const [material, geometries] of batches) {
    const merged = mergeGeometries(geometries, false);
    if (!merged) throw new Error("Chandelier material batch could not be merged.");
    merged.computeBoundingBox();
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, material);
    mesh.name = `Chandelier / ${material.name}`;
    mesh.receiveShadow = material === brass || material === m.brass || material === m.lampIron;
    mesh.userData = { castShadow: false, receiveShadow: mesh.receiveShadow, lightFixture: true };
    result.add(mesh);
    geometries.forEach((geometry) => geometry.dispose());
  }
  sourceGeometries.forEach((geometry) => geometry.dispose());
  result.userData = { assetSystem: "hall-chandelier", arms: CHANDELIER.arms, ceilingMounted: true, sharedTemplate: true };
  return result;
}

export function addHallChandeliers(ground: THREE.Group, upper: THREE.Group, materials: AssetMaterials) {
  const template = makeTemplate(materials);
  return CHANDELIER_MOUNTS.map((mount) => {
    const fixture = template.clone(true);
    fixture.name = mount.label;
    fixture.position.set(mount.x, mount.ceilingY, mount.z);
    fixture.userData = {
      ...fixture.userData,
      mountId: mount.id,
      level: mount.level,
      ceilingY: mount.ceilingY,
      minimumClearance: mount.ceilingY - CHANDELIER.drop - mount.floorY,
      lighting: { colour: CHANDELIER.colour, emitterLocal: [0, -CHANDELIER.emitterDrop, 0], intensity: CHANDELIER.nightIntensity, distance: CHANDELIER.lightRange, decay: CHANDELIER.decay, fixtureSelfShadow: false },
    };
    (mount.level === "ground" ? ground : upper).add(fixture);
    return fixture;
  });
}