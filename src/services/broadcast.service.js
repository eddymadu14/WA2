
import Broadcast from "../models/Broadcast.js";

import {
  sendMessage,
} from "./whatsapp.send.js";

import {
  isClientReady,
} from "./whatsapp.manager.js";

import {
  logger,
} from "../utils/logger.js";

/*
|--------------------------------------------------------------------------
| Broadcast
|--------------------------------------------------------------------------
*/

export async function broadcastMessage(
  broadcastId
) {
  const broadcast =
    await Broadcast.findById(
      broadcastId
    );

  if (!broadcast) {
    throw new Error(
      "Broadcast not found"
    );
  }

  const userId =
    broadcast.userId;

  /*
  |--------------------------------------------------------------------------
  | Runtime is the source of truth
  |--------------------------------------------------------------------------
  */

  if (!isClientReady(userId)) {
    throw new Error(
      `WhatsApp client is not READY for user ${userId}`
    );
  }

  let anyFailed = false;

  for (
    const contactObj of
    broadcast.contacts
  ) {
    try {
      await sendMessage(
        userId,
        contactObj.contact,
        broadcast.message
      );

      contactObj.status =
        "sent";

      contactObj.sentAt =
        new Date();
    } catch (error) {
      contactObj.status =
        "failed";

      anyFailed = true;

      logger.error(
        `[Broadcast:${broadcast._id}] Failed to send to ${contactObj.contact}: ${error.message}`
      );
    }
  }

  broadcast.status =
    anyFailed
      ? "failed"
      : "sent";

  broadcast.sentAt =
    new Date();

  await broadcast.save();

  logger.info(
    `[Broadcast:${broadcast._id}] Completed for user ${userId} - Status: ${broadcast.status}`
  );
}
