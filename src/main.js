/* =========================================================
   EL BOSQUE ARDIENTE - MAIN APPLICATION
   Interactive LiDAR / Touch / WebGL Installation
   ========================================================= */

import * as THREE from 'three';
import { vertexShader, fragmentShader } from './shaders/fireShader.js';
import { BurnMask } from './shaders/burnMask.js';
import { EmberParticleEngine } from './particles.js';
import { FireAudioSynthesizer } from './audio.js';
import { UIController } from './ui.js';

class BurningForestApp {
  constructor() {
    this.canvas = document.getElementById('webgl-canvas');
    this.contactFlare = document.getElementById('contact-flare');

    // Settings
    this.interactionMode = 'hover'; // 'hover' (LiDAR default) or 'click'
    this.fitMode = 'cover';         // 'cover' or 'contain'
    this.isDemoActive = false;
    this.demoAngle = 0;
    this.lastMovementTime = 0;
    this.isBurningAll = false;
    this.burnAllProgress = 0;

    // Pointer tracking
    this.isInteracting = false;
    this.lastPointerPos = { x: 0, y: 0 };
    this.currentVelocity = 0;

    this.initWebGL();
    this.initComponents();
    this.loadTextures();
    this.bindPointerEvents();
    this.onWindowResize();

    // Start render loop
    this.clock = new THREE.Clock();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  initWebGL() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
    this.camera.position.z = 5;
  }

