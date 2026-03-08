import fs from "node:fs/promises";
import path from "node:path";
import { buildHoleCoverStl } from "../core/holeCover.js";

/**
 * Generate hollow covers with optional separate cover (ring + disc).
 * Two directory trees: cover full (no cutout) and cover with 90° cutout.
 * Same size/depth sets as generateSet hollow list.
 */
async function generateCoverSetWithCover() {
  const baseOutputDir = path.join("output", "set_cover");
  await fs.mkdir(baseOutputDir, { recursive: true });

  const innerDiametersHollow = [
    10, 12, 13, 16,
    20, 25, 32,
    35, 40, 50, 63
  ];

  const inletHeights = [
    10, 12, 14, 16, 18, 20, 25, 30, 35, 40
  ];

  const outerMargin = 4;
  const tolerance = 0.2;
  const fmtSize = (value) => String(value).padStart(2, "0");

  const baseParams = {
    thickness: 2,
    inletThickness: 2,
    coverMode: "hollow",
    outerChamfer: {
      enabled: true,
      height: 2,
      offset: 2
    },
    inletLeadIn: {
      enabled: true,
      height: 3,
      offset: 1
    }
  };

  const dirFull = path.join(baseOutputDir, "full");
  const dirCutout90 = path.join(baseOutputDir, "cutout90");
  await fs.mkdir(dirFull, { recursive: true });
  await fs.mkdir(dirCutout90, { recursive: true });

  let totalFull = 0;
  let totalCutout90 = 0;

  for (const inletHeight of inletHeights) {
    const depthLabel = `depth_${inletHeight}mm`;
    const subDirFull = path.join(dirFull, depthLabel);
    const subDirCutout90 = path.join(dirCutout90, depthLabel);
    await fs.mkdir(subDirFull, { recursive: true });
    await fs.mkdir(subDirCutout90, { recursive: true });

    for (const innerDiam of innerDiametersHollow) {
      const outerDiam = innerDiam + outerMargin;
      const innerDiamWithTolerance = innerDiam - tolerance;
      const outerLabel = fmtSize(outerDiam);
      const innerLabel = fmtSize(innerDiam);

      const hollowParams = {
        shape: { outer: "circle", inner: "circle" },
        outerDimensions: { diameter: outerDiam },
        innerDimensions: { diameter: innerDiamWithTolerance },
        ...baseParams,
        inletHeight
      };

      const nameBase = `cover_outer_${outerLabel}mm_inner_${innerLabel}mm_depth_${inletHeight}mm_hollow_cover`;

      // Full cover disc (no cutout)
      const paramsFull = {
        ...hollowParams,
        cover: { enabled: true, kind: "whole", cutoutDegrees: 0 }
      };
      const outPathFull = path.join(subDirFull, `${nameBase}.stl`);
      const { stl: stlFull } = buildHoleCoverStl(paramsFull, { name: nameBase });
      await fs.writeFile(outPathFull, stlFull, "utf8");
      totalFull += 1;

      // Cover disc with 90° cutout
      const paramsCutout90 = {
        ...hollowParams,
        cover: { enabled: true, kind: "whole", cutoutDegrees: 90 }
      };
      const nameCutout90 = `${nameBase}_cutout90`;
      const outPathCutout90 = path.join(subDirCutout90, `${nameCutout90}.stl`);
      const { stl: stlCutout90 } = buildHoleCoverStl(paramsCutout90, { name: nameCutout90 });
      await fs.writeFile(outPathCutout90, stlCutout90, "utf8");
      totalCutout90 += 1;
    }

    console.log(
      `✓ Depth ${inletHeight}mm: ${innerDiametersHollow.length} × 2 (full + cutout90)`
    );
  }

  console.log(`\nGenerated hollow covers with separate cover disc:`);
  console.log(`  ${baseOutputDir}/full/     → ${totalFull} STLs (cover disc full)`);
  console.log(`  ${baseOutputDir}/cutout90/ → ${totalCutout90} STLs (cover disc 90° cutout)`);
  console.log(`  Sizes: ${innerDiametersHollow.join(", ")}mm inner, tolerance ${tolerance}mm`);
}

generateCoverSetWithCover().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});
