import { Telegraf } from "telegraf";
import dotenv from "dotenv";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);

// ESM-friendly __dirname
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Telegram Bot UserName = a_i_web_bot BotName = SiteBuilder Bot
bot.start((ctx) => {
    console.log('ctx:', ctx);
  console.log("welcome");

    ctx.reply("Welcome! Send me a message to begin.")
});

console.log("🤖 Bot started");
bot.launch();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));