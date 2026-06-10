import db from "../db.js";
import { SOL_USER_ID } from "../solUser.js";

/**
 * Detect a "remember X about Y" intent in a message and persist it.
 * Returns the memory object if one was saved, otherwise null.
 */
export function detectAndSaveMemory(text, triggeringUserId, postId) {
  if (!text) return null;

  const lower = text.toLowerCase().trim();

  // Skip questions asking about memory ("what do you remember?", "do you remember?", etc.)
  if (/\b(what|do|can|did|will)\b.*\bremember\b/i.test(lower)) return null;
  if (/\bremember\s*\?/i.test(lower)) return null;

  // Only match imperative "remember X" commands, not incidental uses
  const commandPatterns = [
    /^@?\s*sol\s*,?\s*remember\s+/i,
    /^remember\s+that\s+/i,
    /^remember\s+/i,
    /^don'?t\s+forget\s+that\s+/i,
    /^don'?t\s+forget\s+/i,
    /^keep\s+in\s+mind\s+that\s+/i,
    /^keep\s+in\s+mind\s+/i,
    /^note\s+that\s+/i,
    /^note:\s*/i,
    /^save\s+this:\s*/i,
  ];

  // Strip @sol prefix for matching
  const stripped = lower.replace(/^@\s*sol\s*,?\s*/i, "");
  if (!commandPatterns.some((rx) => rx.test(lower) || rx.test(stripped))) return null;

  let detail = text.trim();
  for (const rx of commandPatterns) {
    if (rx.test(detail)) { detail = detail.replace(rx, "").trim(); break; }
    const strippedDetail = detail.replace(/^@\s*sol\s*,?\s*/i, "");
    if (rx.test(strippedDetail)) { detail = strippedDetail.replace(rx, "").trim(); break; }
  }

  if (!detail || detail.length < 3) return null;

  let aboutUserId = null;
  let aboutName = null;

  const mentionMatch = text.match(/@(\w[\w\s]*?)(?:\s|$|')/);
  if (mentionMatch) {
    const mentionedName = mentionMatch[1].trim();
    const matched = db.prepare(
      "SELECT id, COALESCE(display_name, name) as name FROM users WHERE LOWER(COALESCE(display_name, name)) = LOWER(?)"
    ).get(mentionedName);
    if (matched) { aboutUserId = matched.id; aboutName = matched.name; }
    else aboutName = mentionedName;
  }

  if (!aboutName) {
    const possessive = detail.match(/^this\s+is\s+(\w+)'s\s+/i);
    if (possessive) {
      aboutName = possessive[1];
      const matched = db.prepare(
        "SELECT id, COALESCE(display_name, name) as name FROM users WHERE LOWER(COALESCE(display_name, name)) = LOWER(?)"
      ).get(aboutName);
      if (matched) aboutUserId = matched.id;
    }
  }

  if (!aboutUserId && !aboutName) {
    aboutUserId = triggeringUserId;
    const u = db.prepare("SELECT COALESCE(display_name, name) as name FROM users WHERE id = ?").get(triggeringUserId);
    aboutName = u?.name || null;
  }

  const result = db.prepare(`
    INSERT INTO sol_memories (about_user_id, about_name, detail, raw_text, context_post_id, created_by_user_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(aboutUserId, aboutName, detail, text, postId || null, triggeringUserId);

  console.log(`[Sol Memory] Saved memory #${result.lastInsertRowid}: "${detail}" (about: ${aboutName || aboutUserId})`);
  return { id: result.lastInsertRowid, about_user_id: aboutUserId, about_name: aboutName, detail };
}

/**
 * Load memories relevant to a post thread.
 */
export function getRelevantMemories(postId, userIdsInThread = []) {
  const conditions = [];
  const params = [];

  if (postId) {
    conditions.push("m.context_post_id = ?");
    params.push(postId);
  }
  if (userIdsInThread.length > 0) {
    const placeholders = userIdsInThread.map(() => "?").join(", ");
    conditions.push(`m.about_user_id IN (${placeholders})`);
    params.push(...userIdsInThread);
    conditions.push(`m.created_by_user_id IN (${placeholders})`);
    params.push(...userIdsInThread);
  }

  if (conditions.length === 0) return [];

  const where = conditions.map((c) => `(${c})`).join(" OR ");
  const rows = db.prepare(`
    SELECT m.id, m.detail, m.about_name, m.about_user_id, m.created_at,
           COALESCE(u.display_name, u.name) as created_by_name
    FROM sol_memories m
    LEFT JOIN users u ON u.id = m.created_by_user_id
    WHERE ${where}
    ORDER BY m.created_at DESC
    LIMIT 40
  `).all(...params);

  return rows;
}

/**
 * Load ALL memories (for Sol's global context).
 */
export function getAllMemories() {
  return db.prepare(`
    SELECT m.id, m.detail, m.about_name, m.about_user_id, m.created_at,
           COALESCE(u.display_name, u.name) as created_by_name
    FROM sol_memories m
    LEFT JOIN users u ON u.id = m.created_by_user_id
    ORDER BY m.created_at DESC
    LIMIT 60
  `).all();
}

export function formatMemoriesForPrompt(memories) {
  if (!memories || memories.length === 0) return "";
  const lines = memories.map((m) => {
    const who = m.about_name ? `about ${m.about_name}` : "";
    return `- ${who ? who + ": " : ""}${m.detail}`;
  });
  return `\n\nThings Sol has been asked to remember:\n${lines.join("\n")}\n`;
}
