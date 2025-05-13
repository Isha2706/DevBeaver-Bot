import express from "express";
import dotenv from "dotenv";
import fs from "fs-extra";
import path from "path";
import OpenAI from "openai";
import bodyParser from "body-parser";
import multer from "multer";
import cors from "cors";
import { fileURLToPath } from "url";

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(cors("*"));
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(bodyParser.json());

// Multer storage (ensures uploads dir exists)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userId = req.body.userId;
    const uploadPath = path.join(__dirname, "db", userId, "uploads");
    fs.ensureDirSync(uploadPath); 
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage: storage });

// POST: Upload multiple images with a text and analyze using OpenAI
app.post("/upload-image", upload.array("images", 10), async (req, res) => {
  try {
    const files = req.files;
    const userId = req.body.userId;
    const userText = req.body.text || "";

    if (!files || !userId) {
      return res.status(400).json({ error: "Missing files or userId" });
    }

    const userDir = path.join(__dirname, "db", userId);
    const profileFile = path.join(userDir, "user-data.json");
    const historyFile = path.join(userDir, "chat-history.json");

    fs.ensureFileSync(profileFile);
    fs.ensureFileSync(historyFile);

    // Load existing profile and history
    const userProfile = JSON.parse(fs.readFileSync(profileFile));
    const chatHistory = JSON.parse(fs.readFileSync(historyFile));

    // Ensure images field exists
    if (!userProfile.images) userProfile.images = [];

    const newImagesData = [];

    for (const file of files) {
      const imagePath = file.path;

      const analysis = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that describes images.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "What kind of image is this and what is its use?",
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/${path
                    .extname(file.filename)
                    .slice(1)};base64,${fs.readFileSync(imagePath, {
                    encoding: "base64",
                  })}`,
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

      userProfile.images.push(imageData);
      newImagesData.push(imageData);
    }

    chatHistory.push({
      user: `Uploaded ${files.length} image(s) with text: "${userText}"`,
      bot: newImagesData
        .map((img) => `AI Analysis for ${img.originalname}: ${img.aiAnalysis}`)
        .join("\n\n"),
    });

    fs.writeFileSync(profileFile, JSON.stringify(userProfile, null, 2));
    fs.writeFileSync(historyFile, JSON.stringify(chatHistory, null, 2));

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

// GET: Reset profile and history for a specific user
app.get("/reset", (req, res) => {
  const userId = req.query.userId;

  if (!userId) {
    return res.status(400).json({ error: "Missing userId in query params." });
  }

  const userDir = path.join("db", userId);
  const historyFile = path.join(userDir, "chat-history.json");
  const profileFile = path.join(userDir, "user-data.json");

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
    if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });

    fs.writeFileSync(historyFile, `[]`);
    fs.writeFileSync(profileFile, JSON.stringify(defaultProfile, null, 2));

    res.status(200).json({ message: `Reset successful for user: ${userId}` });
  } catch (error) {
    console.error("Reset Error:", error);
    res.status(500).json({ error: "Failed to reset files" });
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

    const promptQuick = `
You are a helpful assistant that talks to users to understand and build their ideal website.

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
