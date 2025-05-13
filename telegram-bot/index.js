import { Telegraf } from "telegraf";
import dotenv from "dotenv";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import FormData from "form-data";

dotenv.config();

// ESM-friendly __dirname
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bot = new Telegraf(process.env.BOT_TOKEN);

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
  const caption = ctx.message.caption || "";
  const userId = ctx.from.id.toString();
  const tempDir = path.join(__dirname, "temp");

  try {
    fs.mkdirSync(tempDir, { recursive: true });

    const photos = ctx.message.photo;
    const fileId = photos[photos.length - 1].file_id;

    const fileLink = await ctx.telegram.getFileLink(fileId);
    const response = await fetch(fileLink.href);
    const buffer = await response.buffer();

    const fileName = `${Date.now()}-${userId}.jpg`;
    const localPath = path.join(tempDir, fileName);
    fs.writeFileSync(localPath, buffer);

    const form = new FormData();
    form.append("userId", userId);
    form.append("text", caption);
    form.append("images", fs.createReadStream(localPath));

    //console.log('ctx:',ctx);
    
    const uploadRes = await fetch(`${process.env.BASE_URL}/upload-image`, {
      method: "POST",
      body: form,
    });

    const result = await uploadRes.json();
    fs.unlinkSync(localPath); // Cleanup

    if (result.success) {
      await ctx.reply("✅ Image or images are uploaded and analyzed.");
    } else {
      await ctx.reply(`❌ Upload failed: ${result.error}`);
    }
  } catch (err) {
    console.error("Photo Upload Error:", err.message);
    await ctx.reply("⚠️ Failed to upload or analyze the image.");
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
