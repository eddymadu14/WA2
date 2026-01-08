// app.js
import express from "express";
import cors from "cors";
import session from "express-session";
import MongoStore from "connect-mongodb-session";

import leadsRoutes from "./routes/leads.routes.js";
import templatesRoutes from "./routes/templates.routes.js";
import broadcastRoutes from "./routes/broadcast.routes.js";
import settingsRoutes from "./routes/settings.routes.js";
import whatsappRouter from "./routes/whatsapp.routes.js";
import templateRoutes from "./routes/templates.routes.js";
import autoReplyRoutes from "./routes/autoReply.routes.js";
import userRoutes from "./routes/user.routes.js";

import { errorHandler } from "./middlewares/errorHandler.js";

const app = express();
app.use(cors({ origin: true, credentials: true })); // allow cookies
app.use(express.json());

// --- MongoDB Session Setup ---
const mongoStore = new MongoStore({
  uri: process.env.MONGO_URI,
  collection: "sessions",
});

app.use(
  session({
    secret: process.env.SESSION_SECRET || "supersecretkey",
    resave: false,
    saveUninitialized: false,
    store: mongoStore,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 60, // 1 day
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    },
  })
);

// --- Initialize WhatsApp session map ---
const whatsappInitSessions = new Map(); // you can still track QR init sessions in-memory

// --- Routes ---
app.get("/", (req, res) => res.send("Whatsapp Automator is running"));

app.use("/settings", settingsRoutes);
app.use("/api/leads", leadsRoutes);
app.use("/api/templates", templatesRoutes);
app.use("/api/broadcast", broadcastRoutes);
app.use("/api/whatsapp", whatsappRouter);
app.use("/api/templates", templateRoutes);
app.use("/api/auto-replies", autoReplyRoutes);
app.use("/api/users", userRoutes);

app.use(errorHandler);

// --- WhatsApp QR termination route ---
app.post("/whatsapp/terminate-init", async (req, res) => {
  const userId = req.session.user?.id; // now reading from session
  if (!userId) return res.status(401).json({ message: "Not logged in" });

  const session = whatsappInitSessions.get(userId);
  if (session) {
    session.kill(); // stop QR generation / init logic
    whatsappInitSessions.delete(userId);
    return res.json({ message: "QR generation terminated" });
  }

  return res.json({ message: "No QR generation session found" });
});

export default app;