/**
 * DevBeaver Telegram Bot
 * a_i_web_bot Telegram Bot UserName
 * This bot allows users to create, preview, and download multi-page websites through Telegram.
 * It communicates with a backend server that handles the actual website generation.
*/

// Import required libraries
import { Telegraf, Markup } from "telegraf";  // Telegram bot framework
import dotenv from "dotenv";                  // Environment variable management
import fetch from "node-fetch";               // HTTP requests (fetch API)
import fs from "fs-extra";                    // Enhanced file system operations
import path from "path";                      // Path manipulation utilities
import axios from "axios";                    // HTTP client for more complex requests
import { fileURLToPath } from "url";          // Convert file URLs to paths (for ESM)
import FormData from "form-data";             // Form data for multipart/form-data requests

dotenv.config(); // Load environment variables from .env file

// Create ESM-friendly __dirname equivalent (not available in ES modules by default)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Initialize Telegram bot with token from environment variables
const bot = new Telegraf(process.env.BOT_TOKEN);

// Create temporary directory for storing files (like images) before processing
const tempDir = path.join(__dirname, "temp");
fs.ensureDirSync(tempDir); // Ensure the directory exists, create if it doesn't

/**
 * Configure bot menu commands that appear in the Telegram interface
 * These commands will be shown in the bot's menu for easy access
 */
bot.telegram.setMyCommands([
  { command: "/start", description: "Start interacting with the bot" },
  { command: "/help", description: "Show available commands" },
  { command: "/generate", description: "Generate the website" },
  { command: "/preview", description: "Preview the website" },
  { command: "/code", description: "View source code of the website" },
  { command: "/reset", description: "To erase previous data of Website" },
]);

/**
 * Handle /start command
 * This is the entry point for users when they first interact with the bot
 * Displays a welcome message with basic instructions
 */
bot.start((ctx) => {
  console.log("welcome"); // Log when a user starts the bot

  const welcomeMessage = `
👋 *Welcome to the Website Wizard Bot!*

I'm here to help you create a stunning multi-page website step-by-step. ✨

Here’s what you can do next:

🟢 Say *Hi* to start the conversation  
📋 Use /menu to explore all available actions  
💡 Use /help anytime for guidance

Let’s build something amazing together! 🚀
  `;

  ctx.reply(welcomeMessage, { parse_mode: "Markdown" }); // Send formatted welcome message
});

/**
 * Handle /menu command
 * Displays an interactive menu with buttons for main bot functions
 * Uses Telegraf's inline keyboard for better user experience
 */
bot.command("menu", (ctx) => {
  ctx.reply(
    "📋 *Main Menu*\n\nSelect one of the options below to get started:",
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
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

/**
 * Handle inline keyboard button callbacks
 * Each callback provides information about the corresponding command
 * ctx.answerCbQuery() acknowledges the button press to Telegram
 */
bot.action("CMD_RESET", async (ctx) => {
  await ctx.answerCbQuery(); // Acknowledge the callback query
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

/**
 * Handle /help command
 * Provides detailed information about all available commands
 * Formatted with Markdown for better readability
 */
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

/**
 * Handle /reset command
 * Calls the backend API to reset user data
 * @param {string} userId - Unique identifier for the user
 */
bot.command("reset", async (ctx) => {
  const userId = ctx.from.id.toString(); // Get user ID from context

  try {
    // Call backend API to reset user data
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
    console.error("Reset error:", error.message); // Log error for debugging
    await ctx.reply("❌ An error occurred while resetting your data.");
  }
});

/**
 * Handle /preview command
 * Updates Git repository and provides a preview URL
 * @param {string} userId - Unique identifier for the user
 */
bot.command("preview", async (ctx) => {
  const chatId = ctx.chat.id;
  const userId = ctx.from.id.toString();

  try {
    // Trigger backend to update Git repository with latest changes
    await axios.get(`${process.env.BASE_URL}/update-git`);

    const previewUrl = `https://db-bot-web-preview.vercel.app/${userId}/webSite/`; // Generate preview URL with user ID

    // Send preview link as clickable Markdown
    await ctx.reply(`🔗 [Click here to preview your website](${previewUrl})`, {
      parse_mode: "Markdown",
    });
  } catch (error) {
    console.error("❌ Preview error:", error.response?.data || error);
    await ctx.reply("⚠️ Failed to generate preview. Please try again.");
  }
});

/**
 * Handle /code command
 * Retrieves website source code as a ZIP file from backend
 * @param {string} userId - Unique identifier for the user
 */
bot.command("code", async (ctx) => {
  const userId = ctx.chat.id.toString();

  try {
    // Request ZIP file from backend as a stream
    const fileRes = await axios.get(`${process.env.BASE_URL}/code/${userId}`, {
      responseType: "stream",
    });

    // Save stream to temporary file
    const filePath = path.join(tempDir, `webSite-${userId}.zip`);
    const writer = fs.createWriteStream(filePath);
    fileRes.data.pipe(writer);

    await new Promise((resolve) => writer.on("finish", resolve)); // Wait for file to finish writing
    await ctx.replyWithDocument({ source: filePath, filename: "website.zip" }); // Send ZIP file to user
    fs.removeSync(filePath); // Clean up temporary file
  } catch (e) {
    console.error(e);
    await ctx.reply("❌ Failed to download ZIP.");
  }
});

/**
 * Handle /generate command
 * Triggers website generation on the backend
 * @param {string} userId - Unique identifier for the user
 */
bot.command("generate", async (ctx) => {
  const userId = ctx.chat.id.toString(); // Use chat ID as userId

  await ctx.reply("Generating your website... Please wait.");

  try {
    // Call backend API to generate website
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

/**
 * Handle photo messages
 * Processes images sent by users, uploads them to backend for analysis
 * @param {string} userId - Unique identifier for the user
 * @param {string} caption - Optional text caption sent with the image
 */
bot.on("photo", async (ctx) => {
  const userId = ctx.chat.id.toString();
  const caption = ctx.message.caption || "";

  // Get the highest resolution photo from the array of available sizes
  const photo = ctx.message.photo[ctx.message.photo.length - 1];
  const fileId = photo.file_id;

  // Get download link for the photo
  const fileLink = await ctx.telegram.getFileLink(fileId);
  const fileName = `${Date.now()}.jpg`; // Create unique filename using timestamp
  const filePath = path.join(tempDir, fileName);

  // Download the image to temporary storage
  const writer = fs.createWriteStream(filePath);
  const response = await axios({ url: fileLink.href, responseType: "stream" });
  response.data.pipe(writer);

  // Wait for download to complete
  await new Promise((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
  });

  // Prepare form data for backend upload
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
    // Format and display AI analysis results
    const { images } = uploadRes.data;
    const messages = images
      .map((img) => `🖼 ${img.originalname}\n📌 ${img.aiAnalysis}`)
      .join("\n\n");

    await ctx.reply(`✅ Image analyzed:\n\n${messages}`);
  } catch (err) {
    console.error("Upload error:", err.message);
    await ctx.reply("❌ Failed to upload or analyze image.");
  }

  fs.removeSync(filePath); // Clean up temporary file
});

/**
 * Handle text messages
 * Processes regular text messages and sends them to backend chat API
 * @param {string} message - The text message from the user
 * @param {string} userId - Unique identifier for the user
 */
bot.on("text", async (ctx) => {
  const message = ctx.message.text;
  const userId = ctx.from.id.toString();

  try {
     // Send message to backend chat API
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

console.log("🤖 Bot started"); // Log when bot starts successfully
bot.launch(); // Start the bot

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
