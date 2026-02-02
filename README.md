# Frontend — 2.5D Depth Studio

This frontend is a static site (HTML/CSS/JS) that uploads an image and renders a 2.5D effect in two modes:

- **Layer parallax** (multiple RGBA PNG layers)
- **Mesh displacement** (Three.js) driven by `depth_data`

---

## Images

![Demo output](https://res.cloudinary.com/dtwrwvffl/image/upload/v1770058015/Screenshot_2026-02-03_014456_eo4ydi.png)
![Original input](https://res.cloudinary.com/dtwrwvffl/image/upload/v1770058055/young-man-singing-at-rock-concer_oztyhl.jpg)

---

## Links

- Live demo: <http://25dimage.minhtran.tech/>
- Backend endpoint: <https://nermadie-2-5d-depth-studio.hf.space/api/process>
- Hugging Face Spaces: <https://huggingface.co/spaces/nermadie/2.5D_Depth_Studio>

---

## Run locally

### Option 1: static server (recommended)

```bash
cd frontend
python -m http.server 5173
```

Open `http://localhost:5173`.

---

## Configure the backend URL

The frontend calls the API via the `API_URL` constant in `app.js`.

The current source is set to:

- `https://nermadie-2-5d-depth-studio.hf.space/api/process`

- Use a local backend:
  - `http://localhost:8000/api/process`

- Use Hugging Face Spaces:
  - your Space URL + `/api/process`

---

## Rendering details (technical)

### 1) Mesh displacement (Three.js)

If the backend returns `use_mesh: true` and includes `depth_data`, the frontend will prefer mesh rendering:

- Build a plane mesh with many segments.
- Map each vertex to `depth_data` and displace the Z axis by depth.
- Use the original image as a texture → subtle rotation from mouse movement creates the 3D feel.

In code: `Mesh3DRenderer` (file `mesh3d.js`).

### 2) Layer parallax (CSS layers)

If `depth_data` / the mesh renderer is not available, the frontend falls back to layer rendering:

- Sort layers by `index` (background → foreground).
- If the backend returns too many layers, the “Visible layers” slider will sample evenly (to keep the depth range).
- Move each layer with the mouse, scaled by its `depth`.

---

## UI controls

- **Parallax**: how far layers shift with the mouse
- **Smoothness**: interpolation lag while moving
- **Depth (Z)**: depth intensity
- **Visible layers**: lower = faster, higher = more detail

---

## Notes

- If you open `index.html` directly (file://), you may run into API issues (CORS/paths). Use `http.server`.
- If you want more UI features (theme switch, presets, export video/GIF), this can be extended.
