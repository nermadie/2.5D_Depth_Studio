const API_URL = "https://nermadie-2-5d-depth-studio.hf.space/api/process";

// State
let meshRenderer = null;
let currentMouseX = 0;
let currentMouseY = 0;
let targetMouseX = 0;
let targetMouseY = 0;
let isActive = false;

// Config
let config = {
  parallaxStrength: 30,
  rotationAmount: 4,
  smoothness: 0.12,
  depthScaleBase: 50,
  depthIntensity: 1.0,
  useMesh: true,
};

// DOM elements
const fileInput = document.getElementById("fileInput");
const viewer = document.getElementById("viewer");
const layersContainer = document.getElementById("layersContainer");
const loading = document.getElementById("loading");
const placeholder = document.getElementById("placeholder");
const status = document.getElementById("status");
const strengthSlider = document.getElementById("strength");
const strengthValue = document.getElementById("strengthValue");
const smoothnessSlider = document.getElementById("smoothness");
const smoothnessValue = document.getElementById("smoothnessValue");
const depthSlider = document.getElementById("depthIntensity");
const depthValue = document.getElementById("depthValue");
const layerCountSlider = document.getElementById("layerCount");
const layerCountValue = document.getElementById("layerCountValue");

// Init display values
depthValue.textContent = parseFloat(depthSlider.value).toFixed(2);
layerCountValue.textContent = layerCountSlider.value;
config.depthScale = config.depthScaleBase * config.depthIntensity;

// Update controls
strengthSlider.addEventListener("input", (e) => {
  config.parallaxStrength = parseInt(e.target.value);
  strengthValue.textContent = config.parallaxStrength;
});

smoothnessSlider.addEventListener("input", (e) => {
  config.smoothness = parseFloat(e.target.value);
  smoothnessValue.textContent = config.smoothness.toFixed(2);
});

depthSlider.addEventListener("input", (e) => {
  config.depthIntensity = parseFloat(e.target.value);
  depthValue.textContent = config.depthIntensity.toFixed(2);
  config.depthScale = config.depthScaleBase * config.depthIntensity;
  if (meshRenderer) {
    meshRenderer.setDepthIntensity(config.depthIntensity);
  }
});

layerCountSlider.addEventListener("input", (e) => {
  layerCountValue.textContent = e.target.value;
});

// File upload handler
fileInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  loading.classList.add("active");
  placeholder.classList.add("hidden");
  status.textContent = "🔄 Processing your image with AI...";
  layersContainer.innerHTML = "";

  try {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(API_URL, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (data.success) {
      status.textContent = "✅ Done! Move your mouse to see the 3D effect";

      // Prefer mesh rendering when depth data is available
      if (data.use_mesh && data.depth_data && window.Mesh3DRenderer) {
        await initMeshRenderer(data);
      } else {
        await initLayers(data.layers);
      }
    } else {
      status.textContent = "❌ Error: " + data.error;
      placeholder.classList.remove("hidden");
    }
  } catch (error) {
    status.textContent =
      "❌ Cannot reach the backend. Make sure the server is running!";
    placeholder.classList.remove("hidden");
    console.error("Error:", error);
  } finally {
    loading.classList.remove("active");
  }
});

async function initMeshRenderer(data) {
  // Cleanup previous renderer
  if (meshRenderer) {
    meshRenderer.destroy();
  }

  // Validate depth data
  if (!data.depth_data || !Array.isArray(data.depth_data)) {
    console.error("Invalid depth_data from backend:", data.depth_data);
    status.textContent = "❌ Error: invalid depth data";
    return;
  }

  console.log(
    "Depth data dimensions:",
    data.depth_data.length,
    "x",
    data.depth_data[0]?.length,
  );

  // Create new mesh renderer
  meshRenderer = new window.Mesh3DRenderer(layersContainer);
  await meshRenderer.init(data.image, data.depth_data, data.width, data.height);

  isActive = true;

  // Mouse tracking for mesh
  viewer.addEventListener("mousemove", handleMeshMouseMove);
  viewer.addEventListener("mouseleave", handleMeshMouseLeave);
}

