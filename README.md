# Frontend — 2.5D Depth Studio

Frontend là static site (HTML/CSS/JS) để upload ảnh và render hiệu ứng 2.5D theo 2 chế độ:

- **Layer parallax** (nhiều lớp PNG RGBA)
- **Mesh displacement** (Three.js) dựa trên `depth_data`

---

## Ảnh minh hoạ

![Demo](https://res.cloudinary.com/dtwrwvffl/image/upload/v1770058015/Screenshot_2026-02-03_014456_eo4ydi.png)
![Original](https://res.cloudinary.com/dtwrwvffl/image/upload/v1770058055/young-man-singing-at-rock-concer_oztyhl.jpg)

---

## Links

- Demo (deploy): <http://25dimage.minhtran.tech/>
- Backend endpoint: <https://nermadie-2-5d-depth-studio.hf.space/api/process>
- Hugging Face Spaces: <https://huggingface.co/spaces/nermadie/2.5D_Depth_Studio>

---

## Chạy local

### Cách 1: chạy bằng static server (khuyến nghị)

```bash
cd frontend
python -m http.server 5173
```

Mở `http://localhost:5173`.

---

## Cấu hình backend URL

Frontend gọi API qua biến `API_URL` trong `app.js`.

Hiện tại trong source đã set sẵn:

- `https://nermadie-2-5d-depth-studio.hf.space/api/process`

- Dùng backend local:
  - `http://localhost:8000/api/process`

- Dùng Hugging Face Spaces:
  - URL Spaces của bạn + `/api/process`

---

## Kỹ thuật render (chi tiết)

### 1) Mesh displacement (Three.js)

Nếu backend trả `use_mesh: true` và có `depth_data`, frontend ưu tiên render mesh:

- Tạo plane mesh với nhiều segments.
- Map từng vertex tới `depth_data` và dịch chuyển trục Z theo depth.
- Texture là ảnh gốc → xoay nhẹ theo chuột để tạo cảm giác khối.

Trong code: `Mesh3DRenderer` (file `mesh3d.js`).

### 2) Layer parallax (CSS layers)

Nếu không có `depth_data`/mesh renderer, frontend fallback sang layers:

- Xếp các layer theo `index` (background → foreground).
- Nếu backend trả quá nhiều layer, slider “Số layer hiển thị” sẽ pick đều theo bước (để vẫn giữ dải depth).
- Mỗi layer dịch chuyển theo chuột với hệ số theo `depth`.

---

## Điều khiển trong UI

- **Parallax**: độ lệch layer theo chuột (cảm giác nổi khối)
- **Mượt (smoothness)**: độ trễ nội suy khi di chuyển
- **Chiều sâu (Z)**: tăng/giảm cường độ chiều sâu
- **Số layer hiển thị**: giảm để nhẹ máy, tăng để chi tiết

---

## Ghi chú

- Nếu bạn mở `index.html` trực tiếp (file://) đôi khi sẽ gặp vấn đề khi gọi API (CORS/đường dẫn). Nên chạy qua `http.server`.
- Nếu muốn UI đẹp hơn nữa (theme switch, preset, export video/GIF), mình có thể nâng cấp tiếp.
