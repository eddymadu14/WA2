// seedSettings.js
import mongoose from "mongoose";
import User from "./src/models/User.js";
import Settings from "./src/models/Setting.js";

const MONGO_URI = "mongodb://localhost:27017/whatsappAutomatordb"; // replace with your DB

async function seedSettings() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to DB");

  const users = await User.find();

  for (const user of users) {
    const exists = await Settings.findOne({ userId: user._id });
    if (!exists) {
      await Settings.create({ userId: user._id });
      console.log(`Settings created for user ${user._id}`);
    }
  }

  console.log("Seeding completed");
  await mongoose.disconnect();
}

seedSettings().catch(err => {
  console.error(err);
  mongoose.disconnect();
});