function handleMeshMouseMove(e) {
  if (!meshRenderer || !isActive) return;

  const rect = viewer.getBoundingClientRect();
  const normalizedX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  const normalizedY = ((e.clientY - rect.top) / rect.height) * 2 - 1;

  meshRenderer.updateMousePosition(normalizedX, normalizedY);
}

function handleMeshMouseLeave() {
  if (meshRenderer) {
    meshRenderer.updateMousePosition(0, 0);
  }
}

async function initLayers(layersData) {
  // Cleanup mesh renderer if exists
  if (meshRenderer) {
    meshRenderer.destroy();
    meshRenderer = null;
  }

  layersContainer.innerHTML = "";
  let layers = [];

  // Sort: background first, foreground last
  layersData.sort((a, b) => a.index - b.index);

  // Limit layer count based on slider
  const maxLayers = parseInt(layerCountSlider.value, 10) || layersData.length;
  const picked = [];
  if (layersData.length <= maxLayers) {
    picked.push(...layersData);
  } else {
    const step = (layersData.length - 1) / (maxLayers - 1);
    for (let i = 0; i < maxLayers; i++) {
      const idx = Math.round(i * step);
      picked.push(layersData[idx]);
    }
  }

  // Create layer elements
  for (let layerData of picked) {
    const layerDiv = document.createElement("div");
    layerDiv.className = "layer";

    // Preload image
    const img = new Image();
    img.src = layerData.data;
    await img.decode();

    layerDiv.style.backgroundImage = `url(${layerData.data})`;
    layerDiv.style.backgroundSize = "cover";
    layerDiv.style.backgroundPosition = "center";

    const depthFactor = layerData.depth;

    layersContainer.appendChild(layerDiv);

    layers.push({
      element: layerDiv,
      depth: depthFactor,
      name: layerData.name,
    });
  }

  isActive = true;
  animate();
}

// Mouse tracking - improved
viewer.addEventListener("mousemove", (e) => {
  if (!isActive) return;

  const rect = viewer.getBoundingClientRect();
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;

  // Normalize to -1..1 with an easing curve
  targetMouseX = (e.clientX - rect.left - centerX) / centerX;
  targetMouseY = (e.clientY - rect.top - centerY) / centerY;

  // Apply ease curve for a more natural feel
  targetMouseX =
    easeInOutQuad(Math.abs(targetMouseX)) * Math.sign(targetMouseX);
  targetMouseY =
    easeInOutQuad(Math.abs(targetMouseY)) * Math.sign(targetMouseY);
});

viewer.addEventListener("mouseleave", () => {
  targetMouseX = 0;
  targetMouseY = 0;
});

// Touch support - improved
let touchStartX = 0;
let touchStartY = 0;
let lastTouchX = 0;
let lastTouchY = 0;

viewer.addEventListener("touchstart", (e) => {
  if (!isActive) return;
  const touch = e.touches[0];
  const rect = viewer.getBoundingClientRect();

  touchStartX = touch.clientX - rect.left;
  touchStartY = touch.clientY - rect.top;
  lastTouchX = touchStartX;
  lastTouchY = touchStartY;
});

viewer.addEventListener("touchmove", (e) => {
  if (!isActive) return;
  e.preventDefault();

  const touch = e.touches[0];
  const rect = viewer.getBoundingClientRect();

  const currentX = touch.clientX - rect.left;
  const currentY = touch.clientY - rect.top;

  const centerX = rect.width / 2;
  const centerY = rect.height / 2;

  targetMouseX = (currentX - centerX) / centerX;
  targetMouseY = (currentY - centerY) / centerY;

  lastTouchX = currentX;
  lastTouchY = currentY;
});

