
import path from "path";

import pkg from "whatsapp-web.js";

const {
  Client,
  LocalAuth,
  RemoteAuth,
} = pkg;

import WhatsAppSession from "../models/WhatsAppSession.js";

import {
  supabase,
  supabaseBucket,
  isSupabaseEnabled,
} from "../config/supabase.js";

import {
  SupabaseRemoteStore,
} from "./whatsapp/supabaseRemoteStore.js";

import {
  logger,
} from "../utils/logger.js";

import {
  handleIncomingMessage,
} from "../utils/message.dispatcher.js";

/*
|--------------------------------------------------------------------------
| Runtime client registry
|--------------------------------------------------------------------------
*/

const clients = new Map();

const readyClients = new Set();

const initializationPromises =
  new Map();

/*
|--------------------------------------------------------------------------
| Configuration
|--------------------------------------------------------------------------
*/

const isProduction =
  process.env.NODE_ENV === "production";

const whatsappDataPath =
  process.env.WHATSAPP_DATA_PATH ||
  path.resolve(
    process.cwd(),
    ".wwebjs_auth"
  );

const remoteAuthBackupInterval = Math.max(
  Number(
    process.env.WHATSAPP_BACKUP_INTERVAL_MS ||
      300000
  ),
  60000
);

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function keyFor(userId) {
  return String(userId);
}

async function updateSession(
  userId,
  update
) {
  try {
    await WhatsAppSession.updateOne(
      {
        userId,
      },
      {
        $set: update,
      },
      {
        upsert: true,
      }
    );
  } catch (error) {
    logger.error(
      `[WA:${userId}] Failed to update session state: ${error.message}`
    );
  }
}

function createAuthStrategy(userId) {
  const key = keyFor(userId);

  /*
  |--------------------------------------------------------------------------
  | DEVELOPMENT
  |--------------------------------------------------------------------------
  |
  | LocalAuth stores the WhatsApp browser profile locally.
  | Supabase is completely bypassed.
  |
  */

  if (!isProduction) {
    logger.info(
      `[WA:${userId}] Using LocalAuth for development`
    );

    return new LocalAuth({
      clientId: key,

      dataPath:
        whatsappDataPath,
    });
  }

  /*
  |--------------------------------------------------------------------------
  | PRODUCTION
  |--------------------------------------------------------------------------
  |
  | Production MUST use Supabase-backed RemoteAuth.
  |
  */

  if (!isSupabaseEnabled()) {
    throw new Error(
      "Production WhatsApp requires Supabase Storage configuration"
    );
  }

  const store =
    new SupabaseRemoteStore({
      supabase,

      bucket:
        supabaseBucket,

      dataPath:
        whatsappDataPath,
    });

  logger.info(
    `[WA:${userId}] Using Supabase RemoteAuth`
  );

  return new RemoteAuth({
    clientId: key,

    store,

    dataPath:
      whatsappDataPath,

    backupSyncIntervalMs:
      remoteAuthBackupInterval,
  });
}

/*
|--------------------------------------------------------------------------
| Public: getClient
|--------------------------------------------------------------------------
*/

export function getClient(userId) {
  const key = keyFor(userId);

  if (!readyClients.has(key)) {
    return null;
  }

  return clients.get(key) || null;
}

/*
|--------------------------------------------------------------------------
| Public: isClientReady
|--------------------------------------------------------------------------
*/

export function isClientReady(userId) {
  const key = keyFor(userId);

  return (
    readyClients.has(key) &&
    clients.has(key)
  );
}

/*
|--------------------------------------------------------------------------
| Public: waitForClientReady
|--------------------------------------------------------------------------
*/

export async function waitForClientReady(
  userId,
  timeout = 60000
) {
  const key = keyFor(userId);

  const start =
    Date.now();

  while (
    Date.now() - start <
    timeout
  ) {
    if (
      readyClients.has(key) &&
      clients.has(key)
    ) {
      return true;
    }

    await new Promise(
      (resolve) =>
        setTimeout(resolve, 500)
    );
  }

  throw new Error(
    `WhatsApp client is not READY for user ${userId}`
  );
}

/*
|--------------------------------------------------------------------------
| Public: setClient
|--------------------------------------------------------------------------
*/

export function setClient(
  userId,
  client
) {
  clients.set(
    keyFor(userId),
    client
  );
}

/*
|--------------------------------------------------------------------------
| Client destruction
|--------------------------------------------------------------------------
*/

