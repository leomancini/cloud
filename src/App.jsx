import React, { useState, useEffect, useRef } from "react";
import styled from "styled-components";

const RADIUS = "10px";
const RADIUS_SM = "6px";
const BORDER = "#eee";
const TEXT = "#333";
const TEXT_SECONDARY = "#999";
const ICON_GAP = "8px";
const Spinner = () => <i className="fa-solid fa-spinner fa-spin" />;

const parseText = (text, users = []) => {
  if (!text) return [];
  const allUsers = users.some((u) => u.name === "Sol") ? users : [...users, { id: "sol-ai", name: "Sol" }];
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
          mentions.push({ start: m.index, end: m.index + 1 + u.name.length, name: u.name, userId: u.id });
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
    parts.push({ type: "mention", content: mn.name, userId: mn.userId });
    last = mn.end;
  }
  if (last < text.length) parts.push({ type: "text", content: text.slice(last) });
  return parts.length > 0 ? parts : [{ type: "text", content: text }];
};

const MentionSpan = styled.span`
  font-weight: bold;
`;

const MentionHighlight = styled.span`
  background: #e8e8e8;
  border-radius: 3px;
`;

const MentionDropdown = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid ${BORDER};
  border-radius: ${RADIUS_SM};
  max-height: 150px;
  overflow-y: auto;
  z-index: 10;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
`;

const MentionOption = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 14px;
  &:hover { background: #f5f5f5; }
`;

const MentionAvatar = styled.img`
  width: 24px;
  height: 24px;
  border-radius: 50%;
`;

const Page = styled.div`
  min-height: 100vh;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  background: white;
  padding: 40px 20px;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 500px;
  margin: 0 auto 32px;
`;

const HeaderProfile = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
`;

const SmallAvatar = styled.img`
  width: 36px;
  height: 36px;
  border-radius: 50%;
`;

const HeaderName = styled.span`
  font-size: 15px;
  font-weight: 600;
  color: #333;
`;

const LoginCard = styled.div`
  text-align: center;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
`;

const Title = styled.h1`
  font-size: 22px;
  color: #333;
  margin: 0 0 6px;
`;

const Subtitle = styled.p`
  font-size: 15px;
  color: #999;
  margin: 0 0 24px;
`;

const SignInButton = styled.a`
  display: inline-block;
  padding: 12px 24px;
  border-radius: ${RADIUS};
  font-size: 15px;
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
  background: black;
  color: white;

  &:hover {
    background: #222;
  }
`;

const SegmentedControl = styled.div`
  display: flex;
  background: #f0f0f0;
  border-radius: ${RADIUS};
  padding: 3px;
`;

const Segment = styled.button`
  padding: 6px 16px;
  border-radius: ${RADIUS_SM};
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  background: ${(p) => (p.$active ? "white" : "transparent")};
  color: ${(p) => (p.$active ? "#333" : "#888")};
  box-shadow: ${(p) => (p.$active ? "0 1px 3px rgba(0,0,0,0.1)" : "none")};
  transition: all 0.15s ease;
`;

const BackButton = styled.button`
  padding: 8px 0;
  font-size: 15px;
  cursor: pointer;
  border: none;
  background: none;
  color: #333;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const LogoutButton = styled.button`
  padding: 8px 16px;
  border-radius: ${RADIUS};
  font-size: 13px;
  cursor: pointer;
  border: 1px solid #ddd;
  background: white;
  color: #666;

  &:hover {
    background: #f5f5f5;
  }
`;

const Content = styled.div`
  max-width: 500px;
  margin: 0 auto;
`;

const ComposeBox = styled.div`
  margin-bottom: 24px;
  padding-bottom: 24px;
`;

const ComposeWrapper = styled.div`
  position: relative;
  width: 100%;
`;

const ComposeInput = styled.textarea`
  width: 100%;
  border: 1px solid ${BORDER};
  border-radius: ${RADIUS};
  padding: 14px;
  font-size: 16px;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  resize: none;
  outline: none;
  box-sizing: border-box;
  color: transparent;
  caret-color: ${TEXT};
  position: relative;
  z-index: 1;
  background: transparent;

  &:focus {
    border-color: #ccc;
  }
`;

const ComposeHighlight = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 14px;
  font-size: 16px;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  line-height: normal;
  white-space: pre-wrap;
  word-wrap: break-word;
  color: ${TEXT};
  pointer-events: none;
  border: 1px solid transparent;
  border-radius: ${RADIUS};
  box-sizing: border-box;
`;

const ComposeActions = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
`;

const IconButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: ${RADIUS};
  font-size: 14px;
  cursor: pointer;
  border: none;
  background: ${(p) => (p.$active ? "#f0f0f0" : "transparent")};
  color: ${(p) => (p.$active ? "#333" : "#999")};

  &:hover {
    background: #f0f0f0;
  }
`;

const LocationSearch = styled.div`
  position: relative;
  margin-top: 8px;
`;

const LocationInput = styled.input`
  width: 100%;
  border: 1px solid ${BORDER};
  border-radius: ${RADIUS};
  padding: 10px 12px;
  font-size: 16px;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  outline: none;
  box-sizing: border-box;

  &:focus {
    border-color: #ccc;
  }
`;

const LocationResults = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid ${BORDER};
  border-radius: ${RADIUS};
  margin-top: 4px;
  z-index: 10;
  overflow: hidden;
`;

const LocationResult = styled.div`
  padding: 10px 12px;
  cursor: pointer;

  &:hover {
    background: #f9f9f9;
  }
