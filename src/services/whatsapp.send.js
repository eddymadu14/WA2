

import { limiter } from "./messageQueue.js";

import {
  getClient,
  waitForClientReady,
} from "./whatsapp.manager.js";

import {
  logger,
} from "../utils/logger.js";

/*
|--------------------------------------------------------------------------
| Send one message
|--------------------------------------------------------------------------
*/

export async function sendMessage(
  userId,
  to,
  message
) {
  await waitForClientReady(
    userId
  );

  const client =
    getClient(userId);

  if (!client) {
    throw new Error(
      `WhatsApp client is not READY for user ${userId}`
    );
  }

  try {
    const result =
      await limiter.schedule(
        () =>
          client.sendMessage(
            to,
            message
          )
      );

    logger.info(
      `[WA:${userId}] Message sent to ${to}`
    );

    return result;
  } catch (error) {
    logger.error(
      `[WA:${userId}] Failed to send message to ${to}: ${error.message}`
    );

    throw error;
  }
}

/*
|--------------------------------------------------------------------------
| Send broadcast
|--------------------------------------------------------------------------
*/

export async function sendBroadcast(
  userId,
  recipients = [],
  message
) {
  if (!Array.isArray(recipients)) {
    throw new TypeError(
      "Recipients must be an array"
    );
  }

  await waitForClientReady(
    userId
  );

  const client =
    getClient(userId);

  if (!client) {
    throw new Error(
      `WhatsApp client is not READY for user ${userId}`
    );
  }

  const results = [];

  for (const recipient of recipients) {
    try {
      const result =
        await limiter.schedule(
          () =>
            client.sendMessage(
              recipient,
              message
            )
        );

      results.push({
        recipient,
        success: true,
        result,
      });

      logger.info(
        `[WA:${userId}] Broadcast sent to ${recipient}`
      );
    } catch (error) {
      results.push({
        recipient,
        success: false,
        error: error.message,
      });

      logger.error(
        `[WA:${userId}] Broadcast failed for ${recipient}: ${error.message}`
      );
    }
  }

  return results;
}