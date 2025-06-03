/**
 * DevBeaver Bot - Backend Server
 * This server handles all the backend operations for the DevBeaver Bot,
 * including user data management, website generation, image processing, and API endpoints.
 */

// Import required libraries
import express from "express";              // Web server framework
import dotenv from "dotenv";                // Environment variable management
import fs from "fs-extra";                  // Enhanced file system operations
import path from "path";                    // Path manipulation utilities
import OpenAI from "openai";                // OpenAI API client
import bodyParser from "body-parser";       // Request body parsing middleware
import multer from "multer";                // File upload handling middleware
import cors from "cors";                    // Cross-Origin Resource Sharing middleware
import { fileURLToPath } from "url";        // Convert file URLs to paths (for ESM)
import lockfile from "proper-lockfile";     // File locking to prevent race conditions
import { deployToGit } from "./deploy-git.js"; // Custom Git deployment utility
import archiver from "archiver";            // ZIP file creation utility

// Load environment variables from .env file
dotenv.config();

// Create ESM-friendly __dirname equivalent (not available in ES modules by default)
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Initialize Express application
const app = express();

// Configure middleware
app.use(express.json());                  // Parse JSON request bodies
app.use(cors({origin: "*"}));            // Allow cross-origin requests from any domain
app.use(express.json());                  // Parse JSON request bodies (duplicate, can be removed)

// Initialize OpenAI client with API key from environment variables
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Additional body parser middleware (redundant with express.json(), can be removed)
app.use(bodyParser.json());

/**
 * Reset API Endpoint
 * Clears all user data and resets to default state
 * 
 * @route GET /reset
 * @param {string} userId - User identifier from query parameters
 * @returns {object} JSON response indicating success or failure
 */
app.get("/reset", async(req, res) => {
  const userId = req.query.userId;

  // Validate required parameters
  if (!userId) {
    return res.status(400).json({ error: "Missing userId in query params." });
  }

  // Define file and directory paths for this user
  const userDir = path.join("db", userId);
  const historyFile = path.join(userDir, "chat-history.json");
  const profileFile = path.join(userDir, "user-data.json");
  const websiteDir = path.join(userDir, "webSite");
  const uploadsDir = path.join(websiteDir, "uploads");

  // Define default user profile structure
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
    // Ensure all required directories exist
    fs.ensureDirSync(userDir);
    fs.ensureDirSync(websiteDir);
    fs.ensureDirSync(uploadsDir);

    // Reset chat history to empty array and user profile to default state
    fs.writeFileSync(historyFile, `[]`);
    fs.writeFileSync(profileFile, JSON.stringify(defaultProfile, null, 2));

    // Create empty website files
    fs.writeFileSync(path.join(websiteDir, "index.html"), "<!-- empty -->");
    fs.writeFileSync(path.join(websiteDir, "styles.css"), "/* empty */");
    fs.writeFileSync(path.join(websiteDir, "script.js"), "// empty");

    // Clear all uploaded files
    fs.emptyDirSync(uploadsDir);

    // Deploy changes to Git repository
    const values = await deployToGit();
    console.log("In Reset api Return value:", values);

    // Send success response
    res.status(200).json({ message: `Reset successful for user: ${userId}` });
  } catch (error) {
    // Log and handle errors
    console.error("Reset Error:", error);
    res.status(500).json({ error: "Failed to reset files" });
  }
});

/**
 * Update Git Repository Endpoint
 * Triggers deployment to Git/Vercel for website preview
 * 
 * @route GET /update-git
 * @returns {object} JSON response indicating success or failure
 */
app.get('/update-git', async (req, res) => {
  try {
    // Call the Git deployment utility
    const values = await deployToGit();
    console.log("Return value:", values);
    
    // Send success response
    res.status(200).json({ message: '✅ Vercel deployment triggered successfully.' });
  } catch (error) {
    // Log and handle errors
    console.error("❌ Error updating Vercel:", error);
    res.status(500).json({ error: 'Vercel deployment failed.', details: error.message });
  }
});

/**
 * Code Download Endpoint
 * Creates and sends a ZIP file containing the user's website code
 * 
 * @route GET /code/:userId
 * @param {string} userId - User identifier from URL parameters
 * @returns {file} ZIP file download response
 */
app.get("/code/:userId", async (req, res) => {
  const userId = req.params.userId;
  const folderPath = path.join(__dirname, "db", userId, "webSite");

  // Define ZIP file path
  const zipPath = path.join(__dirname, "db", userId, "webSite.zip");
  const output = fs.createWriteStream(zipPath);
  const archive = archiver("zip", { zlib: { level: 9 } });  // Maximum compression

  // Pipe archive data to the file
  archive.pipe(output);
  
  // Add the entire website directory to the archive
  archive.directory(folderPath, false);
  await archive.finalize();

  // When the archive is fully written, send it as a download
  output.on("close", () => {
    res.download(zipPath);
  });
});

/**
 * Image Upload and Analysis Endpoint
 * Handles file uploads, saves images, and analyzes them with OpenAI
 * Uses a two-step middleware approach for file handling and processing
 * 
 * @route POST /upload-image/:userId
 * @param {string} userId - User identifier from URL parameters
 * @returns {object} JSON response with analysis results
 */