  initComponents() {
    // 1. Dynamic Burn Buffer (1376 x 768 matching image dimensions)
    this.burnMask = new BurnMask(1376, 768);

    // 2. Rising Fire Embers Engine
    this.emberEngine = new EmberParticleEngine(1000);
    this.scene.add(this.emberEngine.mesh);

    // 3. Web Audio Fire Synthesizer
    this.audio = new FireAudioSynthesizer();

    // 4. Shaders & Material
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        u_texForest: { value: null },
        u_texFire: { value: null },
        u_burnMap: { value: this.burnMask.texture },
        u_time: { value: 0.0 },
        u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        u_texResolution: { value: new THREE.Vector2(1376, 768) },
        u_flameIntensity: { value: 1.3 },
        u_edgeWidth: { value: 0.30 },
        u_fitMode: { value: 0 }, // 0: cover, 1: contain
        u_contactPos: { value: new THREE.Vector2(-1, -1) },
        u_contactActive: { value: 0.0 }
      },
      depthWrite: false,
      depthTest: false
    });

    // Fullscreen rendering quad
    const quadGeometry = new THREE.PlaneGeometry(2, 2);
    this.screenQuad = new THREE.Mesh(quadGeometry, this.material);
    this.scene.add(this.screenQuad);

    // 5. UI Controller
    this.ui = new UIController(this);
  }

  loadTextures() {
    const textureLoader = new THREE.TextureLoader();

    const configureTexture = (tex) => {
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.generateMipmaps = true;
    };

    // Load estado1 (Bosque verde frondoso)
    textureLoader.load(
      '/Obra/estado1.jpeg',
      (tex) => {
        configureTexture(tex);
        this.material.uniforms.u_texForest.value = tex;
      },
      undefined,
      () => {
        // Fallback relative path
        textureLoader.load('Obra/estado1.jpeg', (tex) => {
          configureTexture(tex);
          this.material.uniforms.u_texForest.value = tex;
        });
      }
    );

    // Load estado2 (Bosque en llamas)
    textureLoader.load(
      '/Obra/estado2.jpeg',
      (tex) => {
        configureTexture(tex);
        this.material.uniforms.u_texFire.value = tex;
      },
      undefined,
      () => {
        // Fallback relative path
        textureLoader.load('Obra/estado2.jpeg', (tex) => {
          configureTexture(tex);
          this.material.uniforms.u_texFire.value = tex;
        });
      }
    );
  }

  bindPointerEvents() {
    window.addEventListener('resize', () => this.onWindowResize());

    const onPointerDown = (e) => {
      this.audio.init();
      this.audio.resumeIfSuspended();
      this.ui.hideHint();
      this.isInteracting = true;
      this.processContact(e.pointerId, e.clientX, e.clientY);
    };

    const onPointerMove = (e) => {
      // In hover mode (LiDAR), any movement acts as active contact
      if (this.interactionMode === 'hover' || this.isInteracting) {
        this.audio.resumeIfSuspended();
        this.ui.hideHint();
        this.processContact(e.pointerId, e.clientX, e.clientY);
      }
    };

    const onPointerUp = (e) => {
      this.burnMask.handlePointerUp(e.pointerId);
      if (e.pointerType !== 'mouse' || this.interactionMode === 'click') {
        this.isInteracting = false;
        this.material.uniforms.u_contactActive.value = 0.0;
        this.contactFlare.classList.remove('active');
      }
    };

    const onPointerLeave = () => {
      this.isInteracting = false;
      this.material.uniforms.u_contactActive.value = 0.0;
      this.contactFlare.classList.remove('active');
    };

    this.canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    this.canvas.addEventListener('pointerleave', onPointerLeave);

    // Touch specific fallbacks for some LiDAR systems
    this.canvas.addEventListener('touchmove', (e) => {
      for (let i = 0; i < e.touches.length; i++) {
        const t = e.touches[i];
        this.processContact(t.identifier, t.clientX, t.clientY);
      }
    }, { passive: true });
  }

  processContact(id, screenX, screenY) {
    const sw = window.innerWidth;
    const sh = window.innerHeight;

    // Convert screen coordinates to texture space
    const coord = this.burnMask.screenToTexture(screenX, screenY, sw, sh, this.fitMode);
    if (!coord.isValid) return;

    // Paint into the burn accumulation texture
    this.burnMask.handlePointerMove(id, coord.x, coord.y);

    // Update shader contact uniform
    this.material.uniforms.u_contactPos.value.set(coord.uvX, 1.0 - coord.uvY);
    this.material.uniforms.u_contactActive.value = 1.0;

    // Move flare DOM element
    this.contactFlare.style.left = `${screenX}px`;
    this.contactFlare.style.top = `${screenY}px`;
    this.contactFlare.classList.add('active');

    // Calculate velocity for particle bursts & audio
    const dx = screenX - this.lastPointerPos.x;
    const dy = screenY - this.lastPointerPos.y;
    const dist = Math.hypot(dx, dy);
    this.currentVelocity = Math.min(1.0, dist / 25.0);
    this.lastPointerPos = { x: screenX, y: screenY };

    // Emit glowing sparks into the particle engine
    // Convert to Three.js NDC space [-1 .. 1]
    const ndcX = (screenX / sw) * 2 - 1;
    const ndcY = -(screenY / sh) * 2 + 1;
    this.emberEngine.emit(ndcX, ndcY, 1.0 + this.currentVelocity * 1.5);

    // Audio responsiveness
    this.audio.update(0.3 + this.currentVelocity * 0.7, 0.016);
    this.lastMovementTime = performance.now();
  }

  onWindowResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.material.uniforms.u_resolution.value.set(w, h);
  }

  setFlameIntensity(val) {
    this.material.uniforms.u_flameIntensity.value = val;
  }

  setEdgeWidth(val) {
    this.material.uniforms.u_edgeWidth.value = val;
  }

  setInteractionMode(mode) {
    this.interactionMode = mode;
  }

  setFitMode(mode) {
    this.fitMode = mode;
    this.material.uniforms.u_fitMode.value = mode === 'cover' ? 0 : 1;
  }

  reset() {
    this.burnMask.clear();
    this.isBurningAll = false;
    this.burnAllProgress = 0;
    this.material.uniforms.u_contactActive.value = 0.0;
    this.contactFlare.classList.remove('active');
  }

  triggerShowcaseBurn() {
    this.isBurningAll = true;
    this.burnAllProgress = 0;
    this.audio.resumeIfSuspended();
  }

  toggleDemoMode() {
    this.isDemoActive = !this.isDemoActive;
    if (this.isDemoActive) {
      this.ui.hideHint();
      this.audio.resumeIfSuspended();
    } else {
      this.contactFlare.classList.remove('active');
      this.material.uniforms.u_contactActive.value = 0.0;
    }
    return this.isDemoActive;
  }

  updateDemo(dt) {
    if (!this.isDemoActive) return;

    this.demoAngle += dt * 1.2;
    const sw = window.innerWidth;
    const sh = window.innerHeight;

    // Organic wandering Lissajous path across screen
    const x = sw * 0.5 + Math.cos(this.demoAngle * 0.8) * (sw * 0.38) + Math.sin(this.demoAngle * 2.1) * (sw * 0.08);
    const y = sh * 0.5 + Math.sin(this.demoAngle * 1.1) * (sh * 0.35) + Math.cos(this.demoAngle * 1.7) * (sh * 0.08);

    this.processContact('demo', x, y);
  }

  destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
  }

  animate() {
    this.animationId = requestAnimationFrame(this.animate);

    const dt = Math.min(this.clock.getDelta(), 0.1);
    const time = this.clock.getElapsedTime();

    // 1. Update Burn Mask (Auto-regrowth if enabled)
    this.burnMask.update();

    // 2. Handle Showcase Burn animation
    if (this.isBurningAll) {
      this.burnAllProgress += dt * 0.35; // completes in ~3 sec
      this.burnMask.burnAllStep(this.burnAllProgress);
      this.emberEngine.emit((Math.random() - 0.5) * 1.8, (Math.random() - 0.5) * 1.8, 2.0);
      this.audio.update(1.0, dt);

      if (this.burnAllProgress >= 1.0) {
        this.isBurningAll = false;
      }
    }

    // 3. Demo mode autonomous movement
    this.updateDemo(dt);

    // 4. Inactivity check for contact glow & flare
    if (performance.now() - this.lastMovementTime > 200 && !this.isDemoActive) {
      this.material.uniforms.u_contactActive.value = THREE.MathUtils.lerp(
        this.material.uniforms.u_contactActive.value,
        0.0,
        dt * 8.0
      );
      if (this.material.uniforms.u_contactActive.value < 0.05) {
        this.contactFlare.classList.remove('active');
      }
      this.audio.update(0.0, dt);
    }

    // 5. Update Shader Uniforms
    this.material.uniforms.u_time.value = time;

    // 6. Update Particles
    this.emberEngine.update(dt, time);

    // 7. Render
    this.renderer.render(this.scene, this.camera);
  }
}

// Bootstrap on DOM content ready or immediately if already loaded
function initApp() {
  if (window.app && typeof window.app.destroy === 'function') {
    window.app.destroy();
  }
  window.app = new BurningForestApp();
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

