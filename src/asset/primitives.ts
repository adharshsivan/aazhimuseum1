import * as THREE from "three";
import type { WallOpening } from "./blueprint";

const boxGeometries = new Map<string, THREE.BoxGeometry>();
const cylinderGeometries = new Map<string, THREE.CylinderGeometry>();

export function clearSharedGeometryCache() {
  boxGeometries.clear();
  cylinderGeometries.clear();
}

export function sharedBoxGeometry(w: number, h: number, d: number) {
  const key = `${w.toFixed(4)}/${h.toFixed(4)}/${d.toFixed(4)}`;
  let geometry = boxGeometries.get(key);
  if (!geometry) {
    geometry = new THREE.BoxGeometry(w, h, d);
    boxGeometries.set(key, geometry);
  }
  return geometry;
}

export function box(parent: THREE.Group, name: string, x: number, y: number, z: number, w: number, h: number, d: number, material: THREE.Material) {
  if (w <= 0.0001 || h <= 0.0001 || d <= 0.0001) throw new Error(`Invalid dimensions for ${name}`);
  const mesh = new THREE.Mesh(sharedBoxGeometry(w, h, d), material);
  mesh.name = name;
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function cylinder(parent: THREE.Group, name: string, x: number, y: number, z: number, radius: number, height: number, material: THREE.Material, sides = 10) {
  const key = `${radius.toFixed(4)}/${height.toFixed(4)}/${sides}`;
  let geometry = cylinderGeometries.get(key);
  if (!geometry) {
    geometry = new THREE.CylinderGeometry(radius, radius, height, sides);
    cylinderGeometries.set(key, geometry);
  }
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function beam(parent: THREE.Group, name: string, from: THREE.Vector3, to: THREE.Vector3, width: number, depth: number, material: THREE.Material) {
  const vector = new THREE.Vector3().subVectors(to, from);
  const mesh = new THREE.Mesh(sharedBoxGeometry(width, vector.length(), depth), material);
  mesh.name = name;
  mesh.position.copy(from).add(to).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vector.normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function wallX(parent: THREE.Group, name: string, start: number, end: number, z: number, base: number, height: number, thickness: number, openings: WallOpening[], material: THREE.Material) {
  const sorted = [...openings].filter((o) => o.center - o.width / 2 >= start && o.center + o.width / 2 <= end).sort((a, b) => a.center - b.center);
  let cursor = start;
  sorted.forEach((o, index) => {
    const left = o.center - o.width / 2;
    if (left - cursor > .001) box(parent, `${name} / pier ${index}`, (cursor + left) / 2, base + height / 2, z, left - cursor, height, thickness, material);
    if (o.sill > 0) box(parent, `${name} / below opening ${index}`, o.center, base + o.sill / 2, z, o.width, o.sill, thickness, material);
    const above = height - o.sill - o.height;
    if (above > .001) box(parent, `${name} / lintel wall ${index}`, o.center, base + height - above / 2, z, o.width, above, thickness, material);
    cursor = o.center + o.width / 2;
  });
  if (end - cursor > .001) box(parent, `${name} / terminal pier`, (cursor + end) / 2, base + height / 2, z, end - cursor, height, thickness, material);
}

export function wallZ(parent: THREE.Group, name: string, start: number, end: number, x: number, base: number, height: number, thickness: number, openings: WallOpening[], material: THREE.Material) {
  const sorted = [...openings].filter((o) => o.center - o.width / 2 >= start && o.center + o.width / 2 <= end).sort((a, b) => a.center - b.center);
  let cursor = start;
  sorted.forEach((o, index) => {
    const left = o.center - o.width / 2;
    if (left - cursor > .001) box(parent, `${name} / pier ${index}`, x, base + height / 2, (cursor + left) / 2, thickness, height, left - cursor, material);
    if (o.sill > 0) box(parent, `${name} / below opening ${index}`, x, base + o.sill / 2, o.center, thickness, o.sill, o.width, material);
    const above = height - o.sill - o.height;
    if (above > .001) box(parent, `${name} / lintel wall ${index}`, x, base + height - above / 2, o.center, thickness, above, o.width, material);
    cursor = o.center + o.width / 2;
  });
  if (end - cursor > .001) box(parent, `${name} / terminal pier`, x, base + height / 2, (cursor + end) / 2, thickness, height, end - cursor, material);
}

export function roofPolygon(parent: THREE.Group, name: string, points: THREE.Vector3[], material: THREE.Material, uvScale = 3.1, facing = new THREE.Vector3(0, 1, 0)) {
  // Newell normal, then force a consistent winding so every plane faces up/outward.
  const normal = new THREE.Vector3();
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    normal.x += (a.y - b.y) * (a.z + b.z);
    normal.y += (a.z - b.z) * (a.x + b.x);
    normal.z += (a.x - b.x) * (a.y + b.y);
  }
  normal.normalize();
  const flipped = normal.dot(facing) < 0;
  // Keep the author's first vertex as the fan anchor so star-shaped notched polygons stay valid.
  const ordered = flipped ? [points[0], ...points.slice(1).reverse()] : points;
  if (flipped) normal.negate();
  // Plane-local UVs: tile courses run horizontally on every slope, with no stretch on steep planes.
  const reference = Math.abs(normal.y) > .999 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
  const across = new THREE.Vector3().crossVectors(reference, normal).normalize();
  const along = new THREE.Vector3().crossVectors(normal, across).normalize();
  const verts: number[] = [];
  const uvs: number[] = [];
  for (let i = 1; i < ordered.length - 1; i++) {
    for (const p of [ordered[0], ordered[i], ordered[i + 1]]) {
      verts.push(p.x, p.y, p.z);
      uvs.push(p.dot(across) / uvScale, p.dot(along) / uvScale);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export const point = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);