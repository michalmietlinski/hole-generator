import fs from "node:fs/promises";
import path from "node:path";
import { buildHoleCoverStl } from "../core/holeCover.js";

function printHelp() {
  console.log(`
Hole Covers Generator (Node CLI)

Usage:
  node src/cli/index.js --input examples/test.full.json --output output/test_full.stl [--name cover_name]

Required:
  --input <file>     Input JSON with hole cover parameters

Optional:
  --output <path>    Output STL path (default: output/hole_cover.stl)
  --name <text>      STL solid name
  --help             Show help
`);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    if (key === "help") {
      args.help = true;
      continue;
    }
    const value = argv[i + 1];
    if (value == null || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    args[key] = value;
    i += 1;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  if (!args.input) {
    throw new Error("Missing required --input <file>.");
  }

  const outputPath = args.output || path.join("output", "hole_cover.stl");
  const inputRaw = await fs.readFile(args.input, "utf8");
  let params;
  try {
    params = JSON.parse(inputRaw);
  } catch {
    throw new Error(`Invalid JSON in ${args.input}`);
  }

  const { stl, meta } = buildHoleCoverStl(params, { name: args.name });
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, stl, "utf8");

  console.log("STL generated successfully.");
  console.log(`Path: ${outputPath}`);
  console.log(`coverMode=${meta.coverMode}`);
  console.log(
    `outerShape=${meta.outerShape}, innerShape=${meta.innerShape}, thickness=${meta.thickness}, inletHeight=${meta.inletHeight}, inletThickness=${meta.inletThickness}`
  );
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});
