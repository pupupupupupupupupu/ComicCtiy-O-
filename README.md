
---

# 🎨 Comic City

> A modern, full-stack webcomic platform empowering independent creators and readers with real-time collaboration, intelligent curation, and seamless chapter-by-chapter publishing.

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Socket.io](https://img.shields.io/badge/Realtime-Socket.io-010101?logo=socket.io&logoColor=white)](https://socket.io/)
[![Auth0](https://img.shields.io/badge/Auth-Auth0-EB5424?logo=auth0&logoColor=white)](https://auth0.com/)

---

## 📖 Overview
Great independent comics often get lost in the noise. **Comic City** was built to change that. It’s a purpose-driven platform where creators publish chapter-by-chapter, readers discover and track stories organically, and teams collaborate in real-time—all without algorithmic gatekeeping or fragmented tooling.

Every feature, from IP-deduplicated view tracking to allowance-based comment moderation, was engineered to keep the creator-reader relationship authentic, performant, and scalable.

---

## ✨ Key Features

### 🛠 Creator Toolkit
- **Chapter-by-Chapter Publishing**: Upload initial runs + append chapters dynamically with metadata validation.
- **Direct Browser → Cloudinary Uploads**: Bypasses Express payload limits. Pages are uploaded in parallel, preserving original quality and order.
- **Drag-to-Reorder UI**: Intuitive thumbnail grid with HTML5 drag-and-drop for perfect page sequencing before submission.
- **Collaboration Toggle**: Creators can open/close their comics to receive role-specific collaboration requests.

### 🤝 Real-Time Collaboration
- **Role Pitching System**: Writers, artists, colorists, etc. submit structured requests with portfolio links and chapter scope preferences.
- **Live Chat Workspace**: Socket.io-powered chat with typing indicators, read receipts, status tracking (`active` → `completed`), mute/block, and system messages.
- **Optimistic UI**: Messages render instantly locally, then reconcile with the server to eliminate perceived latency.

### 📚 Reader Experience
- **Continue-Reading History**: LocalStorage + cloud sync tracks exact chapter/page progress per user.
- **Public & Private Collections**: Organize bookmarks into named folders. Share taste publicly or keep reading lists private.
- **Threaded Comments & Replies**: Rich discussion with edit/delete controls. Creators moderate via a daily action allowance to prevent chaos.
- **Artist Pages & Follow System**: Dedicated profile pages aggregating all works by a creator. One-click follow/unfollow.

### 🔍 Discovery & Analytics
- **IP-Deduplicated View Tracking**: Prevents click farming by recording unique `(comicId, IP)` pairs with 24-hour TTL windows.
- **Weekly Popularity Charts**: Auto-resetting counters surface genuinely trending comics.
- **Deep Search**: Full-text search across titles, authors, genres, and synopses with debounced autocomplete.

### 🔒 Security & Auth
- **Auth0 Redirect Flow**: Secure, popup-free authentication with `onRedirectCallback` route restoration.
- **Email-Based Ownership**: Comics, comments, and moderation rights are consistently keyed to the uploader’s verified email.
- **CORS & Proxy Headers**: Explicit origin allowlisting + `x-forwarded-for` parsing for production environments behind Render/Vercel.

---

## 🛠 Tech Stack

| Layer | Technologies |
|-------|--------------|
| **Frontend** | React 18, React Router v6, Axios, Socket.io-client, MUI/Emotion, CSS Variables, Swiper, CRA |
| **Backend** | Node.js, Express 4, Mongoose 5, Socket.io 4, Cloudinary SDK, `express-async-errors` |
| **Auth & Media** | Auth0 (`@auth0/auth0-react`), Cloudinary (unsigned direct uploads) |
| **Deployment** | Render (Backend), Netlify/Vercel (Frontend), MongoDB Atlas |

---

## 🏗 Architecture Highlights

- **Monorepo Structure**: Clean separation between `backend/` (API, models, controllers, socket routing) and `front-end/` (components, pages, contexts, styles).
- **Namespace Routing**: Socket.io uses `/collab` namespace with dynamic room joins (`chat:${chatId}`, `user_email:${email}`).
- **Lazy Status Fetching**: `QuickSave` cards defer like/bookmark status checks until hover, keeping grid pages blazing fast.
- **Allowance-Based Moderation**: Comic owners get `Math.floor(totalComments * 0.20)` daily hide/delete actions. Resets every 24h to encourage fair moderation.
- **SPA Deep Linking**: `_redirects` file ensures client-side routing survives hard refreshes on Netlify/Vercel.

---

## 🚀 Getting Started

### Prerequisites
- Node.js `>=16` & npm `>=8`
- MongoDB Atlas URI
- Cloudinary Account
- Auth0 Application (SPA)

### 1️⃣ Clone & Install
```bash
git clone <your-repo-url>
cd ComicCityFixed
npm install --prefix backend
npm install --prefix front-end
```

### 2️⃣ Environment Setup
#### Backend (`backend/config.env`)
```env
DATABASE=mongodb+srv://<user>:<password>@cluster.mongodb.net/ComicCity?retryWrites=true&w=majority
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_NEW_secret
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
PORT=4000
```

#### Frontend (`front-end/.env`)
```env
REACT_APP_AUTH0_DOMAIN=your-domain.auth0.com
REACT_APP_AUTH0_CLIENT_ID=your_client_id
REACT_APP_URL=http://localhost:4000
REACT_APP_CLOUDINARY_CLOUD_NAME=your_cloud_name
REACT_APP_CLOUDINARY_UPLOAD_PRESET=comic_city_unsigned
```

### 3️⃣ Manual Configuration Steps
1. **Rotate Cloudinary Secret**: Generate a new API Secret in Cloudinary Dashboard → Settings → Access Keys.
2. **Create Unsigned Upload Preset**: Cloudinary Dashboard → Settings → Upload → Add Preset → Set `Signing Mode: Unsigned` → Name it `comic_city_unsigned` (must match `.env`).
3. **Auth0 Redirect URLs**: In your Auth0 SPA settings, add:
   - Allowed Callback URLs: `http://localhost:3000`
   - Allowed Logout URLs: `http://localhost:3000`
   - Allowed Web Origins: `http://localhost:3000`

### 4️⃣ Run Locally
```bash
# Terminal 1: Backend
cd backend && npm start
# → Listening on port 4000

# Terminal 2: Frontend
cd front-end && npm start
# → Opens http://localhost:3000
```

---

## 🌐 Deployment Guide

| Step | Action |
|------|--------|
| **Backend** | Push to Render. Set env vars: `DATABASE`, `CLOUDINARY_*`, `FRONTEND_URL` (production domain), `NODE_ENV=production`. |
| **Frontend** | Update `front-end/.env` to point to Render backend. Push to Netlify/Vercel. Ensure `public/_redirects` is deployed. |
| **Auth0** | Update Allowed Callback/Logout/Web Origins to your production domains. |
| **CORS** | Backend automatically parses `FRONTEND_URL` (comma-separated) for dynamic origin allowlisting. |

---

## 📡 API & Socket Reference (Semi-Technical)

### Core REST Endpoints
| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/comics?sort=weekly&page=1` | Paginated comics with weekly/total click counts |
| `POST` | `/api/comics` | Create comic (Cloudinary URLs only) |
| `PATCH` | `/api/comics/:id/view` | IP-deduplicated view tracker |
| `GET` | `/api/comics/:id/chapters` | Fetch all chapters sorted by number |
| `POST` | `/api/comics/:id/chapters` | Append chapter (owner email verification) |
| `GET` | `/api/collab/chats/:email` | Fetch user's collaboration workspaces |
| `POST` | `/api/collab/chat/:id/message` | Send message + broadcast via Socket.io |

### Socket Events (`/collab` namespace)
| Event | Payload | Description |
|-------|---------|-------------|
| `identify` | `{ email }` | Join personal notification room |
| `join_chat` / `leave_chat` | `{ chatId }` | Subscribe to chat room |
| `typing` / `stop_typing` | `{ chatId, senderName }` | Real-time typing indicators |
| `message_received` | `MessageDoc` | Broadcast new message to room |
| `status_changed` | `{ collabStatus }` | Sync collaboration state |
| `collab_ended` | `{ chatId }` | Force-read-only state |

---

## 🧩 Contribution & Roadmap

### 🛣 Upcoming
- [ ] Server-side image optimization pipeline (WebP conversion)
- [ ] Webhook-based email notifications for collab requests
- [ ] Reader analytics dashboard (heatmaps, scroll depth)
- [ ] Markdown support for comic descriptions & chapter notes
- [ ] Dark mode toggle with CSS variable persistence

### 🤝 Contributing
1. Fork & create a feature branch (`git checkout -b feat/awesome-feature`)
2. Commit using Conventional Commits (`feat:`, `fix:`, `refactor:`)
3. Open a PR with a clear description & screenshots (if UI)
4. Ensure `npm run build` passes locally

---

Built with ❤💫️ by an independent dev.

---

💡 **Need help?** Open an issue or reach out via the repo discussions.
🚀 **Ready to deploy?** Follow the [Deployment Guide](#-deployment-guide) and launch your instance in minutes.