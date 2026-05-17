export function parseText(text, users = [], currentUser = null) {
  if (!text) return [];
  let base = users.some((u) => u.name === "Sol") ? [...users] : [...users, { id: "sol-ai", name: "Sol" }];
  if (currentUser && !base.some((u) => u.id === currentUser.id)) {
    base.push({ id: currentUser.id, name: currentUser.name, google_name: currentUser.google_name });
  }
  const allUsers = [];
  for (const u of base) {
    allUsers.push(u);
    if (u.google_name && u.google_name !== u.name) allUsers.push({ ...u, name: u.google_name });
  }
  const sorted = [...allUsers].sort((a, b) => b.name.length - a.name.length);
  const mentions = [];
  const atRegex = /@/g;
  let m;
  while ((m = atRegex.exec(text)) !== null) {
    const after = text.slice(m.index + 1);
    for (const u of sorted) {
      if (after.toLowerCase().startsWith(u.name.toLowerCase())) {
        const ch = after[u.name.length];
        if (!ch || /[^a-zA-Z0-9]/.test(ch)) {
          mentions.push({ start: m.index, end: m.index + 1 + u.name.length, name: u.name, rawText: text.slice(m.index, m.index + 1 + u.name.length), userId: u.id });
          break;
        }
      }
    }
  }
  const parts = [];
  let last = 0;
  for (const mn of mentions) {
    if (mn.start < last) continue;
    if (mn.start > last) parts.push({ type: "text", content: text.slice(last, mn.start) });
    parts.push({ type: "mention", content: mn.name, rawText: mn.rawText, userId: mn.userId });
    last = mn.end;
  }
  if (last < text.length) parts.push({ type: "text", content: text.slice(last) });
  return parts.length > 0 ? parts : [{ type: "text", content: text }];
}

export function shortAddress(address) {
  if (!address) return null;
  const parts = address.split(",").map((s) => s.trim());
  if (parts.length >= 3) {
    const state = parts[parts.length - 2].replace(/\s*\d{5}.*/, "");
    const city = parts[parts.length - 3];
    return `${city}, ${state}`;
  }
  return parts.slice(-2).join(", ");
}

export function timeAgo(dateStr) {
  const date = new Date(dateStr + "Z");
  const seconds = Math.floor((Date.now() - date) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 8) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const datePart = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const timePart = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${datePart} at ${timePart}`;
}

export function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}
