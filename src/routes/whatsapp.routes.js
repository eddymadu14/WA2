// routes/whatsapp.routes.js
import express from "express";
import { protect } from "../middlewares/authMiddleware1.js";
import WhatsAppSession from "../models/WhatsAppSession.js";
import { initWhatsAppForUser } from "../services/whatsapp.service.js";
import { destroyClient } from "../services/whatsapp.manager.js";

const router = express.Router();

/**
 * POST /whatsapp/connect
 * Initializes WhatsApp client for logged-in user
 */
router.post("/connect", protect, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(400).json({ message: "User ID missing" });

    // Initialize WhatsApp client for this user
    await initWhatsAppForUser(userId);

    // Ensure session exists in DB
    await WhatsAppSession.updateOne(
      { userId },
      { connected: false, requiresQR: true },
      { upsert: true }
    );

    res.json({ success: true, message: "WhatsApp client initializing" });
  } catch (err) {
    console.error(`[WA ROUTES] /connect error:`, err);
    res.status(500).json({ message: "Failed to connect WhatsApp", error: err.message });
  }
});

/**
 * GET /whatsapp/status
 * Returns current WhatsApp session info
 */
router.get("/status", protect, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(400).json({ message: "User ID missing" });

    let session = await WhatsAppSession.findOne({ userId });
    if (!session) {
      session = await WhatsAppSession.create({ userId });
    }

    res.json(session);
  } catch (err) {
    console.error(`[WA ROUTES] /status error:`, err);
    res.status(500).json({ message: "Failed to fetch WhatsApp status", error: err.message });
  }
});

/**
 * GET /whatsapp/qr
 * Returns QR code for the logged-in user if required
 */
router.get("/qr", protect, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(400).json({ message: "User ID missing" });

    const session = await WhatsAppSession.findOne({ userId });
    if (!session) return res.status(404).json({ message: "Session not found" });
    if (!session.qr) return res.status(404).json({ message: "QR not available" });

    res.json({ qr: session.qr });
  } catch (err) {
    console.error(`[WA ROUTES] /qr error:`, err);
    res.status(500).json({ message: "Failed to fetch QR", error: err.message });
  }
});

/**
 * POST /whatsapp/disconnect
 * Safely logs out and destroys the WhatsApp client
 */
router.post("/disconnect", protect, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(400).json({ message: "User ID missing" });

    // Destroy runtime client
    await destroyClient(userId);

    // Update session in DB
    await WhatsAppSession.updateOne(
      { userId },
      { connected: false, requiresQR: true, qr: null }
    );

    res.json({ success: true, message: "WhatsApp disconnected" });
  } catch (err) {
    console.error(`[WA ROUTES] /disconnect error:`, err);
    res.status(500).json({ message: "Failed to disconnect WhatsApp", error: err.message });
  }
});




export default router;