viewer.addEventListener("touchend", () => {
  // Smooth return to center
  targetMouseX = 0;
  targetMouseY = 0;
});

// Easing function
function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

// Animation loop - Facebook-style
function animate() {
  if (!isActive) return;

  // Smooth interpolation with momentum
  const smoothFactor = config.smoothness;
  currentMouseX += (targetMouseX - currentMouseX) * smoothFactor;
  currentMouseY += (targetMouseY - currentMouseY) * smoothFactor;

  // Stop animation when close to center
  if (Math.abs(currentMouseX) < 0.001 && Math.abs(targetMouseX) < 0.001) {
    currentMouseX = 0;
  }
  if (Math.abs(currentMouseY) < 0.001 && Math.abs(targetMouseY) < 0.001) {
    currentMouseY = 0;
  }

  // Update layers with improved parallax
  layers.forEach((layer, index) => {
    // Facebook-style depth-based movement
    const depthMultiplier = layer.depth;

    // Parallax offset
    const parallaxX = currentMouseX * config.parallaxStrength * depthMultiplier;
    const parallaxY = currentMouseY * config.parallaxStrength * depthMultiplier;

    // Z-depth for true 3D
    const depthZ =
      (layer.depth - 0.5) * (config.depthScaleBase * config.depthIntensity);

    // Scale - closer layers slightly bigger
    const scale = 1.01 + layer.depth * 0.01;

    // Apply transform with hardware acceleration
    layer.element.style.transform = `
            translate3d(${parallaxX}px, ${parallaxY}px, ${depthZ}px)
            scale(${scale})
        `;

    // Optional: slight opacity variation for depth
    const opacity = 0.95 + layer.depth * 0.05;
    layer.element.style.opacity = opacity;
  });

  // Container tilt - subtle 3D effect
  const tiltX = -currentMouseY * config.rotationAmount;
  const tiltY = currentMouseX * config.rotationAmount;

  layersContainer.style.transform = `
        perspective(1000px)
        rotateX(${tiltX}deg)
        rotateY(${tiltY}deg)
    `;

  requestAnimationFrame(animate);
}

// Gyroscope support (for mobile)
if (window.DeviceOrientationEvent) {
  window.addEventListener("deviceorientation", (e) => {
    if (!isActive || !config.gyroEnabled) return;

    // Convert device orientation to mouse position
    const gamma = e.gamma; // Left to right tilt in degrees (-90 to 90)
    const beta = e.beta; // Front to back tilt in degrees (-180 to 180)

    if (gamma !== null && beta !== null) {
      targetMouseX = Math.max(-1, Math.min(1, gamma / 45));
      targetMouseY = Math.max(-1, Math.min(1, (beta - 90) / 45));
    }
  });
}

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  if (!isActive) return;

  switch (e.key) {
    case "ArrowUp":
      config.parallaxStrength = Math.min(100, config.parallaxStrength + 5);
      strengthSlider.value = config.parallaxStrength;
      strengthValue.textContent = config.parallaxStrength;
      break;
    case "ArrowDown":
      config.parallaxStrength = Math.max(0, config.parallaxStrength - 5);
      strengthSlider.value = config.parallaxStrength;
      strengthValue.textContent = config.parallaxStrength;
      break;
    case "r":
    case "R":
      // Reset to center
      targetMouseX = 0;
      targetMouseY = 0;
      break;
  }
});

// Info logging
console.log(`
🎨 Facebook 3D Photo Effect - Improved Version

Improvements:
✅ More accurate depth estimation
✅ Smarter layer separation
✅ Edge-aware inpainting
✅ Soft alpha blending
✅ Smooth animation
✅ Touch & gyroscope support

Shortcuts:
- Arrow Up/Down: Adjust strength
- R: Reset to center

Upload an image to get started!
`);

// Initialize
status.textContent = "📤 Upload an image to get started";
