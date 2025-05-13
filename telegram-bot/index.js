import { Telegraf } from "telegraf";
import dotenv from "dotenv";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import FormData from "form-data";

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);

// ESM-friendly __dirname
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Telegram Bot UserName = a_i_web_bot BotName = SiteBuilder Bot
bot.start((ctx) => {
  console.log("ctx:", ctx);
  console.log("welcome");

  ctx.reply("Welcome! Send me a message to begin.");
});

// for POST /reset api
bot.command("reset", async (ctx) => {
  const userId = ctx.from.id.toString();

  try {
    const response = await fetch(
      `${process.env.BASE_URL}/reset?userId=${userId}`
    );
    const data = await response.json();

    if (response.ok) {
      await ctx.reply(
        "✅ Your data has been reset successfully. Let's start fresh!"
      );
    } else {
      await ctx.reply(`⚠️ Failed to reset: ${data.error}`);
    }
  } catch (error) {
    console.error("Reset error:", error.message);
    await ctx.reply("❌ An error occurred while resetting your data.");
  }
});

// for POST /upload-image api
bot.on("photo", async (ctx) => {
  const userId = ctx.from.id.toString();

  try {
    const photos = ctx.message.photo;
    const highestRes = photos[photos.length - 1];
    const fileId = highestRes.file_id;

    // Get image link
    const fileLink = await ctx.telegram.getFileLink(fileId);

    // Download the image
    const response = await fetch(fileLink.href);
    const buffer = await response.buffer();

    const localPath = `temp/${Date.now()}-${userId}.jpg`;
    fs.writeFileSync(localPath, buffer);

    // Upload to server
    const form = new FormData();
    form.append("userId", userId);
    form.append("images", fs.createReadStream(localPath));

    const uploadRes = await fetch("http://localhost:3001/upload-image", {
      method: "POST",
      body: form,
    });

    const result = await uploadRes.json();

    if (result.success) {
      await ctx.reply(`✅ Image uploaded and analyzed:\n\n${result.images.map(i => `📷 ${i.originalname}\n🧠 ${i.aiAnalysis}`).join('\n\n')}`);
    } else {
      await ctx.reply(`❌ Failed: ${result.error}`);
    }

    // Clean up
    fs.unlinkSync(localPath);
  } catch (error) {
    console.error("Photo Upload Error:", error.message);
    await ctx.reply("⚠️ Failed to process image.");
  }
});

// for POST /chat api
bot.on("text", async (ctx) => {
  const message = ctx.message.text;
  const userId = ctx.from.id.toString();

  try {
    const res = await fetch(`${process.env.BASE_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, userId }),
    });

    const data = await res.json();
    await ctx.reply(data.reply || "No response from server.");
  } catch (err) {
    console.error("Bot error:", err.message);
    await ctx.reply("Error connecting to server.");
  }
});

console.log("🤖 Bot started");
bot.launch();

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
