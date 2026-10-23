/* =========================================================
   EXHIBITION UI CONTROLLER
   Manages glassmorphic HUD, keyboard shortcuts & settings
   ========================================================= */

export class UIController {
  constructor(app) {
    this.app = app;
    this.isUiHidden = false;
    this.isSettingsOpen = false;

    this.bindElements();
    this.bindEvents();
  }

  bindElements() {
    this.exhibitionBar = document.getElementById('exhibition-bar');
    this.settingsPanel = document.getElementById('settings-panel');
    this.unhideBtn = document.getElementById('btn-unhide-ui');
    this.interactionHint = document.getElementById('interaction-hint');

    // Quick action buttons
    this.btnSound = document.getElementById('btn-sound');
    this.iconSoundOn = document.getElementById('icon-sound-on');
    this.iconSoundOff = document.getElementById('icon-sound-off');
    this.btnReset = document.getElementById('btn-reset');
    this.btnBurnAll = document.getElementById('btn-burn-all');
    this.btnDemo = document.getElementById('btn-demo');
    this.btnSettings = document.getElementById('btn-settings');
    this.btnCloseSettings = document.getElementById('btn-close-settings');
    this.btnFullscreen = document.getElementById('btn-fullscreen');
    this.btnHideUi = document.getElementById('btn-hide-ui');

    // Sliders & Labels
    this.sliderFlameHeight = document.getElementById('slider-flame-height');
    this.labelFlameHeight = document.getElementById('flame-height-val');

    this.sliderTrailLength = document.getElementById('slider-trail-length');
    this.labelTrailLength = document.getElementById('trail-length-val');

    this.sliderMinRadius = document.getElementById('slider-min-radius');
    this.labelMinRadius = document.getElementById('min-radius-val');

    this.sliderFlame = document.getElementById('slider-flame-intensity');
    this.labelFlame = document.getElementById('flame-intensity-val');

    this.sliderEdge = document.getElementById('slider-edge-width');
    this.labelEdge = document.getElementById('edge-width-val');

    this.sliderRecovery = document.getElementById('slider-recovery');
    this.labelRecovery = document.getElementById('recovery-val');

    this.sliderEmbers = document.getElementById('slider-embers');
    this.labelEmbers = document.getElementById('embers-val');

    // Segmented buttons
    this.modeHover = document.getElementById('mode-hover');
    this.modeClick = document.getElementById('mode-click');
    this.fitCover = document.getElementById('fit-cover');
    this.fitContain = document.getElementById('fit-contain');
  }

