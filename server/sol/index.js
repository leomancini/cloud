import { join } from "path";
import { existsSync, readFileSync, mkdirSync } from "fs";
import { execSync } from "child_process";
import Anthropic from "@anthropic-ai/sdk";
import db from "../db.js";
import { uploadsDir } from "../upload.js";
import { notifyUser } from "../websocket.js";
import { SOL_USER_ID } from "../solUser.js";
import { handleSolCodeChange } from "./codeChange.js";
import { handleSolMiniGame } from "./miniGame.js";
import { handleSolImageModify } from "./imageModify.js";
import { detectAndSaveMemory, getRelevantMemories, formatMemoriesForPrompt } from "./memory.js";
import { SOL_EMOJI_ONLY } from "../config.js";

const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;

const CLASSIFY_TOOLS = [
  {
    name: "post_comment",
    description: "Reply with a conversational comment on the post",
    input_schema: {
      type: "object",
      properties: {
        comment: { type: "string", description: SOL_EMOJI_ONLY ? "The comment to post. Must be ONLY emoji characters — no letters, no words, no punctuation. Express yourself entirely through emoji." : "The comment to post. All lowercase, 1-2 sentences, no emojis. Casual and genuine, not performative." }
      },
      required: ["comment"]
    }
  },
  {
    name: "make_code_change",
    description: "Make a code change to the Cloud app and open a GitHub pull request. Use this when the user is asking to change, add, fix, or build something in the app's code.",
    input_schema: {
      type: "object",
      properties: {
        description: { type: "string", description: "Detailed description of what code changes to make" },
        message: { type: "string", description: "A brief comment acknowledging what the user asked for and letting them know you're on it and will comment here when it's ready. Reference the specific request. All lowercase, no emojis." }
      },
      required: ["description", "message"]
    }
  },
  {
    name: "post_mini_game",
    description: "Create and post a fun interactive mini game for everyone to play. Use this when someone asks for a game, challenge, puzzle, or something playable/interactive.",
    input_schema: {
      type: "object",
      properties: {
        game_description: { type: "string", description: "Detailed description of what mini game to create, including theme, mechanics, and any specific requests" },
        message: { type: "string", description: "A brief comment acknowledging the game request and letting them know you're creating it. All lowercase, no emojis." }
      },
      required: ["game_description", "message"]
    }
  },
  {
    name: "modify_image",
    description: "Modify, edit, remix, or transform an image from the post using AI image generation. Use this when someone asks to change, edit, modify, remix, stylize, or transform a photo or image on the post.",
    input_schema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "The modification prompt to apply to the image. Describe the desired transformation." },
        message: { type: "string", description: "A brief comment acknowledging the image modification request. All lowercase, no emojis." }
      },
      required: ["prompt", "message"]
    }
  },
  {
    name: "save_memory",
    description: "Save something to Sol's persistent memory when the user explicitly asks Sol to remember a fact, detail, or piece of information. Use this when the message contains 'remember', 'don't forget', 'keep in mind', 'note that', or similar memory-storing intent. The memory will be available in all future conversations.",
    input_schema: {
      type: "object",
      properties: {
        detail: { type: "string", description: "The exact fact or detail to remember, written clearly and concisely." },
        about_name: { type: "string", description: "The name of the person or entity this memory is about, if applicable." },
        message: { type: "string", description: "A brief acknowledgment confirming you've saved the memory. All lowercase, no emojis. Example: 'got it, i'll remember that'" }
      },
      required: ["detail", "message"]
    }
  }
];

const solPostLocks = new Map();

