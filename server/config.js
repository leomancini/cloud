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
const SOL_EMOJI_ONLY = false; // Set to true to force all Sol outputs to be entirely emoji

export { __dirname, port, GITHUB_OWNER, GITHUB_REPO, LISTS_API_URL, SOL_EMOJI_ONLY };
