import * as THREE from "three";

// Fine parallel cyan hatch over the v2 ocean colour. Lines live in world
// space so they pan and zoom with the map, antialiased via screen derivatives.
export function createOceanMaterial({ base = "#2D3A42", hatch = "#5CC8E4", spacing = 5, opacity = 0.22 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uBase: { value: new THREE.Color(base) },
      uHatch: { value: new THREE.Color(hatch) },
      uSpacing: { value: spacing },
      uOpacity: { value: opacity },
    },
    vertexShader: /* glsl */ `
      varying vec2 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xy;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uBase;
      uniform vec3 uHatch;
      uniform float uSpacing;
      uniform float uOpacity;
      varying vec2 vWorld;
      void main() {
        float coord = vWorld.y / uSpacing;
        float fw = max(fwidth(coord), 1e-4);
        float d = abs(fract(coord) - 0.5);
        float line = 1.0 - smoothstep(0.0, fw * 0.9, 0.5 - d);
        // Fade hatch out when lines get denser than ~3px to avoid moire.
        float fade = clamp((1.0 / fw - 3.0) / 3.0, 0.0, 1.0);
        vec3 col = mix(uBase, uHatch, line * uOpacity * fade);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}
