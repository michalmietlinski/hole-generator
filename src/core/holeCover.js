import modeling from "@jscad/modeling";
import stlSerializer from "@jscad/stl-serializer";

const { booleans, hulls, primitives } = modeling;
const { subtract, union } = booleans;
const { hull } = hulls;
const { cuboid, cylinder } = primitives;
const { serialize } = stlSerializer;

const SHAPE_CIRCLE = "circle";
const SHAPE_RECTANGLE = "rectangle";
const MODE_FULL = "full";
const MODE_HOLLOW = "hollow";

function toFiniteNumber(value, label) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw new Error(`${label} must be a finite number.`);
  }
  return num;
}

function normalizeShape(value, label) {
  const shape = String(value || "").toLowerCase();
  if (shape !== SHAPE_CIRCLE && shape !== SHAPE_RECTANGLE) {
    throw new Error(`${label} must be "${SHAPE_CIRCLE}" or "${SHAPE_RECTANGLE}".`);
  }
  return shape;
}

function normalizeCoverMode(value) {
  const coverMode = String(value || MODE_FULL).toLowerCase();
  if (coverMode !== MODE_FULL && coverMode !== MODE_HOLLOW) {
    throw new Error(`coverMode must be "${MODE_FULL}" or "${MODE_HOLLOW}".`);
  }
  return coverMode;
}

function normalizeDimensions(shape, raw, label) {
  if (shape === SHAPE_CIRCLE) {
    const diameter = toFiniteNumber(raw?.diameter, `${label}.diameter`);
    if (diameter <= 0) {
      throw new Error(`${label}.diameter must be > 0.`);
    }
    return { diameter };
  }

  const width = toFiniteNumber(raw?.width, `${label}.width`);
  const height = toFiniteNumber(raw?.height, `${label}.height`);
  if (width <= 0 || height <= 0) {
    throw new Error(`${label}.width and ${label}.height must be > 0.`);
  }
  return { width, height };
}

function insetDimensions(shape, dimensions, offset, label) {
  if (shape === SHAPE_CIRCLE) {
    const diameter = dimensions.diameter - 2 * offset;
    if (diameter <= 0) {
      throw new Error(`${label} results in invalid circle diameter <= 0.`);
    }
    return { diameter };
  }

  const width = dimensions.width - 2 * offset;
  const height = dimensions.height - 2 * offset;
  if (width <= 0 || height <= 0) {
    throw new Error(`${label} results in invalid rectangle dimensions <= 0.`);
  }
  return { width, height };
}

function outsetDimensions(shape, dimensions, offset, label) {
  if (shape === SHAPE_CIRCLE) {
    const diameter = dimensions.diameter + 2 * offset;
    if (diameter <= 0) {
      throw new Error(`${label} results in invalid circle diameter <= 0.`);
    }
    return { diameter };
  }

  const width = dimensions.width + 2 * offset;
  const height = dimensions.height + 2 * offset;
  if (width <= 0 || height <= 0) {
    throw new Error(`${label} results in invalid rectangle dimensions <= 0.`);
  }
  return { width, height };
}

function buildPrism(shape, dimensions, zMin, zMax) {
  const height = zMax - zMin;
  const centerZ = (zMin + zMax) / 2;
  if (height <= 0) {
    throw new Error("Invalid prism height <= 0.");
  }

  if (shape === SHAPE_CIRCLE) {
    return cylinder({
      radius: dimensions.diameter / 2,
      height,
      segments: 128,
      center: [0, 0, centerZ]
    });
  }

  return cuboid({
    size: [dimensions.width, dimensions.height, height],
    center: [0, 0, centerZ]
  });
}

function buildFrustum(shape, bottomDimensions, topDimensions, zMin, zMax) {
  const span = zMax - zMin;
  if (span <= 0) {
    throw new Error("Invalid frustum span <= 0.");
  }
  const eps = Math.min(0.05, span / 3);
  const bottomSlice = buildPrism(shape, bottomDimensions, zMin, zMin + eps);
  const topSlice = buildPrism(shape, topDimensions, zMax - eps, zMax);
  return hull(bottomSlice, topSlice);
}