async function handleSolMention(postId, triggerText = null) {
  if (!anthropic) return;

  const prev = solPostLocks.get(postId) || Promise.resolve();
  let resolve;
  const lock = new Promise(r => { resolve = r; });
  solPostLocks.set(postId, lock);
  await prev;

  const post = db.prepare("SELECT p.*, COALESCE(u.display_name, u.name) as author_name FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id = ?").get(postId);
  if (!post) return;

  // Detect and auto-save memory from the trigger text before doing anything else
  if (triggerText) {
    const lastComment = db.prepare(
      "SELECT user_id FROM comments WHERE post_id = ? AND user_id != ? ORDER BY created_at DESC LIMIT 1"
    ).get(postId, SOL_USER_ID);
    const triggerUserId = lastComment?.user_id || post.user_id;
    detectAndSaveMemory(triggerText, triggerUserId, postId);
  }

  const media = db.prepare("SELECT filename, media_type, source, width, height FROM post_media WHERE post_id = ? ORDER BY id").all(postId);
  const comments = db.prepare(
    "SELECT c.content, c.user_id, COALESCE(u.display_name, u.name) as author_name FROM comments c JOIN users u ON c.user_id = u.id WHERE c.post_id = ? ORDER BY c.created_at ASC"
  ).all(postId);

  const content = [];

  for (const m of media) {
    try {
      const filePath = join(uploadsDir, m.filename);
      if (m.media_type === "image") {
        const buf = readFileSync(filePath);
        const ext = m.filename.split(".").pop().toLowerCase();
        const mediaType = ext === "gif" ? "image/gif" : "image/jpeg";
        content.push({ type: "image", source: { type: "base64", media_type: mediaType, data: buf.toString("base64") } });
      } else if (m.media_type === "video") {
        const tmpDir = join(uploadsDir, ".tmp_frames");
        if (!existsSync(tmpDir)) mkdirSync(tmpDir);
        const duration = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${filePath}"`).toString().trim()) || 1;
        const times = [0, duration / 2, Math.max(0, duration - 0.5)];
        for (const t of times) {
          const framePath = join(tmpDir, `frame_${m.filename}_${t}.jpg`);
          try {
            execSync(`ffmpeg -y -ss ${t} -i "${filePath}" -frames:v 1 -q:v 3 "${framePath}" 2>/dev/null`);
            const buf = readFileSync(framePath);
            content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: buf.toString("base64") } });
            try { execSync(`rm "${framePath}"`); } catch (e) {}
          } catch (e) {}
        }
      }
    } catch (e) {
      console.warn("Failed to process media for Sol:", e);
    }
  }

  let textContext = "";
  if (post.content) textContext += `${post.author_name} posted: "${post.content}"\n\n`;
  if (post.place_name) textContext += `Location: ${post.place_name}\n\n`;
  if (comments.length > 0) {
    textContext += "Comments:\n";
    for (const c of comments) {
      textContext += `- ${c.author_name}: ${c.content}\n`;
    }
    textContext += "\n";
  }
  if (triggerText) {
    textContext += `The message you are responding to: "${triggerText}"\n\n`;
  }
  const threadHasGame = !!db.prepare("SELECT 1 FROM comments WHERE post_id = ? AND mini_game IS NOT NULL LIMIT 1").get(postId);

  // Load relevant memories for this thread
  const userIdsInThread = [...new Set([
    post.user_id,
    ...comments.map((c) => c.user_id).filter(Boolean),
  ])].filter((id) => id !== SOL_USER_ID);
  const relevantMemories = getRelevantMemories(postId, userIdsInThread);
  const memoryContext = formatMemoriesForPrompt(relevantMemories);

  textContext += `You are Sol, an AI participant in this social feed called Cloud. Cloud is also the name of the app's codebase. You are powered by Claude Sonnet 4.6 (Anthropic). When making code changes, you also use Claude Sonnet 4.6.

Respond to the most recent message directed at you (above). The post and comment thread are context, but focus on what was just said to you.

${threadHasGame ? "IMPORTANT: This thread already contains a mini game you created. If the user is asking for ANY changes, updates, tweaks, or modifications, you MUST use post_mini_game \u2014 NOT make_code_change. Only use make_code_change if they explicitly say they want to change the Cloud app's source code itself.\n\n" : ""}${memoryContext}Choose one action:
- post_comment: ${SOL_EMOJI_ONLY ? "Respond using ONLY emoji — no words, no letters, no punctuation. Use a sequence of emoji that expresses your reaction or response to what was said. This is the only way you can communicate right now." : "Write a short, casual comment like a real person would. 1-2 sentences. No emojis. All lowercase. Don't be overly enthusiastic or try to be clever \u2014 just be genuine and low-key."} Use this for casual messages, greetings, questions, or anything that isn't explicitly asking for a code change or a game.
- make_code_change: ONLY use this if the user explicitly asks to modify the Cloud app's deployed source code (server.js, App.jsx, etc). Words like "build", "make", "create", "add", "change", "update" about a game or interactive thing mean post_mini_game, NOT this.${!process.env.GITHUB_TOKEN ? " (Currently unavailable \u2014 no GitHub token configured)" : ""}
- post_mini_game: Use this whenever the user wants ANY kind of game, toy, interactive thing, challenge, puzzle, simulation, or playable experience. Also use this if they describe something visual/interactive to "build" or "make" \u2014 that is a game, not a code change. If in doubt between this and make_code_change, choose this.${threadHasGame ? " This thread already has a game \u2014 use this for any follow-up requests about it." : ""}
- modify_image: Use this when the user asks to modify, edit, remix, stylize, transform, or change an image/photo on the post. Examples: "make this look like a painting", "add a sunset", "make it look vintage", "turn this into pixel art".
- save_memory: Use this when the user explicitly asks you to remember, save, or note a fact for the future.`;

  content.push({ type: "text", text: textContext });

  const placeholder = db.prepare("INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)").run(postId, SOL_USER_ID, "thinking...");
  const placeholderId = placeholder.lastInsertRowid;

  notifyUser(post.user_id, "feed-update");
  const postFollowers = db.prepare("SELECT follower_id FROM follows WHERE following_id = ? AND status = 'approved'").all(post.user_id);
  for (const f of postFollowers) notifyUser(f.follower_id, "feed-update");

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      tools: CLASSIFY_TOOLS,
      tool_choice: { type: "any" },
      messages: [{ role: "user", content }],
    });

    const toolBlock = response.content.find(b => b.type === "tool_use");

    const notify = () => {
      notifyUser(post.user_id, "feed-update");
      for (const f of postFollowers) notifyUser(f.follower_id, "feed-update");
    };

    const solComment = (text) => {
      db.prepare("INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)").run(postId, SOL_USER_ID, text);
      notify();
    };

    const updatePlaceholder = (text) => {
      db.prepare("UPDATE comments SET content = ? WHERE id = ?").run(text || "...", placeholderId);
      notify();
    };

    console.log("[Sol] Classified as:", toolBlock?.name || "text");

    if (toolBlock && toolBlock.name === "make_code_change" && process.env.GITHUB_TOKEN) {
      console.log("[Sol] Posting acknowledgment:", toolBlock.input.message);
      updatePlaceholder(toolBlock.input.message);

      const prUrl = await handleSolCodeChange(toolBlock.input.description, postId);
      console.log("[Sol] PR result:", prUrl || "failed");

      if (prUrl) {
        const existingCheck = postId ? db.prepare("SELECT COUNT(*) as c FROM sol_prs WHERE post_id = ?").get(postId) : null;
        const isExisting = existingCheck && existingCheck.c > 1;
        solComment(isExisting ? `updated the pr \u2014 ${prUrl}` : `i opened a pr for that \u2014 ${prUrl}`);
      } else {
        solComment("i tried but couldn't make that change, sorry");
      }
    } else if (toolBlock && toolBlock.name === "post_mini_game") {
      updatePlaceholder(toolBlock.input.message);

      const existingGame = db.prepare(
        "SELECT id, mini_game, created_at FROM comments WHERE post_id = ? AND mini_game IS NOT NULL ORDER BY created_at DESC LIMIT 1"
      ).get(postId);

      const existingGameHtml = existingGame?.mini_game || null;

      if (existingGame) {
        db.prepare("UPDATE comments SET mini_game = NULL, content = 'generated a game (old version)' WHERE id = ?").run(existingGame.id);
        notify();
      }

      const gamePostId = await handleSolMiniGame(toolBlock.input.game_description, postId, existingGameHtml);
      if (!gamePostId) {
        solComment("i tried to make a game but something went wrong, sorry");
      }
    } else if (toolBlock && toolBlock.name === "modify_image") {
      updatePlaceholder(toolBlock.input.message);
      const result = await handleSolImageModify(toolBlock.input.prompt, postId);
      if (!result) {
        solComment("i tried to modify the image but something went wrong, sorry");
      }
    } else if (toolBlock && toolBlock.name === "save_memory") {
      // Save the memory via the structured tool output
      const triggerUserId = (() => {
        const lastComment = db.prepare("SELECT user_id FROM comments WHERE post_id = ? AND user_id != ? ORDER BY created_at DESC LIMIT 1").get(postId, SOL_USER_ID);
        return lastComment?.user_id || post.user_id;
      })();
      let aboutUserId = null;
      if (toolBlock.input.about_name) {
        const matched = db.prepare("SELECT id FROM users WHERE LOWER(COALESCE(display_name, name)) = LOWER(?)").get(toolBlock.input.about_name);
        if (matched) aboutUserId = matched.id;
      }
      if (!aboutUserId) aboutUserId = triggerUserId;
      db.prepare(`INSERT INTO sol_memories (about_user_id, about_name, detail, raw_text, context_post_id, created_by_user_id) VALUES (?, ?, ?, ?, ?, ?)`).run(
        aboutUserId, toolBlock.input.about_name || null, toolBlock.input.detail, triggerText, postId, triggerUserId
      );
      console.log(`[Sol Memory] Saved via tool: "${toolBlock.input.detail}"`);
      updatePlaceholder(toolBlock.input.message);
    } else if (toolBlock && toolBlock.name === "post_comment") {
      updatePlaceholder(toolBlock.input.comment);
    } else {
      const textBlock = response.content.find(b => b.type === "text");
      updatePlaceholder(textBlock?.text?.trim() || "hmm, not sure what to say");
    }
  } catch (e) {
    console.warn("Sol response error:", e);
    db.prepare("UPDATE comments SET content = ? WHERE id = ?").run("sorry, i couldn't respond right now.", placeholderId);
    notifyUser(post.user_id, "feed-update");
  } finally {
    resolve();
    if (solPostLocks.get(postId) === lock) solPostLocks.delete(postId);
  }
}

export { handleSolMention };
