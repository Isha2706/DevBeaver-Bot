/**
 * Git Deployment Utility
 * 
 * This module handles automatic deployment of website files to a Git repository.
 * It's used to push changes made by users to a remote repository, which triggers
 * deployment to a hosting service like Vercel for live preview.
 */

// Import required dependencies
import { exec } from "child_process";  // For executing Git commands
import path from "path";               // For handling file paths
import fs from "fs-extra";             // Enhanced file system operations

// Define the path to the database folder which contains user websites
// This folder is expected to be a Git repository
const dbFolderPath = path.join(process.cwd(), "db");

/**
 * Executes a shell command in the specified directory
 * 
 * @param {string} command - The shell command to execute
 * @param {string} cwd - Current working directory for the command
 * @returns {Promise<Object>} - Promise resolving to command output or rejecting with error
 */
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

/**
 * Main deployment function that pushes website changes to Git
 * 
 * This function:
 * 1. Checks if the db folder exists and is a Git repository
 * 2. Checks for changes that need to be committed
 * 3. Adds, commits, and pushes changes to the remote repository
 * 4. Handles potential errors during the Git operations
 * 
 * @returns {Promise<string>} - Status message indicating success or failure
 */
export async function deployToGit() {
  try {
    // Verify the db folder exists
    if (!fs.existsSync(dbFolderPath)) {
      throw new Error(`❌ db folder not found at ${dbFolderPath}`);
    }

    console.log("📁 Using DB folder path:", dbFolderPath);

    // Check if the folder is a Git repository
    const isRepo = fs.existsSync(path.join(dbFolderPath, ".git"));
    if (!isRepo) {
      throw new Error("❌ The db folder is not a git repository.");
    }

    // Get remote repository information for logging
    const remote = await runCommand('git remote -v', dbFolderPath);
    console.log("🌐 Git Remote Info:\n", remote.stdout);

    // Check if there are any changes to commit
    const status = await runCommand('git status --porcelain', dbFolderPath);
    console.log("📋 Git Status Output:\n", status.stdout);

    // If no changes detected, return early
    if (!status.stdout) {
      return "⚠️ No changes detected. Nothing to commit.";
    }

    // Stage all changes
    await runCommand('git add .', dbFolderPath);
    
    // Commit changes with timestamp
    await runCommand(`git commit -m "Auto update on ${new Date().toISOString()}"`, dbFolderPath);
    
    // Pull latest changes with rebase to avoid merge conflicts
    await runCommand('git pull --rebase', dbFolderPath);
    
    // Push changes to remote repository
    const push = await runCommand('git push', dbFolderPath);

    // Return success message with command output
    return `✅ Git Push Output:\n${push.stdout || '(No stdout)'}\n\n⚠️ Git Warnings or Errors:\n${push.stderr || '(No stderr)'}`;
  } catch (err) {
    // Handle and log errors
    console.error("❌ Git update failed:\n", err);
    
    // Provide detailed error information if available
    if (err.command) {
      return `❌ Error running command: ${err.command}\nstdout: ${err.stdout}\nstderr: ${err.stderr}\nerror: ${err.error}`;
    }
    
    // Return generic error message
    return `❌ ${err.message}`;
  }
}