`;

const LocationName = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: #333;
`;

const LocationAddress = styled.div`
  font-size: 12px;
  color: #999;
  margin-top: 2px;
`;

const SelectedLocation = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  gap: ${ICON_GAP};
  margin-top: 8px;
  padding: 8px 36px 8px 12px;
  background: #f5f5f5;
  border-radius: ${RADIUS};
  font-size: 13px;
  color: #333;

  span {
    display: flex;
    align-items: center;
    gap: ${ICON_GAP};
  }
`;

const RemoveLocation = styled.button`
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background: none;
  color: #999;
  cursor: pointer;
  font-size: 14px;
  padding: 0;
  display: flex;
  align-items: center;
`;

const ComposeActionsLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;


const HiddenFileInput = styled.input`
  display: none;
`;

const MediaPreviews = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 8px;
  flex-wrap: wrap;
`;

const MediaPreview = styled.div`
  position: relative;
  border-radius: ${RADIUS};
  overflow: hidden;
  max-height: 200px;
`;

const PreviewImage = styled.img`
  height: 100px;
  border-radius: ${RADIUS};
  display: block;
`;

const PreviewVideo = styled.video`
  height: 100px;
  border-radius: ${RADIUS};
  display: block;
`;

const RemoveMedia = styled.button`
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
`;

const PostMediaContainer = styled.div`
  margin-top: 10px;
  display: grid;
  grid-template-columns: ${(p) => (p.$count === 1 ? "1fr" : "1fr 1fr")};
  gap: 4px;
`;

const PostImage = styled.img`
  width: 100%;
  display: block;
  border-radius: ${RADIUS};
  object-fit: cover;
  background: #f0f0f0;
  min-height: ${(p) => (p.$single ? "200px" : "auto")};
`;

const PostVideo = styled.video`
  width: 100%;
  display: block;
  border-radius: ${RADIUS};
  object-fit: cover;
  background: #f0f0f0;
  min-height: ${(p) => (p.$single ? "200px" : "auto")};
`;

const PostButton = styled.button`
  padding: 8px 20px;
  border-radius: ${RADIUS};
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  background: #0066ff;
  color: white;

  &:hover {
    background: #0052cc;
  }

  &:disabled {
    background: #ccc;
    cursor: default;
  }
`;

const PostItem = styled.div`
  padding: 16px 0;
`;

const PostHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
`;

const PostHeaderText = styled.div`
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex: 1;
  min-width: 0;
`;

const Avatar = styled.img`
  width: 36px;
  height: 36px;
  border-radius: 50%;
`;

const PostAuthor = styled.span`
  font-size: 15px;
  font-weight: 600;
  color: #333;
`;

const PostTime = styled.span`
  font-size: 12px;
  color: #999;
`;

const PostHeaderRight = styled.div`
  margin-left: auto;
`;

const PostMenuWrapper = styled.div`
  position: relative;
`;

const PostMenuButton = styled.button`
  border: none;
  background: none;
  color: #ccc;
  cursor: pointer;
  font-size: 14px;
  padding: 4px;
  display: flex;
  align-items: center;

  &:hover {
    color: #999;
  }
`;

const PostMenu = styled.div`
  position: absolute;
  right: 0;
  top: 100%;
  background: white;
  border: 1px solid ${BORDER};
  border-radius: ${RADIUS};
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  z-index: 10;
  overflow: hidden;
  min-width: 120px;
`;

const PostMenuItem = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 14px;
  border: none;
  background: none;
  font-size: 14px;
  cursor: pointer;
  color: ${(p) => (p.$danger ? "#e53e3e" : "#333")};

  &:hover {
    background: #f5f5f5;
  }
`;

const PostContent = styled.p`
  font-size: 15px;
  color: #333;
  margin: 0;
  line-height: 1.4;
  white-space: pre-wrap;
`;

const REACTION_EMOJIS = ["\u2764\uFE0F", "\uD83D\uDE02", "\uD83D\uDE2E", "\uD83D\uDD25", "\uD83D\uDC4F", "\uD83D\uDE22"];

const ReactionsRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 14px;
  flex-wrap: wrap;
`;

const ReactionChip = styled.button`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0;
  border: none;
  background: none;
  font-size: 20px;
  cursor: pointer;
`;

const ReactionNames = styled.span`
  font-size: 15px;
  color: ${TEXT};
  font-weight: 600;
`;

const EmojiOption = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: none;
  background: none;
  font-size: 20px;
  line-height: 34px;
  padding: 2px 0 0;
  cursor: pointer;
  border-radius: ${RADIUS_SM};
  opacity: ${(p) => (p.$dimmed ? 0.35 : 1)};
  &:hover {
    background: none;
  }
`;

const CommentsSection = styled.div`
  margin-top: 14px;
`;

const CommentRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 10px;
`;

const CommentAvatar = styled.img`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  flex-shrink: 0;
`;

const CommentBody = styled.div`
  flex: 1;
  min-width: 0;
  padding-top: 2px;
`;

const CommentAuthor = styled.span`
  font-size: 15px;
  font-weight: 600;
  color: ${TEXT};
  margin-right: 6px;
`;

const CommentText = styled.span`
  font-size: 15px;
  color: ${TEXT};
  line-height: 1.4;
`;

const CommentTime = styled.span`
  font-size: 12px;
  color: ${TEXT_SECONDARY};
  margin-left: 8px;
  vertical-align: baseline;
`;

const CommentInputRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
`;

const CommentInputWrapper = styled.div`
  position: relative;
  flex: 1;
  min-width: 0;
`;

