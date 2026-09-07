import * as THREE from 'three';

export class OrientationCube {
  constructor(mainCamera, mainControls, domContainer) {
    this.mainCamera = mainCamera;
    this.mainControls = mainControls;
    this.domContainer = domContainer;

    this.visible = true;
    this.width = 110;
    this.height = 110;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 50);
    this.camera.position.set(0, 0, 3.2);

    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.domElement = this.renderer.domElement;
    this.domElement.className = 'orientation-cube-canvas';
    this.domContainer.appendChild(this.domElement);

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.initCube();
    this.initEvents();
  }

  createFaceCanvas(text, bgColor = '#1e2026', textColor = '#ffffff') {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, 128, 128);

    // Border
    ctx.strokeStyle = '#4a5162';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, 122, 122);

    // Text
    ctx.fillStyle = textColor;
    ctx.font = 'bold 54px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  initCube() {
    // MNI coordinates:
    // +X: Right (R)    -X: Left (L)
    // +Y: Anterior (A) -Y: Posterior (P)
    // +Z: Superior (S) -Z: Inferior (I)
    // Three.js BoxGeometry face order:
    // 0: +X (Right)
    // 1: -X (Left)
    // 2: +Y (Anterior / Top in 3JS default, but Anterior in MNI)
    // 3: -Y (Posterior)
    // 4: +Z (Superior)
    // 5: -Z (Inferior)

    const materials = [
      new THREE.MeshBasicMaterial({ map: this.createFaceCanvas('R', '#242a38', '#ff7777') }), // +X: Right
      new THREE.MeshBasicMaterial({ map: this.createFaceCanvas('L', '#242a38', '#ff7777') }), // -X: Left
      new THREE.MeshBasicMaterial({ map: this.createFaceCanvas('A', '#242a38', '#77ff77') }), // +Y: Anterior
      new THREE.MeshBasicMaterial({ map: this.createFaceCanvas('P', '#242a38', '#77ff77') }), // -Y: Posterior
      new THREE.MeshBasicMaterial({ map: this.createFaceCanvas('S', '#242a38', '#77aaff') }), // +Z: Superior
      new THREE.MeshBasicMaterial({ map: this.createFaceCanvas('I', '#242a38', '#77aaff') })  // -Z: Inferior
    ];

    const geom = new THREE.BoxGeometry(1.4, 1.4, 1.4);
    this.cube = new THREE.Mesh(geom, materials);
    this.scene.add(this.cube);

    const edgeGeom = new THREE.EdgesGeometry(geom);
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x667799 });
    this.scene.add(new THREE.LineSegments(edgeGeom, edgeMat));
  }

  initEvents() {
    this.domElement.addEventListener('click', (e) => {
      const rect = this.domElement.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / this.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / this.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = this.raycaster.intersectObject(this.cube);

      if (intersects.length > 0) {
        const faceIndex = Math.floor(intersects[0].faceIndex / 2);
        this.snapToFace(faceIndex);
      }
    });
  }

  snapToFace(faceIndex) {
    // Face indices: 0: +X (R), 1: -X (L), 2: +Y (A), 3: -Y (P), 4: +Z (S), 5: -Z (I)
    const target = this.mainControls.target.clone();
    const dist = this.mainCamera.position.distanceTo(target) || 280;

    let dir = new THREE.Vector3();
    let up = new THREE.Vector3(0, 0, 1);

    switch (faceIndex) {
      case 0: // Right (+X)
        dir.set(1, 0, 0);
        up.set(0, 0, 1);
        break;
      case 1: // Left (-X)
        dir.set(-1, 0, 0);
        up.set(0, 0, 1);
        break;
      case 2: // Anterior (+Y)
        dir.set(0, 1, 0);
        up.set(0, 0, 1);
        break;
      case 3: // Posterior (-Y)
        dir.set(0, -1, 0);
        up.set(0, 0, 1);
        break;
      case 4: // Superior (+Z)
        dir.set(0, -0.0002, 1);
        up.set(0, 0, 1);
        break;
      case 5: // Inferior (-Z)
        dir.set(0, 0.0002, -1);
        up.set(0, 0, 1);
        break;
    }

    this.mainCamera.position.copy(target).add(dir.multiplyScalar(dist));
    this.mainCamera.up.copy(up);
    this.mainCamera.lookAt(target);
    this.mainControls.update();
  }

  update() {
    if (!this.visible) return;

    // Synchronize rotation with main camera
    this.camera.position.copy(this.mainCamera.position).sub(this.mainControls.target).normalize().multiplyScalar(3.2);
    this.camera.up.copy(this.mainCamera.up);
    this.camera.lookAt(0, 0, 0);

    this.renderer.render(this.scene, this.camera);
  }

  setVisible(visible) {
    this.visible = visible;
    this.domElement.style.display = visible ? 'block' : 'none';
  }
}
