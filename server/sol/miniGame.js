import Anthropic from "@anthropic-ai/sdk";
import db from "../db.js";
import { notifyUser } from "../websocket.js";
import { SOL_USER_ID } from "../solUser.js";

const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;

export async function handleSolMiniGame(gameDescription, originalPostId, existingGameHtml = null) {
  try {
    console.log("[Sol] Generating mini game with Opus...", existingGameHtml ? "(updating existing)" : "(new)");

    const baseRequirements = `The game runs inside a sandboxed iframe (sandbox="allow-scripts allow-same-origin") embedded in a social feed post card. It does NOT have access to the parent page. Do not use localStorage or sessionStorage — keep all state in JS variables.

Requirements:
- Single HTML file with ALL CSS and JS inline (no external dependencies, no CDNs)
- The game fills a square container — use 100vw \u00d7 100vh and assume the viewport is square
- Must work on BOTH mobile (touch) and desktop (mouse/keyboard):
  - Touch: tap, swipe, drag. Buttons and tap targets minimum 44px
  - Mouse: click, mousemove where applicable
  - Keyboard: arrow keys / WASD / spacebar as appropriate for the game type
  - Always bind BOTH touch and mouse events (touchstart+mousedown, touchmove+mousemove, touchend+mouseup)
  - No hover-dependent mechanics
- Always start with a start screen showing the game title and a tap/click to start prompt. The start screen should match the game's visual style
- Simple, fun, and immediately playable after the start screen
- Include score tracking visible in the game
- Leaderboard API (optional \u2014 use if the game tracks score):
  - On game over, send the score: window.parent.postMessage({ type: 'game-score', score: NUMBER }, '*')
  - The parent will respond with: { type: 'game-leaderboard', leaderboard: [{ rank, name, score, picture, user_id }], userId: NUMBER }
  - Listen for this message and display the leaderboard in your game over screen (show rank, name, score)
  - You can also request the leaderboard at any time: window.parent.postMessage({ type: 'request-leaderboard' }, '*')
  - Design the leaderboard UI to match the game's visual style
- Default to a pixel art visual style (blocky sprites, limited color palette, retro feel) unless the user's description specifies a different style
- Use canvas for rendering. Size the canvas to fill the viewport and handle resize events
- Keep it lightweight and performant
- Test all variable references \u2014 do not use undefined variables
- Add a <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"> tag
- Prevent default on touch events used for game controls to avoid scrolling/zooming the iframe
- Use requestAnimationFrame for the game loop`;

    const prompt = existingGameHtml
      ? `Here is an existing mini game that needs to be updated. Apply the requested changes while keeping everything else intact.

${baseRequirements}

Existing game HTML:
${existingGameHtml}

Requested changes: ${gameDescription}

Return ONLY the complete updated HTML code. No markdown fences, no explanation, no commentary \u2014 just the HTML starting with <!DOCTYPE html> or <html>.`
      : `Create a mini game as a single self-contained HTML file.

${baseRequirements}

Game to create: ${gameDescription}

Return ONLY the raw HTML code. No markdown fences, no explanation, no commentary \u2014 just the HTML starting with <!DOCTYPE html> or <html>.`;

    let response;
    for (let retry = 0; retry < 3; retry++) {
      try {
        response = await anthropic.messages.create({
          model: "claude-opus-4-7",
          max_tokens: 16384,
          messages: [{ role: "user", content: prompt }],
        });
        break;
      } catch (e) {
        if (e.status === 429 && retry < 2) {
          const wait = (retry + 1) * 60;
          console.log(`[Sol] Rate limited, waiting ${wait}s...`);
          await new Promise(r => setTimeout(r, wait * 1000));
        } else throw e;
      }
    }

    let gameHtml = response.content.find(b => b.type === "text")?.text?.trim();
    if (!gameHtml) return null;

    if (gameHtml.startsWith("```")) {
      gameHtml = gameHtml.replace(/^```(?:html)?\n?/, "").replace(/\n?```$/, "");
    }

    const doneMessages = [
      "here you go, have fun!",
      "game's ready, give it a try!",
      "there you go, enjoy!",
      "done! let me know what you think",
      "all yours, have at it!",
      "just made this one, enjoy!",
      "ready to play, good luck!",
    ];
    const doneMsg = doneMessages[Math.floor(Math.random() * doneMessages.length)];
    const result = db.prepare(
      "INSERT INTO comments (post_id, user_id, content, mini_game) VALUES (?, ?, ?, ?)"
    ).run(originalPostId, SOL_USER_ID, doneMsg, gameHtml);

    console.log("[Sol] Mini game comment created:", result.lastInsertRowid);

    const post = db.prepare("SELECT user_id FROM posts WHERE id = ?").get(originalPostId);
    if (post) {
      notifyUser(post.user_id, "feed-update");
      const postFollowers = db.prepare("SELECT follower_id FROM follows WHERE following_id = ? AND status = 'approved'").all(post.user_id);
      for (const f of postFollowers) notifyUser(f.follower_id, "feed-update");
    }

    return result.lastInsertRowid;
  } catch (e) {
    console.warn("[Sol] Mini game generation error:", e);
    return null;
  }
}
