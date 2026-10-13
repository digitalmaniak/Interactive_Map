import * as THREE from "three";
import { tokens } from "./tokens";

const C = tokens.color;

// One material for the whole globe. Land: baked relief from the mask texture
// (R = land, G = relief). Ocean: fill darkening to the limb plus a screen space
// diagonal hatch at 35 degrees, computed from gl_FragCoord so it stays crisp at any zoom.
// opts.cheap: no ocean hatch (force3d on software graphics).
export function createGlobeMaterial(landTex, opts = {}) {
  const a = THREE.MathUtils.degToRad(tokens.hatch.angleDeg);
  return new THREE.ShaderMaterial({
    defines: opts.cheap ? { CHEAP: "" } : {},
    // Push the globe surface back in depth so border lines never sink into it.
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 4,
    uniforms: {
      uLand: { value: landTex },
      uLow: { value: new THREE.Color(C.land.low) },
      uHigh: { value: new THREE.Color(C.land.high) },
      uRidge: { value: new THREE.Color(C.land.ridge) },
      uOcean: { value: new THREE.Color(C.ocean.fill) },
      uLimb: { value: new THREE.Color(C.ocean.limb) },
      uHatch: { value: new THREE.Color(C.ocean.hatch) },
      uHatchOpacity: { value: C.ocean.hatchOpacity },
      uHatchDir: { value: new THREE.Vector2(-Math.sin(a), Math.cos(a)) },
      uHatchSpacing: { value: tokens.hatch.spacingPx.globe },
      uDpr: { value: 1 },
      uReliefMix: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vPosW;
      void main() {
        vUv = uv;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vPosW = w.xyz;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uLand;
      uniform vec3 uLow, uHigh, uRidge, uOcean, uLimb, uHatch;
      uniform float uHatchOpacity, uHatchSpacing, uDpr, uReliefMix;
      uniform vec2 uHatchDir;
      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vPosW;
      void main() {
        vec4 m = texture2D(uLand, vUv);
        // Land edge width follows screen space derivatives so the coast stays crisp when the
        // mask is magnified up close, and soft (not aliased) when it is minified.
        float lw = clamp(fwidth(m.r) * 1.5, 0.02, 0.15);
        float land = smoothstep(0.5 - lw, 0.5 + lw, m.r);
        // Relief fades to a flat mid tone near the surface (uReliefMix from altitude).
        float relief = mix(0.35, m.g, uReliefMix);
        vec3 viewDir = normalize(cameraPosition - vPosW);
        float facing = clamp(dot(normalize(vNormalW), viewDir), 0.0, 1.0);
        // Ocean darkens toward the limb.
        vec3 ocean = mix(uLimb, uOcean, smoothstep(0.0, 0.6, facing));
        #ifndef CHEAP
        // Screen space hatch, 1 px lines with a 0.75 px edge.
        float s = dot(gl_FragCoord.xy / uDpr, uHatchDir);
        float h = abs(fract(s / uHatchSpacing) - 0.5) * uHatchSpacing;
        // Antialias width from fwidth: about one device pixel at any zoom or dpr, no shimmer.
        float aa = max(fwidth(s), 1e-4);
        float line = 1.0 - smoothstep(0.5, 0.5 + aa, h);
        // Fade to 0 over the last 15 percent toward the limb, and lift slightly near coasts.
        float limbFade = smoothstep(0.0, 0.15, facing);
        float nearCoast = mix(0.08, 0.14, smoothstep(0.0, 0.25, 1.0 - m.b)) / 0.14;
        ocean = mix(ocean, uHatch, line * uHatchOpacity * limbFade * nearCoast);
        #endif
        // Baked relief: low to high, ridge used sparingly at the top of the range.
        vec3 ground = mix(uLow, uHigh, smoothstep(0.0, 0.8, relief));
        ground = mix(ground, uRidge, smoothstep(0.85, 1.0, relief) * 0.6);
        ground *= mix(0.82, 1.0, facing);
        gl_FragColor = vec4(mix(ocean, ground, land), 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}

// Fresnel atmosphere rim at 1.015 R, back side, additive.
export function createAtmosphereMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(C.atmo) }, uOpacity: { value: C.atmoOpacity } },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vP;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vP = w.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec3 vN;
      varying vec3 vP;
      void main() {
        vec3 v = normalize(cameraPosition - vP);
        float f = pow(1.0 - abs(dot(normalize(vN), v)), 3.0) * uOpacity;
        gl_FragColor = vec4(uColor * f, f);
      }
    `,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
}

// Stop beams: thin vertical quads on the surface normal, billboarded around that
// axis, additive, fading to the top with pow(1 - t, 1.6). One instanced draw call.
export function createBeamMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uHeight: { value: tokens.beam.heightR.globe }, uWidth: { value: 0.004 }, uGrow: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aAlpha;
      uniform float uHeight, uWidth, uGrow;
      varying float vT;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vec3 base = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vec3 up = normalize(base);
        vec3 toCam = normalize(cameraPosition - base);
        vec3 side = normalize(cross(up, toCam));
        float t = position.y + 0.5;
        vT = t;
        vColor = aColor;
        vAlpha = aAlpha;
        float dist = length(cameraPosition - base);
        vec3 p = base + up * t * uHeight * uGrow + side * position.x * uWidth * dist;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vT;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float a = pow(1.0 - vT, 1.6) * vAlpha;
        gl_FragColor = vec4(vColor * a, a);
      }
    `,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
}
