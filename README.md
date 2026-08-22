# Party Banners 🎨

A full-stack collaborative event platform where registered Fans and Admins can:
1. **Party Registry & Tapestries**: Create and explore dedicated Parties, each with unique themes, descriptions, tags, social links, and rich stitched Tapestries.
2. **Upload Images with Name Badges**: Upload photos or illustrations which are automatically branded server-side with a stylish custom name badge overlay using **Sharp**.
3. **Craft Mosaic Banner Tapestries**: Stitch user-uploaded photos into high-resolution composite tapestry mosaic banners with layout controls and constituent tile inspection.
4. **Live Real-time Message Feed**: Stream event messages in real time powered by **Server-Sent Events (SSE)** and SQLite persistence, with 255-character limits.
5. **Honor System & Content Moderation**:
   - **Fan Honor System**: Fans start with Good Honor, transitioning to Poor and Bad upon overturned reports, with automatic time-based upgrades (1 week for Bad $\rightarrow$ Poor, 1 month for Poor $\rightarrow$ Good).
   - **Reporting & Moderation**: Report Parties, image tiles, or messages. Reported items are immediately hidden from regular users and placed in the Admin Moderation Queue.
   - **Super Admin & Role Promotion**: Super Admin control center for promoting/demoting users between Fan and Admin, with conflict-of-interest protections preventing standard Admins from reviewing their own reports while empowering the Super Admin with full oversight.
6. **Flexible Authentication**: Google OAuth 2.0 supported with built-in instant Dev Personas for zero-config local testing.

---

## 🏗️ Architecture & Tech Stack

- **Backend**: Node.js & Express
- **Database**: SQLite (using Node's native high-performance `node:sqlite`)
- **Image Processing**: `sharp` for pixel-level name overlay composition and grid mosaic stitching
- **Real-Time Feed**: Server-Sent Events (SSE) `/api/messages/stream` + REST pagination `/api/messages`
- **Frontend**: React 18, Vite, Tailwind CSS, Lucide Icons

---

## 🚀 Quick Start

### 🏭 Running in Production Mode (Single Port)

In production mode, the backend server directly serves the compiled frontend bundle, uploaded assets, and API routes on a single port (`http://localhost:3001`):

```bash
# 1. Build the production frontend bundle
npm run build

# 2. Start the unified production server
npm start
```
Now navigate to `http://localhost:3001` in your browser.

---

### 💻 Running in Development Mode (Hot-Reloading)

To run in development mode with hot-reloading for both server and client:

```bash
# Terminal 1: Backend Server (Port 3001)
npm run dev:server

# Terminal 2: Frontend Client (Port 5173 with Vite hot-reload)
npm run dev:client
```
Open `http://localhost:5173` in your browser.

---

## 🧪 Running Backend Automated Tests
```bash
cd server
npm test
```

---

## 🔌 API Endpoints Summary

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/health` | No | Server health check |
| `POST` | `/api/auth/dev-login` | No | Dev Quick Login with custom persona |
| `POST` | `/api/auth/google` | No | Verify Google OAuth Credential |
| `GET` | `/api/auth/me` | Yes | Get authenticated user profile |
| `GET` | `/api/parties` | No | List all active and blessed Parties |
| `GET` | `/api/parties/:id` | No | Get Party details by ID |
| `POST` | `/api/parties` | Admin | Register a new Party |
| `PUT` | `/api/parties/:id` | Admin | Update an existing Party |
| `DELETE`| `/api/parties/:id`| Admin | Delete a Party |
| `POST` | `/api/uploads` | Yes | Upload image & burn name badge |
| `GET` | `/api/uploads` | No | List constituent tiles for a Party |
| `POST` | `/api/banner/generate`| Yes | Stitch images into composite tapestry banner |
| `GET` | `/api/banner/latest` | No | Get most recent banner tapestry for a Party |
| `GET` | `/api/messages` | No | Paginated message feed history for a Party |
| `POST` | `/api/messages` | Yes | Post a new message & broadcast via SSE |
| `GET` | `/api/messages/stream`| No | Server-Sent Events (SSE) live message stream |
| `POST` | `/api/moderation/report` | Yes | Report a Party, image, or message |
| `GET` | `/api/moderation/queue` | Admin | View Moderation Queue |
| `POST` | `/api/moderation/review` | Admin | Agree (Ban) or Disagree (Bless) reported content |
| `GET` | `/api/users/dashboard` | Admin | Paginated rich directory of registered accounts |
| `POST` | `/api/users/:id/role` | Super | Promote/Demote between Fan and Admin roles |
| `POST` | `/api/users/:id/ban` | Admin | Ban/Unban user account |
