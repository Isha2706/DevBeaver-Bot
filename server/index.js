import express from "express";
import dotenv from "dotenv";
import fs from "fs-extra";
import path from "path";
import OpenAI from "openai";
import bodyParser from "body-parser";
import multer from "multer";
import cors from "cors";
import { fileURLToPath } from "url";
import lockfile from "proper-lockfile";
import { deployToGit } from "./deploy-git.js";
import archiver from "archiver";

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());

app.use(cors({origin: "*"}));
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(bodyParser.json());

// GET: Reset profile and history for a specific user
app.get("/reset", (req, res) => {
  const userId = req.query.userId;

  if (!userId) {
    return res.status(400).json({ error: "Missing userId in query params." });
  }

  const userDir = path.join("db", userId);
  const historyFile = path.join(userDir, "chat-history.json");
  const profileFile = path.join(userDir, "user-data.json");
  const websiteDir = path.join(userDir, "webSite");
  const uploadsDir = path.join(websiteDir, "uploads");

  const defaultProfile = {
    websiteType: "",
    targetAudience: "",
    mainGoal: "",
    colorScheme: "",
    theme: "",
    pages: [],
    sections: [],
    features: [],
    content: {},
    designPreferences: {},
    images: [],
    fonts: "",
    contactInfo: {},
    socialLinks: {},
    customScripts: "",
    branding: {},
    updateRequests: [],
    additionalNotes: "",
  };

  try {
    // Ensure base folders exist
    fs.ensureDirSync(userDir);
    fs.ensureDirSync(websiteDir);
    fs.ensureDirSync(uploadsDir);

    // Reset chat history and profile
    fs.writeFileSync(historyFile, `[]`);
    fs.writeFileSync(profileFile, JSON.stringify(defaultProfile, null, 2));

    // Clear HTML/CSS/JS files
    fs.writeFileSync(path.join(websiteDir, "index.html"), "<!-- empty -->");
    fs.writeFileSync(path.join(websiteDir, "styles.css"), "/* empty */");
    fs.writeFileSync(path.join(websiteDir, "script.js"), "// empty");

    // Remove all files from uploads directory
    fs.emptyDirSync(uploadsDir);

    res.status(200).json({ message: `Reset successful for user: ${userId}` });
  } catch (error) {
    console.error("Reset Error:", error);
    res.status(500).json({ error: "Failed to reset files" });
  }
});

// GET: Preview webSite
app.get("/preview/:userId", async (req, res) => {
  const userId = req.params.userId;
  const url = await deployToGit(userId);

  if (url) {
    res.status(200).json({ success: true, url });
  } else {
    res.status(500).json({ error: "Deployment failed" });
  }
});

// GET: To call vercel-utils
app.get('/update-vercel', async (req, res) => {
  try {
    const values = await deployToGit();
    console.log("Return value:", values);
    
    res.status(200).json({ message: '✅ Vercel deployment triggered successfully.' });
  } catch (error) {
    console.error("❌ Error updating Vercel:", error);
    res.status(500).json({ error: 'Vercel deployment failed.', details: error.message });
  }
});

// GET: Code file to user in form of ZIP file
app.get("/code/:userId", async (req, res) => {
  const userId = req.params.userId;
  const folderPath = path.join(__dirname, "db", userId, "webSite");

  const zipPath = path.join(__dirname, "db", userId, "webSite.zip");
  const output = fs.createWriteStream(zipPath);
  const archive = archiver("zip", { zlib: { level: 9 } });

  archive.pipe(output);
  archive.directory(folderPath, false);
  await archive.finalize();

  output.on("close", () => {
    res.download(zipPath);
  });
});

