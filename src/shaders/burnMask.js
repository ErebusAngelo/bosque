/* =========================================================
   BURN MASK MANAGER - DYNAMIC EXPANDING IGNITION & HEALING
   Based on Interactive LiDAR Reference (Naturaleza Sintética)
   Features:
   - Starts small at point of contact and expands outward organically (fire catching & spreading)
   - Burns vividly revealing back layer
   - Smoothly heals / re-draws the top layer after a subtle duration
   ========================================================= */

import * as THREE from 'three';

export class BurnMask {
  constructor(width = 1376, height = 768) {
    this.width = width;
    this.height = height;

    // Offscreen canvas for accumulating organic burn trails
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: false });

    // Active touch points tracking for LiDAR
    this.activePointers = new Map();

    // Active ignition nodes list
    this.ignitionNodes = [];

    // Timing & Physics parameters
    // Alto del fuego mantenido (65px) + longitud moderada (~1.4s total)
    this.minRadius = 12;          // Inicio pequeño sutil
    this.maxRadius = 65;          // Mantiene el alto completo que tenía antes
    this.expandDuration = 0.22;   // Expansión rápida inicial
    this.sustainDuration = 0.35;  // Breve sostenimiento de la llama
    this.healDuration = 0.85;     // Curado suave y ágil
    this.isPermanent = false;     // Regeneración natural activa

    // Three.js CanvasTexture for GPU sampling
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.wrapS = THREE.ClampToEdgeWrapping;
    this.texture.wrapT = THREE.ClampToEdgeWrapping;
    this.texture.generateMipmaps = false;

    this.clear();
    this.strokeSeed = 0;
  }

  get totalLife() {
    return this.expandDuration + this.sustainDuration + this.healDuration;
  }

  setFlameHeight(radius) {
    this.maxRadius = Math.max(10, radius);
  }

  setMinRadius(radius) {
    this.minRadius = Math.max(2, radius);
  }

  setTrailLength(seconds) {
    const total = Math.max(0.3, seconds);
    this.expandDuration = Math.min(0.25, total * 0.16);
    this.sustainDuration = total * 0.24;
    this.healDuration = total * 0.60;
  }

  setHealDuration(seconds) {
    if (seconds <= 0.05) {
      this.isPermanent = true;
    } else {
      this.isPermanent = false;
      this.healDuration = seconds;
    }
  }

  clear() {
    if (this.activePointers) {
      this.activePointers.clear();
    }
    this.ignitionNodes = [];
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, this.width, this.height);
    if (this.texture) {
      this.texture.needsUpdate = true;
    }
  }

  screenToTexture(screenX, screenY, screenWidth, screenHeight, fitMode = 'cover') {
    const screenAspect = screenWidth / screenHeight;
    const texAspect = this.width / this.height;

    const normX = screenX / screenWidth;
    const normY = screenY / screenHeight;

    let uvX = normX;
    let uvY = normY;

    if (fitMode === 'cover') {
      if (screenAspect > texAspect) {
        const r = texAspect / screenAspect;
        uvY = (normY - 0.5) * r + 0.5;
      } else {
        const r = screenAspect / texAspect;
        uvX = (normX - 0.5) * r + 0.5;
      }
    } else { // contain
      if (screenAspect > texAspect) {
        const r = screenAspect / texAspect;
        uvX = (normX - 0.5) * r + 0.5;
      } else {
        const r = texAspect / screenAspect;
        uvY = (normY - 0.5) * r + 0.5;
      }
    }

    return {
      x: uvX * this.width,
      y: uvY * this.height,
      uvX,
      uvY,
      isValid: uvX >= 0 && uvX <= 1 && uvY >= 0 && uvY <= 1
    };
  }

  /**
   * Spawns an ignition point that will expand and then naturally heal
   */
  addIgnitionPoint(x, y, seed) {
    const now = performance.now();
    this.ignitionNodes.push({
      x,
      y,
      birthTime: now,
      seed: seed || Math.random() * 100,
      targetRadius: this.maxRadius * (0.85 + Math.random() * 0.3)
    });

    // Cap max active nodes for performance
    if (this.ignitionNodes.length > 600) {
      this.ignitionNodes.shift();
    }
  }

  /**
   * Handle continuous pointer / LiDAR motion with smooth interpolation
   */
  handlePointerMove(id, x, y) {
    const now = performance.now();
    const prev = this.activePointers.get(id);

    if (prev) {
      const dx = x - prev.x;
      const dy = y - prev.y;
      const dist = Math.hypot(dx, dy);

      // Distance between consecutive nodes (spacing)
      const stepSize = Math.max(8, this.minRadius * 0.8);
      const steps = Math.max(1, Math.ceil(dist / stepSize));

      for (let i = 1; i <= steps; i++) {
        this.strokeSeed += 0.53;
        const t = i / steps;
        const px = prev.x + dx * t;
        const py = prev.y + dy * t;
        this.addIgnitionPoint(px, py, this.strokeSeed);
      }
    } else {
      this.strokeSeed += 0.53;
      this.addIgnitionPoint(x, y, this.strokeSeed);
    }

    this.activePointers.set(id, { x, y, time: now });
  }

  handlePointerUp(id) {
    this.activePointers.delete(id);
  }

  /**
   * Renders a fluid organic flame blotch
   */
  drawExpandingBlotch(ctx, cx, cy, radius, alpha, seed) {
    if (alpha <= 0.001 || radius <= 1) return;

    const numPoints = 12;
    const angleStep = (Math.PI * 2) / numPoints;

    ctx.save();
    ctx.beginPath();
    for (let i = 0; i <= numPoints; i++) {
      const angle = i * angleStep;
      const rMod = 1.0 
        + 0.28 * Math.sin(angle * 3.0 + seed) 
        + 0.18 * Math.cos(angle * 5.0 + seed * 1.5);
      
      const r = radius * Math.max(0.5, rMod);
      const px = cx + Math.cos(angle) * r;
      const py = cy + Math.sin(angle) * r;

      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.closePath();

    const grad = ctx.createRadialGradient(cx, cy, radius * 0.05, cx, cy, radius * 1.15);
    grad.addColorStop(0.0, `rgba(255, 255, 255, ${alpha})`);
    grad.addColorStop(0.5, `rgba(255, 255, 255, ${alpha * 0.9})`);
    grad.addColorStop(0.8, `rgba(255, 255, 255, ${alpha * 0.45})`);
    grad.addColorStop(1.0, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = grad;
    ctx.fill();

    // Satellite micro-ember droplets
    const numDroplets = 2;
    for (let s = 0; s < numDroplets; s++) {
      const sAngle = (seed * 3.7 + s * 2.8) % (Math.PI * 2);
      const sDist = radius * (0.85 + 0.5 * Math.abs(Math.cos(seed * 2.0 + s)));
      const sRad = radius * (0.15 + 0.2 * Math.abs(Math.sin(seed * 3.0 + s)));
      const sx = cx + Math.cos(sAngle) * sDist;
      const sy = cy + Math.sin(sAngle) * sDist - sRad * 0.5; // convection lift

      const sGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, sRad);
      sGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.8})`);
      sGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = sGrad;
      ctx.beginPath();
      ctx.arc(sx, sy, sRad, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Main per-frame update loop:
   * Recalculates expansion and healing lifecycle for all active fire points
   */
  update() {
    const now = performance.now();
    const ctx = this.ctx;

    // Clear buffer to black
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.save();
    ctx.globalCompositeOperation = 'screen'; // additive blend creates fluid merging

    const remainingNodes = [];
    const totalLifeMs = this.totalLife * 1000;
    const expandMs = this.expandDuration * 1000;
    const sustainMs = this.sustainDuration * 1000;
    const healMs = this.healDuration * 1000;

    for (let i = 0; i < this.ignitionNodes.length; i++) {
      const node = this.ignitionNodes[i];
      const ageMs = now - node.birthTime;

      if (!this.isPermanent && ageMs >= totalLifeMs) {
        continue; // expired, heals completely back to forest
      }

      remainingNodes.push(node);

      // 1. Expansion phase: starts small and grows outward like spreading flame
      let radius;
      if (ageMs < expandMs) {
        const t = ageMs / expandMs;
        // Ease-out cubic: rapid initial ignition then smooth expansion
        const easeOut = 1.0 - Math.pow(1.0 - t, 2.5);
        radius = this.minRadius + (node.targetRadius - this.minRadius) * easeOut;
      } else {
        radius = node.targetRadius;
      }

      // 2. Alpha & Healing phase: full burn, then smoothly fades out as forest regrows
      let alpha = 1.0;
      if (!this.isPermanent) {
        const peakMs = expandMs + sustainMs;
        if (ageMs > peakMs) {
          const healProgress = (ageMs - peakMs) / healMs; // 0 to 1
          // Smoothstep fade out so the top layer smoothly re-draws itself
          alpha = 1.0 - (healProgress * healProgress * (3.0 - 2.0 * healProgress));
        }
      }

      this.drawExpandingBlotch(ctx, node.x, node.y, radius, alpha, node.seed);
    }

    ctx.restore();
    this.ignitionNodes = remainingNodes;
    this.texture.needsUpdate = true;
  }

  burnAllStep(progress) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1.0, progress)})`;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.restore();
    this.texture.needsUpdate = true;
  }
}