const CommentInput = styled.input`
  width: 100%;
  border: 1px solid ${BORDER};
  border-radius: ${RADIUS};
  padding: 8px 12px;
  font-size: 16px;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  outline: none;
  min-width: 0;
  color: transparent;
  caret-color: ${TEXT};
  position: relative;
  z-index: 1;
  background: transparent;
  box-sizing: border-box;

  &:focus {
    border-color: #ccc;
  }
`;

const CommentHighlight = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 8px 12px;
  font-size: 16px;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  line-height: normal;
  white-space: nowrap;
  overflow: hidden;
  color: ${TEXT};
  pointer-events: none;
  border: 1px solid transparent;
  border-radius: ${RADIUS};
  box-sizing: border-box;
`;

const CommentPostButton = styled.button`
  border: none;
  background: none;
  color: ${TEXT_SECONDARY};
  font-size: 14px;
  cursor: pointer;
  padding: 8px;
  display: flex;
  align-items: center;

  &:hover {
    color: ${TEXT};
  }
`;

const CommentCount = styled.button`
  border: none;
  background: none;
  color: ${TEXT_SECONDARY};
  font-size: 13px;
  cursor: pointer;
  padding: 0;
  margin-top: 8px;

  &:hover {
    color: ${TEXT};
  }
`;

const PostLocation = styled.div`
  margin-top: 10px;
`;

const PostMapWrapper = styled.div`
  position: relative;
  border-radius: ${RADIUS} ${RADIUS} 0 0;
  overflow: hidden;

  &::after {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: ${RADIUS} ${RADIUS} 0 0;
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.1);
    pointer-events: none;
  }
`;

const PostMap = styled.img`
  width: 100%;
  height: 150px;
  object-fit: cover;
  display: block;
`;

const PostPlaceName = styled.div`
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 500;
  color: ${TEXT};
  border: 1px solid ${BORDER};
  border-top: none;
  border-radius: 0 0 ${RADIUS} ${RADIUS};
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const PostPlaceAddress = styled.span`
  font-weight: 400;
  color: ${TEXT_SECONDARY};
`;

const UserList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const UserRow = styled.div`
  padding: 12px 0;
  display: flex;
  align-items: center;
  justify-content: space-between;

  &:last-child {
    padding-bottom: 0;
  }
`;

const UserInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const UserAvatar = styled.img`
  width: 36px;
  height: 36px;
  border-radius: 50%;
`;

const UserName = styled.span`
  font-size: 15px;
  font-weight: 500;
  color: #333;
`;

const UserStatus = styled.div`
  font-size: 12px;
  color: ${TEXT_SECONDARY};
  margin-top: 1px;
`;

const FollowButton = styled.button`
  padding: 8px 18px;
  border-radius: ${RADIUS};
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid ${(p) => (p.$status === "pending" ? "#ddd" : p.$following ? "#ddd" : "black")};
  background: ${(p) => (p.$status === "pending" ? "white" : p.$following ? "white" : "black")};
  color: ${(p) => (p.$status === "pending" ? "#999" : p.$following ? "#666" : "white")};

  &:hover {
    background: ${(p) => (p.$status === "pending" ? "#f5f5f5" : p.$following ? "#f5f5f5" : "#222")};
  }
`;

const FollowBtn = ({ user, onFollow, busy }) => {
  const status = user.follow_status;
  const following = user.is_following;
  const followsYou = user.follows_you;
  const label = status === "pending" ? "Requested" : following ? "Following" : followsYou ? "Follow back" : "Follow";
  return (
    <FollowButton
      $following={!!following}
      $status={status}
      disabled={busy}
      onClick={() => onFollow(user.id, status || (following ? "approved" : null))}
    >
      {busy ? <Spinner /> : label}
    </FollowButton>
  );
};

const RequestActions = styled.div`
  display: flex;
  gap: 8px;
`;

const ApproveButton = styled.button`
  padding: 8px 18px;
  border-radius: ${RADIUS};
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  background: black;
  color: white;

  &:hover {
    background: #222;
  }
`;

const RejectButton = styled.button`
  padding: 8px 18px;
  border-radius: ${RADIUS};
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid #ddd;
  background: white;
  color: #666;

  &:hover {
    background: #f5f5f5;
  }
`;

const EmptyState = styled.p`
  text-align: center;
  color: #999;
  font-size: 15px;
  margin-top: 40px;
`;

const SuggestionsBox = styled.div`
  background: #fafafa;
  border-radius: ${RADIUS};
  padding: 16px;
  margin-bottom: 24px;
`;

const SectionTitle = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: ${TEXT};
  margin-bottom: 12px;
`;

const ProfilePage = styled.div`
  text-align: center;
  padding-top: 40px;
`;

const ProfileAvatar = styled.img`
  width: 80px;
  height: 80px;
  border-radius: 50%;
  margin-bottom: 16px;
`;

const ProfileName = styled.h2`
  font-size: 22px;
  color: #333;
  margin: 0 0 4px;
`;

const ProfileEmail = styled.p`
  font-size: 14px;
  color: #999;
  margin: 0 0 32px;
