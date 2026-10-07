import * as THREE from "three";
import { CHANDELIER, CHANDELIER_MOUNTS } from "./chandeliers";

export function inspectHallChandeliers(root: THREE.Group) {
  const checks: string[] = [];
  const issues: string[] = [];
  const fixtures: THREE.Object3D[] = [];
  root.updateMatrixWorld(true);
  root.traverse((object) => {
    if (object.userData.assetSystem === "hall-chandelier") fixtures.push(object);
  });

  const ids = new Set(fixtures.map((fixture) => fixture.userData.mountId));
  if (fixtures.length === 4 && CHANDELIER_MOUNTS.every((mount) => ids.has(mount.id))) {
    checks.push("Four eight-arm heritage chandeliers: one in each ground- and first-floor hall");
  } else {
    issues.push(`Hall lighting / expected one chandelier per hall, found ${fixtures.length}`);
  }

  const geometrySets: THREE.BufferGeometry[][] = [];
  let lowestClearance = Infinity;
  for (const mount of CHANDELIER_MOUNTS) {
    const fixture = fixtures.find((candidate) => candidate.userData.mountId === mount.id);
    if (!fixture) continue;
    const bounds = new THREE.Box3().setFromObject(fixture);
    const centre = fixture.getWorldPosition(new THREE.Vector3());
    const ceilingName = mount.level === "upper"
      ? "First-floor closed lime ceiling below ventilated attic"
      : `Upper slab / ${mount.x < 0 ? "west" : "east"} of stairwell`;
    const ceiling = root.getObjectByName(ceilingName);
    const ceilingBounds = ceiling ? new THREE.Box3().setFromObject(ceiling) : null;
    if (!ceilingBounds || Math.abs(bounds.max.y - ceilingBounds.min.y) > .002) {
      issues.push(`${mount.label} / mounting rose does not meet the actual ceiling soffit`);
    }
    const clearance = bounds.min.y - mount.floorY;
    lowestClearance = Math.min(lowestClearance, clearance);
    if (clearance < CHANDELIER.minimumClearance || bounds.min.y < mount.ceilingY - CHANDELIER.drop) {
      issues.push(`${mount.label} / hanging ornament is below the 2.40 m clear-height allowance`);
    }
    if (Math.abs(centre.x - mount.x) > .001 || Math.abs(centre.z - mount.z) > .001) {
      issues.push(`${mount.label} / fixture is not centred in its hall`);
    }
    const nearX = Math.min(Math.abs(bounds.min.x), Math.abs(bounds.max.x));
    const farX = Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x));
    if (nearX < CHANDELIER.hallBounds.innerX + .5 || farX > CHANDELIER.hallBounds.outerX - .5 ||
      bounds.min.z < CHANDELIER.hallBounds.rearZ + .5 || bounds.max.z > CHANDELIER.hallBounds.frontZ - .5) {
      issues.push(`${mount.label} / chandelier encroaches on a wall, door or stair bay`);
    }
    const meshes = fixture.children.filter((child): child is THREE.Mesh => child instanceof THREE.Mesh);
    geometrySets.push(meshes.map((mesh) => mesh.geometry));
  }
  if (issues.length === 0) {
    checks.push(`Chandelier roses meet all four ceiling soffits; ${lowestClearance.toFixed(2)} m minimum clear height, away from doors and stairs`);
  }
  const first = geometrySets[0];
  if (first && geometrySets.length === 4 && geometrySets.every((set) => set.length === first.length && set.every((geometry, i) => geometry === first[i]))) {
    checks.push(`All four chandeliers share ${first.length} merged material meshes; only four hall-light emitters are needed`);
  } else {
    issues.push("Hall lighting / chandelier instances no longer share their geometry");
  }
  return { checks, issues };
}