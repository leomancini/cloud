import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
// __dirname points to the project root (parent of /server)
const __dirname = dirname(dirname(__filename));

const port = 3127;

const GITHUB_OWNER = "leomancini";
const GITHUB_REPO = "cloud";

const LISTS_API_URL = "https://page-builder-server.fcc.lol";

// Sol output modes
//
// Auto-post mode — exactly ONE mode is active at a time. To switch modes,
// change this single value. Valid modes are defined in SOL_POST_MODES below.
//   "normal"     — casual, natural text posts
//   "emoji"      — emoji-only posts
//   "haiku-poem" — posts are always a 5-7-5 haiku about the current context
const SOL_POST_MODE = "haiku-poem";

const SOL_POST_MODES = ["normal", "emoji", "haiku-poem"];

const SOL_EMOJI_ONLY_COMMENTS = false; // Emoji-only for comment replies (independent of post mode)

const SOL_AUTO_POST_ENABLED = false; // Set to true to enable Sol auto-posting

export { __dirname, port, GITHUB_OWNER, GITHUB_REPO, LISTS_API_URL, SOL_POST_MODE, SOL_POST_MODES, SOL_EMOJI_ONLY_COMMENTS, SOL_AUTO_POST_ENABLED };
