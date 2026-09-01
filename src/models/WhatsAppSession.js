
import mongoose from "mongoose";

const WhatsAppSessionSchema =
  new mongoose.Schema(
    {
      userId: {
        type:
          mongoose.Schema.Types.ObjectId,

        required: true,

        unique: true,

        index: true,
      },

      /*
      |--------------------------------------------------------------------------
      | Runtime/application state
      |--------------------------------------------------------------------------
      */

      state: {
        type: String,

        enum: [
          "DISCONNECTED",
          "INITIALIZING",
          "QR_READY",
          "AUTHENTICATED",
          "LOADING",
          "READY",
          "AUTH_FAILURE",
          "ERROR",
        ],

        default: "DISCONNECTED",
      },

      connected: {
        type: Boolean,

        default: false,
      },

      requiresQR: {
        type: Boolean,

        default: true,
      },

      qr: {
        type: String,

        default: null,
      },

      /*
      |--------------------------------------------------------------------------
      | Diagnostics
      |--------------------------------------------------------------------------
      */

      lastConnectedAt: {
        type: Date,

        default: null,
      },

      lastDisconnectedAt: {
        type: Date,

        default: null,
      },

      lastError: {
        type: String,

        default: null,
      },
    },

    {
      timestamps: true,
    }
  );

export default mongoose.model(
  "WhatsAppSession",
  WhatsAppSessionSchema
);
