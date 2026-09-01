
import express from "express";

import {
  protect,
} from "../middlewares/authMiddleware1.js";

import WhatsAppSession from "../models/WhatsAppSession.js";

import {
  initWhatsAppForUser,
  getWhatsAppStatus,
} from "../services/whatsapp.service.js";

import {
  destroyClient,
} from "../services/whatsapp.manager.js";

const router =
  express.Router();

/*
|--------------------------------------------------------------------------
| Connect
|--------------------------------------------------------------------------
*/

router.post(
  "/connect",
  protect,
  async (req, res) => {
    try {
      const userId =
        req.user?.id;

      if (!userId) {
        return res.status(400).json({
          message:
            "User ID missing",
        });
      }

      /*
       * Start initialization.
       *
       * The manager owns the lifecycle state.
       */
      await initWhatsAppForUser(
        userId
      );

      const status =
        getWhatsAppStatus(
          userId
        );

      return res.status(202).json({
        success: true,

        message:
          "WhatsApp client initialization started",

        status,
      });
    } catch (error) {
      console.error(
        "[WA ROUTES] /connect error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Failed to connect WhatsApp",

        error:
          error.message,
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Status
|--------------------------------------------------------------------------
*/

router.get(
  "/status",
  protect,
  async (req, res) => {
    try {
      const userId =
        req.user?.id;

      if (!userId) {
        return res.status(400).json({
          message:
            "User ID missing",
        });
      }

      let session =
        await WhatsAppSession.findOne({
          userId,
        });

      if (!session) {
        session =
          await WhatsAppSession.create({
            userId,
          });
      }

      const runtime =
        getWhatsAppStatus(
          userId
        );

      return res.json({
        ...session.toObject(),

        runtime,
      });
    } catch (error) {
      console.error(
        "[WA ROUTES] /status error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to fetch WhatsApp status",

        error:
          error.message,
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| QR
|--------------------------------------------------------------------------
*/

router.get(
  "/qr",
  protect,
  async (req, res) => {
    try {
      const userId =
        req.user?.id;

      if (!userId) {
        return res.status(400).json({
          message:
            "User ID missing",
        });
      }

      const session =
        await WhatsAppSession.findOne({
          userId,
        });

      if (!session) {
        return res.status(404).json({
          message:
            "Session not found",
        });
      }

      if (!session.qr) {
        return res.status(404).json({
          message:
            "QR not available",
        });
      }

      return res.json({
        qr: session.qr,
      });
    } catch (error) {
      console.error(
        "[WA ROUTES] /qr error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to fetch QR",

        error:
          error.message,
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Disconnect
|--------------------------------------------------------------------------
*/

router.post(
  "/disconnect",
  protect,
  async (req, res) => {
    try {
      const userId =
        req.user?.id;

      if (!userId) {
        return res.status(400).json({
          message:
            "User ID missing",
        });
      }

      /*
       * logout=true means intentional disconnect.
       *
       * For RemoteAuth this removes the remote authentication
       * archive, so the next connection requires QR again.
       */
      await destroyClient(
        userId,
        true
      );

      return res.json({
        success: true,

        message:
          "WhatsApp disconnected",
      });
    } catch (error) {
      console.error(
        "[WA ROUTES] /disconnect error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Failed to disconnect WhatsApp",

        error:
          error.message,
      });
    }
  }
);

export default router;
