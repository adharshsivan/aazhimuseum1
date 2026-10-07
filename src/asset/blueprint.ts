export type OpeningKind = "window" | "door";

export interface WallOpening {
  center: number;
  width: number;
  sill: number;
  height: number;
  kind: OpeningKind;
}

export const BP = {
  width: 34,
  depth: 17,
  halfWidth: 17,
  rearZ: -8.5,
  frontZ: 8.5,
  frontWallZ: 5.7,
  sideWallX: 16.83,
  rearWallZ: -8.33,
  wall: 0.34,
  partition: 0.18,
  floor: 0.75,
  first: 4.8,
  upperTop: 8.4,
  // Clean rectangular opening in the upper slab. 0.4 m wider than the stair on each side so the
  // floor-edge guard rail and the raked stair balustrade read as two separate lines.
  stairVoid: { minX: -2.1, maxX: 2.1, minZ: -5.3, maxZ: -0.45 },
  wingInnerX: 5.15,
  wingBays: [7.25, 11.05, 14.85],
  wingPosts: [5.4, 9.2, 13, 16.83],
  roofEave: 8.65,
  roofRidge: 12.1,
  gablePeak: 14.2,
} as const;

// Windows sit high on both floors so museum exhibits and displays can stand below them. Ground sills
// are 1.38 m above the floor (about 2.10 m above grade), clear of the 0.75 m plinth band below the
// sills on the facade. Upper sills are 1.02 m tall, clear of the 1.08 m railing, and the fronts are
// shortened so the high glass slips between the spandrel (top 4.58) and the eave bearer (underside 8.93).
export const groundWingOpenings: WallOpening[] = [-1, 1].flatMap((sign) =>
  BP.wingBays.map((bay, index) => ({
    center: sign * bay,
    width: index === 1 ? 1.36 : 1.2,
    sill: index === 1 ? 0 : 1.38,
    height: index === 1 ? 2.64 : 1.28,
    kind: index === 1 ? "door" as const : "window" as const,
  })),
).sort((a, b) => a.center - b.center);

export const upperWingOpenings: WallOpening[] = [-1, 1].flatMap((sign) =>
  BP.wingBays.map((bay, index) => ({
    center: sign * bay,
    width: index === 1 ? 1.35 : 1.18,
    sill: index === 1 ? 0 : 1.02,
    height: index === 1 ? 2.52 : 1.28,
    kind: index === 1 ? "door" as const : "window" as const,
  })),
).sort((a, b) => a.center - b.center);

export const groundRearOpenings: WallOpening[] = [-14.85, -11.05, -7.25, 0, 7.25, 11.05, 14.85].map((center) => ({
  center, width: 1.14, sill: 1.38, height: 1.32, kind: "window",
}));

export const upperRearOpenings: WallOpening[] = [-14.85, -11.05, -7.25, 0, 7.25, 11.05, 14.85].map((center) => ({
  center, width: 1.14, sill: 1.02, height: 1.55, kind: "window",
}));

export const groundSideOpenings: WallOpening[] = [3.25, -0.55, -4.85].map((center) => ({
  center, width: 1.12, sill: 1.38, height: 1.32, kind: "window",
}));

export const upperSideOpenings: WallOpening[] = [3.25, -0.55, -4.85].map((center) => ({
  center, width: 1.12, sill: 1.02, height: 1.55, kind: "window",
}));

export const centerGroundDoor: WallOpening = { center: 0, width: 2.35, sill: 0, height: 3.0, kind: "door" };
export const centerUpperDoor: WallOpening = { center: 0, width: 1.72, sill: 0, height: 2.7, kind: "door" };

export const guidedStops = [
  { id: "outside", label: "Outside", x: 0, y: 0, z: 14.2, heading: Math.PI },
  { id: "steps", label: "Main stairs", x: 0, y: 0.6, z: 11.69, heading: Math.PI },
  { id: "portico", label: "Entrance portico", x: 0, y: BP.floor, z: 7.65, heading: Math.PI },
  { id: "hall", label: "Central hall", x: 0, y: BP.floor, z: 2.65, heading: Math.PI },
  { id: "ground-hall-west", label: "Ground hall / west end", x: -8.4, y: BP.floor, z: 1.7, heading: -Math.PI / 2 },
  { id: "ground-hall-east", label: "Ground hall / east end", x: 8.4, y: BP.floor, z: 1.7, heading: Math.PI / 2 },
  { id: "stair-start", label: "Internal staircase", x: -0.95, y: BP.floor, z: -0.65, heading: Math.PI },
  { id: "stair-landing", label: "Turn landing", x: 0, y: 2.775, z: -4.5, heading: 0 },
  { id: "first-floor", label: "First floor", x: 0.95, y: BP.first, z: -0.2, heading: 0 },
  { id: "veranda", label: "Upper veranda", x: 7.25, y: BP.first, z: 7.4, heading: 0 },
  { id: "balcony", label: "Central balcony", x: 0, y: BP.first, z: 9.95, heading: 0 },
  { id: "return", label: "Return downstairs", x: 0, y: BP.floor, z: 2.65, heading: 0 },
] as const;