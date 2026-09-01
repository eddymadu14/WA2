// app.js

import express from "express";
import cors from "cors";
import session from "express-session";
import connectMongoDBSession from "connect-mongodb-session";

// Routes
import leadsRoutes from "./routes/leads.routes.js";
import templatesRoutes from "./routes/templates.routes.js";
import broadcastRoutes from "./routes/broadcast.routes.js";
import settingsRoutes from "./routes/settings.routes.js";
import whatsappRouter from "./routes/whatsapp.routes.js";
import templateRoutes from "./routes/templates.routes.js";
import autoReplyRoutes from "./routes/autoReply.routes.js";
import userRoutes from "./routes/user.routes.js";

// Middleware
import { errorHandler } from "./middlewares/errorHandler.js";

const app = express();

/*
|--------------------------------------------------------------------------
| CORS
|--------------------------------------------------------------------------
*/

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

/*
|--------------------------------------------------------------------------
| Body Parsing
|--------------------------------------------------------------------------
*/

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/*
|--------------------------------------------------------------------------
| MongoDB Session Store
|--------------------------------------------------------------------------
|
| connect-mongodb-session@5 expects express-session to be passed into
| the factory before creating the store.
|
*/

const MongoDBStore = connectMongoDBSession(session);

const mongoStore = new MongoDBStore({
  uri: process.env.MONGO_URI,
  collection: "sessions",
});

/*
|--------------------------------------------------------------------------
| Express Session
|--------------------------------------------------------------------------
*/

app.use(
  session({
    secret:
      process.env.SESSION_SECRET ||
      "supersecretkey",

    resave: false,

    saveUninitialized: false,

    store: mongoStore,

    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 60,

      httpOnly: true,

      secure:
        process.env.NODE_ENV === "production",

      sameSite:
        process.env.NODE_ENV === "production"
          ? "none"
          : "lax",
    },
  })
);

/*
|--------------------------------------------------------------------------
| WhatsApp Initialization Sessions
|--------------------------------------------------------------------------
|
| Temporary in-memory tracking for QR initialization.
|
| IMPORTANT:
| This is NOT WhatsApp authentication/session persistence.
| It only tracks an active initialization process so that it can
| be terminated through /whatsapp/terminate-init.
|
*/

const whatsappInitSessions = new Map();

/*
|--------------------------------------------------------------------------
| Health Check
|--------------------------------------------------------------------------
*/

app.get("/", (req, res) => {
  res.status(200).send(
    "Whatsapp Automator is running"
  );
});

/*
|--------------------------------------------------------------------------
| Routes
|--------------------------------------------------------------------------
*/

app.use(
  "/settings",
  settingsRoutes
);

app.use(
  "/api/leads",
  leadsRoutes
);

app.use(
  "/api/templates",
  templatesRoutes
);

app.use(
  "/api/broadcast",
  broadcastRoutes
);

app.use(
  "/api/whatsapp",
  whatsappRouter
);

// Existing duplicate template route preserved
app.use(
  "/api/templates",
  templateRoutes
);

app.use(
  "/api/auto-replies",
  autoReplyRoutes
);

app.use(
  "/api/users",
  userRoutes
);

/*
|--------------------------------------------------------------------------
| WhatsApp QR Initialization Termination
|--------------------------------------------------------------------------
*/

app.post(
  "/whatsapp/terminate-init",
  async (req, res) => {
    try {
      const userId =
        req.session?.user?.id;

      if (!userId) {
        return res.status(401).json({
          message: "Not logged in",
        });
      }

      const initSession =
        whatsappInitSessions.get(
          String(userId)
        );

      if (!initSession) {
        return res.json({
          message:
            "No QR generation session found",
        });
      }

      /*
       * Some initialization objects may expose kill()
       * while others may expose a different cleanup method.
       */
      if (
        typeof initSession.kill ===
        "function"
      ) {
        initSession.kill();
      }

      whatsappInitSessions.delete(
        String(userId)
      );

      return res.json({
        success: true,
        message:
          "QR generation terminated",
      });
    } catch (error) {
      console.error(
        "[WHATSAPP] Failed to terminate initialization:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to terminate QR generation",
        error: error.message,
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Error Handler
|--------------------------------------------------------------------------
|
| Keep this AFTER all routes.
|
*/

app.use(errorHandler);

export default app;