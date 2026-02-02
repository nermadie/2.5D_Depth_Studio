// Facebook-style 3D Mesh Renderer using Three.js
class Mesh3DRenderer {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.mesh = null;
    this.imageTexture = null;
    this.depthData = null;
    this.mouseX = 0;
    this.mouseY = 0;
    this.targetRotationX = 0;
    this.targetRotationY = 0;
    this.currentRotationX = 0;
    this.currentRotationY = 0;
    this.isActive = false;

    this.config = {
      depthScale: 60, // Increase depth so background variation is more visible
      rotationSpeed: 0.08, // Rotation smoothing speed
      maxRotation: 0.25, // Max rotation angle (radians)
      segments: 128, // Increase segments for more detail
    };

    this.depthIntensity = 1.0;
  }

  async init(imageUrl, depthData, width, height) {
    this.depthData = depthData;
    this.imageWidth = width;
    this.imageHeight = height;

    // Setup Three.js scene
    this.scene = new THREE.Scene();

    // Camera with perspective - tuned to fit the image
    const aspect = width / height;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 5000);

    // Compute camera position so the image fits the viewport
    const fov = this.camera.fov * (Math.PI / 180);
    const cameraZ = Math.abs(height / 2 / Math.tan(fov / 2));
    this.camera.position.z = cameraZ * 1.5; // Add buffer to see the full image

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });

    // Fit canvas to container
    const container = this.container.getBoundingClientRect();
    const containerAspect = container.width / container.height;
    let renderWidth, renderHeight;

    if (aspect > containerAspect) {
      // Image is wider than the container
      renderWidth = container.width;
      renderHeight = container.width / aspect;
    } else {
      // Image is taller than the container
      renderHeight = container.height;
      renderWidth = container.height * aspect;
    }

    this.renderer.setSize(renderWidth, renderHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    // Clear container and mount the canvas
    this.container.innerHTML = "";
    this.container.appendChild(this.renderer.domElement);

    // Add zoom controls
    this.setupZoomControls();

    // Load image texture
    const loader = new THREE.TextureLoader();
    this.imageTexture = await new Promise((resolve) => {
      loader.load(imageUrl, (texture) => {
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        resolve(texture);
      });
    });

    // Create mesh
    this.createDepthMesh(width, height);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight.position.set(0, 0, 1);
    this.scene.add(directionalLight);

    this.isActive = true;
    this.animate();
  }

  setupZoomControls() {
    this.zoomLevel = 1.0;

    // Mouse wheel zoom
    this.renderer.domElement.addEventListener("wheel", (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 1.1 : 0.9;
      this.zoomLevel *= delta;
      this.zoomLevel = Math.max(0.5, Math.min(3.0, this.zoomLevel)); // Clamp zoom: 0.5x - 3x
    });
  }

  setDepthIntensity(intensity) {
    this.depthIntensity = intensity;
    if (this.mesh) {
      this.mesh.scale.z = intensity;
    }
  }

  createDepthMesh(width, height) {
    const segments = this.config.segments;
    const geometry = new THREE.PlaneGeometry(width, height, segments, segments);

    // Validate depthData
    if (
      !this.depthData ||
      !Array.isArray(this.depthData) ||
      this.depthData.length === 0
    ) {
      console.error("Invalid depth data:", this.depthData);
      return;
    }

    // Apply depth to vertices
    const vertices = geometry.attributes.position.array;
    const depthHeight = this.depthData.length;
    const depthWidth = this.depthData[0]?.length || 0;

    if (depthWidth === 0) {
      console.error("Depth data has no width");
      return;
    }

    for (let i = 0; i < segments + 1; i++) {
      for (let j = 0; j < segments + 1; j++) {
        const index = (i * (segments + 1) + j) * 3;

        // Map vertex position to depth data
        const depthY = Math.min(
          Math.floor((i / segments) * depthHeight),
          depthHeight - 1,
        );
        const depthX = Math.min(
          Math.floor((j / segments) * depthWidth),
          depthWidth - 1,
        );

        // Get depth value (0-1)
        const depth = this.depthData[depthY][depthX];

        // Displace Z position based on depth
        vertices[index + 2] = depth * this.config.depthScale;
      }
    }

    geometry.computeVertexNormals();

    // Material with image texture
    const material = new THREE.MeshStandardMaterial({
      map: this.imageTexture,
      side: THREE.DoubleSide,
      flatShading: false,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.scene.add(this.mesh);
  }

  updateMousePosition(normalizedX, normalizedY) {
    // normalizedX, normalizedY: -1 to 1
    this.targetRotationY = normalizedX * this.config.maxRotation;
    this.targetRotationX = -normalizedY * this.config.maxRotation;
  }

  animate() {
    if (!this.isActive) return;

    requestAnimationFrame(() => this.animate());

    // Smooth rotation
    this.currentRotationX +=
      (this.targetRotationX - this.currentRotationX) *
      this.config.rotationSpeed;
    this.currentRotationY +=
      (this.targetRotationY - this.currentRotationY) *
      this.config.rotationSpeed;

    // Apply rotation and zoom to the mesh
    if (this.mesh) {
      this.mesh.rotation.x = this.currentRotationX;
      this.mesh.rotation.y = this.currentRotationY;
      this.mesh.scale.set(
        this.zoomLevel,
        this.zoomLevel,
        this.zoomLevel * this.depthIntensity,
      );
    }

    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    this.isActive = false;
    if (this.renderer) {
      this.renderer.dispose();
    }
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
    }
  }

  resize(width, height) {
    if (this.camera && this.renderer) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    }
  }
}

// Export for use
window.Mesh3DRenderer = Mesh3DRenderer;
