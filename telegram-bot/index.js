import { Telegraf, Markup } from "telegraf";
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

bot.telegram.setMyCommands([
  { command: "/start", description: "Start interacting with the bot" },
  { command: "/help", description: "Show available commands" },
  { command: "/generate", description: "Generate the website" },
  { command: "/preview", description: "Preview the website" },
  { command: "/code", description: "View source code of the website" },
  { command: "/reset", description: "To erase previous data of Website" },
]);

// Telegram Bot UserName = a_i_web_bot BotName = SiteBuilder Bot
bot.start((ctx) => {
  // console.log("ctx:", ctx);
  console.log("welcome");

  ctx.reply("Welcome! Send me a message to begin. Start with writting 'Hi'.");
});

// Menu command with inline keyboard
bot.command("menu", (ctx) => {
  ctx.reply(
    "📋 Choose a command:",
    Markup.inlineKeyboard([
      [Markup.button.callback("📋 Reset", "CMD_RESET")],
      [Markup.button.callback("🔄 Generate Website", "CMD_GENERATE")],
      [Markup.button.callback("👁️ Preview", "CMD_PREVIEW")],
      [Markup.button.callback("💻 View Code", "CMD_CODE")],
      [Markup.button.callback("🆘 Help", "CMD_HELP")],
    ])
  );
});

// Handle callbacks
bot.action("CMD_RESET", async (ctx) => {
  await ctx.answerCbQuery(); // Clear loading
  await ctx.deleteMessage(); // Optional: remove menu message
  // Call your actual /reset logic here
  ctx.reply("♻️ Data has been reset. You can start fresh!");
});

bot.action("CMD_GENERATE", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.deleteMessage();
  // Replace this with your actual generate logic
  ctx.reply("✅ Website generated successfully!\n\n👀 Use /preview to view it.");
});

bot.action("CMD_PREVIEW", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.deleteMessage();
  ctx.reply("📄 Here's a preview of your website...");
  // Your preview logic here
});

bot.action("CMD_CODE", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.deleteMessage();
  ctx.reply("💻 Here is your website's source code...");
  // Your code viewing logic here
});

bot.action("CMD_HELP", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.deleteMessage();
  // Ideally re-use your /help content
  ctx.reply("ℹ️ Help Menu:\n\n/start - Start the bot\n/help - Show help...\n...");
});

// /help command
bot.command("help", (ctx) => {
  const helpText = `
📖 *Available Commands:*

/start - Start the bot and see welcome message
/help - Show this help menu
/menu - Show the all commands Buttons
/reset - To Remove all data of previous website
/generate - Generate your website with current data
/preview - Preview the current website
/code - View the source code of the website

Use these commands to interact with the bot and update your site easily.
  `;
  ctx.reply(helpText, { parse_mode: "Markdown" });
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
        "♻️ Your data has been reset successfully. Let's start fresh!"
      );
    } else {
      await ctx.reply(`⚠️ Failed to reset: ${data.error}`);
    }
  } catch (error) {
    console.error("Reset error:", error.message);
    await ctx.reply("❌ An error occurred while resetting your data.");
  }
});

// for GET /update-git api
bot.command("preview", async (ctx) => {
  const chatId = ctx.chat.id;
  const userId = ctx.from.id.toString();

  try {
    await axios.get(`${process.env.BASE_URL}/update-git`);

    const previewUrl = `https://db-bot-web-preview.vercel.app/${userId}/webSite/index.html`;

    await ctx.reply(`🔗 [Click here to preview your website](${previewUrl})`, {
      parse_mode: "Markdown",
    });
  } catch (error) {
    console.error("❌ Preview error:", error.response?.data || error);
    await ctx.reply("⚠️ Failed to generate preview. Please try again.");
  }
});

// for GET /code/:userId api
bot.command("code", async (ctx) => {
  const userId = ctx.chat.id.toString();

  try {
    const fileRes = await axios.get(`${process.env.BASE_URL}/code/${userId}`, {
      responseType: "stream",
    });

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
      await ctx.reply(
        "✅ Website generated successfully!\n\n👀 Now it's time to preview your site!\nJust type or click 🔍 /preview to see how it looks."
      );
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
