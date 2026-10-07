import * as THREE from "three";

function random(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function texture(draw: (ctx: CanvasRenderingContext2D, rand: () => number) => void, seed: number, size = 512) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  draw(ctx, random(seed));
  const result = new THREE.CanvasTexture(canvas);
  result.colorSpace = THREE.SRGBColorSpace;
  result.wrapS = result.wrapT = THREE.RepeatWrapping;
  result.anisotropy = 8;
  return result;
}

export function createMaterials() {
  const roofAtlas = texture((ctx, rand) => {
    ctx.fillStyle = "#9d4d32";
    ctx.fillRect(0, 0, 512, 512);
    const tileW = 64;
    const tileH = 51.2;
    for (let row = -1; row < 11; row++) {
      for (let col = -1; col < 10; col++) {
        const x = col * tileW + (row % 2 ? tileW / 2 : 0);
        const y = row * tileH;
        const tone = rand();
        ctx.fillStyle = `hsl(${13 + rand() * 6} ${48 + rand() * 12}% ${37 + tone * 13}%)`;
        ctx.fillRect(x + 1, y + 1, tileW - 2, tileH - 2);
        ctx.strokeStyle = "rgba(48,24,17,.5)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + 1, y + 1);
        ctx.lineTo(x + 1, y + tileH - 2);
        ctx.quadraticCurveTo(x + tileW / 2, y + tileH + 8, x + tileW - 2, y + tileH - 2);
        ctx.stroke();
        ctx.strokeStyle = "rgba(239,169,112,.32)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + 5, y + 5);
        ctx.lineTo(x + tileW - 6, y + 5);
        ctx.stroke();
        for (let i = 0; i < 5; i++) {
          ctx.fillStyle = rand() > .5 ? "rgba(63,35,25,.075)" : "rgba(255,207,144,.09)";
          ctx.fillRect(x + rand() * tileW, y + rand() * tileH, 3 + rand() * 12, 1 + rand() * 3);
        }
      }
    }
  }, 491);

  const roofNormal = texture((ctx) => {
    const image = ctx.createImageData(512, 512);
    for (let y = 0; y < 512; y++) {
      const row = Math.floor(y / 51.2);
      const course = (y % 51.2) / 51.2;
      for (let x = 0; x < 512; x++) {
        const tile = ((x - (row % 2 ? 32 : 0)) % 64 + 64) % 64;
        const archedFace = (tile - 32) / 32;
        const edge = tile < 3 || tile > 61 ? 19 : 0;
        const horizontalEdge = course < .065 || course > .93 ? 20 : 0;
        const i = (y * 512 + x) * 4;
        image.data[i] = 128 + archedFace * 22 + edge;
        image.data[i + 1] = 128 + (course - .5) * 13 + horizontalEdge;
        image.data[i + 2] = 248;
        image.data[i + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
  }, 492);
  roofNormal.colorSpace = THREE.NoColorSpace;

  const plasterAtlas = texture((ctx, rand) => {
    ctx.fillStyle = "#eee5d4";
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 13000; i++) {
      const v = rand();
      ctx.fillStyle = v < .5 ? "rgba(110,90,61,.022)" : "rgba(255,255,246,.09)";
      const r = .4 + rand() * 3;
      ctx.fillRect(rand() * 512, rand() * 512, r, r);
    }
    for (let i = 0; i < 80; i++) {
      ctx.fillStyle = "rgba(151,125,82,.019)";
      ctx.fillRect(rand() * 512, rand() * 512, 2 + rand() * 15, 6 + rand() * 70);
    }
  }, 211);

  const timberAtlas = texture((ctx, rand) => {
    ctx.fillStyle = "#543324";
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 420; i++) {
      const x = rand() * 512;
      ctx.strokeStyle = rand() > .5 ? "rgba(217,153,105,.11)" : "rgba(25,12,9,.18)";
      ctx.lineWidth = .5 + rand() * 3;
      ctx.beginPath();
      ctx.moveTo(x, -10);
      ctx.bezierCurveTo(x + (rand() - .5) * 25, 150, x + (rand() - .5) * 25, 330, x + (rand() - .5) * 24, 522);
      ctx.stroke();
    }
  }, 843);

  const stoneAtlas = texture((ctx, rand) => {
    ctx.fillStyle = "#807a6b";
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 14000; i++) {
      ctx.fillStyle = rand() > .5 ? "rgba(241,222,190,.085)" : "rgba(55,49,43,.065)";
      const r = .4 + rand() * 3;
      ctx.fillRect(rand() * 512, rand() * 512, r, r);
    }
  }, 121);

  const lateriteAtlas = texture((ctx, rand) => {
    ctx.fillStyle = "#60493c";
    ctx.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 512; y += 86) {
      ctx.fillStyle = "rgba(31,24,21,.23)";
      ctx.fillRect(0, y, 512, 3);
      for (let x = (y / 86) % 2 ? -60 : 0; x < 512; x += 126) ctx.fillRect(x, y, 3, 86);
    }
    for (let i = 0; i < 5000; i++) {
      ctx.fillStyle = rand() > .5 ? "rgba(235,164,110,.06)" : "rgba(16,10,8,.07)";
      ctx.fillRect(rand() * 512, rand() * 512, 2 + rand() * 7, 1 + rand() * 5);
    }
  }, 721);

  const standard = (name: string, color: string, roughness = .83, map?: THREE.Texture) =>
    new THREE.MeshStandardMaterial({ name, color, roughness, map, metalness: 0 });

  return {
    plaster: standard("01 / lime plaster", "#ffffff", .92, plasterAtlas),
    agedPlaster: standard("02 / shaded lime", "#dbd3bd", .97, plasterAtlas),
    trim: standard("03 / cream stucco detail", "#f3e7cf", .88),
    trimShade: standard("04 / warm stucco shadow", "#c8b69a", .94),
    roof: new THREE.MeshStandardMaterial({ name: "05 / weathered terracotta tile atlas", map: roofAtlas, normalMap: roofNormal, normalScale: new THREE.Vector2(.45, .45), roughness: .94, side: THREE.DoubleSide }),
    roofAlt: new THREE.MeshStandardMaterial({ name: "06 / oxidised terracotta", map: roofAtlas, normalMap: roofNormal, normalScale: new THREE.Vector2(.45, .45), color: "#cfad98", roughness: .96, side: THREE.DoubleSide }),
    roofEdge: standard("07 / clay ridge tile", "#985139", .9),
    teak: standard("08 / aged teak", "#f4dfc3", .78, timberAtlas),
    teakDark: standard("09 / carved dark teak", "#cda887", .79, timberAtlas),
    teakHighlight: standard("10 / exposed teak edges", "#af7854", .78),
    laterite: standard("11 / laterite masonry atlas", "#ffffff", .98, lateriteAtlas),
    stone: standard("12 / worn stone atlas", "#ffffff", .96, stoneAtlas),
    stoneLight: standard("13 / step nosing", "#b8ac94", .92),
    roofUnder: new THREE.MeshStandardMaterial({ name: "14 / shaded roof soffit", color: "#37291f", roughness: .95, side: THREE.DoubleSide }),
    interiorFloor: standard("15 / limewashed stone floor", "#d5c8ad", .94, stoneAtlas),
    glass: new THREE.MeshPhysicalMaterial({ name: "16 / smoke glazing", color: "#544c3e", roughness: .2, metalness: .05, transparent: true, opacity: .55, side: THREE.DoubleSide, depthWrite: false }),
    brass: standard("17 / aged brass", "#ad8751", .42),
    // Warm oil-lamp glow. Emissive so the lantern reads lit day and night with no extra lights.
    lampGlass: new THREE.MeshPhysicalMaterial({ name: "18 / heritage lamp glow glass", color: "#f0c078", emissive: new THREE.Color("#ffa53c"), emissiveIntensity: .85, roughness: .28, metalness: 0, transparent: true, opacity: .72, side: THREE.DoubleSide }),
    // Dark aged bronze/ironwork for lantern frames, brackets and wall plates.
    lampIron: standard("19 / aged lantern iron", "#4a3b2e", .62),
    chandelierBrass: new THREE.MeshStandardMaterial({ name: "20 / antique chandelier brass", color: "#b59157", metalness: .6, roughness: .36 }),
    chandelierOpal: new THREE.MeshStandardMaterial({ name: "21 / warm opal lotus glass", color: "#fff1d5", emissive: "#ffc985", emissiveIntensity: .25, roughness: .28, metalness: 0 }),
    chandelierFlame: new THREE.MeshStandardMaterial({ name: "22 / chandelier candle light", color: "#fff8e8", emissive: "#ffdda3", emissiveIntensity: 1.8, roughness: .2 }),
    chandelierCrystal: new THREE.MeshPhysicalMaterial({ name: "23 / faceted chandelier glass", color: "#f6ebd5", roughness: .12, metalness: .1, clearcoat: .7, transparent: true, opacity: .72, depthWrite: false, flatShading: true }),
    collision: new THREE.MeshBasicMaterial({ name: "Collision (non-rendering)", color: "#38d6aa", transparent: true, opacity: .18, depthWrite: false }),
  };
}

export type AssetMaterials = ReturnType<typeof createMaterials>;