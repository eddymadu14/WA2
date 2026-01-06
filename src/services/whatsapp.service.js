import { initWhatsAppUser, getClient } from "./whatsapp.manager.js";

/**
 * Initialize WhatsApp for a user
 * Returns the single shared client from manager
 */
export async function initWhatsAppForUser(userId, sessionData = null) {
  // If client already exists, return it
  let client = getClient(userId);
  if (client) return client;

  // Otherwise, initialize through manager
  client = await initWhatsAppUser(userId, sessionData);
  return client;
}