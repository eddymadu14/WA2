
import mongoose from "mongoose";

const WhatsAppSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      unique: true,
      index: true,
    },

    connected: { type: Boolean, default: false },
    requiresQR: { type: Boolean, default: true },
    qr: { type: String, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("WhatsAppSession", WhatsAppSessionSchema);