`;

function shortAddress(address) {
  if (!address) return null;
  const parts = address.split(",").map((s) => s.trim());
  if (parts.length >= 3) {
    const state = parts[parts.length - 2].replace(/\s*\d{5}.*/, "");
    const city = parts[parts.length - 3];
    return `${city}, ${state}`;
  }
  return parts.slice(-2).join(", ");
}

function timeAgo(dateStr) {
  const date = new Date(dateStr + "Z");
  const seconds = Math.floor((Date.now() - date) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 8) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return date.toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function App() {
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [followRequests, setFollowRequests] = useState([]);
  const [tab, setTab] = useState("feed");
  const [compose, setCompose] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [busyActions, setBusyActions] = useState(new Set());

  // Location state
  const [showLocationSearch, setShowLocationSearch] = useState(false);
  const [locationQuery, setLocationQuery] = useState("");
  const [locationResults, setLocationResults] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const searchTimeout = useRef(null);

  // Media state
  const [mediaFiles, setMediaFiles] = useState([]);
  const [mediaPreviews, setMediaPreviews] = useState([]);
  const fileInputRef = useRef(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [commentInputs, setCommentInputs] = useState({});
  const [expandedComments, setExpandedComments] = useState({});
  const [mentionQuery, setMentionQuery] = useState(null); // { field: "compose" | postId, query: string }
  const composeRef = useRef(null);
  const commentRefs = useRef({});

  const renderTextPart = (str, keyPrefix) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const pieces = str.split(urlRegex);
    return pieces.map((piece, j) =>
      urlRegex.test(piece) ? <a key={`${keyPrefix}-${j}`} href={piece} target="_blank" rel="noopener noreferrer" style={{ color: "#2563EB" }}>{piece}</a> : <span key={`${keyPrefix}-${j}`}>{piece}</span>
    );
  };

  const renderText = (text) => {
    const parts = parseText(text, users);
    return parts.map((p, i) =>
      p.type === "mention" ? <MentionSpan key={i}>@{p.content}</MentionSpan> : <span key={i}>{renderTextPart(p.content, i)}</span>
    );
  };

  const renderHighlight = (text) => {
    const parts = parseText(text, users);
    return parts.map((p, i) =>
      p.type === "mention" ? <MentionHighlight key={i}>@{p.content}</MentionHighlight> : <span key={i}>{p.content}</span>
    );
  };

  const mentionUsers = users.some((u) => u.name === "Sol")
    ? users
    : [...users, { id: "sol-ai", name: "Sol", picture: "/api/pictures/sol.jpg" }];

  const handleMentionInput = (value, field) => {
    const ref = field === "compose" ? composeRef.current : commentRefs.current[field];
    if (!ref) return setMentionQuery(null);
    const pos = ref.selectionStart;
    const before = value.slice(0, pos);
    const atIdx = before.lastIndexOf("@");
    if (atIdx === -1 || (atIdx > 0 && /\S/.test(before[atIdx - 1]))) return setMentionQuery(null);
    const query = before.slice(atIdx + 1);
    if (/\s/.test(query) && query.length > 0) return setMentionQuery(null);
    setMentionQuery({ field, query: query.toLowerCase() });
  };

  const insertMention = (userName, field) => {
    const ref = field === "compose" ? composeRef.current : commentRefs.current[field];
    const val = ref.value;
    const pos = ref.selectionStart;
    const before = val.slice(0, pos);
    const atIdx = before.lastIndexOf("@");
    const after = val.slice(pos);
    const insertion = "@" + userName + "\u00A0";
    const newVal = before.slice(0, atIdx) + insertion + after;
    const newPos = atIdx + insertion.length;

    // Use native setter to trigger React's onChange
    const nativeSetter = Object.getOwnPropertyDescriptor(
      field === "compose" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
      "value"
    ).set;
    nativeSetter.call(ref, newVal);
    ref.dispatchEvent(new Event("input", { bubbles: true }));

    setMentionQuery(null);
    requestAnimationFrame(() => {
      ref.focus();
      ref.setSelectionRange(newPos, newPos);
    });
  };
  const [openCommentMenuId, setOpenCommentMenuId] = useState(null);
  const [editingComment, setEditingComment] = useState(null);
  const [editCommentText, setEditCommentText] = useState("");

  const startBusy = (key) => setBusyActions((prev) => new Set(prev).add(key));
  const endBusy = (key) => setBusyActions((prev) => { const next = new Set(prev); next.delete(key); return next; });
  const isBusy = (key) => busyActions.has(key);

  useEffect(() => {
    const handleClickOutside = () => { setOpenMenuId(null); setOpenCommentMenuId(null); };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        setUser(data.user);
        setLoading(false);
        if (data.user) {
          loadFeed();
          loadUsers();
          loadFollowers();
          loadFollowRequests();
        }
      });
  }, []);

  useEffect(() => {
    if (!user) return;
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${window.location.host}/ws?userId=${user.id}`);
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "follow-request") loadFollowRequests();
      if (msg.type === "follow-approved" || msg.type === "follow-rejected") { loadUsers(); loadFollowers(); }
      if (msg.type === "feed-update") loadFeed();
    };
    return () => ws.close();
  }, [user]);

  const loadFeed = () => {
    fetch("/api/feed")
      .then((res) => res.json())
      .then((data) => setPosts(data.posts));
  };

  const loadFollowRequests = () => {
    fetch("/api/follow-requests")
      .then((res) => res.json())
      .then((data) => setFollowRequests(data.requests));
  };

  const loadFollowers = () => {
    fetch("/api/followers")
      .then((res) => res.json())
      .then((data) => setFollowers(data.followers));
  };

  const loadUsers = () => {
    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => setUsers(data.users));
  };

  const searchPlaces = (query) => {
    setLocationQuery(query);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!query.trim()) {
      setLocationResults([]);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      const params = new URLSearchParams({ query });
      if (userLocation) {
        params.set("lat", userLocation.lat);
        params.set("lng", userLocation.lng);
      }
      const res = await fetch(`/api/places/search?${params}`);
      const data = await res.json();
      setLocationResults(data.places || []);
    }, 300);
  };

  const selectLocation = (place) => {
    setSelectedLocation(place);
    setLocationQuery("");
    setLocationResults([]);
    setShowLocationSearch(false);
  };

  const compressImage = (file, maxWidth = 1600, quality = 0.8) =>
    new Promise((resolve) => {
      if (!file.type.startsWith("image/")) return resolve(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => resolve(new File([blob], file.name, { type: "image/jpeg" })), "image/jpeg", quality);
        URL.revokeObjectURL(img.src);
      };
      img.src = URL.createObjectURL(file);
    });

  const handleMediaSelect = async (e) => {
    const files = Array.from(e.target.files);
    const processed = await Promise.all(files.map((f) => compressImage(f)));
    setMediaFiles((prev) => [...prev, ...processed]);
    const newPreviews = processed.map((file) => ({
      url: URL.createObjectURL(file),
      type: file.type.startsWith("video/") ? "video" : "image",
    }));
    setMediaPreviews((prev) => [...prev, ...newPreviews]);
    e.target.value = "";
  };

  const removeMedia = (index) => {
    URL.revokeObjectURL(mediaPreviews[index].url);
    setMediaFiles((prev) => prev.filter((_, i) => i !== index));
    setMediaPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePost = async () => {
    if (posting) return;
    if (!compose.trim() && mediaFiles.length === 0) return;
    setPosting(true);
    const formData = new FormData();
    formData.append("content", compose);
    if (selectedLocation) {
      formData.append("place_name", selectedLocation.name);
      formData.append("place_lat", selectedLocation.lat);
      formData.append("place_lng", selectedLocation.lng);
      if (selectedLocation.address) formData.append("place_address", selectedLocation.address);
    }
    for (const file of mediaFiles) {
      formData.append("media", file);
    }
    await fetch("/api/posts", {
      method: "POST",
      body: formData,
    });
    setCompose("");
    setMentionQuery(null);
    setSelectedLocation(null);
    mediaPreviews.forEach((p) => URL.revokeObjectURL(p.url));
    setMediaFiles([]);
    setMediaPreviews([]);
    setPosting(false);
    loadFeed();
  };

  const handleDelete = async (id) => {
    setOpenMenuId(null);
    startBusy(`delete-${id}`);
    await fetch(`/api/posts/${id}`, { method: "DELETE" });
    setPosts((prev) => prev.filter((p) => p.id !== id));
    endBusy(`delete-${id}`);
  };

  const handleReact = async (postId, emoji) => {
    const res = await fetch(`/api/posts/${postId}/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
    const { action, previous } = await res.json();
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        let reactions = [...(p.reactions || [])];

        // Remove user from previous emoji if changing
        if (action === "changed" && previous) {
          const prevIdx = reactions.findIndex((r) => r.emoji === previous);
          if (prevIdx >= 0) {
            const names = reactions[prevIdx].names.filter((n) => n !== user.name);
            if (names.length === 0) reactions.splice(prevIdx, 1);
            else reactions[prevIdx] = { ...reactions[prevIdx], names, user_reacted: 0 };
          }
        }

        if (action === "added" || action === "changed") {
          const idx = reactions.findIndex((r) => r.emoji === emoji);
          if (idx >= 0) {
            reactions[idx] = { ...reactions[idx], names: [...reactions[idx].names, user.name], user_reacted: 1 };
          } else {
            reactions.push({ emoji, names: [user.name], user_reacted: 1 });
          }
        } else if (action === "removed") {
          const idx = reactions.findIndex((r) => r.emoji === emoji);
          if (idx >= 0) {
            const names = reactions[idx].names.filter((n) => n !== user.name);
            if (names.length === 0) reactions.splice(idx, 1);
            else reactions[idx] = { ...reactions[idx], names, user_reacted: 0 };
          }
        }

        return { ...p, reactions };
      })
    );
  };

  const handleComment = async (postId) => {
    const content = (commentInputs[postId] || "").trim();
    if (!content) return;
    startBusy(`comment-${postId}`);
    const res = await fetch(`/api/posts/${postId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    const comment = await res.json();
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, comments: [...(p.comments || []), comment] } : p
      )
    );
    setCommentInputs((prev) => ({ ...prev, [postId]: "" }));
    setMentionQuery(null);
    endBusy(`comment-${postId}`);
  };

  const handleDeleteComment = async (commentId, postId) => {
    setOpenCommentMenuId(null);
    await fetch(`/api/comments/${commentId}`, { method: "DELETE" });
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, comments: p.comments.filter((c) => c.id !== commentId) } : p
      )
    );
  };

  const handleEditComment = async (commentId, postId) => {
    const content = editCommentText.trim();
    if (!content) return;
    startBusy(`edit-comment-${commentId}`);
    await fetch(`/api/comments/${commentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, comments: p.comments.map((c) => (c.id === commentId ? { ...c, content } : c)) }
          : p
      )
    );
    endBusy(`edit-comment-${commentId}`);
    setEditingComment(null);
    setEditCommentText("");
  };

  const handleFollow = async (id, followStatus) => {
    const key = `follow-${id}`;
    startBusy(key);
    if (followStatus === "approved" || followStatus === "pending") {
      await fetch(`/api/unfollow/${id}`, { method: "POST" });
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, is_following: 0, follow_status: null } : u))
      );
      setFollowers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, is_following: 0, follow_status: null } : u))
      );
    } else {
      await fetch(`/api/follow/${id}`, { method: "POST" });
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, is_following: 0, follow_status: "pending" } : u))
      );
    }
    endBusy(key);
    loadFeed();
    loadUsers();
    loadFollowRequests();
  };

  const handleApproveFollow = async (id) => {
    startBusy(`approve-${id}`);
    await fetch(`/api/follow-requests/${id}/approve`, { method: "POST" });
    setFollowRequests((prev) => prev.map((r) => (r.id === id ? { ...r, approved: true } : r)));
    endBusy(`approve-${id}`);
    loadFollowers();
    loadUsers();
    loadFeed();
  };

  const handleRejectFollow = async (id) => {
    startBusy(`reject-${id}`);
    await fetch(`/api/follow-requests/${id}/reject`, { method: "POST" });
    setFollowRequests((prev) => prev.filter((r) => r.id !== id));
    endBusy(`reject-${id}`);
  };

  const handleLogout = async () => {
    startBusy("logout");
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setUsers([]);
    setPosts([]);
  };

  if (loading) return null;

  if (!user) {
    return (
      <Page>
        <LoginCard>
          <Title>Cloud</Title>
          <Subtitle>Share your day</Subtitle>
          <SignInButton href="/api/auth/google">Log in with Google</SignInButton>
        </LoginCard>
      </Page>
    );
  }

  return (
    <Page>
      <Header>
        {tab === "profile" ? (
          <BackButton onClick={() => setTab("feed")}><i className="fa-solid fa-arrow-left" /> Back</BackButton>
        ) : (
          <>
            <HeaderProfile onClick={() => setTab("profile")}>
              <SmallAvatar src={user.picture} alt={user.name} />
              <HeaderName>{user.name}</HeaderName>
            </HeaderProfile>
            <SegmentedControl>
              <Segment $active={tab === "feed"} onClick={() => setTab("feed")}>
                Feed
              </Segment>
              <Segment $active={tab === "people"} onClick={() => { setTab("people"); loadUsers(); loadFollowRequests(); loadFollowers(); }}>
                People
              </Segment>
            </SegmentedControl>
          </>
        )}
      </Header>
      <Content>
        {tab === "profile" ? (
          <ProfilePage>
            <ProfileAvatar src={user.picture} alt={user.name} />
            <ProfileName>{user.name}</ProfileName>
            <ProfileEmail>{user.email}</ProfileEmail>
            <LogoutButton onClick={handleLogout} disabled={isBusy("logout")}>{isBusy("logout") ? <Spinner /> : "Log out"}</LogoutButton>
          </ProfilePage>
        ) : tab === "feed" ? (
          <>
            <ComposeBox>
              <ComposeWrapper>
                <ComposeHighlight>{renderHighlight(compose)}</ComposeHighlight>
                <ComposeInput
                  ref={composeRef}
                  rows={3}
                  placeholder="What's on your mind?"
                  value={compose}
                  onChange={(e) => { setCompose(e.target.value); handleMentionInput(e.target.value, "compose"); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && e.metaKey) handlePost();
                  }}
                />
                {mentionQuery && mentionQuery.field === "compose" && (
                  <MentionDropdown>
                    {mentionUsers.filter((u) => u.name.toLowerCase().includes(mentionQuery.query)).map((u) => (
                      <MentionOption key={u.id} onMouseDown={(e) => { e.preventDefault(); insertMention(u.name, "compose"); }}>
                        <MentionAvatar src={u.picture} /> {u.name}
                      </MentionOption>
                    ))}
                  </MentionDropdown>
                )}
              </ComposeWrapper>
              {selectedLocation && (
                <SelectedLocation>
                  <span><i className="fa-solid fa-location-dot" /> <strong>{selectedLocation.name}</strong></span>
                  <RemoveLocation onClick={() => setSelectedLocation(null)}>
                    <i className="fa-solid fa-xmark" />
                  </RemoveLocation>
                </SelectedLocation>
              )}
              {showLocationSearch && !selectedLocation && (
                <LocationSearch>
                  <LocationInput
                    placeholder="Search for a place..."
                    value={locationQuery}
                    onChange={(e) => searchPlaces(e.target.value)}
                    autoFocus
                  />
                  {locationResults.length > 0 && (
                    <LocationResults>
                      {locationResults.map((place, i) => (
                        <LocationResult key={i} onClick={() => selectLocation(place)}>
                          <LocationName>{place.name}</LocationName>
                          <LocationAddress>{place.address}</LocationAddress>
                        </LocationResult>
                      ))}
                    </LocationResults>
                  )}
                </LocationSearch>
              )}
              {mediaPreviews.length > 0 && (
                <MediaPreviews>
                  {mediaPreviews.map((preview, i) => (
                    <MediaPreview key={i}>
                      {preview.type === "video" ? (
                        <PreviewVideo src={preview.url} muted />
                      ) : (
                        <PreviewImage src={preview.url} />
                      )}
                      <RemoveMedia onClick={() => removeMedia(i)}><i className="fa-solid fa-xmark" /></RemoveMedia>
                    </MediaPreview>
                  ))}
                </MediaPreviews>
              )}
              <HiddenFileInput
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleMediaSelect}
              />
              <ComposeActions>
                <ComposeActionsLeft>
                  <IconButton
                    $active={mediaFiles.length > 0}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <i className="fa-solid fa-image" />
                  </IconButton>
                  <IconButton
                    $active={showLocationSearch || selectedLocation}
                    onClick={() => {
                      if (selectedLocation) {
                        setSelectedLocation(null);
                      } else {
                        if (!showLocationSearch && !userLocation && navigator.geolocation) {
                          navigator.geolocation.getCurrentPosition(
                            (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                            () => {}
                          );
                        }
                        setShowLocationSearch(!showLocationSearch);
                      }
                      setLocationQuery("");
                      setLocationResults([]);
                    }}
                  >
                    <i className="fa-solid fa-location-dot" />
                  </IconButton>
                </ComposeActionsLeft>
                <PostButton
                  onClick={handlePost}
                  disabled={posting || (!compose.trim() && mediaFiles.length === 0)}
                >
                  {posting ? <i className="fa-solid fa-spinner fa-spin" /> : "Post"}
                </PostButton>
              </ComposeActions>
            </ComposeBox>
            {followRequests.length > 0 && (
              <SuggestionsBox>
                <SectionTitle>Follow requests</SectionTitle>
                {followRequests.map((r) => (
                  <UserRow key={r.id}>
                    <UserInfo>
                      <UserAvatar src={r.picture} alt={r.name} />
                      <UserName>{r.name}</UserName>
                    </UserInfo>
                    {r.approved ? (
                      <FollowBtn
                        user={users.find((u) => u.id === r.id) || { id: r.id, follows_you: true }}
                        onFollow={handleFollow}
                        busy={isBusy(`follow-${r.id}`)}
                      />
                    ) : (
                      <RequestActions>
                        <ApproveButton disabled={isBusy(`approve-${r.id}`)} onClick={() => handleApproveFollow(r.id)}>
                          {isBusy(`approve-${r.id}`) ? <Spinner /> : "Approve"}
                        </ApproveButton>
                        <RejectButton disabled={isBusy(`reject-${r.id}`)} onClick={() => handleRejectFollow(r.id)}>
                          {isBusy(`reject-${r.id}`) ? <Spinner /> : "Reject"}
                        </RejectButton>
                      </RequestActions>
                    )}
                  </UserRow>
                ))}
              </SuggestionsBox>
            )}
            {users.filter((u) => u.is_following).length < 5 &&
              users.filter((u) => !u.is_following).length > 0 && (
              <SuggestionsBox>
                <SectionTitle>People you might know</SectionTitle>
                {users
                  .filter((u) => !u.is_following)
                  .map((u) => (
                    <UserRow key={u.id}>
                      <UserInfo>
                        <UserAvatar src={u.picture} alt={u.name} />
                        <UserName>{u.name}</UserName>
                      </UserInfo>
                      <FollowBtn user={u} onFollow={handleFollow} busy={isBusy(`follow-${u.id}`)} />
                    </UserRow>
                  ))}
              </SuggestionsBox>
            )}
            {posts.length === 0 ? (
              <EmptyState>No posts yet. Follow people to see their posts!</EmptyState>
            ) : (
              posts.map((post) => (
                <PostItem key={post.id}>
                  <PostHeader>
                    <Avatar src={post.author_picture} alt={post.author_name} />
                    <PostHeaderText>
                      <PostAuthor>{post.author_name}</PostAuthor>
                      <PostTime>{timeAgo(post.created_at)}</PostTime>
                    </PostHeaderText>
                    {post.user_id === user.id && (
                      <PostHeaderRight>
                        <PostMenuWrapper>
                          <PostMenuButton onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === post.id ? null : post.id);
                          }}>
                            <i className="fa-solid fa-ellipsis-vertical" />
                          </PostMenuButton>
                          {openMenuId === post.id && (
                            <PostMenu onClick={(e) => e.stopPropagation()}>
                              <PostMenuItem $danger onClick={() => handleDelete(post.id)}>
                                <i className="fa-solid fa-trash" /> Delete
                              </PostMenuItem>
                            </PostMenu>
                          )}
                        </PostMenuWrapper>
                      </PostHeaderRight>
                    )}
                  </PostHeader>
                  {post.content && <PostContent>{renderText(post.content)}</PostContent>}
                  {post.media && post.media.length > 0 && (
                    <PostMediaContainer $count={post.media.length}>
                      {post.media.map((m, i) =>
                        m.type === "video" ? (
                          <PostVideo
                            key={i}
                            src={m.url}
                            autoPlay
                            loop
                            muted
                            playsInline
                            $single={post.media.length === 1}
                          />
                        ) : (
                          <PostImage key={i} src={m.url} $single={post.media.length === 1} />
                        )
                      )}
                    </PostMediaContainer>
                  )}
                  {post.place_name && post.place_lat && (
                    <PostLocation>
                      <PostMapWrapper>
                        <PostMap
                          src={`/api/staticmap?lat=${post.place_lat}&lng=${post.place_lng}&v=2`}
                          alt={post.place_name}
                        />
                      </PostMapWrapper>
                      <PostPlaceName>
                        <span>{post.place_name}</span>
                        {post.place_address && <PostPlaceAddress>{shortAddress(post.place_address)}</PostPlaceAddress>}
                      </PostPlaceName>
                    </PostLocation>
                  )}
                  {(post.reactions || []).length > 0 && (
                    <ReactionsRow>
                      {(post.reactions || []).map((r) => (
                        <ReactionChip
                          key={r.emoji}
                          $active={r.user_reacted}
                          onClick={() => handleReact(post.id, r.emoji)}
                        >
                          {r.emoji} <ReactionNames>{(r.names || []).join(", ")}</ReactionNames>
                        </ReactionChip>
                      ))}
                    </ReactionsRow>
                  )}
                  <ReactionsRow style={{ marginLeft: -6 }}>
                    {(() => {
                      const hasAnyReaction = (post.reactions || []).some((r) => r.user_reacted);
                      return REACTION_EMOJIS.map((emoji) => {
                        const userReacted = (post.reactions || []).some((r) => r.emoji === emoji && r.user_reacted);
                        return (
                          <EmojiOption key={emoji} $dimmed={hasAnyReaction && !userReacted} onClick={() => handleReact(post.id, emoji)}>
                            {emoji}
                          </EmojiOption>
                        );
                      });
                    })()}
                  </ReactionsRow>
                  <CommentsSection>
                    {post.comments && post.comments.length > 0 && (
                      <>
                        {post.comments.map((c) => (
                          <CommentRow key={c.id}>
                            <CommentAvatar src={c.author_picture} alt={c.author_name} />
                            <CommentBody>
                              <CommentAuthor>{c.author_name}</CommentAuthor>
                              {editingComment === c.id ? (
                                <CommentInputRow>
                                  <CommentInput
                                    value={editCommentText}
                                    onChange={(e) => setEditCommentText(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") handleEditComment(c.id, post.id);
                                      if (e.key === "Escape") { setEditingComment(null); setEditCommentText(""); }
                                    }}
                                    autoFocus
                                  />
                                  <CommentPostButton onClick={() => handleEditComment(c.id, post.id)} disabled={isBusy(`edit-comment-${c.id}`)}>
                                    {isBusy(`edit-comment-${c.id}`) ? <Spinner /> : <i className="fa-solid fa-check" />}
                                  </CommentPostButton>
                                </CommentInputRow>
                              ) : (
                                <>
                                  <CommentText style={c.content === "thinking..." ? { color: TEXT_SECONDARY } : undefined}>
                                    {c.content === "thinking..." ? c.content : renderText(c.content)}
                                  </CommentText>
                                  {c.content !== "thinking..." && <CommentTime>{timeAgo(c.created_at)}</CommentTime>}
                                </>
                              )}
                            </CommentBody>
                            {c.user_id === user.id && editingComment !== c.id && (
                              <PostMenuWrapper>
                                <PostMenuButton onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenCommentMenuId(openCommentMenuId === c.id ? null : c.id);
                                }}>
                                  <i className="fa-solid fa-ellipsis-vertical" />
                                </PostMenuButton>
                                {openCommentMenuId === c.id && (
                                  <PostMenu onClick={(e) => e.stopPropagation()}>
                                    <PostMenuItem onClick={() => {
                                      setOpenCommentMenuId(null);
                                      setEditingComment(c.id);
                                      setEditCommentText(c.content);
                                    }}>
                                      <i className="fa-solid fa-pen" /> Edit
                                    </PostMenuItem>
                                    <PostMenuItem $danger onClick={() => handleDeleteComment(c.id, post.id)}>
                                      <i className="fa-solid fa-trash" /> Delete
                                    </PostMenuItem>
                                  </PostMenu>
                                )}
                              </PostMenuWrapper>
                            )}
                          </CommentRow>
                        ))}
                      </>
                    )}
                    <div style={{ position: "relative" }}>
                      <CommentInputRow>
                        <CommentInputWrapper>
                          <CommentHighlight>{renderHighlight(commentInputs[post.id] || "")}</CommentHighlight>
                          <CommentInput
                            ref={(el) => (commentRefs.current[post.id] = el)}
                            placeholder="Add a comment..."
                            value={commentInputs[post.id] || ""}
                            onChange={(e) => { setCommentInputs((prev) => ({ ...prev, [post.id]: e.target.value })); handleMentionInput(e.target.value, post.id); }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleComment(post.id);
                            }}
                          />
                        </CommentInputWrapper>
                        {(commentInputs[post.id] || "").trim() && (
                          <CommentPostButton onClick={() => handleComment(post.id)} disabled={isBusy(`comment-${post.id}`)}>
                            {isBusy(`comment-${post.id}`) ? <Spinner /> : <i className="fa-solid fa-arrow-up" />}
                          </CommentPostButton>
                        )}
                      </CommentInputRow>
                      {mentionQuery && mentionQuery.field === post.id && (
                        <MentionDropdown>
                          {mentionUsers.filter((u) => u.name.toLowerCase().includes(mentionQuery.query)).map((u) => (
                            <MentionOption key={u.id} onMouseDown={(e) => { e.preventDefault(); insertMention(u.name, post.id); }}>
                              <MentionAvatar src={u.picture} /> {u.name}
                            </MentionOption>
                          ))}
                        </MentionDropdown>
                      )}
                    </div>
                  </CommentsSection>
                </PostItem>
              ))
            )}
          </>
        ) : (
          <>
            <UserList>
              {users.length === 0 ? (
                <EmptyState>No other users yet</EmptyState>
              ) : (
                users.map((u) => (
                  <UserRow key={u.id}>
                    <UserInfo>
                      <UserAvatar src={u.picture} alt={u.name} />
                      <div>
                        <UserName>{u.name}</UserName>
                        {u.follows_you && (
                          <UserStatus>Follows you</UserStatus>
                        )}
                      </div>
                    </UserInfo>
                    <FollowBtn user={u} onFollow={handleFollow} busy={isBusy(`follow-${u.id}`)} />
                  </UserRow>
                ))
              )}
            </UserList>
          </>
        )}
      </Content>
    </Page>
  );
}

export default App;
