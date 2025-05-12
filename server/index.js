import express from "express";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import OpenAI from "openai";
import bodyParser from "body-parser";

dotenv.config();
const app = express();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(bodyParser.json());

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

    const formattedConversation = updatedHistory.map(entry =>
      entry.bot ? `User: ${entry.user}\nBot: ${entry.bot}` : `User: ${entry.user}`
    ).join("\n");

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
    fs.writeFileSync(profileFile, JSON.stringify(parsed.updatedUserProfile, null, 2));

    res.json({ reply: parsed.nextQuestion, chatHistory: updatedHistory });
  } catch (error) {
    console.error("Chat Error:", error.message);
    res.status(500).json({ error: "Something went wrong" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🟢 Server running on http://localhost:${PORT}`));