// POST: Upload multiple images with a text and analyze using OpenAI
app.post("/upload-image/:userId", (req, res, next) => {
  const userId = req.params.userId;
  req.userId = userId;
  const uploadsDir = path.join(__dirname, "db", userId, "webSite", "uploads");
  fs.ensureDirSync(uploadsDir);

  const storage = multer.diskStorage({
    destination: (_, __, cb) => cb(null, uploadsDir),
    filename: (_, file, cb) => cb(null, Date.now() + "-" + file.originalname),
  });

  const upload = multer({ storage }).array("images", 10);
  upload(req, res, (err) => {
    if (err) return res.status(500).json({ error: "Upload failed" });
    next();
  });
}, async (req, res) => {
  const userId = req.userId;
  const uploadsDir = path.join(__dirname, "db", userId, "webSite", "uploads");
  const profileFile = path.join(__dirname, "db", userId, "user-data.json");
  const historyFile = path.join(__dirname, "db", userId, "chat-history.json");

  try {
    const files = req.files;
    const userText = req.body.text || "";

    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    fs.ensureFileSync(profileFile);
    fs.ensureFileSync(historyFile);

    const newImagesData = [];

    for (const file of files) {
      const imagePath = path.join(uploadsDir, file.filename);
      const ext = path.extname(file.originalname).slice(1);

      const analysis = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that describes images.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "What kind of image is this and what is its use?" },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/${ext};base64,${fs.readFileSync(imagePath, "base64")}`,
                },
              },
            ],
          },
        ],
        max_tokens: 200,
      });

      const aiDescription = analysis.choices[0].message.content;

      const imageData = {
        filename: file.filename,
        originalname: file.originalname,
        url: `/uploads/${file.filename}`,
        uploadedAt: new Date().toISOString(),
        description: userText,
        aiAnalysis: aiDescription,
      };

      newImagesData.push(imageData);
    }

    // Lock both files
    await lockfile.lock(profileFile);
    await lockfile.lock(historyFile);

    try {
      // Re-read files after locking to avoid stale writes
      const latestUserProfile = JSON.parse(fs.readFileSync(profileFile, "utf-8") || "{}");
      const latestChatHistory = JSON.parse(fs.readFileSync(historyFile, "utf-8") || "[]");

      if (!Array.isArray(latestUserProfile.images)) {
        latestUserProfile.images = [];
      }

      latestUserProfile.images.push(...newImagesData);

      latestChatHistory.push({
        user: `Uploaded ${files.length} image(s) with text: "${userText}"`,
        bot: newImagesData.map(img => `AI Analysis for ${img.originalname}: ${img.aiAnalysis}`).join("\n\n"),
      });

      fs.writeFileSync(profileFile, JSON.stringify(latestUserProfile, null, 2));
      fs.writeFileSync(historyFile, JSON.stringify(latestChatHistory, null, 2));
    } finally {
      // Unlock files
      await lockfile.unlock(profileFile);
      await lockfile.unlock(historyFile);
    }

    res.status(200).json({
      success: true,
      images: newImagesData,
      message: "Images uploaded and analyzed successfully.",
    });
  } catch (err) {
    console.error("Upload Error:", err);
    res.status(500).json({ error: "Image upload or analysis failed." });
  }
});

// POST: Generate dynamic webSite from profile
app.post("/promptBackground", async (req, res) => {
  try {
    const userId = req.body.userId;
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    const userDir = path.join(__dirname, "db", userId);
    const profileFile = path.join(userDir, "user-data.json");
    const historyFile = path.join(userDir, "chat-history.json");
    const websiteDir = path.join(userDir, "webSite");

    fs.ensureDirSync(websiteDir);
    fs.ensureFileSync(profileFile);
    fs.ensureFileSync(historyFile);

    const userProfile = JSON.parse(fs.readFileSync(profileFile, "utf-8"));
    const chatHistory = JSON.parse(fs.readFileSync(historyFile, "utf-8"));

    // Existing or default blank code
    const websiteCode = {
      html: fs.existsSync(path.join(websiteDir, "index.html"))
        ? fs.readFileSync(path.join(websiteDir, "index.html"), "utf-8")
        : "<!-- empty -->",
      css: fs.existsSync(path.join(websiteDir, "styles.css"))
        ? fs.readFileSync(path.join(websiteDir, "styles.css"), "utf-8")
        : "/* empty */",
      js: fs.existsSync(path.join(websiteDir, "script.js"))
        ? fs.readFileSync(path.join(websiteDir, "script.js"), "utf-8")
        : "// empty",
    };

    const systemPromptBackground = `
You are a full-stack AI developer. Create a dynamic, multi-page website using only one HTML file, one CSS file, and one JavaScript file. The website must be fully functional and styled using CSS. JavaScript should handle all interactivity and dynamic behavior.
where on clicking at navbar 'a' elements it only show there section only.
Here is the user's desired website information:
${JSON.stringify(userProfile, null, 2)}
${JSON.stringify(chatHistory, null, 2)}

Here is the current website code:
HTML:
${websiteCode.html}

CSS:
${websiteCode.css}

JS:
${websiteCode.js}

Your task:
- Update the HTML, CSS, and JS files to reflect the user's website preferences.
- Include all required pages and sections if listed.
- Insert placeholders like <span id="goal"> or <div id="about-section">.
- In script.js, fetch "/profile", "/history" and multiple pages website populate the HTML.
- Make the site responsive and visually appealing.
- By clicking the navbar "a" elements and buttons in open that particular section of code only.
- Generate the dummy data in website according user need.
- Use clean and modern design, respecting colorScheme, theme, etc.

Respond ONLY in this JSON format:
{"updatedCode": {
    "html": "string",
    "css": "string",
    "js": "string"
  }
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ 
        role: "system", 
        content: systemPromptBackground, 
        text: { 
          format: {
            updatedCode: {html: "string", css: "string", js: "string"}
          }
        }
      }],
    });

    let parsed;
    try {
      parsed = JSON.parse(response.choices[0].message.content);
    } catch (jsonErr) {
      console.error("❌ Failed to parse OpenAI response as JSON. Content was:", response.choices[0].message.content);
      return res.status(500).json({ error: "OpenAI response is not valid JSON", details: jsonErr.message });
    }

    // Now safe to use parsed object
    // fs.writeFileSync(profileFile, JSON.stringify(parsed.updatedUserProfile, null, 2));
    fs.writeFileSync(path.join(websiteDir, "index.html"), parsed.updatedCode.html);
    fs.writeFileSync(path.join(websiteDir, "styles.css"), parsed.updatedCode.css);
    fs.writeFileSync(path.join(websiteDir, "script.js"), parsed.updatedCode.js);

    res.status(200).json({ message: "WebSite updated successfully" });
  } catch (err) {
    console.error("Background update error:", err);
    res.status(500).json({ error: "Failed to update webSite" });
  }
});

