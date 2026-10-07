import * as THREE from "three";

const distantDetails = [
  "shutter louvre",
  "arch voussoir",
  "small carved front eave brackets",
  "exposed lean-to rafter tail",
  "sill weather edge",
  "inset panel shadow",
  "ventilated teak gable louvre",
  "stair handrail finial",
  "newel cap",
  "pilaster neck moulding",
];

// Agent 10 only classifies removable micro-detail. Walls, roofs, posts and silhouette stay intact.
export function classifyMobileLOD(root: THREE.Group) {
  const details: THREE.Object3D[] = [];
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    if (distantDetails.some((word) => object.name.toLowerCase().includes(word))) {
      object.userData.lod = "near-detail";
      object.castShadow = false;
      details.push(object);
    }
  });
  return {
    details,
    nearDistance: 64,
    manifest: {
      lod0: "Full named architecture and carved details",
      lod1: "Identical silhouette, roof, openings, rooms and collision; micro-detail culled",
      nearDistanceMetres: 64,
      techniques: ["shared PBR materials", "cached compatible box/cylinder geometry", "procedural texture atlases", "instanced balusters and shutter louvres", "roof tile atlases instead of tile meshes", "detail distance culling"],
    },
  };
}