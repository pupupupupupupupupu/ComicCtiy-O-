require("express-async-errors");
const dotenv    = require("dotenv");
const express   = require("express");
const http      = require("http");
const mongoose  = require("mongoose");
const cors      = require("cors");
const { Server } = require("socket.io");

dotenv.config({ path: "./config.env" });

const comicRoutes        = require("./router/comicRouter");
const chapterRoutes      = require("./router/chapterRouter");
const commentRoutes      = require("./router/commentRouter");
const historyRoutes      = require("./router/historyRouter");
const profileRoutes      = require("./router/profileRouter");
const collectionRoutes   = require("./router/collectionRouter");
const bookmarkRoutes     = require("./router/bookmarkRouter");
const likeRoutes         = require("./router/likeRouter");
const savedArtistRoutes  = require("./router/savedArtistRouter");
const collabRoutes       = require("./router/collabRouter");
const notificationRoutes = require("./router/notificationRouter");
const { toggleCollabOpen } = require("./controllers/collabController");
const { setIO }            = require("./socket");

const app    = express();
const server = http.createServer(app);

// ─── CORS ─────────────────────────────────────────────────────────────────
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(",").map((o) => o.trim())
  : ["http://localhost:3000"];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

if (process.env.NODE_ENV !== "production") {
  app.use((req, _res, next) => { console.log(`[${req.method}] ${req.path}`); next(); });
}

// ─── ROUTES ───────────────────────────────────────────────────────────────
app.use("/api/comics",                   comicRoutes);
app.use("/api/comics/:comicId/chapters", chapterRoutes);
app.use("/api/comics/:comicId/comments", commentRoutes);
app.use("/api/history",                  historyRoutes);
app.use("/api/profile",                  profileRoutes);
app.use("/api/collections",              collectionRoutes);
app.use("/api/bookmarks",                bookmarkRoutes);
app.use("/api/likes",                    likeRoutes);
app.use("/api/saved-artists",             savedArtistRoutes);
app.use("/api/collab",                   collabRoutes);
app.use("/api/notifications",            notificationRoutes);
app.patch("/api/comics/:id/collab-toggle", toggleCollabOpen);
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

// ─── GLOBAL ERROR HANDLER ─────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  if (process.env.NODE_ENV !== "production") console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Internal Server Error" });
});

// ─── SOCKET.IO ────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: allowedOrigins, methods: ["GET", "POST", "PATCH", "DELETE"], credentials: true },
});
setIO(io);

const collabNS = io.of("/collab");
collabNS.on("connection", (socket) => {
  socket.on("identify", ({ email }) => { if (email) socket.join(`user_email:${email}`); });
  socket.on("join_chat",   ({ chatId })    => { if (chatId) socket.join(`chat:${chatId}`); });
  socket.on("leave_chat",  ({ chatId })    => { if (chatId) socket.leave(`chat:${chatId}`); });
  socket.on("typing",      ({ chatId, senderName }) => socket.to(`chat:${chatId}`).emit("typing", { senderName }));
  socket.on("stop_typing", ({ chatId })    => socket.to(`chat:${chatId}`).emit("stop_typing"));
});

// ─── DB + SERVER ──────────────────────────────────────────────────────────
const dbUri = (process.env.DATABASE || "").replace(/\r/g, "").trim();

mongoose.connect(dbUri, { dbName: "ComicCity" })
  .then(() => {
    console.log("Connected → ComicCity");
    server.listen(process.env.PORT || 4000, () =>
      console.log("Listening on port " + (process.env.PORT || 4000))
    );
  })
  .catch((err) => { console.error("DB error:", err.message); process.exit(1); });
