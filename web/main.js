function toFiniteNumber(raw, label) {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }
  return value;
}

function setStatus(message, isError = false) {
  const body = document.querySelector("#status .status-body");
  if (!body) return;
  body.textContent = String(message);
  body.style.color = isError ? "crimson" : "";
}

function downloadTextFile(filename, content) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function collectParamsFromForm(form) {
  const outerShape = String(form.shapeOuter.value || "circle").toLowerCase();
  const innerShape = String(form.shapeInner.value || "circle").toLowerCase();
  const inletHeight = toFiniteNumber(form.inletHeight.value, "Inlet depth");
  const thickness = toFiniteNumber(form.thickness.value, "Cover thickness");
  const inletThickness = toFiniteNumber(form.inletThickness.value, "Inlet wall thickness");
  const coverMode = String(form.coverMode.value || "full").toLowerCase();

  if (outerShape !== "circle" && outerShape !== "rectangle") {
    throw new Error('Outer shape must be "circle" or "rectangle".');
  }
  if (innerShape !== "circle" && innerShape !== "rectangle") {
    throw new Error('Inner shape must be "circle" or "rectangle".');
  }
  if (inletHeight <= 0) {
    throw new Error("Inlet depth must be greater than 0mm.");
  }
  if (thickness <= 0) {
    throw new Error("Cover thickness must be greater than 0mm.");
  }
  if (inletThickness <= 0) {
    throw new Error("Inlet wall thickness must be greater than 0mm.");
  }
  if (inletHeight < thickness) {
    throw new Error("Inlet depth must be >= cover thickness.");
  }
  if (coverMode !== "full" && coverMode !== "hollow") {
    throw new Error('Cover mode must be "full" or "hollow".');
  }

  let outerDimensions;
  if (outerShape === "circle") {
    const outerDiameter = toFiniteNumber(form.outerDiameter.value, "Outer diameter");
    if (outerDiameter <= 0) {
      throw new Error("Outer diameter must be greater than 0mm.");
    }
    outerDimensions = { diameter: outerDiameter };
  } else {
    const outerWidth = toFiniteNumber(form.outerWidth.value, "Outer width");
    const outerHeight = toFiniteNumber(form.outerHeight.value, "Outer height");
    if (outerWidth <= 0 || outerHeight <= 0) {
      throw new Error("Outer width and height must be greater than 0mm.");
    }
    outerDimensions = { width: outerWidth, height: outerHeight };
  }

  let innerDimensions;
  if (innerShape === "circle") {
    const innerDiameter = toFiniteNumber(form.innerDiameter.value, "Inner diameter");
    if (innerDiameter <= 0) {
      throw new Error("Inner diameter must be greater than 0mm.");
    }
    innerDimensions = { diameter: innerDiameter };
  } else {
    const innerWidth = toFiniteNumber(form.innerWidth.value, "Inner width");
    const innerHeight = toFiniteNumber(form.innerHeight.value, "Inner height");
    if (innerWidth <= 0 || innerHeight <= 0) {
      throw new Error("Inner width and height must be greater than 0mm.");
    }
    innerDimensions = { width: innerWidth, height: innerHeight };
  }

  const outerChamferEnabled = Boolean(form.outerChamferEnabled.checked);
  const outerChamferHeight = toFiniteNumber(
    form.outerChamferHeight.value,
    "Chamfer height"
  );
  const outerChamferOffset = toFiniteNumber(
    form.outerChamferOffset.value,
    "Chamfer inset"
  );

  if (outerChamferEnabled) {
    if (outerChamferHeight <= 0 || outerChamferHeight > thickness) {
      throw new Error("Chamfer height must be > 0 and <= cover thickness.");
    }
    if (outerChamferOffset < 0 || outerChamferOffset > thickness) {
      throw new Error("Chamfer inset must be >= 0 and <= cover thickness.");
    }
  }

  const inletLeadInEnabled = Boolean(form.inletLeadInEnabled.checked);
  const inletLeadInHeight = toFiniteNumber(
    form.inletLeadInHeight.value,
    "Lead-in height"
  );
  const inletLeadInOffset = toFiniteNumber(
    form.inletLeadInOffset.value,
    "Lead-in offset"
  );

  if (inletLeadInEnabled) {
    const availableHeight = inletHeight - thickness;
    if (availableHeight <= 0) {
      throw new Error("Inlet lead-in cannot be used when inlet depth <= cover thickness.");
    }
    if (inletLeadInHeight <= 0 || inletLeadInHeight > availableHeight) {
      throw new Error(
        "Lead-in height must be > 0 and <= (inlet depth - cover thickness)."
      );
    }
    if (inletLeadInOffset < 0) {
      throw new Error("Lead-in offset must be >= 0mm.");
    }
  }

  return {
    outerShape,
    innerShape,
    outerDimensions,
    innerDimensions,
    inletHeight,
    thickness,
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

function buildFilename(params) {
  const pad = (value) => String(Math.round(value)).padStart(2, "0");
  let outerLabel;
  let innerLabel;

  if (params.outerShape === "circle" && params.outerDimensions?.diameter != null) {
    outerLabel = `${pad(params.outerDimensions.diameter)}mm`;
  } else if (params.outerShape === "rectangle" && params.outerDimensions) {
    outerLabel = `${pad(params.outerDimensions.width)}x${pad(params.outerDimensions.height)}mm`;
  } else {
    outerLabel = "outer_custom";
  }

  if (params.innerShape === "circle" && params.innerDimensions?.diameter != null) {
    innerLabel = `${pad(params.innerDimensions.diameter)}mm`;
  } else if (params.innerShape === "rectangle" && params.innerDimensions) {
    innerLabel = `${pad(params.innerDimensions.width)}x${pad(params.innerDimensions.height)}mm`;
  } else {
    innerLabel = "inner_custom";
  }

  const depthLabel = pad(params.inletHeight);
  const mode = params.coverMode;
  return `cover_outer_${outerLabel}_inner_${innerLabel}_depth_${depthLabel}mm_${mode}.stl`;
}

function buildHoleCoverStlBrowser(params) {
  const name = `hole_cover_${params.coverMode}`;
  const triangles = [];

  function addTri(p1, p2, p3) {
    triangles.push([p1, p2, p3]);
  }

  const flangeThickness = params.thickness;
  const inletHeight = params.inletHeight;

  // Handle circular covers with a proper hollow inlet and optional through-hole
  if (
    params.outerShape === "circle" &&
    params.innerShape === "circle" &&
    params.outerDimensions?.diameter &&
    params.innerDimensions?.diameter
  ) {
    const outerR = params.outerDimensions.diameter / 2;
    const inletOuterR = params.innerDimensions.diameter / 2;
    const inletInnerR = inletOuterR - params.inletThickness;
    if (inletInnerR <= 0) {
      throw new Error("Inlet thickness too large: inner radius must be > 0.");
    }
    const segments = 96;

    const zTop = 0;
    const zFlangeBottom = -flangeThickness;
    const zInletBottom = -inletHeight;
    const zVoidTop = params.coverMode === "hollow" ? zTop : zFlangeBottom;

    function ring(radius, z) {
      const pts = [];
      const twoPi = Math.PI * 2;
      for (let i = 0; i < segments; i += 1) {
        const a = (twoPi * i) / segments;
        pts.push([radius * Math.cos(a), radius * Math.sin(a), z]);
      }
      return pts;
    }

    // Outer flange: solid disc from zFlangeBottom to zTop with optional chamfer
    (function buildFlange() {
      const bottomCenter = [0, 0, zFlangeBottom];
      const chamfer = params.outerChamfer || {};
      const chamferEnabled = Boolean(chamfer.enabled) && chamfer.height > 0 && chamfer.offset !== 0;

      if (!chamferEnabled) {
        const topCenter = [0, 0, zTop];
        const ringTop = ring(outerR, zTop);
        const ringBottom = ring(outerR, zFlangeBottom);

        for (let i = 0; i < segments; i += 1) {
          const j = (i + 1) % segments;

          const v0Top = ringTop[i];
          const v1Top = ringTop[j];
          const v0Bottom = ringBottom[i];
          const v1Bottom = ringBottom[j];

          // Top disk
          addTri(topCenter, v0Top, v1Top);
          // Bottom disk
          addTri(bottomCenter, v1Bottom, v0Bottom);

          // Side wall of flange
          addTri(v0Bottom, v0Top, v1Top);
          addTri(v0Bottom, v1Top, v1Bottom);
        }
        return;
      }

      const chamferHeight = Math.min(chamfer.height, flangeThickness);
      const zChamferBottom = zTop - chamferHeight;
      const topRadius = outerR - chamfer.offset;
      if (topRadius <= 0) {
        throw new Error("Chamfer offset too large: top radius must be > 0.");
      }

      const ringBottom = ring(outerR, zFlangeBottom);
      const ringChamferBottom = ring(outerR, zChamferBottom);
      const ringChamferTop = ring(topRadius, zTop);
      const topCenter = [0, 0, zTop];

      // Bottom disk at full radius
      for (let i = 0; i < segments; i += 1) {
        const j = (i + 1) % segments;
        const v0 = ringBottom[i];
        const v1 = ringBottom[j];
        addTri(bottomCenter, v1, v0);
      }

      // Cylindrical wall from bottom to chamfer start (if any)
      if (zFlangeBottom < zChamferBottom) {
        for (let i = 0; i < segments; i += 1) {
          const j = (i + 1) % segments;
          const a = ringBottom[i];
          const b = ringBottom[j];
          const c = ringChamferBottom[i];
          const d = ringChamferBottom[j];
          addTri(a, b, c);
          addTri(b, d, c);
        }
      }

      // Chamfer frustum from chamfer bottom to top (outerR → topRadius)
      for (let i = 0; i < segments; i += 1) {
        const j = (i + 1) % segments;
        const a = ringChamferBottom[i];
        const b = ringChamferBottom[j];
        const c = ringChamferTop[i];
        const d = ringChamferTop[j];
        addTri(a, b, c);
        addTri(b, d, c);
      }

      // Top disk at reduced radius
      for (let i = 0; i < segments; i += 1) {
        const j = (i + 1) % segments;
        const v0 = ringChamferTop[i];
        const v1 = ringChamferTop[j];
        addTri(topCenter, v0, v1);
      }
    })();

    // Inlet outer shell from zInletBottom to zFlangeBottom (with optional lead-in chamfer)
    (function buildInletOuter() {
      const lead = params.inletLeadIn || {};
      const leadEnabled =
        Boolean(lead.enabled) && lead.height > 0 && lead.offset && lead.offset > 0;

      if (!leadEnabled) {
        const ringBottom = ring(inletOuterR, zInletBottom);
        const ringTop = ring(inletOuterR, zFlangeBottom);
        for (let i = 0; i < segments; i += 1) {
          const j = (i + 1) % segments;
          const a = ringBottom[i];
          const b = ringBottom[j];
          const c = ringTop[i];
          const d = ringTop[j];
          addTri(a, b, c);
          addTri(b, d, c);
        }
        return;
      }

      const maxLeadHeight = inletHeight - flangeThickness;
      const leadHeight = Math.min(lead.height, Math.max(0, maxLeadHeight));
      if (leadHeight <= 0) {
        // Fallback to straight wall if no space for lead-in
        const ringBottom = ring(inletOuterR, zInletBottom);
        const ringTop = ring(inletOuterR, zFlangeBottom);
        for (let i = 0; i < segments; i += 1) {
          const j = (i + 1) % segments;
          const a = ringBottom[i];
          const b = ringBottom[j];
          const c = ringTop[i];
          const d = ringTop[j];
          addTri(a, b, c);
          addTri(b, d, c);
        }
        return;
      }

      const zLeadBottom = zFlangeBottom - leadHeight;
      const expandedR = inletOuterR + lead.offset;

      // Straight section from inlet bottom to lead-in bottom
      const ringBottom = ring(inletOuterR, zInletBottom);
      const ringLeadBottom = ring(inletOuterR, zLeadBottom);
      for (let i = 0; i < segments; i += 1) {
        const j = (i + 1) % segments;
        const a = ringBottom[i];
        const b = ringBottom[j];
        const c = ringLeadBottom[i];
        const d = ringLeadBottom[j];
        addTri(a, b, c);
        addTri(b, d, c);
      }

      // Lead-in frustum from lead-in bottom to flange bottom (inletOuterR → expandedR)
      const ringLeadTop = ring(expandedR, zFlangeBottom);
      for (let i = 0; i < segments; i += 1) {
        const j = (i + 1) % segments;
        const a = ringLeadBottom[i];
        const b = ringLeadBottom[j];
        const c = ringLeadTop[i];
        const d = ringLeadTop[j];
        addTri(a, b, c);
        addTri(b, d, c);
      }
    })();

    // Inlet inner void shell from zInletBottom to zVoidTop, leaving wall thickness
    (function buildInletInner() {
      const ringBottomInner = ring(inletInnerR, zInletBottom);
      const ringTopInner = ring(inletInnerR, zVoidTop);
      for (let i = 0; i < segments; i += 1) {
        const j = (i + 1) % segments;
        const a = ringBottomInner[i];
        const b = ringBottomInner[j];
        const c = ringTopInner[i];
        const d = ringTopInner[j];
        // Reverse orientation so normals point into the void
        addTri(c, b, a);
        addTri(c, d, b);
      }
    })();

    // Close bottom of inlet wall with an annular ring at zInletBottom
    (function buildInletBottomRing() {
      const ringOuter = ring(inletOuterR, zInletBottom);
      const ringInner = ring(inletInnerR, zInletBottom);
      for (let i = 0; i < segments; i += 1) {
        const j = (i + 1) % segments;
        const o1 = ringOuter[i];
        const o2 = ringOuter[j];
        const i1 = ringInner[i];
        const i2 = ringInner[j];
        // Bottom faces outward (approx -Z)
        addTri(o1, o2, i1);
        addTri(o2, i2, i1);
      }
    })();

    // For full covers, close void top at zFlangeBottom so the flat is solid
    if (params.coverMode === "full") {
      (function buildVoidTopRing() {
        const ringOuter = ring(inletOuterR, zFlangeBottom);
        const ringInner = ring(inletInnerR, zFlangeBottom);
        for (let i = 0; i < segments; i += 1) {
          const j = (i + 1) % segments;
          const o1 = ringOuter[i];
          const o2 = ringOuter[j];
          const i1 = ringInner[i];
          const i2 = ringInner[j];
          // Top of void region (faces into void)
          addTri(i1, o2, o1);
          addTri(i1, i2, o2);
        }
      })();
    }
  } else {
    // Fallback: outer solid only (rectangle or circle), as before
    const height = Math.max(inletHeight, flangeThickness);
    const zBottom = 0;
    const zTop = height;

    if (params.outerShape === "rectangle" && params.outerDimensions?.width && params.outerDimensions?.height) {
      const w = params.outerDimensions.width;
      const h = params.outerDimensions.height;
      const hx = w / 2;
      const hy = h / 2;

      const v000 = [-hx, -hy, zBottom];
      const v100 = [hx, -hy, zBottom];
      const v010 = [-hx, hy, zBottom];
      const v110 = [hx, hy, zBottom];
      const v001 = [-hx, -hy, zTop];
      const v101 = [hx, -hy, zTop];
      const v011 = [-hx, hy, zTop];
      const v111 = [hx, hy, zTop];

      addTri(v000, v100, v110);
      addTri(v000, v110, v010);
      addTri(v001, v011, v111);
      addTri(v001, v111, v101);
      addTri(v000, v010, v011);
      addTri(v000, v011, v001);
      addTri(v100, v101, v111);
      addTri(v100, v111, v110);
      addTri(v000, v001, v101);
      addTri(v000, v101, v100);
      addTri(v010, v110, v111);
      addTri(v010, v111, v011);
    } else if (params.outerShape === "circle" && params.outerDimensions?.diameter) {
      const r = params.outerDimensions.diameter / 2;
      const segments = 96;
      const twoPi = Math.PI * 2;

      for (let i = 0; i < segments; i += 1) {
        const a0 = (twoPi * i) / segments;
        const a1 = (twoPi * (i + 1)) / segments;
        const x0 = r * Math.cos(a0);
        const y0 = r * Math.sin(a0);
        const x1 = r * Math.cos(a1);
        const y1 = r * Math.sin(a1);

        const topCenter = [0, 0, zTop];
        const bottomCenter = [0, 0, zBottom];
        const v0Top = [x0, y0, zTop];
        const v1Top = [x1, y1, zTop];
        const v0Bottom = [x0, y0, zBottom];
        const v1Bottom = [x1, y1, zBottom];

        addTri(topCenter, v0Top, v1Top);
        addTri(bottomCenter, v1Bottom, v0Bottom);
        addTri(v0Bottom, v0Top, v1Top);
        addTri(v0Bottom, v1Top, v1Bottom);
      }
    } else {
      const s = 1;
      const hx = s / 2;
      const hy = s / 2;
      const hz = s / 2;
      const v000 = [-hx, -hy, -hz];
      const v100 = [hx, -hy, -hz];
      const v010 = [-hx, hy, -hz];
      const v110 = [hx, hy, -hz];
      const v001 = [-hx, -hy, hz];
      const v101 = [hx, -hy, hz];
      const v011 = [-hx, hy, hz];
      const v111 = [hx, hy, hz];

      addTri(v000, v100, v110);
      addTri(v000, v110, v010);
      addTri(v001, v011, v111);
      addTri(v001, v111, v101);
      addTri(v000, v010, v011);
      addTri(v000, v011, v001);
      addTri(v100, v101, v111);
      addTri(v100, v111, v110);
      addTri(v000, v001, v101);
      addTri(v000, v101, v100);
      addTri(v010, v110, v111);
      addTri(v010, v111, v011);
    }
  }

  function triNormal(tri) {
    const a = tri[0];
    const b = tri[1];
    const c = tri[2];
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    return [nx / len, ny / len, nz / len];
  }

  let out = "";
  out += `solid ${name}\n`;
  for (const tri of triangles) {
    const n = triNormal(tri);
    out += `  facet normal ${n[0]} ${n[1]} ${n[2]}\n`;
    out += "    outer loop\n";
    out += `      vertex ${tri[0][0]} ${tri[0][1]} ${tri[0][2]}\n`;
    out += `      vertex ${tri[1][0]} ${tri[1][1]} ${tri[1][2]}\n`;
    out += `      vertex ${tri[2][0]} ${tri[2][1]} ${tri[2][2]}\n`;
    out += "    endloop\n";
    out += "  endfacet\n";
  }
  out += `endsolid ${name}\n`;

  return {
    stl: out,
    meta: {
      coverMode: params.coverMode
    }
  };
}

function handleSubmit(event) {
  event.preventDefault();
  try {
    const form = event.target;
    const params = collectParamsFromForm(form);
    const filename = buildFilename(params);
    const { stl, meta } = buildHoleCoverStlBrowser(params);

    downloadTextFile(filename, stl);

    const summary = [
      `Downloaded: ${filename}`,
      "",
      `Mode: ${meta.coverMode}`,
      params.outerShape === "circle" && params.outerDimensions?.diameter != null
        ? `Outer: circle, diameter ${params.outerDimensions.diameter.toFixed(2)}mm`
        : params.outerShape === "rectangle" && params.outerDimensions
        ? `Outer: rectangle, ${params.outerDimensions.width.toFixed(
            2
          )} × ${params.outerDimensions.height.toFixed(2)}mm`
        : "Outer: custom",
      params.innerShape === "circle" && params.innerDimensions?.diameter != null
        ? `Inner: circle, diameter ${params.innerDimensions.diameter.toFixed(2)}mm`
        : params.innerShape === "rectangle" && params.innerDimensions
        ? `Inner: rectangle, ${params.innerDimensions.width.toFixed(
            2
          )} × ${params.innerDimensions.height.toFixed(2)}mm`
        : "Inner: custom",
      `Inlet depth: ${params.inletHeight.toFixed(2)}mm`,
      `Cover thickness: ${params.thickness.toFixed(2)}mm`,
      `Inlet wall: ${params.inletThickness.toFixed(2)}mm`,
      params.outerChamfer.enabled
        ? `Outer chamfer: ${params.outerChamfer.height.toFixed(
            2
          )}mm high, inset ${params.outerChamfer.offset.toFixed(2)}mm`
        : "Outer chamfer: disabled",
      params.inletLeadIn.enabled
        ? `Inlet lead-in: ${params.inletLeadIn.height.toFixed(
            2
          )}mm high, offset ${params.inletLeadIn.offset.toFixed(2)}mm`
        : "Inlet lead-in: disabled"
    ].join("\n");

    setStatus(summary, false);
  } catch (error) {
    setStatus(error.message || String(error), true);
  }
}

function main() {
  const form = document.getElementById("generator-form");
  if (!form) {
    return;
  }

  function updateShapeFieldsVisibility() {
    const outerShape = String(form.shapeOuter.value || "circle").toLowerCase();
    const innerShape = String(form.shapeInner.value || "circle").toLowerCase();

    const outerCircleEls = form.querySelectorAll(".outer-circle-only");
    const outerRectEls = form.querySelectorAll(".outer-rect-only");
    const innerCircleEls = form.querySelectorAll(".inner-circle-only");
    const innerRectEls = form.querySelectorAll(".inner-rect-only");

    outerCircleEls.forEach((el) => {
      el.closest(".field").style.display = outerShape === "circle" ? "" : "none";
    });
    outerRectEls.forEach((el) => {
      el.closest(".field").style.display = outerShape === "rectangle" ? "" : "none";
    });

    innerCircleEls.forEach((el) => {
      el.closest(".field").style.display = innerShape === "circle" ? "" : "none";
    });
    innerRectEls.forEach((el) => {
      el.closest(".field").style.display = innerShape === "rectangle" ? "" : "none";
    });
  }

  form.addEventListener("submit", handleSubmit);
  form.shapeOuter.addEventListener("change", updateShapeFieldsVisibility);
  form.shapeInner.addEventListener("change", updateShapeFieldsVisibility);
  updateShapeFieldsVisibility();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", main);
} else {
  main();
}

