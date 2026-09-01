
import {
  initWhatsAppUser,
  getClient,
  isClientReady,
  getWhatsAppRuntimeStatus,
} from "./whatsapp.manager.js";

/*
|--------------------------------------------------------------------------
| Initialize
|--------------------------------------------------------------------------
*/

export async function initWhatsAppForUser(
  userId
) {
  return initWhatsAppUser(userId);
}

/*
|--------------------------------------------------------------------------
| Runtime client
|--------------------------------------------------------------------------
*/

export function getWhatsAppClient(
  userId
) {
  return getClient(userId);
}

/*
|--------------------------------------------------------------------------
| Ready check
|--------------------------------------------------------------------------
*/

export function isWhatsAppReady(
  userId
) {
  return isClientReady(userId);
}

/*
|--------------------------------------------------------------------------
| Runtime status
|--------------------------------------------------------------------------
*/

export function getWhatsAppStatus(
  userId
) {
  return getWhatsAppRuntimeStatus(
    userId
  );
}
