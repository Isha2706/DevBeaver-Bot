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
  console.log("welcome");

  const welcomeMessage = `
👋 *Welcome to the Website Wizard Bot!*

I'm here to help you create a stunning multi-page website step-by-step. ✨

Here’s what you can do next:

🟢 Say *Hi* to start the conversation  
📋 Use /menu to explore all available actions  
💡 Use /help anytime for guidance

Let’s build something amazing together! 🚀
  `;

  ctx.reply(welcomeMessage, { parse_mode: "Markdown" });
});

// Menu command with inline keyboard
bot.command("menu", (ctx) => {
  ctx.reply(
    "📋 *Main Menu*\n\nSelect one of the options below to get started:",
    {
      parse_mode: "Markdown",
      ... Markup.inlineKeyboard([
        [
          Markup.button.callback("📋 Reset", "CMD_RESET"),
          Markup.button.callback("🆘 Help", "CMD_HELP"),
        ],
        [
          Markup.button.callback("👁️ Preview", "CMD_PREVIEW"),
          Markup.button.callback("💻 View Code", "CMD_CODE"),
        ],
        [Markup.button.callback("🔄 Generate Website", "CMD_GENERATE")],
      ]),
    }
  );
});

// Handle callbacks
bot.action("CMD_RESET", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(
    "♻️ *Reset Command*\n\nClick /reset to clear your current data and start fresh! ✨",
    { parse_mode: "Markdown" }
  );
});

bot.action("CMD_GENERATE", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(
    "🛠️ *Generate Website*\n\nClick /generate to create your awesome multi-page website! 🚀",
    { parse_mode: "Markdown" }
  );
});

bot.action("CMD_PREVIEW", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(
    "👁️ *Preview Website*\n\nUse /preview to see how your website looks! 🌐",
    { parse_mode: "Markdown" }
  );
});

bot.action("CMD_CODE", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(
    "💻 *View Source Code*\n\nClick /code to get the full source code of your generated site. 📂",
    { parse_mode: "Markdown" }
  );
});

bot.action("CMD_HELP", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(
    "🆘 *Help Menu*\n\nNeed assistance? Click /help to learn about all available commands and how to use the bot. 🤖",
    { parse_mode: "Markdown" }
  );
});

// /help command
bot.command("help", (ctx) => {
  const helpText = `
🙋‍♂️ *Need Help? I’ve got you covered!*

Here’s a list of all the available commands you can use to interact with me:

🔹 /start – _Kick things off with a welcome message!_

🔹 /help – _You're here! Shows this help guide._

🔹 /menu – _Get all options in a neat button layout!_

🔄 /reset – _Clear all previous data and start fresh._

🚀 /generate – _Generate your website with current information._

👁️ /preview – _See a live preview of your generated site._

💻 /code – _View the source code of your website._

---

🛠 *Tip:* Use /menu for the easiest navigation with buttons!

If you need more help, feel free to ask. I'm here to assist! 😊
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

    const previewUrl = `https://db-bot-web-preview.vercel.app/${userId}/webSite/`;

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
