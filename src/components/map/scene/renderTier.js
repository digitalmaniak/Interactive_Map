// WebGL capability probe. Returns "static" when the device should not run the
// live globe at all: no WebGL, a software rasterizer (SwiftShader, llvmpipe,
// Microsoft Basic Render, etc.), or a context that reports a major performance
// caveat. Software rendering is treated as the lowest tier. Cached per page load.
const SOFTWARE_RE = /swiftshader|llvmpipe|softpipe|software|basic render|mesa offscreen/i;

let cached = null;

export function detectRenderTier() {
  if (cached) return cached;
  if (typeof window === "undefined" || typeof document === "undefined") return "webgl";
  cached = probe();
  return cached;
}

function probe() {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) return "static";
    let renderer = "";
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    if (info) renderer = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) || "");
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    if (SOFTWARE_RE.test(renderer)) return "static";

    // Browsers that hide the renderer string still refuse this flag on software paths.
    const strict = document.createElement("canvas");
    const sgl = strict.getContext("webgl", { failIfMajorPerformanceCaveat: true });
    if (!sgl) return "static";
    sgl.getExtension("WEBGL_lose_context")?.loseContext();
    return "webgl";
  } catch {
    return "static";
  }
}
