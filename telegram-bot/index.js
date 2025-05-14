import { Telegraf } from "telegraf";
import dotenv from "dotenv";
import fetch from "node-fetch";
import fs from "fs-extra";
import path from "path";
import axios from "axios";
import { fileURLToPath } from "url";
import FormData from "form-data";

dotenv.config();

// ESM-friendly __dirname
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bot = new Telegraf(process.env.BOT_TOKEN);

// Temp folder to save Telegram image before upload
const tempDir = path.join(__dirname, "temp");
fs.ensureDirSync(tempDir);

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

// for GET /update-vercel api
bot.command("preview", async (ctx) => {
  const chatId = ctx.chat.id;
  const userId = ctx.from.id.toString();

  try {
    // await axios.get(`${process.env.BASE_URL}/update-vercel`); 

    const previewUrl = `https://db-bot-web-preview.vercel.app/${userId}/webSite/index.html`; 

    await ctx.reply(`🔗 [Click here to preview your website](${previewUrl})`, {
      parse_mode: "Markdown",
    });
  } catch (error) {
    console.error("❌ Preview error:", error.response?.data || error.message);
    await ctx.reply("⚠️ Failed to generate preview. Please try again.");
  }
});

// for GET /codefile/:userId api
bot.command("codefile", async (ctx) => {
  const userId = ctx.chat.id.toString();

  try {
    const fileRes = await axios.get(
      `${process.env.BASE_URL}/codefile/${userId}`,
      {
        responseType: "stream",
      }
    );

    const filePath = path.join(tempDir, `webSite-${userId}.zip`);
    const writer = fs.createWriteStream(filePath);
    fileRes.data.pipe(writer);

    await new Promise((resolve) => writer.on("finish", resolve));
    await ctx.replyWithDocument({ source: filePath, filename: "website.zip" });
    fs.removeSync(filePath);
  } catch (e) {
    console.error(e);
    await ctx.reply("❌ Failed to download ZIP.");
  }
});

// for POST /promptbackground api
bot.command("generate", async (ctx) => {
  const userId = ctx.chat.id.toString(); // Use chat ID as userId

  await ctx.reply("Generating your website... Please wait.");

  try {
    const response = await fetch(`${process.env.BASE_URL}/promptBackground`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });

    const data = await response.json();

    if (response.ok) {
      await ctx.reply("✅ Website generated successfully!");
    } else {
      await ctx.reply(`❌ Failed to generate: ${data.error}`);
    }
  } catch (err) {
    console.error("Telegram Bot Error:", err.message);
    await ctx.reply("❌ An error occurred while generating your website.");
  }
});

// for POST /upload-image/:userId api
bot.on("photo", async (ctx) => {
  const userId = ctx.chat.id.toString();
  const caption = ctx.message.caption || "";

  const photo = ctx.message.photo[ctx.message.photo.length - 1];
  const fileId = photo.file_id;

  const fileLink = await ctx.telegram.getFileLink(fileId);
  const fileName = `${Date.now()}.jpg`;
  const filePath = path.join(tempDir, fileName);

  const writer = fs.createWriteStream(filePath);
  const response = await axios({ url: fileLink.href, responseType: "stream" });
  response.data.pipe(writer);

  await new Promise((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
  });

  // Send to backend
  const form = new FormData();
  form.append("images", fs.createReadStream(filePath));
  form.append("text", caption);

  try {
    const uploadRes = await axios.post(
      `${process.env.BASE_URL}/upload-image/${userId}`,
      form,
      {
        headers: form.getHeaders(),
      }
    );

    const { images } = uploadRes.data;
    const messages = images
      .map((img) => `🖼 ${img.originalname}\n📌 ${img.aiAnalysis}`)
      .join("\n\n");

    await ctx.reply(`✅ Image analyzed:\n\n${messages}`);
  } catch (err) {
    console.error("Upload error:", err.message);
    await ctx.reply("❌ Failed to upload or analyze image.");
  }

  fs.removeSync(filePath); // Clean up
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
