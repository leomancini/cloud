import { join, dirname } from "path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { execFileSync } from "child_process";
import Anthropic from "@anthropic-ai/sdk";
import db from "../db.js";
import { __dirname, GITHUB_OWNER, GITHUB_REPO } from "../config.js";

const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;

export async function handleSolCodeChange(description, postId) {
  if (!process.env.GITHUB_TOKEN) return null;

  const existingPr = postId ? db.prepare("SELECT * FROM sol_prs WHERE post_id = ? ORDER BY created_at DESC LIMIT 1").get(postId) : null;
  const isUpdate = !!(existingPr && existingPr.branch_name);

  const slug = isUpdate ? existingPr.branch_name.replace("sol/", "") : `sol-${Date.now()}`;
  const branchName = isUpdate ? existingPr.branch_name : `sol/${slug}`;
  const worktreePath = `/tmp/${slug}`;

  try {
    if (isUpdate) {
      execFileSync("git", ["fetch", "origin", branchName], { cwd: __dirname });
      execFileSync("git", ["worktree", "add", worktreePath, branchName], { cwd: __dirname });
      try { execFileSync("git", ["merge", "origin/main", "--no-edit"], { cwd: worktreePath }); } catch {}
    } else {
      execFileSync("git", ["worktree", "add", worktreePath, "-b", branchName], { cwd: __dirname });
    }
    console.log(`[Sol] Worktree created at ${worktreePath}`);

    const agentMessages = [{
      role: "user",
      content: `You are Sol, an AI developer making changes to Cloud, a social feed app.

Tech stack: Express backend (server.js), React frontend (src/App.jsx — entire UI in one file), SQLite (better-sqlite3), styled-components, Vite.

Requested change: ${description}

Steps: 1) Read the file(s) you need to change. 2) Use edit_file for targeted replacements. 3) Stop — do not re-read or verify. Get it right the first time.`
    }];

    const agentTools = [
      { name: "read_file", description: "Read a file from the repo", input_schema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } },
      { name: "edit_file", description: "Replace old_string with new_string in a file. old_string must be unique.", input_schema: { type: "object", properties: { path: { type: "string" }, old_string: { type: "string" }, new_string: { type: "string" } }, required: ["path", "old_string", "new_string"] } },
      { name: "write_file", description: "Create a new file or overwrite a small file", input_schema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] } },
    ];

    const runTool = (name, input) => {
      const safePath = join(worktreePath, input.path);
      if (!safePath.startsWith(worktreePath + "/")) throw new Error("Path outside repo");
      if (name === "read_file") {
        if (!existsSync(safePath)) return `File not found: ${input.path}`;
        return readFileSync(safePath, "utf-8");
      } else if (name === "edit_file") {
        if (!existsSync(safePath)) return `File not found: ${input.path}`;
        const content = readFileSync(safePath, "utf-8");
        const count = content.split(input.old_string).length - 1;
        if (count === 0) return `Error: old_string not found in ${input.path}`;
        if (count > 1) return `Error: old_string found ${count} times — include more context to make it unique.`;
        writeFileSync(safePath, content.replace(input.old_string, input.new_string));
        return `Edited ${input.path}`;
      } else if (name === "write_file") {
        const dir = dirname(safePath);
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        writeFileSync(safePath, input.content);
        return `Written ${input.path}`;
      }
      return `Unknown tool: ${name}`;
    };

    for (let i = 0; i < 7; i++) {
      console.log(`[Sol] Agent iteration ${i + 1}...`);
      let response;
      for (let retry = 0; retry < 3; retry++) {
        try {
          response = await anthropic.messages.create({ model: "claude-sonnet-4-6", max_tokens: 8192, tools: agentTools, messages: agentMessages });
          break;
        } catch (e) {
          if (e.status === 429 && retry < 2) {
            const wait = (retry + 1) * 60;
            console.log(`[Sol] Rate limited, waiting ${wait}s...`);
            await new Promise(r => setTimeout(r, wait * 1000));
          } else throw e;
        }
      }

      agentMessages.push({ role: "assistant", content: response.content });
      const toolBlocks = response.content.filter(b => b.type === "tool_use");
      if (toolBlocks.length === 0) { console.log("[Sol] Agent done."); break; }

      const results = [];
      for (const block of toolBlocks) {
        console.log(`[Sol] Tool: ${block.name} (${block.input.path})`);
        let result;
        try { result = runTool(block.name, block.input); } catch (e) { result = `Error: ${e.message}`; }
        results.push({ type: "tool_result", tool_use_id: block.id, content: result });
      }
      agentMessages.push({ role: "user", content: results });
    }

    const status = execFileSync("git", ["status", "--porcelain"], { cwd: worktreePath }).toString();
    if (!status.trim()) {
      console.log("[Sol] No changes made.");
      execFileSync("git", ["worktree", "remove", "--force", worktreePath], { cwd: __dirname });
      return null;
    }

    let shortTitle = description.slice(0, 50);
    try {
      const titleRes = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001", max_tokens: 30,
        messages: [{ role: "user", content: `Write a concise PR title (max 10 words, no quotes, lowercase) for this change: ${description}` }],
      });
      const generated = titleRes.content[0]?.text?.trim();
      if (generated && generated.length <= 60) shortTitle = generated;
    } catch {}

    execFileSync("git", ["add", "-A"], { cwd: worktreePath });
    execFileSync("git", ["commit", "-m", `sol: ${shortTitle}`], { cwd: worktreePath });

    const pushUrl = `https://x-access-token:${process.env.GITHUB_TOKEN}@github.com/${GITHUB_OWNER}/${GITHUB_REPO}.git`;
    execFileSync("git", ["push", pushUrl, branchName], { cwd: worktreePath });

    let prUrl;
    if (isUpdate && existingPr.pr_url) {
      if (existingPr.pr_number) {
        await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues/${existingPr.pr_number}/comments`, {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify({ body: `Updated: ${description}` }),
        });
      }
      prUrl = existingPr.pr_url;
      console.log("[Sol] PR updated:", prUrl);
    } else {
      const prRes = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls`, {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `sol: ${shortTitle}`,
          body: `requested via cloud\n\n> ${description}`,
          head: branchName,
          base: "main",
        }),
      });
      const pr = await prRes.json();
      prUrl = pr.html_url || null;
      const prNumber = pr.number || null;
      console.log("[Sol] PR created:", prUrl);

      if (postId && prUrl) {
        db.prepare("INSERT INTO sol_prs (post_id, branch_name, pr_url, pr_number) VALUES (?, ?, ?, ?)").run(postId, branchName, prUrl, prNumber);
      }
    }

    execFileSync("git", ["worktree", "remove", "--force", worktreePath], { cwd: __dirname });
    return prUrl;
  } catch (e) {
    console.warn("Sol PR error:", e);
    try { execFileSync("git", ["worktree", "remove", "--force", worktreePath], { cwd: __dirname }); } catch {}
    try { execFileSync("git", ["branch", "-D", branchName], { cwd: __dirname }); } catch {}
    return null;
  }
}