// Dynamic user-specific chat handler
app.post("/chat", async (req, res) => {
  const { message, userId } = req.body;

  if (!userId) return res.status(400).json({ error: "Missing userId" });

  const userDir = path.join("db", userId);
  const historyFile = path.join(userDir, "chat-history.json");
  const profileFile = path.join(userDir, "user-data.json");

  try {
    if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
    if (!fs.existsSync(historyFile)) fs.writeFileSync(historyFile, "[]");
    if (!fs.existsSync(profileFile)) fs.writeFileSync(profileFile, "{}");

    const chatHistory = JSON.parse(fs.readFileSync(historyFile));
    const userProfile = JSON.parse(fs.readFileSync(profileFile));
    const updatedHistory = [...chatHistory, { user: message, bot: "" }];

    const formattedConversation = updatedHistory
      .map((entry) =>
        entry.bot
          ? `User: ${entry.user}\nBot: ${entry.bot}`
          : `User: ${entry.user}`
      )
      .join("\n");

    const promptQuick = `You are a helpful assistant that talks in friendly way with users to understand and build their ideal website.
Here is the existing chat history:
${formattedConversation}

Here is the current user profile:
${JSON.stringify(userProfile, null, 2)}

Respond ONLY in this JSON format:
{ "nextQuestion": "string", "updatedUserProfile": { ... } }
`.trim();

    const quickResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: promptQuick }],
    });

    let responseText = quickResponse.choices[0].message.content;
    responseText = responseText.replace(/```json|```/g, "").trim();

    const parsed = JSON.parse(responseText);
    updatedHistory[updatedHistory.length - 1].bot = parsed.nextQuestion;

    fs.writeFileSync(historyFile, JSON.stringify(updatedHistory, null, 2));
    fs.writeFileSync(
      profileFile,
      JSON.stringify(parsed.updatedUserProfile, null, 2)
    );

    res.json({ reply: parsed.nextQuestion, chatHistory: updatedHistory });
  } catch (error) {
    console.error("Chat Error:", error.message);
    res.status(500).json({ error: "Something went wrong" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () =>
  console.log(`🟢 Server running on http://localhost:${PORT}`)
);
