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
