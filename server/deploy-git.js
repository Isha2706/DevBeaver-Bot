import { exec } from "child_process";
import path from "path";
import fs from "fs-extra";

const dbFolderPath = path.join(process.cwd(), "db");

function runCommand(command, cwd) {
  return new Promise((resolve, reject) => {
    exec(command, { cwd, shell: true }, (error, stdout, stderr) => {
      if (error) {
        return reject({
          success: false,
          command,
          stdout,
          stderr,
          error: error.message,
        });
      }
      resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}

export async function deployToGit() {
  try {
    if (!fs.existsSync(dbFolderPath)) {
      throw new Error(`❌ db folder not found at ${dbFolderPath}`);
    }

    console.log("📁 Using DB folder path:", dbFolderPath);

    const isRepo = fs.existsSync(path.join(dbFolderPath, ".git"));
    if (!isRepo) {
      throw new Error("❌ The db folder is not a git repository.");
    }

    const remote = await runCommand('git remote -v', dbFolderPath);
    console.log("🌐 Git Remote Info:\n", remote.stdout);

    const status = await runCommand('git status --porcelain', dbFolderPath);
    console.log("📋 Git Status Output:\n", status.stdout);

    if (!status.stdout) {
      return "⚠️ No changes detected. Nothing to commit.";
    }

    await runCommand('git add .', dbFolderPath);
    await runCommand(`git commit -m "Auto update on ${new Date().toISOString()}"`, dbFolderPath);
    await runCommand('git pull --rebase', dbFolderPath);
    const push = await runCommand('git push', dbFolderPath);

    return `✅ Git Push Output:\n${push.stdout || '(No stdout)'}\n\n⚠️ Git Warnings or Errors:\n${push.stderr || '(No stderr)'}`;
  } catch (err) {
    console.error("❌ Git update failed:\n", err);
    if (err.command) {
      return `❌ Error running command: ${err.command}\nstdout: ${err.stdout}\nstderr: ${err.stderr}\nerror: ${err.error}`;
    }
    return `❌ ${err.message}`;
  }
}

