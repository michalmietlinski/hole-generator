import fs from "node:fs/promises";
import path from "node:path";
import { buildHoleCoverStl } from "../core/holeCover.js";

/**
 * Generate a set of hole covers for common furniture hole sizes
 * Includes standard drill sizes (3-8mm) and cable pass-through sizes (10-63mm)
 * Outer diameter = inner + 4mm
 * Generates sets for common inletHeight values
 * Each inletHeight gets its own directory
 * Tolerance is subtracted from inner diameter for fit clearance
 */
async function generateCoverSet() {
  const baseOutputDir = path.join("output", "set");
  await fs.mkdir(baseOutputDir, { recursive: true });

  // Common furniture hole sizes for full covers (all sizes)
  const innerDiametersFull = [
    // Small holes (fasteners, screws, dowels)
    3, 4, 5, 6, 8,
    // Medium holes (hardware, single cables)
    10, 12, 13, 16,
    // Large holes (cable bundles, European 32mm system)
    20, 25, 32,
    // Extra large (major cable conduits, pipes)
    35, 40, 50, 63
  ];

  // Common furniture hole sizes for hollow covers (larger sizes only, for pass-through)
  const innerDiametersHollow = [
    // Medium holes (single cables)
    10, 12, 13, 16,
    // Large holes (cable bundles, European 32mm system)
    20, 25, 32,
    // Extra large (major cable conduits, pipes)
    35, 40, 50, 63
  ];

  // Common inlet heights for furniture (in mm)
  const inletHeights = [
    10, 12, 14, 16, 18, 20, 25, 30, 35, 40
  ];

  // Generation settings
  const outerMargin = 4; // outer = inner + 4mm
  const tolerance = 0.2; // subtracted from inner diameter for fit clearance
  const generateModes = "full"; // "full", "hollow", or "both"

  // Helper for zero-padded size labels in filenames (e.g. 3 -> "03")
  const fmtSize = (value) => String(value).padStart(2, "0");

  const baseParams = {
    thickness: 2,
    inletThickness: 1,
    outerChamfer: {
      enabled: true,
      height: 2,
      offset: 1,
    }
  };

  const allGenerated = [];
  const shouldGenerateFull = generateModes === "full" || generateModes === "both";
  const shouldGenerateHollow = generateModes === "hollow" || generateModes === "both";

  // Loop through each inletHeight
  for (const inletHeight of inletHeights) {
    if (shouldGenerateFull) {
      const fullDir = path.join(baseOutputDir, `depth_${inletHeight}mm_full`);
      await fs.mkdir(fullDir, { recursive: true });
    }
    if (shouldGenerateHollow) {
      const hollowDir = path.join(baseOutputDir, `depth_${inletHeight}mm_hollow`);
      await fs.mkdir(hollowDir, { recursive: true });
    }

    const fixedParams = {
      ...baseParams,
      inletHeight: inletHeight
    };

    const generated = [];

    // Generate full covers
    if (shouldGenerateFull) {
      for (const innerDiam of innerDiametersFull) {
        const outerDiam = innerDiam + outerMargin;
        const innerDiamWithTolerance = innerDiam - tolerance; // Apply tolerance for fit clearance
        const outerLabel = fmtSize(outerDiam);
        const innerLabel = fmtSize(innerDiam);

        const fullParams = {
          shape: {
            outer: "circle",
            inner: "circle"
          },
          outerDimensions: {
            diameter: outerDiam
          },
          innerDimensions: {
            diameter: innerDiamWithTolerance
          },
          coverMode: "full",
          ...fixedParams
        };

        const fullDir = path.join(baseOutputDir, `depth_${inletHeight}mm_full`);
        await fs.mkdir(fullDir, { recursive: true });
        const fullOutputPath = path.join(
          fullDir,
          `cover_outer_${outerLabel}mm_inner_${innerLabel}mm_depth_${inletHeight}mm_full.stl`
        );
        const { stl: fullStl, meta: fullMeta } = buildHoleCoverStl(fullParams, {
          name: `cover_outer_${outerLabel}mm_inner_${innerLabel}mm_depth_${inletHeight}mm_full`
        });
        await fs.writeFile(fullOutputPath, fullStl, "utf8");
        generated.push({
          path: fullOutputPath,
          inner: innerDiam,
          innerWithTolerance: innerDiamWithTolerance,
          outer: outerDiam,
          mode: "full",
          inletHeight: inletHeight,
          meta: fullMeta
        });
      }
    }

    // Generate hollow covers
    if (shouldGenerateHollow) {
      for (const innerDiam of innerDiametersHollow) {
        const outerDiam = innerDiam + outerMargin;
        const innerDiamWithTolerance = innerDiam - tolerance; // Apply tolerance for fit clearance
        const outerLabel = fmtSize(outerDiam);
        const innerLabel = fmtSize(innerDiam);

        const hollowParams = {
          shape: {
            outer: "circle",
            inner: "circle"
          },
          outerDimensions: {
            diameter: outerDiam
          },
          innerDimensions: {
            diameter: innerDiamWithTolerance
          },
          coverMode: "hollow",
          ...fixedParams
        };

        const hollowDir = path.join(baseOutputDir, `depth_${inletHeight}mm_hollow`);
        await fs.mkdir(hollowDir, { recursive: true });
        const hollowOutputPath = path.join(
          hollowDir,
          `cover_outer_${outerLabel}mm_inner_${innerLabel}mm_depth_${inletHeight}mm_hollow.stl`
        );
        const { stl: hollowStl, meta: hollowMeta } = buildHoleCoverStl(
          hollowParams,
          {
            name: `cover_outer_${outerLabel}mm_inner_${innerLabel}mm_depth_${inletHeight}mm_hollow`
          }
        );
        await fs.writeFile(hollowOutputPath, hollowStl, "utf8");
        generated.push({
          path: hollowOutputPath,
          inner: innerDiam,
          innerWithTolerance: innerDiamWithTolerance,
          outer: outerDiam,
          mode: "hollow",
          inletHeight: inletHeight,
          meta: hollowMeta
        });
      }
    }

    allGenerated.push({
      inletHeight: inletHeight,
      covers: generated
    });

    const fullCount = shouldGenerateFull ? innerDiametersFull.length : 0;
    const hollowCount = shouldGenerateHollow ? innerDiametersHollow.length : 0;
    const modeCount = (shouldGenerateFull ? 1 : 0) + (shouldGenerateHollow ? 1 : 0);
    const sizeInfo = shouldGenerateFull && shouldGenerateHollow
      ? `${fullCount} full + ${hollowCount} hollow sizes`
      : shouldGenerateFull
      ? `${fullCount} sizes`
      : `${hollowCount} sizes`;
    console.log(
      `✓ Depth ${inletHeight}mm: ${generated.length} covers (${sizeInfo} × ${modeCount} mode(s), tolerance: ${tolerance}mm)`
    );
  }

  // Print summary
  const totalCovers = allGenerated.reduce((sum, set) => sum + set.covers.length, 0);
  console.log(`\nGenerated ${totalCovers} covers total:`);
  console.log(`Output directory: ${baseOutputDir}\n`);

  for (const set of allGenerated) {
    const dirs = [];
    if (shouldGenerateFull) dirs.push(`depth_${set.inletHeight}mm_full/`);
    if (shouldGenerateHollow) dirs.push(`depth_${set.inletHeight}mm_hollow/`);
    console.log(
      `  Depth ${set.inletHeight}mm: ${set.covers.length} files in ${dirs.join(' and ')}`
    );
  }

  const modeCount = (shouldGenerateFull ? 1 : 0) + (shouldGenerateHollow ? 1 : 0);
  const fullSizeCount = shouldGenerateFull ? innerDiametersFull.length : 0;
  const hollowSizeCount = shouldGenerateHollow ? innerDiametersHollow.length : 0;
  console.log(
    `\nTotal: ${totalCovers} STL files across ${allGenerated.length} depth configurations`
  );
  if (shouldGenerateFull && shouldGenerateHollow) {
    console.log(
      `  (${allGenerated.length} depths × ${fullSizeCount} full sizes + ${hollowSizeCount} hollow sizes × ${modeCount} mode(s))`
    );
  } else {
    const sizeCount = shouldGenerateFull ? fullSizeCount : hollowSizeCount;
    console.log(
      `  (${allGenerated.length} depths × ${sizeCount} sizes × ${modeCount} mode(s))`
    );
  }
  console.log(
    `  Modes: ${generateModes}`
  );
  if (shouldGenerateFull) {
    console.log(
      `  Full cover sizes: ${innerDiametersFull.join(', ')}mm`
    );
  }
  if (shouldGenerateHollow) {
    console.log(
      `  Hollow cover sizes: ${innerDiametersHollow.join(', ')}mm`
    );
  }
  console.log(
    `  Tolerance: ${tolerance}mm (inner diameter reduced by tolerance for fit clearance)`
  );
}

generateCoverSet().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});