  bindEvents() {
    // Sound
    this.btnSound?.addEventListener('click', () => {
      const isMuted = this.app.audio.toggleMute();
      this.iconSoundOn?.classList.toggle('hidden', isMuted);
      this.iconSoundOff?.classList.toggle('hidden', !isMuted);
    });

    // Reset
    this.btnReset?.addEventListener('click', () => {
      this.app.reset();
    });

    // Burn all
    this.btnBurnAll?.addEventListener('click', () => {
      this.app.triggerShowcaseBurn();
    });

    // Demo mode
    this.btnDemo?.addEventListener('click', () => {
      const active = this.app.toggleDemoMode();
      this.btnDemo.classList.toggle('active', active);
    });

    // Settings drawer
    this.btnSettings?.addEventListener('click', () => this.toggleSettings());
    this.btnCloseSettings?.addEventListener('click', () => this.toggleSettings(false));

    // Fullscreen
    this.btnFullscreen?.addEventListener('click', () => this.toggleFullscreen());

    // Hide / Unhide UI
    this.btnHideUi?.addEventListener('click', () => this.toggleUI(false));
    this.unhideBtn?.addEventListener('click', () => this.toggleUI(true));

    // 1. Slider: Flame Height (Grosor / Altura)
    if (this.sliderFlameHeight) {
      this.sliderFlameHeight.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (this.labelFlameHeight) this.labelFlameHeight.textContent = `${val} px`;
        this.app.burnMask.setFlameHeight(val);
      });
    }

    // 2. Slider: Trail Length (Duración de la estela)
    if (this.sliderTrailLength) {
      this.sliderTrailLength.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (this.labelTrailLength) this.labelTrailLength.textContent = `${val.toFixed(1)} s`;
        this.app.burnMask.setTrailLength(val);
        if (this.sliderRecovery && this.labelRecovery) {
          const heal = this.app.burnMask.healDuration;
          this.sliderRecovery.value = heal.toFixed(2);
          this.labelRecovery.textContent = `${heal.toFixed(2)} s`;
        }
      });
    }

    // 3. Slider: Initial small radius (Ignición sutil inicial)
    if (this.sliderMinRadius) {
      this.sliderMinRadius.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (this.labelMinRadius) this.labelMinRadius.textContent = `${val} px`;
        this.app.burnMask.setMinRadius(val);
      });
    }

    // 4. Slider: Fire Intensity
    if (this.sliderFlame) {
      this.sliderFlame.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (this.labelFlame) this.labelFlame.textContent = val.toFixed(1);
        this.app.setFlameIntensity(val);
      });
    }

    // 5. Slider: Edge Width
    if (this.sliderEdge) {
      this.sliderEdge.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (this.labelEdge) this.labelEdge.textContent = val.toFixed(2);
        this.app.setEdgeWidth(val);
      });
    }

    // 6. Slider: Recovery / Healing Time
    if (this.sliderRecovery) {
      this.sliderRecovery.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (val <= 0.05) {
          if (this.labelRecovery) this.labelRecovery.textContent = 'Permanente (Fijo)';
          this.app.burnMask.setHealDuration(0);
        } else {
          if (this.labelRecovery) this.labelRecovery.textContent = `${val.toFixed(2)} s`;
          this.app.burnMask.setHealDuration(val);
          if (this.sliderTrailLength && this.labelTrailLength) {
            const total = this.app.burnMask.totalLife;
            this.sliderTrailLength.value = Math.min(3.5, total).toFixed(1);
            this.labelTrailLength.textContent = `${total.toFixed(1)} s`;
          }
        }
      });
    }

    // 7. Slider: Embers density
    if (this.sliderEmbers) {
      this.sliderEmbers.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        const names = ['Apagado', 'Baja', 'Media', 'Alta'];
        if (this.labelEmbers) this.labelEmbers.textContent = names[val];
        this.app.emberEngine.setDensity(val);
      });
    }

    // Interaction mode segmented
    this.modeHover?.addEventListener('click', () => {
      this.modeHover.classList.add('active');
      this.modeClick.classList.remove('active');
      this.app.setInteractionMode('hover');
    });

    this.modeClick?.addEventListener('click', () => {
      this.modeClick.classList.add('active');
      this.modeHover.classList.remove('active');
      this.app.setInteractionMode('click');
    });

    // Fit mode segmented
    this.fitCover?.addEventListener('click', () => {
      this.fitCover.classList.add('active');
      this.fitContain.classList.remove('active');
      this.app.setFitMode('cover');
    });

    this.fitContain?.addEventListener('click', () => {
      this.fitContain.classList.add('active');
      this.fitCover.classList.remove('active');
      this.app.setFitMode('contain');
    });

    // Keyboard shortcuts (Supports P and C for settings panel toggle)
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' && e.target.type !== 'range') return;

      switch (e.key.toLowerCase()) {
        case 'p':
        case 'c':
          this.toggleSettings();
          break;
        case 'f':
          this.toggleFullscreen();
          break;
        case 'h':
          this.toggleUI();
          break;
        case 'r':
          this.app.reset();
          break;
        case 'b':
          this.app.triggerShowcaseBurn();
          break;
        case 'm':
          this.btnSound?.click();
          break;
        case 'd':
          this.btnDemo?.click();
          break;
        case 'escape':
          if (this.isSettingsOpen) this.toggleSettings(false);
          break;
      }
    });
  }

  hideHint() {
    if (this.interactionHint) {
      this.interactionHint.classList.add('fade-out');
    }
  }

  toggleUI(forceState) {
    this.isUiHidden = forceState !== undefined ? !forceState : !this.isUiHidden;
    this.exhibitionBar.classList.toggle('ui-hidden', this.isUiHidden);
    this.unhideBtn.classList.toggle('hidden', !this.isUiHidden);
    if (this.isUiHidden && this.isSettingsOpen) {
      this.toggleSettings(false);
    }
  }

  toggleSettings(forceState) {
    this.isSettingsOpen = forceState !== undefined ? forceState : !this.isSettingsOpen;
    this.settingsPanel.classList.toggle('open', this.isSettingsOpen);
    this.btnSettings.classList.toggle('active', this.isSettingsOpen);
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  }
}