function buildFlatWithChamfer(validated) {
  const { outerShape, outerDimensions, thickness, outerChamfer } = validated;
  const zTop = 0;
  const zBottom = -thickness;

  if (!outerChamfer.enabled || outerChamfer.offset === 0 || outerChamfer.height === 0) {
    return buildPrism(outerShape, outerDimensions, zBottom, zTop);
  }

  const chamferHeight = outerChamfer.height;
  const zChamferBottom = zTop - chamferHeight;
  const topDimensions = insetDimensions(
    outerShape,
    outerDimensions,
    outerChamfer.offset,
    "outerChamfer.offset"
  );

  const parts = [];

  if (zBottom < zChamferBottom - 1e-9) {
    parts.push(buildPrism(outerShape, outerDimensions, zBottom, zChamferBottom));
  }

  parts.push(buildFrustum(outerShape, outerDimensions, topDimensions, zChamferBottom, zTop));

  return union(...parts);
}

function buildInletOuterWithLeadIn(validated) {
  const { innerShape, innerDimensions, inletHeight, thickness, inletLeadIn } = validated;
  const zTop = -thickness;
  const zBottom = -inletHeight;

  if (!inletLeadIn.enabled || inletLeadIn.offset === 0 || inletLeadIn.height === 0) {
    return buildPrism(innerShape, innerDimensions, zBottom, zTop);
  }

  const leadHeight = inletLeadIn.height;
  const zLeadBottom = zTop - leadHeight;
  const topDimensions = outsetDimensions(
    innerShape,
    innerDimensions,
    inletLeadIn.offset,
    "inletLeadIn.offset"
  );

  const parts = [];
  if (zBottom < zLeadBottom - 1e-9) {
    parts.push(buildPrism(innerShape, innerDimensions, zBottom, zLeadBottom));
  }
  parts.push(buildFrustum(innerShape, innerDimensions, topDimensions, zLeadBottom, zTop));
  return union(...parts);
}

