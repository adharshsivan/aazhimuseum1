import * as THREE from "three";
import { BP, centerUpperDoor, groundRearOpenings, groundSideOpenings, groundWingOpenings, upperRearOpenings, upperSideOpenings, upperWingOpenings, type WallOpening } from "./blueprint";
import type { AssetMaterials } from "./materials";
import { box, sharedBoxGeometry } from "./primitives";

function insert(parent: THREE.Group, name: string, x: number, y: number, z: number, rotation: number, opening: WallOpening, m: AssetMaterials) {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(x, y + opening.sill, z);
  g.rotation.y = rotation;
  g.userData.level = y >= BP.first ? "upper" : "ground";
  parent.add(g);
  const w = opening.width;
  const h = opening.height;
  const isDoor = opening.kind === "door";

  // All pieces sit in a void in a 340 mm masonry wall, rather than on a solid facade.
  box(g, "Recessed timber reveal / left", -w / 2 + .065, h / 2, -.085, .13, h, .27, m.teakDark);
  box(g, "Recessed timber reveal / right", w / 2 - .065, h / 2, -.085, .13, h, .27, m.teakDark);
  box(g, "Timber lintel", 0, h - .065, -.07, w, .13, .28, m.teakDark);
  if (!isDoor) {
    // Windows are high glazed clerestories with closed louvred shutters, so the wall below stays
    // free for museum exhibits. Louvre count scales down with the shorter sash.
    const shutterHeight = h - .14;
    box(g, "Timber inner sill", 0, .058, -.065, w, .115, .26, m.teakDark);
    box(g, "Glazed recessed opening", 0, h / 2, -.13, w - .2, shutterHeight - .1, .025, m.glass);
    box(g, "Window centre mullion", 0, h / 2, -.005, .048, shutterHeight - .04, .065, m.teak);
    box(g, "Window transom", 0, h * .58, -.005, w - .14, .05, .065, m.teak);
    const louvreCount = Math.max(2, Math.floor((shutterHeight - .16) / .13));
    for (const sign of [-1, 1]) {
      const shutter = new THREE.Group();
      shutter.name = "Hinged teak shutter";
      shutter.position.set(sign * (w / 2 - .10), .07, .055);
      shutter.rotation.y = sign * .41;
      g.add(shutter);
      const leafW = (w - .22) / 2;
      box(shutter, "Shutter stile and panel", -sign * leafW / 2, shutterHeight / 2, 0, leafW, shutterHeight, .07, m.teakDark);
      const louvres = new THREE.InstancedMesh(sharedBoxGeometry(leafW - .12, .04, .025), m.teakHighlight, louvreCount);
      louvres.name = "Horizontal shutter louvre / instanced";
      louvres.castShadow = false;
      const dummy = new THREE.Object3D();
      for (let i = 0; i < louvreCount; i++) {
        dummy.position.set(-sign * leafW / 2, .1 + i * ((shutterHeight - .2) / louvreCount), .047);
        dummy.updateMatrix();
        louvres.setMatrixAt(i, dummy.matrix);
      }
      louvres.instanceMatrix.needsUpdate = true;
      shutter.add(louvres);
    }
    box(g, "Stone sill projection", 0, -.035, .155, w + .36, .12, .34, m.trim);
    box(g, "Sill weather edge", 0, -.105, .20, w + .41, .045, .31, m.trimShade);
  } else {
    box(g, "Door threshold", 0, .035, .12, w - .13, .07, .34, m.stoneLight);
    const pivot = new THREE.Group();
    pivot.name = "Open secondary door / 950 mm passage";
    pivot.position.set(-w / 2 + .13, 0, .06);
    pivot.rotation.y = -1.28;
    g.add(pivot);
    box(pivot, "Teak door leaf", (w - .2) / 2, h / 2, 0, w - .2, h - .1, .085, m.teakDark);
    for (const py of [.58, 1.42, 2.13]) {
      if (py + .3 >= h) continue;
      box(pivot, "Inset carved door panel", (w - .2) / 2, py, .055, w - .37, .46, .025, m.teak);
    }
  }
  box(g, "Cream window head moulding", 0, h + .14, .19, w + .39, .16, .27, m.trim);
  box(g, "Head shadow course", 0, h + .04, .23, w + .26, .05, .23, m.trimShade);
  for (const sign of [-1, 1]) {
    box(g, "Plaster opening edge", sign * (w / 2 + .085), h / 2, .16, .12, h + .14, .15, m.trim);
  }
}

export function buildOpenings(m: AssetMaterials) {
  const group = new THREE.Group();
  group.name = "Openings / Agent 04";
  for (const o of groundWingOpenings) insert(group, `Ground front ${o.kind} / ${o.center}`, o.center, BP.floor, BP.frontWallZ + BP.wall / 2, 0, o, m);
  for (const o of upperWingOpenings) insert(group, `Upper front ${o.kind} / ${o.center}`, o.center, BP.first, BP.frontWallZ + BP.wall / 2, 0, o, m);
  for (const o of groundRearOpenings) insert(group, `Ground rear window / ${o.center}`, o.center, BP.floor, BP.rearWallZ - BP.wall / 2, Math.PI, o, m);
  for (const o of upperRearOpenings) insert(group, `Upper rear window / ${o.center}`, o.center, BP.first, BP.rearWallZ - BP.wall / 2, Math.PI, o, m);
  for (const sign of [-1, 1]) {
    for (const o of groundSideOpenings) insert(group, `Ground side window / ${sign}, ${o.center}`, sign * 17, BP.floor, o.center, sign * Math.PI / 2, o, m);
    for (const o of upperSideOpenings) insert(group, `Upper side window / ${sign}, ${o.center}`, sign * 17, BP.first, o.center, sign * Math.PI / 2, o, m);
  }
  insert(group, "Central upper balcony access", 0, BP.first, BP.frontWallZ + BP.wall / 2, 0, centerUpperDoor, m);
  for (const sign of [-1, 1]) {
    // Flanking lights sit between the centre and the bearing walls, clear of the gallery portal at
    // |x| = 4.0 and the portico roof bearer's carrier face (|x| = 4.42) on this wall.
    const sideWindow: WallOpening = { center: sign * 3.6, width: .98, sill: .90, height: 1.32, kind: "window" };
    insert(group, "Central upper flanking shutter", sideWindow.center, BP.first, BP.frontWallZ + BP.wall / 2, 0, sideWindow, m);
  }
  return group;
}