app.post("/upload-image/:userId", (req, res, next) => {
  // First middleware: Handle file upload with multer
  const userId = req.params.userId;
  req.userId = userId;  // Pass userId to the next middleware
  
  // Ensure uploads directory exists
  const uploadsDir = path.join(__dirname, "db", userId, "webSite", "uploads");
  fs.ensureDirSync(uploadsDir);

  // Configure storage for uploaded files
  const storage = multer.diskStorage({
    destination: (_, __, cb) => cb(null, uploadsDir),
    filename: (_, file, cb) => cb(null, Date.now() + "-" + file.originalname),
  });

  // Set up multer with configured storage
  const upload = multer({ storage }).array("images", 10);  // Allow up to 10 images
  upload(req, res, (err) => {
    if (err) return res.status(500).json({ error: "Upload failed" });
    next();  // Proceed to next middleware
  });
}, async (req, res) => {
  // Second middleware: Process and analyze uploaded images
  const userId = req.userId;
  const uploadsDir = path.join(__dirname, "db", userId, "webSite", "uploads");
  const profileFile = path.join(__dirname, "db", userId, "user-data.json");
  const historyFile = path.join(__dirname, "db", userId, "chat-history.json");

  try {
    const files = req.files;
    const userText = req.body.text || "";

    // Validate that files were uploaded
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    // Ensure user data files exist
    fs.ensureFileSync(profileFile);
    fs.ensureFileSync(historyFile);

    const newImagesData = [];

    // Process each uploaded image
    for (const file of files) {
      const imagePath = path.join(uploadsDir, file.filename);
      const ext = path.extname(file.originalname).slice(1);

      // Use OpenAI to analyze the image
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

      // Create metadata for the image
      const imageData = {
        filename: file.filename,
        originalname: file.originalname,
        url: `uploads/${file.filename}`,
        uploadedAt: new Date().toISOString(),
        description: userText,
        aiAnalysis: aiDescription,
      };

      newImagesData.push(imageData);
    }

    // Lock files to prevent concurrent modifications
    await lockfile.lock(profileFile);
    await lockfile.lock(historyFile);

    try {
      // Re-read files after locking to avoid stale writes
      const latestUserProfile = JSON.parse(fs.readFileSync(profileFile, "utf-8") || "{}");
      const latestChatHistory = JSON.parse(fs.readFileSync(historyFile, "utf-8") || "[]");

      // Initialize images array if it doesn't exist
      if (!Array.isArray(latestUserProfile.images)) {
        latestUserProfile.images = [];
      }

      // Add new images to user profile
      latestUserProfile.images.push(...newImagesData);

      // Add upload event to chat history
      latestChatHistory.push({
        user: `Uploaded ${files.length} image(s) with text: "${userText}"`,
        bot: newImagesData.map(img => `AI Analysis for ${img.originalname}: ${img.aiAnalysis}`).join("\n\n"),
      });

      // Write updated data back to files
      fs.writeFileSync(profileFile, JSON.stringify(latestUserProfile, null, 2));
      fs.writeFileSync(historyFile, JSON.stringify(latestChatHistory, null, 2));
    } finally {
      // Always unlock files, even if an error occurs
      await lockfile.unlock(profileFile);
      await lockfile.unlock(historyFile);
    }

    // Send success response with image data
    res.status(200).json({
      success: true,
      images: newImagesData,
      message: "Images uploaded and analyzed successfully.",
    });
  } catch (err) {
    // Log and handle errors
    console.error("Upload Error:", err);
    res.status(500).json({ error: "Image upload or analysis failed." });
  }
});

/**
 * Website Generation Endpoint
 * Creates or updates website files based on user profile and chat history
 * Uses OpenAI to generate HTML, CSS, and JavaScript code
 * 
 * @route POST /promptBackground
 * @param {string} userId - User identifier in request body
 * @returns {object} JSON response indicating success or failure
 */