export function validateHoleCoverParams(rawParams) {
  const outerShape = normalizeShape(rawParams?.shape?.outer, "shape.outer");
  const innerShape = normalizeShape(rawParams?.shape?.inner, "shape.inner");
  const coverMode = normalizeCoverMode(rawParams?.coverMode);
  const outerDimensions = normalizeDimensions(outerShape, rawParams?.outerDimensions, "outerDimensions");
  const innerDimensions = normalizeDimensions(innerShape, rawParams?.innerDimensions, "innerDimensions");
  const thickness = toFiniteNumber(rawParams?.thickness, "thickness");
  const inletHeight = toFiniteNumber(rawParams?.inletHeight, "inletHeight");
  const inletThickness = toFiniteNumber(rawParams?.inletThickness, "inletThickness");

  if (thickness <= 0) {
    throw new Error("thickness must be > 0.");
  }
  if (inletHeight <= 0) {
    throw new Error("inletHeight must be > 0.");
  }
  if (inletThickness <= 0) {
    throw new Error("inletThickness must be > 0.");
  }
  if (inletHeight < thickness) {
    throw new Error("inletHeight must be >= thickness.");
  }

  const outerChamferEnabled = Boolean(rawParams?.outerChamfer?.enabled);
  const outerChamferHeight = outerChamferEnabled
    ? toFiniteNumber(rawParams?.outerChamfer?.height, "outerChamfer.height")
    : 0;
  const outerChamferOffset = outerChamferEnabled
    ? toFiniteNumber(rawParams?.outerChamfer?.offset, "outerChamfer.offset")
    : 0;

  if (outerChamferEnabled) {
    if (outerChamferHeight <= 0 || outerChamferHeight > thickness) {
      throw new Error("outerChamfer.height must be > 0 and <= thickness.");
    }
    if (outerChamferOffset < 0 || outerChamferOffset > thickness) {
      throw new Error("outerChamfer.offset must be >= 0 and <= thickness.");
    }
  }

  const inletLeadInEnabled = Boolean(rawParams?.inletLeadIn?.enabled);
  const inletLeadInHeight = inletLeadInEnabled
    ? toFiniteNumber(rawParams?.inletLeadIn?.height, "inletLeadIn.height")
    : 0;
  const inletLeadInOffset = inletLeadInEnabled
    ? toFiniteNumber(rawParams?.inletLeadIn?.offset, "inletLeadIn.offset")
    : 0;

  if (inletLeadInEnabled) {
    const availableHeight = inletHeight - thickness;
    if (availableHeight <= 0) {
      throw new Error("inletLeadIn cannot be used when inletHeight <= thickness.");
    }
    if (inletLeadInHeight <= 0 || inletLeadInHeight > availableHeight) {
      throw new Error("inletLeadIn.height must be > 0 and <= (inletHeight - thickness).");
    }
    if (inletLeadInOffset < 0) {
      throw new Error("inletLeadIn.offset must be >= 0.");
    }
    outsetDimensions(innerShape, innerDimensions, inletLeadInOffset, "inletLeadIn.offset");
  }

  // Validate that inlet wall thickness can exist inside the fit envelope.
  insetDimensions(innerShape, innerDimensions, inletThickness, "inletThickness");

  const coverEnabled = Boolean(rawParams?.cover?.enabled);
  const coverKindRaw = coverEnabled ? String(rawParams?.cover?.kind || "whole").toLowerCase() : "none";
  const coverKind = coverKindRaw === "whole" ? "whole" : "none";
  const coverCutoutDegrees = coverEnabled
    ? toFiniteNumber(rawParams?.cover?.cutoutDegrees ?? 0, "cover.cutoutDegrees")
    : 0;

  const coverDiscClearance = coverEnabled
    ? toFiniteNumber(rawParams?.cover?.discClearance ?? 0.2, "cover.discClearance")
    : 0.2;

  if (coverEnabled) {
    if (coverCutoutDegrees < 0 || coverCutoutDegrees > 90) {
      throw new Error("cover.cutoutDegrees must be between 0 and 90.");
    }
    if (coverDiscClearance < 0) {
      throw new Error("cover.discClearance must be >= 0.");
    }
  }

  return {
    outerShape,
    innerShape,
    outerDimensions,
    innerDimensions,
    thickness,
    inletHeight,
    inletThickness,
    coverMode,
    outerChamfer: {
      enabled: outerChamferEnabled,
      height: outerChamferHeight,
      offset: outerChamferOffset
    },
    inletLeadIn: {
      enabled: inletLeadInEnabled,
      height: inletLeadInHeight,
      offset: inletLeadInOffset
    },
    cover: {
      enabled: coverEnabled,
      kind: coverKind,
      cutoutDegrees: coverCutoutDegrees,
      discClearance: coverDiscClearance
    }
  };
}

