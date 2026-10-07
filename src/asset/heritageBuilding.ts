import * as THREE from "three";
import { BP } from "./blueprint";
import { buildCollision } from "./collision";
import { buildEntrance } from "./entrance";
import { buildInterior } from "./interior";
import { createMaterials } from "./materials";
import { buildOpenings } from "./openings";
import { classifyMobileLOD } from "./optimization";
import { runAssetQA } from "./qa";
import { buildRoof } from "./roof";
import { buildStructure } from "./structure";
import { buildVerandas } from "./verandas";

export function createHeritageBuilding() {
  const materials = createMaterials();
  // Integration is additive. Specialist groups retain ownership of their geometry.
  const structure = buildStructure(materials);
  const entrance = buildEntrance(materials);
  const verandas = buildVerandas(materials);
  const openings = buildOpenings(materials);
  const interior = buildInterior(materials);
  const roof = buildRoof(materials);
  const collision = buildCollision(materials);

  const root = new THREE.Group();
  root.name = "HeritageBuilding / Malabar House";
  root.userData = {
    asset: "Malabar House - Kerala heritage mansion",
    units: "metres",
    blueprint: { width: BP.width, depth: BP.depth, height: 14.6, wall: BP.wall, partition: BP.partition, groundFloor: BP.floor, firstFloor: BP.first, symmetryAxis: "X=0" },
    authoredSystems: 12,
    gameplayRoute: "Exterior > entrance > hall > rooms > U-stair > first floor > veranda > balcony > return",
  };
  const materialNode = new THREE.Group();
  materialNode.name = "Materials / Agent 08";
  materialNode.userData = { sharedPBRPalette: Object.values(materials).map((m) => m.name), tiledRoofUsesAtlas: true };
  root.add(structure.foundation, structure.ground, structure.first, entrance, verandas.group, openings, interior.group, roof, materialNode, collision.group);
  const optimization = classifyMobileLOD(root);
  const qa = runAssetQA(root, collision);

  return {
    root,
    materials,
    collision,
    optimization,
    qa,
    chandeliers: interior.chandeliers,
    layers: {
      roof,
      upper: [structure.first, verandas.upper, interior.upper],
      openings,
    },
  };
}