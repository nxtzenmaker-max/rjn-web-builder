# 🚀 RJN Autonomous Cloud Web Builder (Railway Production)

Dedicated high-performance web generation and hosting microservice powered by **Claude Opus 5.5 (FreeModel)** and built for **RJN AI**.

---

## ⚡ Superpowers & Features

- **Autonomous Code Synthesis**: Generates full single-file production HTML5, CSS3, modern animations, and responsive JS via Claude Opus 5.5.
- **Instant Cloud Hosting**: Every site is served live immediately at `/sites/:id`.
- **Interactive Multi-Device Previewer**: Preview generated websites instantly inside simulated Mobile, Tablet, and Desktop frames (`/preview/:id`).
- **Iterative Live Refinement**: Send modifications via `/api/sites/:id/edit` to update any existing website.
- **One-Click Download**: Direct download of generated production code.

---

## 🌐 Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` | Web Builder Dashboard & Generator UI |
| `POST` | `/api/build` | Generates a new website via Claude Opus 5.5 |
| `POST` | `/api/sites/:id/edit` | Modifies an existing website |
| `GET` | `/sites/:id` | Renders the live website |
| `GET` | `/preview/:id` | Interactive responsive device previewer |
| `GET` | `/api/sites` | Lists all generated sites with live URLs |
| `GET` | `/health` | Health & uptime telemetry |
