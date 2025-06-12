# 🤖 DevBeaver – AI-Powered Telegram Bot for Website Development

**DevBeaver** is a smart and interactive **Telegram bot** designed to generate fully functional websites just by chatting with users. Powered by **Node.js**, **Telegraf**, and **OpenAI**, this bot gathers requirements, generates code, and even deploys a live preview - all through a simple Telegram interface.

> 🔧 Internship Project under the Supervision of  
> **Mr. Shyam Sundar Verma** (Founder & CEO, Ready Bytes Software Labs Pvt. Ltd.)

## 📖 About

DevBeaver simplifies the web development process using a conversational approach. It interacts with users to gather website requirements, generates corresponding HTML/CSS/JS code using the OpenAI API, and delivers both downloadable code and live previews. It also stores and manages user data and conversations using JSON files.

## 🚀 Features

- 🗣️ **Conversational Chatbot** on Telegram
- ⚙️ **AI-Driven Code Generation** using OpenAI
- 📁 **Send ZIP file** with all website source code
- 🌐 **Live Preview** via Vercel deployment
- 💾 **Stores Chat History** and user profile in JSON format
- 🧹 **Reset Functionality** to clear previous sessions
- 🧪 **API Testing** with Postman during development

## 🛠 Technologies Used

| Tech        | Usage                                 |
|-------------|---------------------------------------|
| **Node.js** | Backend server and logic              |
| **Telegraf**| Telegram Bot framework                |
| **OpenAI API** | AI for generating website content  |
| **Git & GitHub** | Version control and storage      |
| **Vercel**  | Hosting for live website previews     |
| **Postman** | Testing API endpoints                 |

## 🧾 Bot Commands

| Command      | Description                                          |
|--------------|------------------------------------------------------|
| `/start`     | Sends a welcome/start message                        |
| `/help`      | Lists available commands (text format)               |
| `/menu`      | Shows available commands as clickable buttons        |
| `/generate`  | Triggers the AI to generate website code             |
| `/code`      | Sends the generated source code as a ZIP file        |
| `/preview`   | Shares a live preview link via Vercel                |
| `/reset`     | Clears user profile and chat history JSON files      |


## 🧠 What I Learned

- Integrating **Telegram bots** using Telegraf
- Using **OpenAI API** to dynamically generate content
- Working with **file systems and JSON storage**
- Automating **code preview and deployment** using Vercel
- **API testing** and debugging using Postman
- Building a production-ready backend with **Node.js and Express**

## 👨‍💼 Internship Details

- **Organization**: Ready Bytes Software Labs Pvt. Ltd.  
- **Project**: AI-Powered Telegram Bot for Website Generation  
- **Role**: Full-Stack Developer Intern  
- **Supervision**: Mr. Shyam Sundar Verma (Founder & CEO)

## 📥 How to Use (Locally)

1. **Clone the Repo**
   
   ```bash
   git clone https://github.com/Isha2706/DevBeaver-Bot.git
   cd DevBeaver-Bot
   ```
   
2. **Install Dependencies**
   
   ```bash
   npm install
   ```
   
3. **Configure Environment**

- Create a `.env` file with:
     
  ```ini
  TELEGRAM_BOT_TOKEN=your_token
  OPENAI_API_KEY=your_key
  VERCEL_API_TOKEN=your_token

4. **Run the Bot**
   
  ```bash
  node server/index.js
  node telegram-bot/index.js
  ```

5. **Start Chatting** on Telegram!
