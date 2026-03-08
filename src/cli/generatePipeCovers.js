import fs from "node:fs/promises";
import path from "node:path";
import { buildHoleCoverStl } from "../core/holeCover.js";

/**
 * Pipe covers — caps that go over the pipe end.
 *
 * Short description:
 *   Circular caps that fit over pipe ends. Inner diameter = hole size (pipe, pipe+1 mm, or pipe+2 mm).
 *   Top is the same diameter as the hole (no wider rim). Cap thickness 2 mm, inlet depth 15 mm.
 *
 * Sizes (nominal pipe, mm):
 *   15, 20, 25, 32, 40, 50, 63, 75, 90, 110
 *
 * Variants per size: exact (inner = pipe), +1 mm, +2 mm.
 */
async function generatePipeCoverSet() {
  const baseOutputDir = path.join("output", "pipe_covers");
  await fs.mkdir(baseOutputDir, { recursive: true });

  const pipeSizes = [
    15, 20, 25, 32, 40, 50, 63, 75, 90, 110
  ];

  const inletHeight = 15;
  const thickness = 2;
  const inletThickness = 2;

  const variants = [
    { suffix: "exact", innerOffset: 0 },   // inner = pipe size
    { suffix: "plus_1mm", innerOffset: 1 }, // inner = pipe + 1
    { suffix: "plus_2mm", innerOffset: 2 }  // inner = pipe + 2 (16–18 for 16mm pipe)
  ];

  const fmtSize = (value) => String(Math.round(value)).padStart(2, "0");

  let total = 0;

  for (const size of pipeSizes) {
    for (const v of variants) {
      const innerDiam = size + v.innerOffset;
      if (innerDiam <= 0) continue;
      // Top not wider: same as inner (pipe size)
      const outerDiam = innerDiam;

      const params = {
        shape: { outer: "circle", inner: "circle" },
        outerDimensions: { diameter: outerDiam },
        innerDimensions: { diameter: innerDiam },
        thickness,
        inletHeight,
        inletThickness,
        coverMode: "full",
        outerChamfer: { enabled: true, height: 2, offset: 1 }
      };

      const outerLabel = fmtSize(outerDiam);
      const innerLabel = fmtSize(innerDiam);
      const name = `pipe_cover_outer_${outerLabel}mm_inner_${innerLabel}mm_${v.suffix}`;
      const filename = `${name}.stl`;
      const outPath = path.join(baseOutputDir, filename);

      const { stl } = buildHoleCoverStl(params, { name });
      await fs.writeFile(outPath, stl, "utf8");
      total += 1;
    }
  }

  console.log(`Generated ${total} pipe covers in ${baseOutputDir}/`);
  console.log(`  Cover goes OVER pipe. Inner = hole size (pipe / pipe+1 / pipe+2), top = same. Sizes: ${pipeSizes.join(", ")} mm × 3 variants`);
  console.log(`  Thickness ${thickness}mm, inlet ${inletThickness}mm, depth ${inletHeight}mm`);
}

generatePipeCoverSet().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});