app.post("/promptBackground", async (req, res) => {
  try {
    const userId = req.body.userId;
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    // Define file and directory paths for this user
    const userDir = path.join(__dirname, "db", userId);
    const profileFile = path.join(userDir, "user-data.json");
    const historyFile = path.join(userDir, "chat-history.json");
    const websiteDir = path.join(userDir, "webSite");

    // Ensure directories and files exist
    fs.ensureDirSync(websiteDir);
    fs.ensureFileSync(profileFile);
    fs.ensureFileSync(historyFile);

    // Load user data
    const userProfile = JSON.parse(fs.readFileSync(profileFile, "utf-8"));
    const chatHistory = JSON.parse(fs.readFileSync(historyFile, "utf-8"));

    // Load current website code (if exists)
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

    // Create system prompt for OpenAI
    const systemPromptBackground = `
You are a full-stack AI developer. Create a **dynamic, multi-page-like website** using **a single HTML file**, **one CSS file**, and **one JS file**. Do not split into separate HTML pages. Instead, use JavaScript to simulate multi-page behavior by hiding and showing sections on navbar link click.

Here is the user's desired website information:
${JSON.stringify(userProfile, null, 2)}

Here is the chat history so far:
${JSON.stringify(chatHistory, null, 2)}

Here is the current website code:
HTML:
${websiteCode.html}

CSS:
${websiteCode.css}

JS:
${websiteCode.js}

✅ Your task:
- Update and improve the HTML, CSS, and JS files to reflect the user's requirements.
- The site should simulate **multi-page navigation** using one file only.
- When the user clicks "About" in the navbar, it should show the About section and hide others. Same for "Home", "Contact", etc.
- JavaScript should handle this navigation dynamically.
- you can add dummy data to show the design of website.
- Use image according to aiAnalysis.
- Create placeholder sections like <section id="about-section"> for different pages.
- Make sure the default visible section is "Home" (or first in navbar).
- Keep the design responsive and visually appealing using CSS.
- Include dummy content using the user's profile data where appropriate.

Respond ONLY with JSON in the following structure:
{
  "updatedCode": {
    "html": "HTML_CODE_STRING",
    "css": "CSS_CODE_STRING",
    "js": "JS_CODE_STRING"
  }
}
Do not return markdown formatting, comments, or explanation.
    `.trim();

    // Generate website code using OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // or "gpt-4o" 
      messages: [
        {
          role: "system",
          content: systemPromptBackground,
        }
      ]
    });

    // Parse OpenAI response
    let parsed;
    try {
      parsed = JSON.parse(response.choices[0].message.content);
    } catch (jsonErr) {
      console.error("❌ Failed to parse OpenAI response as JSON. Content was:", response.choices[0].message.content);
      return res.status(500).json({ error: "OpenAI response is not valid JSON", details: jsonErr.message });
    }

    // Write generated code to files
    fs.writeFileSync(path.join(websiteDir, "index.html"), parsed.updatedCode.html);
    fs.writeFileSync(path.join(websiteDir, "styles.css"), parsed.updatedCode.css);
    fs.writeFileSync(path.join(websiteDir, "script.js"), parsed.updatedCode.js);

    // Send success response
    res.status(200).json({ message: "WebSite updated successfully" });
  } catch (err) {
    // Log and handle errors
    console.error("Background update error:", err);
    res.status(500).json({ error: "Failed to update webSite" });
  }
});

/**
 * Chat API Endpoint
 * Handles user messages, updates chat history, and generates responses
 * Uses OpenAI to understand user requirements and update user profile
 * 
 * @route POST /chat
 * @param {string} message - User's message text
 * @param {string} userId - User identifier
 * @returns {object} JSON response with bot reply and updated chat history
 */
app.post("/chat", async (req, res) => {
  const { message, userId } = req.body;

  // Validate required parameters
  if (!userId) return res.status(400).json({ error: "Missing userId" });

  // Define file paths for this user
  const userDir = path.join("db", userId);
  const historyFile = path.join(userDir, "chat-history.json");
  const profileFile = path.join(userDir, "user-data.json");

  try {
    // Ensure directories and files exist
    if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
    if (!fs.existsSync(historyFile)) fs.writeFileSync(historyFile, "[]");
    if (!fs.existsSync(profileFile)) fs.writeFileSync(profileFile, "{}");

    // Load existing data
    const chatHistory = JSON.parse(fs.readFileSync(historyFile));
    const userProfile = JSON.parse(fs.readFileSync(profileFile));
    
    // Add user message to history (bot response will be added later)
    const updatedHistory = [...chatHistory, { user: message, bot: "" }];

    // Format conversation for OpenAI prompt
    const formattedConversation = updatedHistory
      .map((entry) =>
        entry.bot
          ? `User: ${entry.user}\nBot: ${entry.bot}`
          : `User: ${entry.user}`
      )
      .join("\n");

    // Create prompt for OpenAI
    const promptQuick = `You are a helpful assistant that talks in friendly way with users to understand and build their ideal website.
Here is the existing chat history:
${formattedConversation}

Here is the current user profile:
${JSON.stringify(userProfile, null, 2)}

Respond ONLY in this JSON format:
{ "nextQuestion": "string", "updatedUserProfile": { ... } }
`.trim();

    // Generate response using OpenAI
    const quickResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: promptQuick }],
    });

    // Process OpenAI response
    let responseText = quickResponse.choices[0].message.content;
    responseText = responseText.replace(/```json|```/g, "").trim();

    const parsed = JSON.parse(responseText);
    
    // Update chat history with bot response
    updatedHistory[updatedHistory.length - 1].bot = parsed.nextQuestion;

    // Save updated data
    fs.writeFileSync(historyFile, JSON.stringify(updatedHistory, null, 2));
    fs.writeFileSync(
      profileFile,
      JSON.stringify(parsed.updatedUserProfile, null, 2)
    );

    // Send response to client
    res.json({ reply: parsed.nextQuestion, chatHistory: updatedHistory });
  } catch (error) {
    // Log and handle errors
    console.error("Chat Error:", error.message);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// Start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () =>
  console.log(`🟢 Server running on http://localhost:${PORT}`)
);
