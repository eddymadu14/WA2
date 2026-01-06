import express from "express";
import cors from "cors";
import leadsRoutes from "./routes/leads.routes.js";
import templatesRoutes from "./routes/templates.routes.js";
import broadcastRoutes from "./routes/broadcast.routes.js";
import settingsRoutes from "./routes/settings.routes.js";
import whatsappRouter from "./routes/whatsapp.routes.js";
//import statusRoutes from "./routes/status.routes.js";
import templateRoutes from "./routes/templates.routes.js";
import autoReplyRoutes from "./routes/autoReply.routes.js";
import userRoutes from "./routes/user.routes.js";
import { errorHandler } from "./middlewares/errorHandler.js";
//import dashboardRoutes from "./routes/dashboard.routes.js";




const app = express();
app.use(cors());
app.use(express.json());
const whatsappInitSessions = new Map(); // key: userId, value: session object
app.get("/", (req, res) => res.send("Whatsapp Automator is running"));
app.use("/settings", settingsRoutes);
app.use("/api/leads", leadsRoutes);
app.use("/api/templates", templatesRoutes);
app.use("/api/broadcast", broadcastRoutes);
//app.use("/api/status", statusRoutes);
app.use("/api/whatsapp", whatsappRouter);
app.use("/api/templates", templateRoutes);
app.use("/api/auto-replies", autoReplyRoutes);
app.use("/api/users", userRoutes);
//app.use("/api/dashboard", dashboardRoutes);


app.use(errorHandler);
// Only terminate QR-generating session if connected = false
app.post("/whatsapp/terminate-init", async (req, res) => {
  const userId = req.user.id;

  const session = whatsappInitSessions.get(userId); // map of QR init sessions
  if (session) {
    session.kill(); // stop QR generation / init logic
    whatsappInitSessions.delete(userId);
    return res.json({ message: "QR generation terminated" });
  }

  return res.json({ message: "No QR generation session found" });
});

export default app;