export async function destroyClient(
  userId,
  logout = false
) {
  const key =
    keyFor(userId);

  const client =
    clients.get(key);

  if (!client) {
    readyClients.delete(key);

    await updateSession(
      userId,
      {
        connected: false,
        state: "DISCONNECTED",
        requiresQR: true,
        qr: null,
      }
    );

    return;
  }

  try {
    if (
      logout &&
      typeof client.logout ===
        "function"
    ) {
      await client.logout();
    }
  } catch (error) {
    logger.warn(
      `[WA:${userId}] Logout failed: ${error.message}`
    );
  }

  try {
    await client.destroy();
  } catch (error) {
    logger.warn(
      `[WA:${userId}] Destroy failed: ${error.message}`
    );
  }

  clients.delete(key);

  readyClients.delete(key);

  initializationPromises.delete(
    key
  );

  await updateSession(
    userId,
    {
      connected: false,
      state: "DISCONNECTED",
      requiresQR: true,
      qr: null,
    }
  );

  logger.info(
    `[WA:${userId}] Client destroyed`
  );
}

/*
|--------------------------------------------------------------------------
| Initialize WhatsApp
|--------------------------------------------------------------------------
*/

export async function initWhatsAppUser(
  userId
) {
  const key =
    keyFor(userId);

  /*
  |--------------------------------------------------------------------------
  | Already READY
  |--------------------------------------------------------------------------
  */

  if (
    clients.has(key) &&
    readyClients.has(key)
  ) {
    logger.info(
      `[WA:${userId}] Client already READY`
    );

    return clients.get(key);
  }

  /*
  |--------------------------------------------------------------------------
  | Already initializing
  |--------------------------------------------------------------------------
  */

  if (
    initializationPromises.has(key)
  ) {
    return initializationPromises.get(
      key
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Create initialization promise
  |--------------------------------------------------------------------------
  */

  const initialization =
    initializeClient(userId);

  initializationPromises.set(
    key,
    initialization
  );

  try {
    return await initialization;
  } finally {
    initializationPromises.delete(
      key
    );
  }
}

/*
|--------------------------------------------------------------------------
| Actual client initialization
|--------------------------------------------------------------------------
*/

async function initializeClient(
  userId
) {
  const key =
    keyFor(userId);

  /*
  |--------------------------------------------------------------------------
  | Prevent duplicate runtime clients
  |--------------------------------------------------------------------------
  */

  const existing =
    clients.get(key);

  if (existing) {
    return existing;
  }

  await updateSession(
    userId,
    {
      state: "INITIALIZING",
      connected: false,
      requiresQR: false,
      qr: null,
    }
  );

  const authStrategy =
    createAuthStrategy(userId);

  const client =
    new Client({
      authStrategy,

      puppeteer: {
        headless: true,

        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--no-first-run",
          "--no-zygote",
        ],

        executablePath:
          process.env.PUPPETEER_EXECUTABLE_PATH ||
          undefined,
      },
    });

  /*
  |--------------------------------------------------------------------------
  | IMPORTANT
  |--------------------------------------------------------------------------
  |
  | Register the client BEFORE initialize().
  |
  */

  clients.set(
    key,
    client
  );

  /*
  |--------------------------------------------------------------------------
  | QR
  |--------------------------------------------------------------------------
  */

  client.on(
    "qr",
    async (qr) => {
      logger.info(
        `[WA:${userId}] QR generated`
      );

      await updateSession(
        userId,
        {
          state: "QR_READY",
          connected: false,
          requiresQR: true,
          qr,
        }
      );
    }
  );

  /*
  |--------------------------------------------------------------------------
  | Loading
  |--------------------------------------------------------------------------
  */

  client.on(
    "loading_screen",
    async (
      percent,
      message
    ) => {
      logger.info(
        `[WA:${userId}] Loading ${percent}% - ${message}`
      );

      await updateSession(
        userId,
        {
          state: "LOADING",
          connected: false,
          requiresQR: false,
        }
      );
    }
  );

  /*
  |--------------------------------------------------------------------------
  | Authenticated
  |--------------------------------------------------------------------------
  */

  client.on(
    "authenticated",
    async () => {
      logger.info(
        `[WA:${userId}] Authenticated`
      );

      /*
       * IMPORTANT:
       *
       * Do NOT mark connected=true here.
       *
       * Authentication != READY.
       */

      await updateSession(
        userId,
        {
          state: "AUTHENTICATED",
          connected: false,
          requiresQR: false,
          qr: null,
        }
      );
    }
  );

  /*
  |--------------------------------------------------------------------------
  | Ready
  |--------------------------------------------------------------------------
  */

  client.on(
    "ready",
    async () => {
      readyClients.add(key);

      logger.info(
        `[WA:${userId}] READY`
      );

      await updateSession(
        userId,
        {
          state: "READY",
          connected: true,
          requiresQR: false,
          qr: null,
          lastConnectedAt:
            new Date(),
          lastError: null,
        }
      );
    }
  );

  /*
  |--------------------------------------------------------------------------
  | Auth failure
  |--------------------------------------------------------------------------
  */

  client.on(
    "auth_failure",
    async (message) => {
      logger.error(
        `[WA:${userId}] Authentication failure: ${message}`
      );

      readyClients.delete(key);

      await updateSession(
        userId,
        {
          state: "AUTH_FAILURE",
          connected: false,
          requiresQR: true,
          qr: null,
          lastError:
            String(message),
        }
      );
    }
  );

  /*
  |--------------------------------------------------------------------------
  | Disconnected
  |--------------------------------------------------------------------------
  */

  client.on(
    "disconnected",
    async (reason) => {
      logger.warn(
        `[WA:${userId}] Disconnected: ${reason}`
      );

      readyClients.delete(key);

      clients.delete(key);

      initializationPromises.delete(
        key
      );

      await updateSession(
        userId,
        {
          state: "DISCONNECTED",
          connected: false,
          requiresQR: true,
          qr: null,
          lastDisconnectedAt:
            new Date(),
          lastError:
            String(reason),
        }
      );
    }
  );

  /*
  |--------------------------------------------------------------------------
  | Incoming messages
  |--------------------------------------------------------------------------
  */

  client.on(
    "message",
    async (msg) => {
      try {
        if (!msg?.body) {
          return;
        }

        logger.debug(
          `[WA:${userId}] Incoming message from ${msg.from}`
        );

        await handleIncomingMessage({
          userId,
          client,
          msg,
        });
      } catch (error) {
        logger.error(
          `[WA:${userId}] Message handler error: ${error.message}`
        );
      }
    }
  );

  /*
  |--------------------------------------------------------------------------
  | General error
  |--------------------------------------------------------------------------
  */

  client.on(
    "error",
    async (error) => {
      logger.error(
        `[WA:${userId}] Client error: ${error.message}`
      );

      await updateSession(
        userId,
        {
          lastError:
            error.message,
        }
      );
    }
  );

  /*
  |--------------------------------------------------------------------------
  | Initialize
  |--------------------------------------------------------------------------
  */

  try {
    logger.info(
      `[WA:${userId}] Initializing client`
    );

    await client.initialize();

    logger.info(
      `[WA:${userId}] initialize() completed; waiting for READY`
    );

    return client;
  } catch (error) {
    logger.error(
      `[WA:${userId}] Initialization failed: ${error.message}`
    );

    readyClients.delete(key);

    clients.delete(key);

    await updateSession(
      userId,
      {
        state: "ERROR",
        connected: false,
        requiresQR: true,
        qr: null,
        lastError:
          error.message,
      }
    );

    try {
      await client.destroy();
    } catch {}

    throw error;
  }
}

/*
|--------------------------------------------------------------------------
| Restore all previously connected users
|--------------------------------------------------------------------------
*/

export async function initAllWhatsAppUsers() {
  const sessions =
    await WhatsAppSession.find({
      connected: true,
    });

  logger.info(
    `[WA] Restoring ${sessions.length} WhatsApp clients`
  );

  /*
   * Start restoration independently.
   *
   * Do not make Express startup depend on every WhatsApp
   * client reaching READY.
   */

  for (const session of sessions) {
    initWhatsAppUser(
      session.userId
    ).catch((error) => {
      logger.error(
        `[WA:${session.userId}] Restore failed: ${error.message}`
      );
    });
  }
}

/*
|--------------------------------------------------------------------------
| Expose runtime status
|--------------------------------------------------------------------------
*/

export function getWhatsAppRuntimeStatus(
  userId
) {
  const key =
    keyFor(userId);

  return {
    initialized:
      clients.has(key),

    ready:
      readyClients.has(key),

    connected:
      readyClients.has(key) &&
      clients.has(key),
  };
}
