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