export function buildHoleCoverGeometry(rawParams) {
  const validated = validateHoleCoverParams(rawParams);
  const flat = buildFlatWithChamfer(validated);
  const inletOuter = buildInletOuterWithLeadIn(validated);
  let geometry = union(flat, inletOuter);

  const inletInnerDimensions = insetDimensions(
    validated.innerShape,
    validated.innerDimensions,
    validated.inletThickness,
    "inletThickness"
  );

  const voidBottom = -validated.inletHeight - 0.05;
  const voidTop = validated.coverMode === MODE_HOLLOW ? 0.05 : -validated.thickness;
  if (voidTop > voidBottom) {
    const innerVoid = buildPrism(validated.innerShape, inletInnerDimensions, voidBottom, voidTop);
    geometry = subtract(geometry, innerVoid);
  }

  // Optional separate cover features (CLI-only for now), circular covers only.
  if (
    validated.cover?.enabled &&
    validated.cover.kind === "whole" &&
    validated.outerShape === SHAPE_CIRCLE &&
    validated.innerShape === SHAPE_CIRCLE &&
    validated.coverMode === MODE_HOLLOW
  ) {
    const voidInnerRadius = inletInnerDimensions.diameter / 2;
    const ringThickness = 2;
    const ringOuterRadius = voidInnerRadius;
    const ringInnerRadiusBottom = ringOuterRadius - ringThickness;
    if (ringInnerRadiusBottom <= 0) {
      throw new Error("cover ring radius invalid; inner diameter too small for 2mm ring.");
    }

    const chamferHeight = validated.outerChamfer.enabled
      ? validated.outerChamfer.height
      : Math.min(2, validated.thickness);
    const ringHeight = chamferHeight;

    // Ring lives entirely inside the hollow inlet, just below the flat:
    // top at z = 0 (flush with cover), bottom at z = -ringHeight.
    const ringTopZ = 0;
    const ringBottomZ = -ringHeight;

    // Outer surface: cylinder at constant radius = voidInnerRadius.
    const ringOuterDims = { diameter: ringOuterRadius * 2 };
    const ringOuterSolid = buildPrism(SHAPE_CIRCLE, ringOuterDims, ringBottomZ, ringTopZ);

    // Inner surface: frustum from radius = ringOuterRadius at top down to (ringOuterRadius - 2mm) at bottom.
    const ringInnerTopDims = { diameter: ringOuterRadius * 2 };
    const ringInnerBottomDims = { diameter: ringInnerRadiusBottom * 2 };
    const ringInnerFrustum = buildFrustum(
      SHAPE_CIRCLE,
      ringInnerBottomDims,
      ringInnerTopDims,
      ringBottomZ,
      ringTopZ
    );

    const coverRing = subtract(ringOuterSolid, ringInnerFrustum);

    // Cover disc: printed as a separate solid above the ring, with inverse chamfer
    // Move it up by 30mm in Z so it slices as a clearly separate part.
    const discBottomZ = ringTopZ + 30;
    const discTopZ = discBottomZ + chamferHeight;
    const discClearance = validated.cover.discClearance ?? 0.2;
    const discOuterRadius = ringOuterRadius - discClearance;
    const discInnerRadius = discOuterRadius - ringThickness;
    if (discInnerRadius <= 0) {
      throw new Error("cover disc geometry invalid; disc radius too small.");
    }

    const discBottomDims = { diameter: discInnerRadius * 2 };
    const discTopDims = { diameter: discOuterRadius * 2 };
    let coverDisc = buildFrustum(
      SHAPE_CIRCLE,
      discBottomDims,
      discTopDims,
      discBottomZ,
      discTopZ
    );

    // Optional simple 90° quadrant cut-out from the disc when cutoutDegrees = 90.
    if (validated.cover.cutoutDegrees >= 89.9) {
      const cutSize = discOuterRadius * 2 + 2;
      const cutHeight = discTopZ - discBottomZ + 2;
      const cutBlock = cuboid({
        size: [cutSize, cutSize, cutHeight],
        center: [cutSize / 4, cutSize / 4, discBottomZ + cutHeight / 2]
      });
      coverDisc = subtract(coverDisc, cutBlock);
    }

    geometry = union(geometry, coverRing, coverDisc);
  }

  return {
    geometry,
    meta: {
      coverMode: validated.coverMode,
      outerShape: validated.outerShape,
      innerShape: validated.innerShape,
      thickness: validated.thickness,
      inletHeight: validated.inletHeight,
      inletThickness: validated.inletThickness
    }
  };
}

export function buildHoleCoverStl(params, options = {}) {
  const { geometry, meta } = buildHoleCoverGeometry(params);
  const name = (options.name || `hole_cover_${meta.coverMode}`).replace(/\s+/g, "_");
  const serialized = serialize({ binary: false, statusCallback: null }, geometry);
  const stl = Array.isArray(serialized) ? serialized.join("") : String(serialized);
  const stlWithName = stl
    .replace(/^solid jscad/i, `solid ${name}`)
    .replace(/endsolid jscad\s*$/i, `endsolid ${name}`);
  return { stl: stlWithName, meta };
}
