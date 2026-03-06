# Hole Covers Generator

**Live browser tool:** [Hole Covers STL Generator](https://michalmietlinski.github.io/hole-generator/)

This is a new standalone project for generating printable hole covers.

## Goal

Generate a 3D cover model from parametric input.

## Core Parameters

- `shape.outer`: outer profile shape (`rectangle` or `circle`)
- `shape.inner`: inner/profile opening shape (`rectangle` or `circle`)
- `outerDimensions`: dimensions for the outer shape
- `innerDimensions`: dimensions for the inner shape
- `thickness`: main body thickness
- `inletHeight`: vertical depth/height of the inlet section
- `inletThickness`: wall thickness of the inlet section
- `inletLeadIn.enabled`: optional self-centering taper between flat and inlet
- `inletLeadIn.height`: vertical height of that taper zone
- `inletLeadIn.offset`: outward expansion at the top of inlet (at flat/inlet junction)
- `coverMode`: `full` or `hollow`
- `outerChamfer.enabled`: optional chamfer toggle for the outer flat edge
- `outerChamfer.height`: chamfer height in Z (can be partial or full thickness)
- `outerChamfer.offset`: horizontal inset amount from body outline to chamfered top outline

## Dimension Rules

- Units: millimeters (1 unit = 1 mm)
- `innerDimensions` define the **maximum outer fit envelope** of the inlet section at the reference plane.
- `inletHeight` is measured from the **top surface of the flat cover** and extends in mounting direction into the hole.
- Interpretation rule: if `inletHeight = 18`, the inlet section depth from that top reference plane to its end is exactly `18 mm`.
- `inletThickness` must be applied **inward** from that envelope (toward the center), never outward.
- After applying `inletThickness`, the inlet outer boundary must still match `innerDimensions` so the part fits in the hole.
- Optional self-centering lead-in (`inletLeadIn`) is applied between inlet and flat:
  - it tapers the inlet outer shape outward near the flat/inlet junction
  - helps guide insertion and centering in the hole
  - it can be wider than the straight inlet section to create a self-centering squeeze
- Lead-in constraints:
  - `inletLeadIn.height` must be > 0 and <= (`inletHeight - thickness`)
  - `inletLeadIn.offset` must be >= 0
- `coverMode` behavior:
  - `full`: flat cover area is solid (no opening in the top flat part).
  - `hollow`: create a pass-through opening in the flat cover, centered on `shape.inner`.
  - In `hollow` mode, the remaining ring/wall around the opening is defined by `inletThickness` and must stay inside `innerDimensions`.
- Outer chamfer (if enabled) must go "upward" for easy printing:
  - body/bottom keeps the requested `outerDimensions`
  - top outline can be smaller than body
  - chamfer transitions from larger body to smaller top
- Chamfer printability constraint:
  - `outerChamfer.height` must be > 0 and <= `thickness` (partial is allowed, full thickness is also allowed)
  - `outerChamfer.offset` must be <= `thickness`
  - (equivalently, max bottom-to-top size difference per side is limited by flat thickness)

## Shape Dimension Conventions

- For `circle`: use `diameter`.
- For `rectangle`: use `width` and `height`.

## Installation

```bash
cd hole-covers
npm install
```

## Usage

Generate STL from JSON input file (Node CLI reference):

```bash
npm run generate -- --input examples/test.full.json --output output/cover_40_34p6_full.stl --name cover_name
```

### Command Options

- `--input <file>`: JSON input file with cover parameters (required)
- `--output <path>`: Output STL file path (default: `output/cover.stl`)
- `--name <text>`: STL solid name (default: `hole_cover`)

## Browser STL Generator

There is also a small standalone web generator that mirrors the core circular cover parameters and produces STL files directly in the browser.

### Local web usage

- Open `web/index.html` in a modern browser, or serve the `web/` folder with any static server.
- The form fields correspond 1:1 to the CLI JSON:
  - Outer / inner shapes and dimensions
  - `thickness`, `inletHeight`, `inletThickness`
  - `coverMode` (`full` / `hollow`)
  - Optional `outerChamfer` and `inletLeadIn` for circular covers
- Click **Generate STL** to download a single model using the entered parameters.

Currently, the browser generator implements full inlet + lead‑in behavior for circular covers. Rectangular and mixed shapes fall back to a simpler outer solid block while still using the same parameter model.

### Build for GitHub Pages (`docs/` dist)

To publish the web UI via GitHub Pages, build the static assets into `docs/`:

```bash
npm run build-web
```

This copies `web/index.html` and `web/main.js` into the `docs/` folder (the “dist” for GitHub Pages). Commit and push `docs/`, then configure GitHub Pages:

- Settings → Pages
  - Source: **Deploy from a branch**
  - Branch: your main/default branch
  - Folder: `/docs`

## Collections

- [Collection of furniture hole covers (3–63mm)](https://www.printables.com/model/1617117-collection-of-furniture-hole-covers-size-3-63mm)
- [Furniture cable pass-through covers](https://www.printables.com/model/1627791-furniture-cable-pass-through-covers)

## Examples

### Circular Covers

**Full cover (solid top):**
```bash
npm run generate -- --input examples/test.full.json --output output/cover_40_34p6_full.stl
```
- 40mm outer diameter, 34.6mm inner fit envelope
- 2mm thickness, 18mm inlet height
- Outer chamfer enabled

**Hollow cover (pass-through opening):**
```bash
npm run generate -- --input examples/test.hollow.json --output output/cover_40_34p6_hollow.stl
```
- Same dimensions as full, but with opening in flat section

**Hollow with self-centering lead-in:**
```bash
npm run generate -- --input examples/test.hollow.leadin.json --output output/cover_40_34p6_hollow_leadin.stl
```
- Includes outward taper at flat/inlet junction for easier insertion

### Rectangular Covers

**Full rectangular cover:**
```bash
npm run generate -- --input examples/test.rectangle.json --output output/cover_rect_140x190.stl
```
- 140×190mm outer (covers 100×150mm hole with 20mm margin each side)
- 99.4×149.4mm inner fit envelope
- Rectangle outer and inner shapes

**Hollow rectangular cover:**
```bash
npm run generate -- --input examples/test.rectangle.hollow.json --output output/cover_rect_140x190_hollow.stl
```
- Same dimensions, with pass-through opening

**Mixed shape (rectangular outer, circular inner):**
```bash
npm run generate -- --input examples/test.rectangle.circle.inner.json --output output/cover_rect_circle_inner.stl
```
- 140×190mm rectangular outer
- 95mm circular inner opening
- Useful for rectangular mounting with circular pass-through

## Example Files Reference

All example JSON files in `examples/`:

| File | Outer Shape | Inner Shape | Mode | Description |
|------|-------------|-------------|------|-------------|
| `test.full.json` | circle | circle | full | Basic circular cover |
| `test.hollow.json` | circle | circle | hollow | Circular cover with opening |
| `test.hollow.leadin.json` | circle | circle | hollow | With self-centering taper |
| `test.rectangle.json` | rectangle | rectangle | full | Rectangular cover |
| `test.rectangle.hollow.json` | rectangle | rectangle | hollow | Rectangular with opening |
| `test.rectangle.circle.inner.json` | rectangle | circle | hollow | Mixed shapes |

## Quick Parameter Guide

### Fit Calculation

For a hole of size `H`, use:
- `innerDimensions` = `H - clearance` (typically 0.4-0.6mm smaller for fit)
- `outerDimensions` = `H + margin` (how much the cover extends beyond hole)

**Example:** 35mm hole
- `innerDimensions.diameter = 34.6` (0.4mm clearance)
- `outerDimensions.diameter = 40` (5mm margin each side)

### Common Configurations

**Thin cover (1-2mm):**
- `thickness: 1` or `2`
- `inletHeight: 10-15` (shorter for thin covers)
- `inletThickness: 1-2`

**Thick cover (3-5mm):**
- `thickness: 3-5`
- `inletHeight: 15-25`
- `inletThickness: 2-3`

**With chamfer:**
- `outerChamfer.enabled: true`
- `outerChamfer.height: 1-2` (partial) or equal to `thickness` (full)
- `outerChamfer.offset: 0.5-1.5` (how much smaller top is)

**With self-centering:**
- `inletLeadIn.enabled: true`
- `inletLeadIn.height: 2-5` (taper zone height)
- `inletLeadIn.offset: 0.5-2` (outward expansion at top)

## Notes

- All dimensions are in millimeters
- The generator validates all constraints automatically
- STL files are ASCII format for easy inspection
