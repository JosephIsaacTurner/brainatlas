import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class Viewer {
  constructor(canvasContainer) {
    this.container = canvasContainer;
    this.width = this.container.clientWidth || window.innerWidth;
    this.height = this.container.clientHeight || window.innerHeight;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.backgroundColor = 0x121316; // Surf Ice dark theme
    this.scene.background = new THREE.Color(this.backgroundColor);

    // 2. Camera (MNI space: +Z is Superior, +Y is Anterior, +X is Right)
    this.camera = new THREE.PerspectiveCamera(40, this.width / this.height, 1, 2000);
    this.camera.up.set(0, 0, 1); // Z is superior

    this.defaultTarget = new THREE.Vector3(0, -20, 10); // Brain center
    this.defaultPosition = new THREE.Vector3(250, -330, 150);
    this.camera.position.copy(this.defaultPosition);
    this.camera.lookAt(this.defaultTarget);

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.localClippingEnabled = true; // Essential for mesh clipping!
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.container.appendChild(this.renderer.domElement);

    // 4. Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.copy(this.defaultTarget);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.rotateSpeed = 0.8;
    this.controls.zoomSpeed = 1.2;
    this.controls.panSpeed = 0.8;

    // 5. Lighting
    this.initLights();

    // 6. Resize listener
    window.addEventListener('resize', () => this.onResize());

    // 7. Animation Clock & Turntable Spin
    this.clock = new THREE.Clock();
    this.turntableSpin = false;
    this.turntableSecondsPerRotation = 20;

    // Update callback hooks
    this.onRenderCallbacks = [];
  }

  initLights() {
    // Soft omnidirectional ambient light
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    this.scene.add(this.ambientLight);

    // Headlight (attached to camera pointing straight along line of sight)
    this.headlight = new THREE.DirectionalLight(0xffffff, 0.95);
    this.headlight.position.set(0, 0, 0);
    this.headlight.target.position.set(0, 0, -1);
    this.camera.add(this.headlight);
    this.camera.add(this.headlight.target);

    // Bilaterally symmetric fill lights attached to camera (equal left & right intensity)
    this.fillLightLeft = new THREE.DirectionalLight(0xb0c4de, 0.25);
    this.fillLightLeft.position.set(-1, 0.5, 0);
    this.fillLightLeft.target.position.set(0, 0, -1);
    this.camera.add(this.fillLightLeft);
    this.camera.add(this.fillLightLeft.target);

    this.fillLightRight = new THREE.DirectionalLight(0xb0c4de, 0.25);
    this.fillLightRight.position.set(1, 0.5, 0);
    this.fillLightRight.target.position.set(0, 0, -1);
    this.camera.add(this.fillLightRight);
    this.camera.add(this.fillLightRight.target);

    this.scene.add(this.camera);
  }

  onResize() {
    this.width = this.container.clientWidth || window.innerWidth;
    this.height = this.container.clientHeight || window.innerHeight;

    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(this.width, this.height);
  }

  setBackgroundColor(color) {
    if (typeof color === 'string') {
      this.scene.background.set(color);
      this.backgroundColor = this.scene.background.getHex();
    } else if (typeof color === 'number') {
      this.backgroundColor = color;
      this.scene.background.setHex(color);
    } else if (color && color.isColor) {
      this.scene.background.copy(color);
      this.backgroundColor = this.scene.background.getHex();
    }
  }

  getBackgroundColorHex() {
    return '#' + this.scene.background.getHexString();
  }

  resetCamera() {
    this.camera.position.copy(this.defaultPosition);
    this.camera.up.set(0, 0, 1);
    this.controls.target.copy(this.defaultTarget);
    this.camera.lookAt(this.defaultTarget);
    this.controls.update();
  }

  // 6 Standard Anatomical Views with Fixed Turntable Rotation Axis (+Z Superior)
  setAnatomicalView(viewName) {
    const dist = 430;
    const target = this.defaultTarget.clone();

    // The turntable rotation axis (+Z MNI Superior) is strictly preserved across all views
    this.camera.up.set(0, 0, 1);

    switch (viewName) {
      case 'superior':
      case 'axial_sup':
        // Top-down view (slightly offset in Y to preserve +Z turntable axis without gimbal lock)
        this.camera.position.set(target.x, target.y - 0.05, target.z + dist);
        break;

      case 'inferior':
      case 'axial_inf':
        // Bottom-up view (offset in Y to preserve +Z turntable axis and neurological orientation)
        this.camera.position.set(target.x, target.y + 0.05, target.z - dist);
        break;

      case 'anterior':
      case 'coronal_ant':
        // Front coronal view (+Y Anterior in MNI)
        this.camera.position.set(target.x, target.y + dist, target.z);
        break;

      case 'posterior':
      case 'coronal_post':
        // Back coronal view (-Y Posterior in MNI)
        this.camera.position.set(target.x, target.y - dist, target.z);
        break;

      case 'left_lateral':
      case 'sagittal_left':
        // Patient left lateral view (-X Left in MNI)
        this.camera.position.set(target.x - dist, target.y, target.z);
        break;

      case 'right_lateral':
      case 'sagittal_right':
        // Patient right lateral view (+X Right in MNI)
        this.camera.position.set(target.x + dist, target.y, target.z);
        break;

      case 'oblique':
        this.camera.position.set(target.x + 245, target.y - 275, target.z + 165);
        break;

      default:
        console.warn(`Unknown anatomical view: ${viewName}`);
        return;
    }

    this.camera.lookAt(target);
    this.controls.target.copy(target);
    this.controls.update();
  }

  // Backward compatibility alias
  setView(viewName) {
    this.setAnatomicalView(viewName);
  }

  captureScreenshot(scale = 1, transparent = false) {
    const prevBg = this.scene.background;
    if (transparent) {
      this.scene.background = null;
    }

    // Render at specified scale
    const originalWidth = this.width;
    const originalHeight = this.height;
    const targetW = originalWidth * scale;
    const targetH = originalHeight * scale;

    this.renderer.setSize(targetW, targetH, false);
    this.camera.aspect = targetW / targetH;
    this.camera.updateProjectionMatrix();

    this.renderer.render(this.scene, this.camera);

    const dataURL = this.renderer.domElement.toDataURL('image/png');

    // Restore original size
    this.renderer.setSize(originalWidth, originalHeight);
    this.camera.aspect = originalWidth / originalHeight;
    this.camera.updateProjectionMatrix();
    this.scene.background = prevBg;
    this.renderer.render(this.scene, this.camera);

    // Download file
    const link = document.createElement('a');
    link.download = `neuroviewer_capture_${Date.now()}.png`;
    link.href = dataURL;
    link.click();
  }

  addRenderHook(fn) {
    this.onRenderCallbacks.push(fn);
  }

  setTurntableSpin(enabled, secondsPerRotation = null) {
    this.turntableSpin = Boolean(enabled);
    this.controls.autoRotate = this.turntableSpin;
    if (secondsPerRotation !== null) {
      this.setTurntableSpeed(secondsPerRotation);
    } else {
      this.setTurntableSpeed(this.turntableSecondsPerRotation);
    }
  }

  setTurntableSpeed(secondsPerRotation) {
    const sec = Math.max(0.5, Number(secondsPerRotation) || 20);
    this.turntableSecondsPerRotation = sec;
    this.controls.autoRotateSpeed = 60.0 / sec;
  }

  render() {
    const delta = this.clock.getDelta();
    this.controls.update(delta);

    for (let i = 0; i < this.onRenderCallbacks.length; i++) {
      this.onRenderCallbacks[i]();
    }

    this.renderer.render(this.scene, this.camera);
  }

  start() {
    const loop = () => {
      requestAnimationFrame(loop);
      this.render();
    };
    requestAnimationFrame(loop);
  }
}
