/* =========================================================
   GLSL FIRE & FLUID COMBUSTION SHADER - REFINED
   Organic Fluid Combustion, Crisp Forest Alignment & Licking Flames
   ========================================================= */

export const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export const fragmentShader = /* glsl */ `
  precision highp float;

  uniform sampler2D u_texForest;    // estado1: Bosque verde frondoso
  uniform sampler2D u_texFire;      // estado2: Bosque en llamas
  uniform sampler2D u_burnMap;      // Mapa acumulativo de contacto / calor
  
  uniform float u_time;
  uniform vec2 u_resolution;
  uniform vec2 u_texResolution;     // 1376.0, 768.0
  uniform float u_flameIntensity;
  uniform float u_edgeWidth;
  uniform int u_fitMode;            // 0: cover, 1: contain
  uniform vec2 u_contactPos;        // Posición normalizada de contacto actual
  uniform float u_contactActive;    // 1.0 si hay contacto activo

  varying vec2 vUv;

  // --- GLSL SIMPLEX NOISE ---
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187,
                        0.366025403784439,
                       -0.577350269189626,
                        0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy) );
    vec2 x0 = v -   i + dot(i, C.xx);
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
      + i.x + vec3(0.0, i1.x, 1.0 ));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m;
    m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  // Multi-octave Fractal Brownian Motion
  float fbm(vec2 p) {
    float val = 0.0;
    float amp = 0.5;
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
    for (int i = 0; i < 4; i++) {
      val += amp * (snoise(p) * 0.5 + 0.5);
      p = rot * p * 2.04 + vec2(100.0);
      amp *= 0.5;
    }
    return val;
  }

  // Aspect-ratio UV calculation (Cover / Contain)
  vec2 getAspectUV(vec2 uv, vec2 screenRes, vec2 texRes, int fit) {
    float screenAspect = screenRes.x / screenRes.y;
    float texAspect = texRes.x / texRes.y;
    vec2 newUv = uv;

    if (fit == 0) { // Cover
      if (screenAspect > texAspect) {
        float r = texAspect / screenAspect;
        newUv.y = (uv.y - 0.5) * r + 0.5;
      } else {
        float r = screenAspect / texAspect;
        newUv.x = (uv.x - 0.5) * r + 0.5;
      }
    } else { // Contain
      if (screenAspect > texAspect) {
        float r = screenAspect / texAspect;
        newUv.x = (uv.x - 0.5) * r + 0.5;
      } else {
        float r = texAspect / screenAspect;
        newUv.y = (uv.y - 0.5) * r + 0.5;
      }
    }
    return newUv;
  }

  void main() {
    // 1. Calculate proper image UVs based on screen aspect ratio
    vec2 uv = getAspectUV(vUv, u_resolution, u_texResolution, u_fitMode);

    // Letterbox in contain mode
    if (u_fitMode == 1 && (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0)) {
      gl_FragColor = vec4(0.02, 0.02, 0.03, 1.0);
      return;
    }

    // 2. FLUID DOMAIN WARPING
    // Fluid turbulence deforms geometric lines into turbulent flowing fire eddies
    vec2 pWarp = uv * 4.5;
    vec2 q = vec2(
      fbm(pWarp + vec2(0.0, -u_time * 0.35)),
      fbm(pWarp + vec2(5.2, 1.3 - u_time * 0.28))
    );
    vec2 r = vec2(
      fbm(pWarp + 3.0 * q + vec2(1.7, 9.2) - vec2(0.0, u_time * 0.55)),
      fbm(pWarp + 3.0 * q + vec2(8.3, 2.8) - vec2(0.0, u_time * 0.48))
    );

    // Convection lift: flames and heat naturally drift upward (+y in texture space)
    vec2 fluidOffset = (r - 0.5) * 0.075;
    fluidOffset.y -= 0.015 * r.x; // upward draft

    vec2 burnUV = uv + fluidOffset;

    // Sample the burn map at warped coordinates
    float rawBurn = texture2D(u_burnMap, burnUV).r;

    // 3. ORGANIC VEINING & FOLIAGE EROSION
    // Fire consumes leaf canopy faster than dense wood trunks
    float leafGrain = snoise(uv * 24.0);
    float woodFibers = snoise(uv * vec2(8.0, 36.0));
    float foliageErosion = (leafGrain * 0.65 + woodFibers * 0.35);

    // Only apply perturbation where burn is present
    float burnActive = smoothstep(0.005, 0.16, rawBurn);
    float perturbedBurn = rawBurn + foliageErosion * 0.22 * burnActive;
    perturbedBurn = clamp(perturbedBurn, 0.0, 1.0);

    // 4. Heat Shimmer Refraction
    // Subtle realistic optical heat wave shimmer (keeps tree trunks crisp and authentic)
    float heatZone = smoothstep(0.04, 0.60, perturbedBurn);
    vec2 heatShimmer = vec2(
      sin(uv.y * 60.0 + u_time * 10.0),
      cos(uv.x * 60.0 + u_time * 10.0)
    ) * 0.0016 * heatZone * u_flameIntensity;

    // 5. Sample the two layer textures
    vec4 forestTex = texture2D(u_texForest, uv);
    vec4 fireTex = texture2D(u_texFire, uv + heatShimmer);

    // 6. Charring & Scorching Stage (Vegetation darkening to carbon/ash)
    float scorchFactor = smoothstep(0.01, 0.18, perturbedBurn);
    vec3 ashColor = vec3(0.035, 0.02, 0.015) * (0.7 + 0.3 * snoise(uv * 50.0));
    vec3 charredForest = mix(forestTex.rgb, ashColor, scorchFactor * 0.95);

    // 7. Dynamic Upward Licking Flames at the Combustion Frontier
    // Flames lick vertically upwards (+y in UV space)
    vec2 flameUV = uv * vec2(16.0, 32.0) + vec2(snoise(uv * 7.0 + u_time * 0.7) * 0.6, -u_time * 4.2);
    float flameNoise = fbm(flameUV);
    float flameFlicker = 0.85 + 0.15 * sin(u_time * 25.0 + uv.x * 40.0 + uv.y * 25.0);

    // Combustion frontier band: active around the boundary between green and burnt
    float flameBand = smoothstep(0.03, 0.22, perturbedBurn)
                    * (1.0 - smoothstep(0.22, 0.65, perturbedBurn));
    
    flameBand = pow(flameBand, 0.75); // organic curve

    // Tongue of fire intensity with upward stretch
    float flameCore = flameBand * (0.4 + 0.6 * flameNoise) * flameFlicker * u_flameIntensity;

    // Incandescent Fire Gradient Ramp:
    // Charcoal Ash -> Ember Crimson -> Radiant Orange -> Incandescent Yellow -> White-Hot Core
    vec3 colEmber = vec3(0.85, 0.08, 0.01);
    vec3 colOrange = vec3(1.0, 0.42, 0.02);
    vec3 colYellow = vec3(1.0, 0.88, 0.16);
    vec3 colWhiteHot = vec3(2.0, 1.8, 1.4); // Intense HDR glow

    vec3 flameColor;
    if (flameCore < 0.20) {
      flameColor = mix(ashColor, colEmber, flameCore / 0.20);
    } else if (flameCore < 0.50) {
      flameColor = mix(colEmber, colOrange, (flameCore - 0.20) / 0.30);
    } else if (flameCore < 0.78) {
      flameColor = mix(colOrange, colYellow, (flameCore - 0.50) / 0.28);
    } else {
      flameColor = mix(colYellow, colWhiteHot, (flameCore - 0.78) / 0.22);
    }

    // 8. Dynamic Contact Halo (Under user's current LiDAR hand / touch point)
    float contactGlow = 0.0;
    if (u_contactActive > 0.01) {
      float distToContact = distance(uv, u_contactPos);
      float contactRadius = 0.09;
      contactGlow = smoothstep(contactRadius, 0.0, distToContact) * u_contactActive;
    }
    vec3 contactGlowColor = vec3(1.0, 0.48, 0.12) * contactGlow * 1.0;

    // 9. Layer Blending & Reveal
    // Sharp and clean transition into the vivid burning forest (estado2)
    float revealProgress = smoothstep(0.08, 0.32, perturbedBurn);
    
    // Living flame pulse in the burning forest layer
    vec3 enhancedFireTex = fireTex.rgb * (0.96 + 0.06 * sin(u_time * 3.5 + uv.y * 8.0));

    // Base crossfade between charred front and fiery back
    vec3 finalRgb = mix(charredForest, enhancedFireTex, revealProgress);

    // Additive flame combustion frontier
    finalRgb += flameColor * flameBand * 2.8 * u_flameIntensity;
    finalRgb += contactGlowColor;

    // High-temperature spark flecks along the combustion frontier
    if (flameBand > 0.18 && rawBurn > 0.04) {
      float sparkNoise = snoise(uv * 110.0 + vec2(0.0, -u_time * 6.0));
      if (sparkNoise > 0.82) {
        finalRgb += vec3(2.0, 1.5, 0.6) * (sparkNoise - 0.82) * 5.0;
      }
    }

    gl_FragColor = vec4(finalRgb, 1.0);
  }
`;
