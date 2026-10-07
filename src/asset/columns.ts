import * as THREE from "three";
import type { AssetMaterials } from "./materials";
import { cylinder } from "./primitives";

/*
 * Shared round-column builder. Every pillar in the building (veranda posts, balcony posts, entrance
 * columns) uses the same traditional language so proportions stay consistent:
 *
 *   floor -> moulded round base -> gently tapered shaft -> neck rings + bell capital -> round abacus
 *
 * Every piece starts exactly where the previous one ends, and the abacus top is the bearing height,
 * so the stack always closes against the beam above with no gap and no overlap.
 */

/** [radius, height, smooth?] - corners are hard unless flagged smooth. */
export type LatheProfile = [number, number, boolean?][];

export function lathe(parent: THREE.Group, name: string, x: number, y: number, z: number, profile: LatheProfile, material: THREE.Material, segments = 24) {
  const points: THREE.Vector2[] = [];
  profile.forEach(([r, h, smooth], i) => {
    points.push(new THREE.Vector2(r, h));
    // Doubling an interior point splits its normal, which keeps mouldings crisp while flares stay smooth.
    if (i > 0 && i < profile.length - 1 && !smooth) points.push(new THREE.Vector2(r, h));
  });
  const mesh = new THREE.Mesh(new THREE.LatheGeometry(points, segments), material);
  mesh.name = name;
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export interface ColumnMaterials {
  base: THREE.Material;
  shaft: THREE.Material;
  capital: THREE.Material;
  abacus: THREE.Material;
}

export interface ColumnOptions {
  baseHeight?: number;
  /** Total capital height, including the abacus disc. */
  capitalHeight?: number;
  /** How far the base moulding projects beyond the shaft radius. */
  baseFlare?: number;
  segments?: number;
}

const ABACUS_H = .07;

export function roundColumn(
  parent: THREE.Group,
  name: string,
  x: number,
  z: number,
  floor: number,
  bearing: number,
  radius: number,
  mats: ColumnMaterials,
  opts: ColumnOptions = {},
) {
  const R = radius;
  const Rt = R * .9; // shaft tapers 10 percent toward the capital
  const baseH = opts.baseHeight ?? .18;
  const capH = opts.capitalHeight ?? .3;
  const flare = opts.baseFlare ?? .08;
  const seg = opts.segments ?? 24;
  const bellH = capH - ABACUS_H;
  const baseTop = floor + baseH;
  const capBottom = bearing - capH;
  const shaftH = capBottom - baseTop;
  if (shaftH <= .2) throw new Error(`Column ${name} has no room for a shaft`);

  const u = baseH / .18;
  lathe(parent, `${name} / round base`, x, floor, z, [
    [0, 0],
    [R + flare, 0],
    [R + flare, .05 * u],
    [R + flare * .62, .075 * u],
    [R + flare * .62, .10 * u],
    [R + flare * .3, .12 * u],
    [R + flare * .3, .145 * u],
    [R + .012, .16 * u],
    [R + .012, baseH],
    [0, baseH],
  ], mats.base, seg);

  lathe(parent, `${name} / round shaft`, x, baseTop, z, [
    [0, 0],
    [R, 0],
    [R * 1.012, shaftH * .35, true],
    [Rt, shaftH],
    [0, shaftH],
  ], mats.shaft, seg);

  // Neck bead, groove, and a flaring bell, all springing from the exact shaft top radius.
  lathe(parent, `${name} / bell capital`, x, capBottom, z, [
    [0, 0],
    [Rt, 0],
    [Rt * 1.2, bellH * .10],
    [Rt * 1.2, bellH * .24],
    [Rt, bellH * .33],
    [Rt, bellH * .40],
    [Rt * 1.14, bellH * .45, true],
    [Rt * 1.45, bellH * .70, true],
    [Rt * 1.58, bellH * .90, true],
    [Rt * 1.62, bellH],
    [0, bellH],
  ], mats.capital, seg);

  cylinder(parent, `${name} / round abacus`, x, bearing - ABACUS_H / 2, z, Rt * 1.75, ABACUS_H, mats.abacus, seg + 4);
}

export function timberMats(m: AssetMaterials, base: THREE.Material = m.teakDark): ColumnMaterials {
  return { base, shaft: m.teak, capital: m.teakDark, abacus: m.teakHighlight };
}

/** Turned round newel with a flat cap disc; used to terminate rails. */
export function roundNewel(parent: THREE.Group, name: string, x: number, z: number, floor: number, height: number, radius: number, m: AssetMaterials) {
  cylinder(parent, `${name} / terminal newel`, x, floor + height / 2, z, radius, height, m.teakDark, 16);
  cylinder(parent, `${name} / newel cap`, x, floor + height + .03, z, radius + .025, .06, m.teakHighlight, 16);
}
