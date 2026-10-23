/* =========================================================
   EMBERS & SPARKS PARTICLE ENGINE
   Cinematic rising fire embers and glowing ash flakes
   ========================================================= */

import * as THREE from 'three';

export class EmberParticleEngine {
  constructor(maxParticles = 800) {
    this.maxParticles = maxParticles;
    this.particleCount = 0;
    this.densityLevel = 2; // 0: Off, 1: Low, 2: Med, 3: High

    // Generate circular soft glow texture for particles
    this.spriteTexture = this.createEmberTexture();

    // Buffer arrays
    this.positions = new Float32Array(maxParticles * 3);
    this.colors = new Float32Array(maxParticles * 3);
    this.sizes = new Float32Array(maxParticles);
    this.lifespans = new Float32Array(maxParticles); // remaining life [0..1]
    this.maxLifes = new Float32Array(maxParticles);
    this.velocities = [];

    for (let i = 0; i < maxParticles; i++) {
      this.velocities.push({ x: 0, y: 0, turbulenceSeed: Math.random() * 100 });
      this.positions[i * 3] = 0;
      this.positions[i * 3 + 1] = 0;
      this.positions[i * 3 + 2] = 1; // slightly in front
      this.sizes[i] = 0;
      this.lifespans[i] = 0;
    }

    // Geometry & Material
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));

    // Custom Points Material with additive blending
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        u_texture: { value: this.spriteTexture }
      },
      vertexShader: /* glsl */ `
        attribute float size;
        attribute vec3 color;
        varying vec3 vColor;
        void main() {
          vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D u_texture;
        varying vec3 vColor;
        void main() {
          vec4 tex = texture2D(u_texture, gl_PointCoord);
          if (tex.a < 0.05) discard;
          gl_FragColor = vec4(vColor * tex.rgb, tex.a);
        }
      `,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      transparent: true
    });

    this.mesh = new THREE.Points(this.geometry, this.material);
    this.mesh.frustumCulled = false;
  }

  createEmberTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(0.25, 'rgba(255, 220, 120, 0.9)');
    grad.addColorStop(0.55, 'rgba(255, 90, 20, 0.5)');
    grad.addColorStop(0.85, 'rgba(200, 30, 0, 0.15)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
  }

  /**
   * Spawns sparks at normalized position (-1 to 1 in Three.js NDC space)
   */
  emit(ndcX, ndcY, countMultiplier = 1) {
    if (this.densityLevel === 0) return;

    const baseCount = [0, 2, 5, 10][this.densityLevel] * countMultiplier;
    const spawnCount = Math.min(15, Math.ceil(baseCount));

    for (let c = 0; c < spawnCount; c++) {
      // Find inactive slot or overwrite oldest
      let idx = -1;
      for (let i = 0; i < this.maxParticles; i++) {
        if (this.lifespans[i] <= 0) {
          idx = i;
          break;
        }
      }
      if (idx === -1) {
        idx = Math.floor(Math.random() * this.maxParticles);
      }

      const life = 0.8 + Math.random() * 1.6; // duration in seconds
      this.lifespans[idx] = life;
      this.maxLifes[idx] = life;

      // Slight initial scatter
      const scatter = 0.04;
      this.positions[idx * 3] = ndcX + (Math.random() - 0.5) * scatter;
      this.positions[idx * 3 + 1] = ndcY + (Math.random() - 0.5) * scatter;
      this.positions[idx * 3 + 2] = -1.0; // NDC depth

      // Velocity: Upward convection draft + chaotic horizontal burst
      this.velocities[idx].x = (Math.random() - 0.5) * 0.45;
      this.velocities[idx].y = 0.35 + Math.random() * 0.75; // rising up in NDC
      this.velocities[idx].turbulenceSeed = Math.random() * 1000;

      // Initial size
      this.sizes[idx] = 0.08 + Math.random() * 0.14;

      // Initial color: brilliant white-yellow
      this.colors[idx * 3] = 1.0;
      this.colors[idx * 3 + 1] = 0.9;
      this.colors[idx * 3 + 2] = 0.6;
    }
  }

  update(dt, time) {
    let hasActive = false;

    for (let i = 0; i < this.maxParticles; i++) {
      if (this.lifespans[i] <= 0) {
        this.sizes[i] = 0;
        continue;
      }

      hasActive = true;
      this.lifespans[i] -= dt;
      const progress = 1.0 - (this.lifespans[i] / this.maxLifes[i]); // 0 to 1

      // Turbulence / horizontal sway
      const seed = this.velocities[i].turbulenceSeed;
      const sway = Math.sin(time * 6.0 + seed) * 0.25;

      // Upward motion with drag
      this.positions[i * 3] += (this.velocities[i].x + sway) * dt;
      this.positions[i * 3 + 1] += this.velocities[i].y * dt;

      // Color shifts as ember cools:
      // White/Yellow -> Blazing Orange -> Ruby Red -> Dark Charcoal Ash
      if (progress < 0.25) {
        const t = progress / 0.25;
        this.colors[i * 3] = 1.0;
        this.colors[i * 3 + 1] = THREE.MathUtils.lerp(0.9, 0.45, t);
        this.colors[i * 3 + 2] = THREE.MathUtils.lerp(0.5, 0.05, t);
      } else if (progress < 0.7) {
        const t = (progress - 0.25) / 0.45;
        this.colors[i * 3] = THREE.MathUtils.lerp(1.0, 0.75, t);
        this.colors[i * 3 + 1] = THREE.MathUtils.lerp(0.45, 0.1, t);
        this.colors[i * 3 + 2] = 0.02;
      } else {
        const t = (progress - 0.7) / 0.3;
        this.colors[i * 3] = THREE.MathUtils.lerp(0.75, 0.15, t);
        this.colors[i * 3 + 1] = THREE.MathUtils.lerp(0.1, 0.02, t);
        this.colors[i * 3 + 2] = 0.01;
      }

      // Sparkle pulsation
      const flicker = 0.75 + 0.25 * Math.sin(time * 30.0 + seed);
      this.sizes[i] = (1.0 - progress * 0.8) * 0.14 * flicker;
    }

    if (hasActive) {
      this.geometry.attributes.position.needsUpdate = true;
      this.geometry.attributes.color.needsUpdate = true;
      this.geometry.attributes.size.needsUpdate = true;
    }
  }

  setDensity(level) {
    this.densityLevel = Math.max(0, Math.min(3, level));
  }
}
