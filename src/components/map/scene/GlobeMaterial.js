import * as THREE from "three";

// One material for the whole globe: charcoal land with baked soft relief from the
// mask texture, cyan latitude hatch on the ocean, simple fixed key light.
export function createGlobeMaterial(landTex, c) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uLand: { value: landTex },
      uLandA: { value: new THREE.Color(c.landDark) },
      uLandB: { value: new THREE.Color(c.landLight) },
      uOcean: { value: new THREE.Color(c.ocean) },
      uHatch: { value: new THREE.Color(c.hatch) },
      uLines: { value: 360.0 },
      uLightDir: { value: new THREE.Vector3(-0.4, 0.6, 0.7).normalize() },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vPosObj;
      void main() {
        vUv = uv;
        vPosObj = position;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uLand;
      uniform vec3 uLandA, uLandB, uOcean, uHatch, uLightDir;
      uniform float uLines;
      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vPosObj;
      void main() {
        vec4 m = texture2D(uLand, vUv);
        float land = smoothstep(0.35, 0.65, m.r);
        float relief = m.g;
        // Latitude hatch: parallel lines, antialiased, faded where too dense.
        float lat = asin(clamp(normalize(vPosObj).y, -1.0, 1.0));
        float coord = lat * uLines / 3.14159265;
        float fw = max(fwidth(coord), 1e-4);
        float d = 0.5 - abs(fract(coord) - 0.5);
        float line = 1.0 - smoothstep(0.0, fw * 0.9, d);
        float fade = clamp((1.0 / fw - 3.0) / 3.0, 0.0, 1.0);
        vec3 ocean = mix(uOcean, uHatch, line * 0.22 * fade);
        vec3 ground = mix(uLandA, uLandB, relief);
        vec3 col = mix(ocean, ground, land);
        float lambert = 0.72 + 0.28 * max(dot(normalize(vNormalW), uLightDir), 0.0);
        gl_FragColor = vec4(col * lambert, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}
