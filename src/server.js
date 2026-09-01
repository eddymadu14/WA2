
import dotenv from "dotenv";

dotenv.config();

import app from "./app.js";

import connectDB from "./config/db.js";

import {
  initAllWhatsAppUsers,
} from "./services/whatsapp.manager.js";

import {
  startBroadcastScheduler,
} from "./jobs/broadcastScheduler.js";

import {
  logger,
} from "./utils/logger.js";

/*
|--------------------------------------------------------------------------
| Global error handlers
|--------------------------------------------------------------------------
*/

process.on(
  "uncaughtException",
  (error) => {
    logger.error(
      `Uncaught Exception: ${error.message}`
    );

    console.error(
      error.stack
    );

    process.exit(1);
  }
);

process.on(
  "unhandledRejection",
  (reason) => {
    logger.error(
      `Unhandled Rejection: ${reason}`
    );
  }
);

/*
|--------------------------------------------------------------------------
| Server bootstrap
|--------------------------------------------------------------------------
*/

async function startServer() {
  try {
    /*
    |--------------------------------------------------------------------------
    | 1. Database
    |--------------------------------------------------------------------------
    */

    await connectDB();

    logger.info(
      "MongoDB connected successfully"
    );

    /*
    |--------------------------------------------------------------------------
    | 2. HTTP server
    |--------------------------------------------------------------------------
    */

    const PORT =
      process.env.PORT ||
      5000;

    app.listen(
      PORT,
      () => {
        logger.info(
          `Backend running on port ${PORT}`
        );

        console.log(
          `Backend running on port ${PORT}`
        );
      }
    );

    /*
    |--------------------------------------------------------------------------
    | 3. Broadcast scheduler
    |--------------------------------------------------------------------------
    */

    startBroadcastScheduler();

    logger.info(
      "Broadcast scheduler started"
    );

    /*
    |--------------------------------------------------------------------------
    | 4. Restore WhatsApp clients
    |--------------------------------------------------------------------------
    |
    | IMPORTANT:
    |
    | Do NOT await this.
    |
    | Express must remain available even while WhatsApp clients
    | are restoring from Supabase.
    |
    */

    initAllWhatsAppUsers()
      .then(() => {
        logger.info(
          "WhatsApp restoration process started"
        );
      })
      .catch((error) => {
        logger.error(
          `WhatsApp restoration failed: ${error.message}`
        );
      });
  } catch (error) {
    logger.error(
      `Server startup failed: ${error.message}`
    );

    console.error(error);

    process.exit(1);
  }
}

startServer();
