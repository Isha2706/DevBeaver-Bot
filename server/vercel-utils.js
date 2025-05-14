import simpleGit from 'simple-git';
import path from 'path';
import fs from 'fs-extra';

const dbFolderPath = path.join(process.cwd(), 'server', 'db');

export async function deployToVercel() {
  if (!fs.existsSync(dbFolderPath)) {
    throw new Error(`❌ DB folder does not exist at path: ${dbFolderPath}`);
  }

  const git = simpleGit(dbFolderPath);

  try {
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      throw new Error("❌ The db folder is not a Git repository. Please run: git init && git remote add origin <your-repo-url>");
    }

    await git.add('./*');

    const status = await git.status();
    if (status.files.length === 0) {
      console.log("✅ No changes to commit.");
      return;
    }

    await git.commit(`Update: Auto commit at ${new Date().toISOString()}`);
    await git.push();

    console.log("✅ Changes pushed to GitHub. Vercel will auto-deploy.");
  } catch (err) {
    console.error("❌ Failed to deploy to Vercel:", err.message);
    throw err;
  }
}
