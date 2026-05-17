import React, { useState, useEffect, useRef, useCallback } from "react";
import { ThemeProvider } from "styled-components";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import PullToRefresh from "pulltorefreshjs";
import ReactDOMServer from "react-dom/server";

// Theme
import {
  RADIUS, RADIUS_SM, ICON_GAP,
  lightTheme, darkTheme,
  useSystemDark, ThemePrefContext, GlobalStyle,
} from "./theme.js";

// Utilities
import { parseText, shortAddress, timeAgo, urlBase64ToUint8Array } from "./utils.js";

// Hooks
import { useDoubleTap, useReactionDoubleTap } from "./hooks/useDoubleTap.js";

// Components
import { Spinner, BigSpinner } from "./components/Spinner.jsx";
import { PhotoLightbox } from "./components/PhotoLightbox.jsx";
import { PostItemWithReaction, CommentRowWithReaction } from "./components/ReactionWrappers.jsx";
import { FollowBtn, PeopleFollowBtn } from "./components/FollowButtons.jsx";

// Styled components — Common
import { SpinnerRing, spinAnim, shimmer, MentionSpan, MentionHighlight, MentionDropdown, MentionOption, MentionAvatar, innerBorder, avatarBase, randomTilt, avatarHover } from "./styles/common.js";

// Styled components — Layout
import { Page, Header, HeaderProfile, SmallAvatar, HeaderName, LoginCard, Title, Subtitle, SignInButton, SegmentedControl, Segment, BackButton, LogoutButton, Content, Banner, BannerText, BannerButton, BannerDismiss, EmptyState } from "./styles/layout.js";

// Styled components — Compose
import { ComposeBox, ComposeWrapper, ComposeInput, ComposeHighlight, ComposeActions, ComposeActionsLeft, IconButton, HiddenFileInput, MediaPreviews, MediaPreview, PreviewImage, PreviewVideo, RemoveMedia, LocationSearch, LocationInput, LocationResults, LocationResult, LocationName, LocationAddress, SelectedLocation, RemoveLocation } from "./styles/compose.js";

// Styled components — Post
import { PostMediaContainer, PostImage, PostVideo, VideoWrap, GameFrameWrap, GameFrameInner, MosaicBadgeBg, MosaicBadge, MediaWrapper, LinkPreviewCard, LinkPreviewImageWrap, LinkPreviewImage, LinkPreviewBody, LinkPreviewSite, LinkPreviewTitle, LinkPreviewDesc, PostLocation, PostMapWrapper, PostMap, PostPlaceName, PostPlaceAddress, SaveToListButton, SaveToListDropdown, SaveToListItem, ListItemIcon } from "./styles/post.js";

// Styled components — Comments
import { CommentsSection, ThreadContainer, ThreadedReplyGroup, ThreadConnector, ReplyButton, CollapseThreadButton, CollapsedThreadPill, ViewThreadButton, ThreadFocusOverlay, ThreadFocusSheet, ThreadFocusHeader, ThreadFocusTitle, ThreadFocusClose, ReplyInputBanner, CancelReplyButton, CommentRow, CommentThumbsBadge, ThumbsUpEmoji, DoubleTapPickerBackdrop, DoubleTapPickerPopover, DoubleTapPickerScroll, DoubleTapPickerEmoji, CommentAvatar, CommentBody, CommentAuthor, CommentText, CommentTime, CommentInputRow, CommentInputWrapper, CommentInput, CommentHighlight, CommentPostButton, CommentCount } from "./styles/comments.js";

// Styled components — People
import { UserList, UserRow, UserInfo, UserAvatar, UserName, UserStatus, FilterDescription, PeopleGrid, PeopleCard, PeopleCardAvatar, PeopleCardName, PeopleCardStatus, UserProfileHeader, UserProfileAvatar, UserProfileName, UserProfileStats, UserProfileStat, UserProfilePrivate, DegreeBadge, DegreeFilterBar, DegreeFilterLabel, DegreeFilterChip, FollowButton, PeopleFollowButton, RequestActions, ApproveButton, RejectButton, SuggestionsBox, SectionTitle, SectionHeader, CollapseButton } from "./styles/people.js";

// Styled components — Profile
import { ProfilePage, ProfileAvatar, ProfileName, ProfileEmail, ThemeToggleLabel, ThemeToggleWrap, ThemeToggle, ThemeSegment, PushSection, PushRow, PushRowLabel, ToggleTrack, ToggleThumb } from "./styles/profile.js";

// Styled components — Lightbox
import { LightboxBackdrop, LightboxImg, LightboxClose } from "./styles/lightbox.js";

// Styled components — Reactions
import { ReactionSettingsSection, ReactionContextBlock, ReactionContextHeader, ReactionContextLabel, ReactionContextSubLabel, ReactionResetButton, EmojiChipRow, EmojiChip, EmojiChipRemove, EmojiChipDragHandle, AddEmojiRow, EmojiInput, AddEmojiButton, ReactionContextDivider, ReactionPreviewRow, ReactionPreviewEmoji, ReactionInheritNote, ReactionsRow, ReactionChip, ReactionNames, EmojiOption, EmojiEditButton, QuickReactButton, EmojiPickerWrap } from "./styles/reactions.js";

function App() {
  const [themePref, setThemePref] = useState(() => localStorage.getItem("theme-pref") || "system");
  const systemDark = useSystemDark();
  const resolvedTheme = themePref === "system" ? (systemDark ? darkTheme : lightTheme) : themePref === "dark" ? darkTheme : lightTheme;

  const updateThemePref = (pref) => {
    setThemePref(pref);
    localStorage.setItem("theme-pref", pref);
  };

  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [feedHasMore, setFeedHasMore] = useState(false);
  const [feedLoadingMore, setFeedLoadingMore] = useState(false);
  const [gameAudioEnabled, setGameAudioEnabled] = useState({});
  const [gameLeaderboardOptOut, setGameLeaderboardOptOut] = useState(false);
  const [frozenListsOrder, setFrozenListsOrder] = useState(null);
  const [listsConnected, setListsConnected] = useState(false);
  const [saveToListPostId, setSaveToListPostId] = useState(null);
  const [listsPages, setListsPages] = useState([]);
  const [listsLoading, setListsLoading] = useState(false);
  const [listsSaving, setListsSaving] = useState(null);
  const [listsSaved, setListsSaved] = useState({});
  const [listsSavedLoaded, setListsSavedLoaded] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [creatingList, setCreatingList] = useState(false);
  const [followers, setFollowers] = useState([]);
  const [followRequests, setFollowRequests] = useState([]);
  const initialProfileId = useRef(null);
  const [tab, setTabState] = useState(() => {
    const path = window.location.pathname;
    if (path === "/people") return "people";
    if (path === "/profile") return "profile";
    const userMatch = path.match(/^\/user\/(\d+)$/);
    if (userMatch) { initialProfileId.current = parseInt(userMatch[1]); return "user-profile"; }
    return "feed";
  });
  const setTab = (newTab) => {
    // Save current scroll position in the current entry before navigating
    window.history.replaceState({ scrollY: window.scrollY }, "");
    const slug = newTab === "feed" ? "/" : newTab === "people" ? "/people" : newTab === "profile" ? "/profile" : null;
    if (slug) window.history.pushState(null, "", slug);
    setTabState(newTab);
    window.scrollTo(0, 0);
  };
  useEffect(() => {
    const onPopState = (e) => {
      const path = window.location.pathname;
      const userMatch = path.match(/^\/user\/(\d+)$/);
      if (userMatch) {
        setTabState("user-profile");
        loadUserProfile(parseInt(userMatch[1]), true);
      } else if (path === "/people") setTabState("people");
      else if (path === "/profile") setTabState("profile");
      else setTabState("feed");
      if (e.state?.scrollY != null) {
        const savedY = e.state.scrollY;
        setTimeout(() => window.scrollTo(0, savedY), 50);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
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

  // Link preview state
  const [ogPreview, setOgPreview] = useState(null);
  const [ogLoading, setOgLoading] = useState(false);
  const ogFetchedUrl = useRef(null);

  // Media state
  const [mediaFiles, setMediaFiles] = useState([]);
  const [mediaPreviews, setMediaPreviews] = useState([]);
  const [mediaSources, setMediaSources] = useState([]);
  const [prefillImageLoaded, setPrefillImageLoaded] = useState(false);
  const hasPrefillRef = useRef(false);
  const prefillReceivedRef = useRef(false);
  const [prefillLoading, setPrefillLoading] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const file = params.get("compose");
    const awaitContent = params.get("awaitContent");
    if (awaitContent) {
      hasPrefillRef.current = true;
      const name = awaitContent.charAt(0).toUpperCase() + awaitContent.slice(1);
      return { source: name, width: parseInt(params.get("width")) || null, height: parseInt(params.get("height")) || null, awaiting: true };
    }
    const raw = file ? { source: params.get("source"), width: parseInt(params.get("width")) || null, height: parseInt(params.get("height")) || null }
      : (() => { try { return JSON.parse(localStorage.getItem("pendingPrefill")); } catch { return null; } })();
    if (!raw?.source && !file) return null;
    hasPrefillRef.current = true;
    const name = (raw.source || "").charAt(0).toUpperCase() + (raw.source || "").slice(1) || null;
    return { source: name, width: raw.width, height: raw.height };
  });
  const fileInputRef = useRef(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [commentInputs, setCommentInputs] = useState({});
  const [expandedComments, setExpandedComments] = useState({});
  const [mentionQuery, setMentionQuery] = useState(null); // { field: "compose" | postId, query: string }
  const composeRef = useRef(null);
  const composeHighlightRef = useRef(null);
  const commentRefs = useRef({});

  const renderTextPart = (str, keyPrefix) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const pieces = str.split(urlRegex);
    return pieces.map((piece, j) =>
      urlRegex.test(piece) ? <a key={`${keyPrefix}-${j}`} href={piece} target="_blank" rel="noopener noreferrer" style={{ color: "#2563EB" }}>{piece}</a> : <span key={`${keyPrefix}-${j}`}>{piece}</span>
    );
  };

  const renderText = (text) => {
    const parts = parseText(text, users, user);
    return parts.map((p, i) =>
      p.type === "mention" ? <MentionSpan key={i} onClick={() => { if (p.userId === user.id) setTab("profile"); else if (p.userId) loadUserProfile(p.userId); }}>@{p.content}</MentionSpan> : <span key={i}>{renderTextPart(p.content, i)}</span>
    );
  };

  const renderHighlight = (text) => {
    const parts = parseText(text, users, user);
    return parts.map((p, i) =>
      p.type === "mention" ? <MentionHighlight key={i}>@{p.content}</MentionHighlight> : <React.Fragment key={i}>{p.content}</React.Fragment>
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

  const fixMentionCasing = (text) => {
    const parts = parseText(text, users, user);
    let result = "";
    for (const p of parts) {
      result += p.type === "mention" ? `@${p.content}` : p.content;
    }
    return result;
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
      HTMLTextAreaElement.prototype,
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
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [openCommentMenuId, setOpenCommentMenuId] = useState(null);
  const [connectionDegrees, setConnectionDegrees] = useState({}); // userId -> 1 | 2
  const [peopleFilter, setPeopleFilter] = useState("friends"); // "all" | "friends" | "fof"
  const [editingComment, setEditingComment] = useState(null);
  const [editingName, setEditingName] = useState(null);
  const [editCommentText, setEditCommentText] = useState("");
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [commentThumbsAnimate, setCommentThumbsAnimate] = useState({}); // commentId -> bool

  // Reaction preferences state
  const [reactionPrefs, setReactionPrefs] = useState(null); // { global: [...], posts: null|[...], comments: null|[...] }
  const [reactionSaving, setReactionSaving] = useState({});
  const [editingEmojiSlot, setEditingEmojiSlot] = useState(null); // index in profile settings
  const [emojiPickerPostId, setEmojiPickerPostId] = useState(null); // post id for inline picker
  const [emojiPickerSlot, setEmojiPickerSlot] = useState(null); // slot index being replaced
  const [commentReactionPicker, setCommentReactionPicker] = useState(null); // { postId, commentId }
  const [quickReactPickerPostId, setQuickReactPickerPostId] = useState(null); // post id for quick one-off reaction
  const [commentDoubleTapPicker, setCommentDoubleTapPicker] = useState(null); // { postId, commentId, x, y } — shown on double-tap

  // Threading state
  const [replyingTo, setReplyingTo] = useState({}); // postId -> { commentId, authorName }
  const [collapsedThreads, setCollapsedThreads] = useState({}); // commentId -> bool (collapsed)
  const [threadFocus, setThreadFocus] = useState(null); // { postId, rootCommentId } — "view thread" mode
  const pickerPopoverRef = useRef(null);
  const pickerScrollRef = useRef(null);
  const [pickerScroll, setPickerScroll] = useState({ left: false, right: false });
  useEffect(() => {
    if (commentDoubleTapPicker && pickerScrollRef.current) {
      const el = pickerScrollRef.current;
      setPickerScroll({ left: false, right: el.scrollWidth > el.clientWidth });
    }
  }, [!!commentDoubleTapPicker]);
  useEffect(() => {
    if (!commentDoubleTapPicker) return;
    const dismiss = (e) => {
      if (pickerPopoverRef.current?.contains(e.target)) return;
      setCommentDoubleTapPicker(null);
    };
    window.addEventListener("scroll", dismiss, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", dismiss, { capture: true });
  }, [!!commentDoubleTapPicker]);

  // User profile page state
  const [viewingProfile, setViewingProfile] = useState(null); // { profile, posts, canViewPosts, hasMore }
  const [viewingProfileLoading, setViewingProfileLoading] = useState(false);
  const profileBackTab = useRef("people"); // track where to go back to

  // Returns the resolved emoji set for a given context, falling back: context → global → default
  const getReactionEmojis = (context = "posts") => {
    if (!reactionPrefs) return DEFAULT_REACTION_EMOJIS;
    if (context !== "global" && reactionPrefs[context] && reactionPrefs[context].length > 0) {
      return reactionPrefs[context];
    }
    if (reactionPrefs.global && reactionPrefs.global.length > 0) {
      return reactionPrefs.global;
    }
    return DEFAULT_REACTION_EMOJIS;
  };

  // Push notification state
  const [pushPrefs, setPushPrefs] = useState(null);
  const [pushSupported] = useState(() => "serviceWorker" in navigator && "PushManager" in window);
  const [isStandalone] = useState(() => window.navigator.standalone || window.matchMedia("(display-mode: standalone)").matches);
  const [isMobile] = useState(() => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
  const [installBannerDismissed, setInstallBannerDismissed] = useState(() => localStorage.getItem("install-banner-dismissed") === "true");
  const [notifBannerDismissed, setNotifBannerDismissed] = useState(() => localStorage.getItem("notif-banner-dismissed") === "true");

  const startBusy = (key) => setBusyActions((prev) => new Set(prev).add(key));
  const endBusy = (key) => setBusyActions((prev) => { const next = new Set(prev); next.delete(key); return next; });
  const isBusy = (key) => busyActions.has(key);

  // Pull-to-refresh in PWA mode
  const ptrRef = useRef(null);
  useEffect(() => {
    if (!isStandalone) return;
    ptrRef.current = PullToRefresh.init({
      mainElement: "body",
      onRefresh: () => { window.location.reload(); },
      distThreshold: 60,
      distMax: 500,
      distReload: 50,
      instructionsPullToRefresh: " ",
      instructionsReleaseToRefresh: " ",
      instructionsRefreshing: " ",
      refreshTimeout: 500,
      iconArrow: ReactDOMServer.renderToString(<i className="fa-solid fa-rotate" />),
      iconRefreshing: ReactDOMServer.renderToString(<i className="fa-solid fa-rotate fa-spin" />),
    });
    return () => { if (ptrRef.current) { ptrRef.current.destroy(); ptrRef.current = null; } };
  }, [isStandalone]);

  useEffect(() => {
    const handleClickOutside = () => { setOpenMenuId(null); setOpenCommentMenuId(null); };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const loadMoreRef = useRef(null);

  useEffect(() => {
    // Stash ?compose=filename&source= in localStorage so it survives a login round-trip
    const params = new URLSearchParams(window.location.search);
    const composeFile = params.get("compose");
    if (composeFile) {
      const composeSource = params.get("source") || null;
      const composeWidth = parseInt(params.get("width")) || null;
      const composeHeight = parseInt(params.get("height")) || null;
      localStorage.setItem(
        "pendingPrefill",
        JSON.stringify({ file: composeFile, source: composeSource, width: composeWidth, height: composeHeight })
      );
      window.history.replaceState(null, "", "/");
    }

    fetch("/api/auth/me")
      .then((res) => { if (res.ok) return res.json(); })
      .then((data) => {
        if (!data) { setLoading(false); return; }
        setUser(data.user);
        setLoading(false);
        if (data.user) {
          loadFeed();
          loadUsers();
          loadFollowers();
          loadFollowRequests();
          loadConnectionDegrees();
          if (initialProfileId.current) {
            loadUserProfile(initialProfileId.current, true);
            initialProfileId.current = null;
          }
          const pendingRaw = localStorage.getItem("pendingPrefill");
          if (pendingRaw) {
            localStorage.removeItem("pendingPrefill");
            try {
              const { file: prefillFile, source: prefillSource, width: prefillWidth, height: prefillHeight } = JSON.parse(pendingRaw);
              fetch(`/api/uploads/${prefillFile}`)
                .then((r) => { if (r.ok) return r.blob(); })
                .then((blob) => {
                  if (!blob) { setPrefillLoading(null); return; }
                  const file = new File([blob], prefillFile, { type: blob.type });
                  const url = URL.createObjectURL(blob);
                  // Preload the image before showing preview
                  const img = new Image();
                  img.onload = () => {
                    setMediaFiles([file]);
                    setMediaPreviews([{ url, type: "image" }]);
                    setMediaSources([prefillSource]);
                    setPrefillImageLoaded(true);
                  };
                  img.src = url;
                })
                .catch(() => setPrefillLoading(null));
            } catch { setPrefillLoading(null); }
          }
        }
      })
      .catch(() => { setLoading(false); });
  }, []);

  useEffect(() => {
    if (!user) return;
    const onVisible = () => { if (document.visibilityState === "visible") loadFeed(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let ws, reconnectTimer, alive = true;
    const connect = () => {
      if (!alive) return;
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      ws = new WebSocket(`${proto}//${window.location.host}/ws?userId=${user.id}`);
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === "follow-request") loadFollowRequests();
        if (msg.type === "follow-approved" || msg.type === "follow-rejected") { loadUsers(); loadFollowers(); }
        if (msg.type === "feed-update") loadFeed();
      };
      ws.onclose = () => { if (alive) reconnectTimer = setTimeout(connect, 2000); };
      ws.onerror = () => ws.close();
    };
    connect();
    const onVisibility = () => { if (document.visibilityState === "visible") loadFeed(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { alive = false; clearTimeout(reconnectTimer); ws?.close(); document.removeEventListener("visibilitychange", onVisibility); };
  }, [user]);

  // Scroll to post from notification tap
  const scrollToPost = useCallback((postId, commentId) => {
    setTab("feed");
    const tryScroll = () => {
      const target = commentId
        ? document.querySelector(`[data-comment-id="${commentId}"]`)
        : document.querySelector(`[data-post-id="${postId}"]`);
      if (target) { target.scrollIntoView({ behavior: "smooth", block: "center" }); return true; }
      return false;
    };
    if (!tryScroll()) {
      const observer = new MutationObserver(() => { if (tryScroll()) observer.disconnect(); });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => observer.disconnect(), 5000);
    }
  }, []);

  useEffect(() => {
    // Handle ?post= URL param (from notification open)
    const params = new URLSearchParams(window.location.search);
    const postId = params.get("post");
    const commentId = params.get("comment");
    if (postId) {
      window.history.replaceState(null, "", "/");
      const wait = setInterval(() => {
        if (posts.length) { clearInterval(wait); scrollToPost(postId, commentId); }
      }, 100);
      setTimeout(() => clearInterval(wait), 10000);
    }

    // Handle message from service worker (PWA already open)
    const onSwMessage = (e) => {
      if (e.data?.type === "scroll-to-post" && e.data.url) {
        const p = new URLSearchParams(e.data.url.split("?")[1] || "");
        const id = p.get("post");
        const cId = p.get("comment");
        if (id) { loadFeed(); setTimeout(() => scrollToPost(id, cId), 500); }
      }
    };
    navigator.serviceWorker?.addEventListener("message", onSwMessage);
    return () => navigator.serviceWorker?.removeEventListener("message", onSwMessage);
  }, [posts.length > 0]);

  // Lists integration
  const [savedPlacesData, setSavedPlacesData] = useState(null);

  useEffect(() => {
    if (!user) return;
    fetch("/api/lists/status").then(r => r.json()).then(d => {
      setListsConnected(d.connected);
      if (d.connected) {
        fetch("/api/lists/saved-places").then(r => r.ok ? r.json() : null).then(data => {
          if (data) setSavedPlacesData(data);
          setListsSavedLoaded(true);
        }).catch(() => setListsSavedLoaded(true));
      } else {
        setListsSavedLoaded(true);
      }
    }).catch(() => {});
  }, [user]);

  // Apply saved places whenever posts or saved data changes
  useEffect(() => {
    if (!savedPlacesData || !posts.length) return;
    const next = {};
    for (const post of posts) {
      if (post.place_id && savedPlacesData[post.place_id]) {
        const entries = {};
        for (const s of savedPlacesData[post.place_id]) {
          entries[s.pageId] = { pageTitle: s.pageTitle, itemId: s.itemId };
        }
        next[post.id] = entries;
      }
    }
    setListsSaved(prev => ({ ...next, ...prev }));
  }, [posts, savedPlacesData]);

  useEffect(() => {
    const onMessage = (e) => {
      if (e.data?.type === "prefill-ready" && e.data.filename && !prefillReceivedRef.current) {
        prefillReceivedRef.current = true;
        if (e.source) e.source.postMessage({ type: "prefill-ack" }, "*");
        const source = prefillLoading?.source || null;
        fetch(`/api/uploads/${e.data.filename}`)
          .then((r) => { if (r.ok) return r.blob(); })
          .then((blob) => {
            if (!blob) { setPrefillLoading(null); return; }
            const file = new File([blob], e.data.filename, { type: blob.type });
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = () => {
              setMediaFiles([file]);
              setMediaPreviews([{ url, type: "image" }]);
              setMediaSources([source?.toLowerCase() || null]);
              setPrefillImageLoaded(true);
            };
            img.src = url;
          })
          .catch(() => setPrefillLoading(null));
        window.history.replaceState(null, "", "/");
      }
      if (e.data?.type === "lists-api-key" && e.data.apiKey) {
        fetch("/api/lists/connect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey: e.data.apiKey }) })
          .then(() => {
            setListsConnected(true);
            setListsLoading(true);
            return fetch("/api/lists/pages");
          })
          .then(r => r.ok ? r.json() : [])
          .then(data => {
            setListsPages(data);
            setListsLoading(false);
            if (pendingConnectPostId.current) {
              setSaveToListPostId(pendingConnectPostId.current);
              pendingConnectPostId.current = null;
            }
          });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const handleSaveToList = async (postId) => {
    if (saveToListPostId === postId) { setSaveToListPostId(null); setFrozenListsOrder(null); return; }
    setSaveToListPostId(postId);
    setFrozenListsOrder(null);
    if (!listsConnected) return;
    setListsLoading(true);
    try {
      const res = await fetch("/api/lists/pages");
      if (res.ok) { const data = await res.json(); setListsPages(data); }
    } catch {}
    setListsLoading(false);
  };

  const handleSavePlaceToList = async (pageId, placeId, postId, pageTitle) => {
    const savedForPost = listsSaved[postId] || {};
    // If already saved to this list, remove it
    if (savedForPost[pageId]) {
      setListsSaving(pageId);
      try {
        const res = await fetch(`/api/lists/remove-item/${pageId}/${savedForPost[pageId].itemId}`, { method: "DELETE" });
        if (res.ok) {
          setListsSaved(prev => {
            const next = { ...prev, [postId]: { ...prev[postId] } };
            delete next[postId][pageId];
            if (Object.keys(next[postId]).length === 0) delete next[postId];
            return next;
          });
          setTimeout(() => { setSaveToListPostId(null); setFrozenListsOrder(null); }, 600);
        }
      } catch {}
      setListsSaving(null);
      return;
    }
    setListsSaving(pageId);
    try {
      const res = await fetch(`/api/lists/save-place/${pageId}/${placeId}`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setListsSaved(prev => ({
          ...prev,
          [postId]: { ...(prev[postId] || {}), [pageId]: { pageTitle, itemId: data.item?.id } }
        }));
        setTimeout(() => { setSaveToListPostId(null); setFrozenListsOrder(null); }, 600);
      }
    } catch {}
    setListsSaving(null);
  };

  const pendingConnectPostId = useRef(null);

  const handleCreateList = async (postId, placeId) => {
    if (!newListName.trim()) return;
    setCreatingList(true);
    try {
      const res = await fetch("/api/lists/create-page", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: newListName.trim() }) });
      if (res.ok) {
        const resData = await res.json();
        const page = resData.page || resData;
        const pageId = page._id || page.id;
        const title = page.title || newListName.trim();
        const newPage = { ...page, id: pageId, title, type: "locations", _new: Date.now() };
        setListsPages(prev => [newPage, ...prev]);
        setFrozenListsOrder(prev => prev ? [newPage, ...prev] : [newPage]);
        setNewListName("");
        setCreatingList(false);
        if (!pageId) return;
        // Auto-save the place to the new list
        setListsSaving(pageId);
        const saveRes = await fetch(`/api/lists/save-place/${pageId}/${placeId}`, { method: "POST" });
        if (saveRes.ok) {
          const data = await saveRes.json();
          setListsSaved(prev => ({ ...prev, [postId]: { ...(prev[postId] || {}), [pageId]: { pageTitle: title, itemId: data.item?.id } } }));
          setTimeout(() => { setSaveToListPostId(null); setFrozenListsOrder(null); }, 600);
        }
        setListsSaving(null);
      }
    } catch {}
    setCreatingList(false);
  };

  const connectLists = (postId) => {
    if (postId) pendingConnectPostId.current = postId;
    window.open("https://lists.fcc.lol/connect?app=Cloud", "lists-connect", "width=420,height=500,left=200,top=200");
  };

  const muteScript = `<script>(function(){var m=true,g=null,aa=[];var O=window.AudioContext||window.webkitAudioContext;if(O){var R=O;window.AudioContext=window.webkitAudioContext=function(){var c=new R();g=c.createGain();g.gain.value=0;g.connect(c.destination);Object.defineProperty(c,'destination',{get:function(){return g}});return c}}var A=window.Audio;window.Audio=function(s){var a=new A(s);a.muted=true;aa.push(a);return a};window.addEventListener('message',function(e){if(e.data==='toggle-audio'){m=!m;if(g)g.gain.value=m?0:1;aa.forEach(function(a){a.muted=m})}})})();</script>`;

  const getGameSrcDoc = (html, audioOn) => {
    if (audioOn) return html;
    return html.replace(/<head>/i, '<head>' + muteScript);
  };

  const toggleGameAudio = (id) => {
    const iframe = document.querySelector(`iframe[data-game-id="${id}"]`);
    if (iframe) iframe.contentWindow.postMessage('toggle-audio', '*');
    setGameAudioEnabled(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Listen for game score reports and leaderboard requests from iframes
  useEffect(() => {
    const onGameMessage = (e) => {
      if (!e.data?.type) return;
      const iframes = document.querySelectorAll('iframe[data-game-id]');
      let sourceIframe = null, gameId = null;
      for (const iframe of iframes) {
        if (iframe.contentWindow === e.source) {
          sourceIframe = iframe;
          gameId = iframe.getAttribute('data-game-id');
          break;
        }
      }
      if (!gameId) return;

      if (e.data.type === 'game-score' && typeof e.data.score === 'number') {
        fetch(`/api/games/${gameId}/score`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ score: e.data.score }),
        }).then(r => r.ok ? r.json() : null).then(() => {
          // Send updated leaderboard back to the game
          fetch(`/api/games/${gameId}/leaderboard`).then(r => r.ok ? r.json() : null).then(data => {
            if (data && sourceIframe?.contentWindow) {
              sourceIframe.contentWindow.postMessage({ type: 'game-leaderboard', leaderboard: data.leaderboard, userId: user?.id }, '*');
            }
          });
        });
      }

      if (e.data.type === 'request-leaderboard') {
        fetch(`/api/games/${gameId}/leaderboard`).then(r => r.ok ? r.json() : null).then(data => {
          if (data && sourceIframe?.contentWindow) {
            sourceIframe.contentWindow.postMessage({ type: 'game-leaderboard', leaderboard: data.leaderboard, userId: user?.id }, '*');
          }
        });
      }
    };
    window.addEventListener('message', onGameMessage);
    return () => window.removeEventListener('message', onGameMessage);
  }, [user]);

  // Sync opt-out from user
  useEffect(() => {
    if (user) setGameLeaderboardOptOut(!!user.game_leaderboard_opt_out);
  }, [user]);

  const loadFeed = () => {
    fetch("/api/feed")
      .then((res) => { if (res.ok) return res.json(); })
      .then((data) => { if (data) { setPosts(data.posts); setFeedHasMore(data.hasMore); } })
      .catch(() => {});
  };

  const loadMoreFeed = () => {
    if (feedLoadingMore || !feedHasMore) return;
    setFeedLoadingMore(true);
    fetch(`/api/feed?offset=${posts.length}`)
      .then((res) => { if (res.ok) return res.json(); })
      .then((data) => {
        if (data) {
          setPosts((prev) => [...prev, ...data.posts]);
          setFeedHasMore(data.hasMore);
        }
      })
      .catch(() => {})
      .finally(() => setFeedLoadingMore(false));
  };
  loadMoreRef.current = loadMoreFeed;
  useEffect(() => {
    if (tab !== "feed") return;
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 300) {
        loadMoreRef.current();
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [tab]);

  const loadFollowRequests = () => {
    fetch("/api/follow-requests")
      .then((res) => { if (res.ok) return res.json(); })
      .then((data) => { if (data) setFollowRequests(data.requests); })
      .catch(() => {});
  };

  const loadFollowers = () => {
    fetch("/api/followers")
      .then((res) => { if (res.ok) return res.json(); })
      .then((data) => { if (data) setFollowers(data.followers); })
      .catch(() => {});
  };

  const loadUsers = () => {
    fetch("/api/users")
      .then((res) => { if (res.ok) return res.json(); })
      .then((data) => { if (data) setUsers(data.users); })
      .catch(() => {});
  };

  const loadUserProfile = (userId, skipPush) => {
    profileBackTab.current = tab === "user-profile" ? profileBackTab.current : tab;
    // Seed with data we already have from the users list so the header renders instantly
    const cached = users.find((u) => u.id === userId);
    if (cached) {
      setViewingProfile({
        profile: { id: cached.id, name: cached.name, picture: cached.picture, follow_status: cached.follow_status, follows_you: cached.follows_you, is_following: cached.is_following, post_count: null, followers_count: null, following_count: null },
        posts: [],
        canViewPosts: cached.follow_status === "approved",
        hasMore: false,
        _postsLoading: true,
      });
      setViewingProfileLoading(false);
    } else {
      setViewingProfileLoading(true);
      setViewingProfile(null);
    }
    if (!skipPush) {
      window.history.replaceState({ scrollY: window.scrollY }, "");
      window.history.pushState(null, "", `/user/${userId}`);
      window.scrollTo(0, 0);
    }
    setTabState("user-profile");
    fetch(`/api/users/${userId}/profile`)
      .then((res) => { if (res.ok) return res.json(); })
      .then((data) => { if (data) setViewingProfile({ ...data, _postsLoading: false }); })
      .catch(() => {})
      .finally(() => setViewingProfileLoading(false));
  };

  const loadConnectionDegrees = () => {
    fetch("/api/users/connections")
      .then((res) => { if (res.ok) return res.json(); })
      .then((data) => { if (data) setConnectionDegrees(data.degrees || {}); })
      .catch(() => {});
  };

  // ── Reaction preferences ────────────────────────────────────────────────────
  const loadReactionPrefs = () => {
    fetch("/api/reaction-prefs")
      .then((res) => { if (res.ok) return res.json(); })
      .then((data) => {
        if (data?.prefs) setReactionPrefs(data.prefs);
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (user) loadReactionPrefs();
  }, [user]);

  const saveReactionEmojis = async (context, emojis) => {
    setReactionSaving((prev) => ({ ...prev, [context]: true }));
    const res = await fetch(`/api/reaction-prefs/${context}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emojis }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.ok) {
        setReactionPrefs((prev) => ({ ...prev, [context]: data.emojis }));
      }
    }
    setReactionSaving((prev) => ({ ...prev, [context]: false }));
  };

  const addEmojiToContext = (context) => {
    const raw = (emojiInputs[context] || "").trim();
    if (!raw) return;
    // Extract just the first grapheme cluster (emoji)
    const segmenter = typeof Intl !== "undefined" && Intl.Segmenter
      ? new Intl.Segmenter()
      : null;
    const emoji = segmenter
      ? [...segmenter.segment(raw)].map((s) => s.segment)[0]
      : [...raw][0];
    if (!emoji) return;

    const currentSet = reactionPrefs
      ? (reactionPrefs[context] ?? (context === "global" ? DEFAULT_REACTION_EMOJIS : getReactionEmojis("global")))
      : DEFAULT_REACTION_EMOJIS;

    if (currentSet.includes(emoji)) {
      setEmojiInputs((prev) => ({ ...prev, [context]: "" }));
      return;
    }
    const newSet = [...currentSet, emoji].slice(0, 12);
    setEmojiInputs((prev) => ({ ...prev, [context]: "" }));
    saveReactionEmojis(context, newSet);
  };

  const removeEmojiFromContext = (context, emoji) => {
    const currentSet = reactionPrefs
      ? (reactionPrefs[context] ?? (context === "global" ? DEFAULT_REACTION_EMOJIS : getReactionEmojis("global")))
      : DEFAULT_REACTION_EMOJIS;
    const newSet = currentSet.filter((e) => e !== emoji);
    saveReactionEmojis(context, newSet.length > 0 ? newSet : null);
  };

  const moveEmojiInContext = (context, fromIndex, toIndex) => {
    const currentSet = reactionPrefs
      ? (reactionPrefs[context] ?? (context === "global" ? DEFAULT_REACTION_EMOJIS : getReactionEmojis("global")))
      : DEFAULT_REACTION_EMOJIS;
    const newSet = [...currentSet];
    const [item] = newSet.splice(fromIndex, 1);
    newSet.splice(toIndex, 0, item);
    saveReactionEmojis(context, newSet);
  };

  const resetContextToInherited = (context) => {
    saveReactionEmojis(context, null);
  };

  const replaceEmojiInSlot = (context, index, raw) => {
    const segmenter = typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter() : null;
    const emoji = segmenter ? [...segmenter.segment(raw)].map((s) => s.segment)[0] : [...raw][0];
    if (!emoji) return;
    const currentSet = [...getReactionEmojis(context)];
    currentSet[index] = emoji;
    saveReactionEmojis(context, currentSet);
    setEditingEmojiSlot(null);
  };

  const addEmojiSlot = (context) => {
    const currentSet = [...getReactionEmojis(context)];
    if (currentSet.length >= 12) return;
    currentSet.push("⭐");
    saveReactionEmojis(context, currentSet);
  };

  const removeEmojiSlot = (context, index) => {
    const currentSet = [...getReactionEmojis(context)];
    if (currentSet.length <= 3) return;
    currentSet.splice(index, 1);
    if (emojiPickerSlot != null && emojiPickerSlot >= currentSet.length) setEmojiPickerSlot(null);
    saveReactionEmojis(context, currentSet);
  };

  // ── Push notifications ──────────────────────────────────────────────────────
  const loadPushPrefs = () => {
    fetch("/api/push/prefs")
      .then((res) => { if (res.ok) return res.json(); })
      .then((data) => { if (data) setPushPrefs(data); })
      .catch(() => {});
  };

  useEffect(() => {
    if (user) loadPushPrefs();
  }, [user]);

  const subscribeToPush = async () => {
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      const vapidRes = await fetch("/api/push/vapid-key");
      if (!vapidRes.ok) return;
      const { publicKey } = await vapidRes.json();
      if (!publicKey) return;

      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const json = sub.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      loadPushPrefs();
    } catch (err) {
      console.error("Push subscribe error:", err);
    }
  };

  const unsubscribeFromPush = async () => {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg && await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      } else {
        // No local subscription — still tell server to disable
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
      }
      loadPushPrefs();
    } catch (err) {
      console.error("Push unsubscribe error:", err);
    }
  };

  const updatePushPref = async (key, value) => {
    setPushPrefs((prev) => ({ ...prev, [key]: value }));
    await fetch("/api/push/prefs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    });
  };
  // ── End push notifications ──────────────────────────────────────────────────

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
      if (!res.ok) return;
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
      if (!file.type.startsWith("image/") || file.type === "image/gif") return resolve(file);
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
    const newPreviews = await Promise.all(processed.map((file) => {
      const url = URL.createObjectURL(file);
      if (!file.type.startsWith("video/")) return Promise.resolve({ url, type: "image" });
      return new Promise((resolve) => {
        const vid = document.createElement("video");
        vid.preload = "metadata";
        vid.onloadedmetadata = () => resolve({ url, type: "video", width: vid.videoWidth, height: vid.videoHeight });
        vid.onerror = () => resolve({ url, type: "video" });
        vid.src = url;
      });
    }));
    setMediaPreviews((prev) => [...prev, ...newPreviews]);
    setMediaSources((prev) => [...prev, ...processed.map(() => null)]);
    e.target.value = "";
  };

  const removeMedia = (index) => {
    URL.revokeObjectURL(mediaPreviews[index].url);
    setMediaFiles((prev) => prev.filter((_, i) => i !== index));
    setMediaPreviews((prev) => prev.filter((_, i) => i !== index));
    setMediaSources((prev) => prev.filter((_, i) => i !== index));
  };

  const fetchOgPreview = async (text) => {
    const urlMatch = text.match(/(https?:\/\/[^\s]+)/);
    if (!urlMatch) {
      setOgPreview(null);
      ogFetchedUrl.current = null;
      return;
    }
    const url = urlMatch[1];
    if (url === ogFetchedUrl.current) return;
    ogFetchedUrl.current = url;
    setOgLoading(true);
    try {
      const res = await fetch(`/api/og?url=${encodeURIComponent(url)}`);
      if (res.ok) {
        const data = await res.json();
        setOgPreview(data);
      } else {
        setOgPreview(null);
      }
    } catch {
      setOgPreview(null);
    }
    setOgLoading(false);
  };

  const handlePost = async () => {
    if (posting) return;
    if (!compose.trim() && mediaFiles.length === 0 && !selectedLocation) return;
    setPosting(true);

    // Build optimistic post
    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticPost = {
      id: optimisticId,
      user_id: user.id,
      content: compose,
      created_at: null,
      _uploading: true,
      author_name: user.name,
      author_picture: user.picture,
      media: mediaPreviews.map((p, i) => ({ url: p.url, type: p.type, source: mediaSources[i] || null })),
      comments: [],
      reactions: [],
      og_preview: ogPreview || null,
      place_name: selectedLocation?.name || null,
      place_lat: selectedLocation?.lat || null,
      place_lng: selectedLocation?.lng || null,
      place_address: selectedLocation?.address || null,
      place_maps_url: selectedLocation?.maps_url || null,
      place_id: selectedLocation?.id || null,
    };
    setPosts(prev => [optimisticPost, ...prev]);

    const formData = new FormData();
    formData.append("content", compose);
    if (selectedLocation) {
      formData.append("place_name", selectedLocation.name);
      formData.append("place_lat", selectedLocation.lat);
      formData.append("place_lng", selectedLocation.lng);
      if (selectedLocation.address) formData.append("place_address", selectedLocation.address);
      if (selectedLocation.maps_url) formData.append("place_maps_url", selectedLocation.maps_url);
      if (selectedLocation.id) formData.append("place_id", selectedLocation.id);
    }
    for (const file of mediaFiles) {
      formData.append("media", file);
    }
    if (mediaSources.some(Boolean)) {
      const srcMap = {};
      mediaSources.forEach((src, i) => { if (src) srcMap[i] = src; });
      formData.append("media_sources", JSON.stringify(srcMap));
    }
    if (ogPreview) {
      formData.append("og_preview", JSON.stringify(ogPreview));
    }

    // Clear compose immediately
    setCompose("");
    setOgPreview(null);
    ogFetchedUrl.current = null;
    setMentionQuery(null);
    setSelectedLocation(null);
    setShowLocationSearch(false);
    setPrefillLoading(null);
    setPrefillImageLoaded(false);
    setMediaFiles([]);
    setMediaPreviews([]);
    setMediaSources([]);
    setPosting(false);

    await fetch("/api/posts", { method: "POST", body: formData });
    // Don't revoke blob URLs until feed replaces optimistic post
    loadFeed();
  };

  const handleDelete = async (id) => {
    setOpenMenuId(null);
    startBusy(`delete-${id}`);
    await fetch(`/api/posts/${id}`, { method: "DELETE" });
    setPosts((prev) => prev.filter((p) => p.id !== id));
    setViewingProfile((prev) => prev ? { ...prev, posts: prev.posts.filter((p) => p.id !== id) } : prev);
    endBusy(`delete-${id}`);
  };

  // Helper: update a post in both feed and profile states
  const updatePostInState = (mapper) => {
    setPosts((prev) => prev.map(mapper));
    setViewingProfile((prev) => prev ? { ...prev, posts: prev.posts.map(mapper) } : prev);
  };

  const spawnEmojiConfetti = (emoji, x, y) => {
    const count = 16;
    for (let i = 0; i < count; i++) {
      const el = document.createElement("div");
      el.textContent = emoji;
      el.style.cssText = `position:fixed;left:${x}px;top:${y}px;font-size:${36 + Math.random() * 20}px;pointer-events:none;z-index:9999;transform:translate(-50%,-50%);`;
      document.body.appendChild(el);
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const dist = 150 + Math.random() * 300;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;
      const rot = (Math.random() - 0.5) * 360;
      el.animate([
        { transform: "translate(-50%,-50%) scale(0.8) rotate(0deg)", opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(1.3) rotate(${rot}deg)`, opacity: 0 },
      ], { duration: 1200, easing: "cubic-bezier(.2,.8,.3,1)" }).onfinish = () => el.remove();
    }
  };

  const handleReact = async (postId, emoji, e) => {
    const post = posts.find(p => p.id === postId);
    const alreadyReacted = post?.reactions?.some(r => r.emoji === emoji && r.user_reacted);
    if (e && !alreadyReacted) {
      const rect = e.target?.getBoundingClientRect?.();
      const x = e.clientX || (rect ? rect.left + rect.width / 2 : 0);
      const y = e.clientY || (rect ? rect.top + rect.height / 2 : 0);
      if (x && y) spawnEmojiConfetti(emoji, x, y);
    }
    // Cancel any pending lightbox from first tap of double-tap
    const el = document.querySelector(`[data-post-id="${postId}"]`);
    if (el && el._lightboxTimer) { clearTimeout(el._lightboxTimer); el._lightboxTimer = null; }
    const res = await fetch(`/api/posts/${postId}/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
    if (!res.ok) return;
    const { action, previous } = await res.json();
    updatePostInState((p) => {
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
    });
  };

  const handleCommentReact = async (postId, commentId, e, emoji) => {
    // If no emoji supplied, show the reaction picker at the tap position
    if (!emoji) {
      const rect = e?.target?.getBoundingClientRect?.();
      const x = e?.clientX || (rect ? rect.left + rect.width / 2 : window.innerWidth / 2);
      const y = e?.clientY || (rect ? rect.top + rect.height / 2 : window.innerHeight / 2);
      setCommentDoubleTapPicker({ postId, commentId, x, y, openedAt: Date.now() });
      return;
    }
    const post = posts.find(p => p.id === postId);
    const comment = post?.comments?.find(c => c.id === commentId);
    const alreadyReacted = comment?.comment_reactions?.some(r => r.emoji === emoji && r.user_reacted);
    if (e && !alreadyReacted) {
      const rect = e.target?.getBoundingClientRect?.();
      const x = e.clientX || (rect ? rect.left + rect.width / 2 : 0);
      const y = e.clientY || (rect ? rect.top + rect.height / 2 : 0);
      if (x && y) spawnEmojiConfetti(emoji, x, y);
    }
    const res = await fetch(`/api/comments/${commentId}/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
    if (!res.ok) return;
    const data = await res.json();
    updatePostInState((p) => {
      if (p.id !== postId) return p;
      return {
        ...p,
        comments: (p.comments || []).map((c) =>
          c.id === commentId ? { ...c, comment_reactions: data.comment_reactions } : c
        ),
      };
    });
  };

  const handleComment = async (postId) => {
    const content = (commentInputs[postId] || "").trim();
    if (!content) return;
    startBusy(`comment-${postId}`);
    const reply = replyingTo[postId];
    const res = await fetch(`/api/posts/${postId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, parent_comment_id: reply?.commentId || null }),
    });
    if (!res.ok) { endBusy(`comment-${postId}`); return; }
    const comment = await res.json();
    updatePostInState((p) =>
      p.id === postId ? { ...p, comments: [...(p.comments || []), comment] } : p
    );
    setCommentInputs((prev) => ({ ...prev, [postId]: "" }));
    setReplyingTo((prev) => { const next = { ...prev }; delete next[postId]; return next; });
    if (commentRefs.current[postId]) commentRefs.current[postId].style.height = "auto";
    setMentionQuery(null);
    endBusy(`comment-${postId}`);
  };

  const handleDeleteComment = async (commentId, postId) => {
    setOpenCommentMenuId(null);
    await fetch(`/api/comments/${commentId}`, { method: "DELETE" });
    updatePostInState((p) =>
      p.id === postId ? { ...p, comments: p.comments.filter((c) => c.id !== commentId) } : p
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
    updatePostInState((p) =>
      p.id === postId
        ? { ...p, comments: p.comments.map((c) => (c.id === commentId ? { ...c, content } : c)) }
        : p
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
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, follows_you: true } : u)));
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

  const renderPostCard = (post, { disableProfileLink } = {}) => (
    <PostItemWithReaction
      key={post.id}
      post={post}
      getReactionEmojis={getReactionEmojis}
      onReact={handleReact}
      renderContent={(postReactProps) => (
        <PostItem data-post-id={post.id}>
          <PostHeader>
            <PostHeaderLink $clickable={!disableProfileLink} onClick={disableProfileLink ? undefined : () => post.user_id === user.id ? setTab("profile") : loadUserProfile(post.user_id)}>
              <Avatar style={{ backgroundImage: `url(${post.author_picture})`, '--tilt': randomTilt() }} />
              <PostAuthor>{post.author_name}</PostAuthor>
            </PostHeaderLink>
            <PostHeaderText>
              <PostTime>{post._uploading ? "uploading..." : timeAgo(post.created_at)}</PostTime>
            </PostHeaderText>
            {post.user_id === user.id && !post._uploading && (
              <PostHeaderRight>
                <PostMenuWrapper>
                  <PostMenuButton onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === post.id ? null : post.id); }}>
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
          {(() => {
            const hasLink = !!post.og_preview;
            const hasMedia = post.media && post.media.length > 0;
            const hasMap = !!(post.place_name && post.place_lat);
            const SMALL = "4px";
            // Order: media → link → map
            const belowMedia = hasLink || hasMap;
            const aboveLink = hasMedia;
            const belowLink = hasMap;
            const aboveMap = hasMedia || hasLink;
            return (
              <div {...postReactProps}>
                {post.content && <PostContent>{renderText(post.og_preview ? post.content.replace(/https?:\/\/[^\s]+/g, "").trim() : post.content)}</PostContent>}
                {post.mini_game && (
                  <GameFrameWrap><GameFrameInner data-game-id={`post-${post.id}`} srcDoc={getGameSrcDoc(post.mini_game, gameAudioEnabled[`post-${post.id}`])} sandbox="allow-scripts allow-same-origin" title="Mini game" /></GameFrameWrap>
                )}
                {hasMedia && (
                  <PostMediaContainer $count={post.media.length} $belowMedia={belowMedia} style={{ ...(belowMedia ? { marginBottom: SMALL } : {}) }}>
                    {post.media.map((m, i) => {
                      const radiusStyle = post.media.length === 1 && belowMedia ? { borderRadius: `${RADIUS} ${RADIUS} ${SMALL} ${SMALL}` } : undefined;
                      if (m.type === "video") return (
                        <VideoWrap key={i} style={{ ...radiusStyle, ...(m.width && m.height ? { aspectRatio: `${m.width} / ${m.height}` } : {}) }}><PostVideo src={m.url} autoPlay loop muted playsInline style={m.width && m.height ? { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" } : undefined} /></VideoWrap>
                      );
                      const img = (
                        <PostImage
                          src={m.url}
                          width={m.width || undefined}
                          height={m.height || undefined}
                          $single={post.media.length === 1}
                          $tappable={post.media.length > 1}
                          style={m.source ? undefined : radiusStyle}
                          onClick={post.media.length > 1 ? () => {
                            const el = document.querySelector(`[data-post-id="${post.id}"]`);
                            if (el && el._touchHandled) return;
                            const url = m.url;
                            const timer = setTimeout(() => setLightboxSrc(url), 300);
                            if (el) { if (el._lightboxTimer) clearTimeout(el._lightboxTimer); el._lightboxTimer = timer; }
                          } : undefined}
                        />
                      );
                      if (m.source === "mosaic") return (
                        <MediaWrapper key={i} style={radiusStyle}>
                          {img}
                          <MosaicBadge href="https://mosaic.fcc.lol" target="_blank" rel="noopener noreferrer"><MosaicBadgeBg />Made with Mosaic <span style={{ opacity: 0.75, fontWeight: 400 }}>Try it <i className="fa-solid fa-arrow-right" style={{ fontSize: 11 }} /></span></MosaicBadge>
                        </MediaWrapper>
                      );
                      if (m.source === "zap") return (
                        <MediaWrapper key={i} style={radiusStyle}>
                          {img}
                          <MosaicBadge href="https://zap.fcc.lol" target="_blank" rel="noopener noreferrer"><MosaicBadgeBg />Made with Zap <span style={{ opacity: 0.75, fontWeight: 400 }}>Try it <i className="fa-solid fa-arrow-right" style={{ fontSize: 11 }} /></span></MosaicBadge>
                        </MediaWrapper>
                      );
                      return <React.Fragment key={i}>{img}</React.Fragment>;
                    })}
                  </PostMediaContainer>
                )}
                {hasLink && (
                  <LinkPreviewCard href={post.og_preview.url} target="_blank" rel="noopener noreferrer" style={{ marginTop: aboveLink ? 0 : 10, ...(aboveLink || belowLink ? { borderRadius: `${aboveLink ? SMALL : RADIUS} ${aboveLink ? SMALL : RADIUS} ${belowLink ? SMALL : RADIUS} ${belowLink ? SMALL : RADIUS}` } : {}), ...(belowLink ? { marginBottom: SMALL } : {}) }}>
                    {post.og_preview.image && <LinkPreviewImageWrap className="link-image-wrap" style={aboveLink ? { borderRadius: `${SMALL} ${SMALL} 0 0` } : undefined}><LinkPreviewImage src={post.og_preview.image} /></LinkPreviewImageWrap>}
                    <LinkPreviewBody className="link-body" $hasImage={!!post.og_preview.image} style={belowLink ? { borderRadius: `0 0 ${SMALL} ${SMALL}` } : undefined}>
                      {post.og_preview.title && <LinkPreviewTitle>{post.og_preview.title}</LinkPreviewTitle>}
                      {post.og_preview.description && <LinkPreviewDesc>{post.og_preview.description}</LinkPreviewDesc>}
                      {post.og_preview.siteName && <LinkPreviewSite>{post.og_preview.siteName}</LinkPreviewSite>}
                    </LinkPreviewBody>
                  </LinkPreviewCard>
                )}
                {hasMap && (<>
                  <div style={{ position: "relative", marginTop: aboveMap ? 0 : 10 }}>
                    <PostLocation as="a" href={post.place_maps_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", color: "inherit", cursor: "pointer" }}>
                      <PostMapWrapper className="map-wrapper" style={aboveMap ? { borderRadius: `${SMALL} ${SMALL} 0 0` } : undefined}>
                        <PostMap src={`/api/staticmap?lat=${post.place_lat}&lng=${post.place_lng}&v=4`} alt={post.place_name} />
                      </PostMapWrapper>
                      <PostPlaceName className="place-name">
                        <span>{post.place_name}</span>
                        {post.place_address && <PostPlaceAddress>{shortAddress(post.place_address)}</PostPlaceAddress>}
                      </PostPlaceName>
                    </PostLocation>
                    {post.place_id && (
                      <SaveToListButton onClick={() => { if (!listsConnected) { connectLists(post.id); return; } if (listsSavedLoaded) handleSaveToList(post.id); }} $saved={!!listsSaved[post.id]} $loading={!listsSavedLoaded}>
                        <span>{!listsSavedLoaded ? <Spinner size="14px" /> : <><img src="https://lists.fcc.lol/apple-touch-icon.png?v=2" alt="" style={{ width: 16, height: 16, borderRadius: 3 }} />{(() => { const s = listsSaved[post.id]; if (!s) return "Save on Lists App"; const names = Object.values(s).map(v => v.pageTitle); return names.length === 1 ? `Saved to ${names[0]}` : `Saved to ${names.length} lists`; })()}</>}</span>
                      </SaveToListButton>
                    )}
                  </div>
                  {post.place_id && saveToListPostId === post.id && listsConnected && (
                    <SaveToListDropdown onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                      {listsLoading ? (
                        <SaveToListItem disabled><Spinner size="20px" /> Loading lists...</SaveToListItem>
                      ) : (<>
                        <SaveToListItem key="_new-list-input" as="div" style={{ cursor: "default" }}>
                          <ListItemIcon><i className="fa-solid fa-plus" /></ListItemIcon>
                          <input
                            value={newListName}
                            onChange={(e) => setNewListName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleCreateList(post.id, post.place_id); }}
                            placeholder="New list"
                            disabled={creatingList}
                            autoComplete="off"
                            data-1p-ignore
                            data-lpignore="true"
                            style={{ flex: 1, border: "none", background: "none", outline: "none", font: "inherit", fontWeight: "inherit", color: "inherit", padding: 0, minWidth: 0 }}
                          />
                          {creatingList ? <Spinner /> : newListName.trim() && <button onClick={() => handleCreateList(post.id, post.place_id)} style={{ border: "none", background: resolvedTheme.btnPrimary, color: resolvedTheme.btnPrimaryText, borderRadius: 12, padding: "6px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0, margin: "-4px -4px -4px 0" }}>Add</button>}
                        </SaveToListItem>
                        {(() => {
                          if (frozenListsOrder) return frozenListsOrder;
                          const sorted = listsPages.filter(p => p.type === "locations").sort((a, b) => {
                            if (a._new && !b._new) return -1;
                            if (b._new && !a._new) return 1;
                            const saved = listsSaved[post.id] || {};
                            const aSaved = saved[a.id || a._id] ? 1 : 0;
                            const bSaved = saved[b.id || b._id] ? 1 : 0;
                            if (aSaved !== bSaved) return bSaved - aSaved;
                            const addr = (post.place_address || post.place_name || "").toLowerCase();
                            const aTitle = (a.title || "").toLowerCase();
                            const bTitle = (b.title || "").toLowerCase();
                            const aWords = aTitle.split(/[\s\/]+/);
                            const bWords = bTitle.split(/[\s\/]+/);
                            const aScore = aWords.filter(w => w.length > 2 && addr.includes(w)).length;
                            const bScore = bWords.filter(w => w.length > 2 && addr.includes(w)).length;
                            return bScore - aScore;
                          });
                          if (!frozenListsOrder) setFrozenListsOrder(sorted);
                          return sorted;
                        })().map(page => (
                          <SaveToListItem key={page.id || page._id} disabled={listsSaving === (page.id || page._id)} onClick={() => handleSavePlaceToList(page.id || page._id, post.place_id, post.id, page.title)}>
                            <ListItemIcon><i className="fa-solid fa-location-dot" /></ListItemIcon>
                            <span style={{ flex: 1 }}>{page.title}</span>
                            {listsSaving === (page.id || page._id) ? <Spinner size="16px" /> : listsSaved[post.id]?.[page.id || page._id] ? <i className="fa-solid fa-check" style={{ width: 16, textAlign: "center" }} /> : null}
                          </SaveToListItem>
                        ))}
                      </>)}
                    </SaveToListDropdown>
                  )}
                </>)}
              </div>
            );
          })()}
          {(post.reactions || []).length > 0 && (
            <ReactionsRow>
              {(post.reactions || []).map((r) => (
                <ReactionChip key={r.emoji} $active={r.user_reacted}>
                  <span style={{ width: 24, textAlign: "center", flexShrink: 0 }}>{r.emoji}</span> <ReactionNames>{(r.names || []).join(", ")}</ReactionNames>
                </ReactionChip>
              ))}
            </ReactionsRow>
          )}
          {emojiPickerPostId === post.id ? (
            <>
              <ReactionsRow>
                {getReactionEmojis("global").map((emoji, i) => (
                  <div key={emoji + i} style={{ position: "relative" }}>
                    <EmojiOption
                      onClick={() => setEmojiPickerSlot(emojiPickerSlot === i ? null : i)}
                      style={{ width: 44, height: 44, fontSize: 24, paddingBottom: 2, background: "transparent", border: emojiPickerSlot === i ? `2px solid ${resolvedTheme.btnPrimary}` : `2px dashed ${resolvedTheme.border}`, borderRadius: RADIUS_SM, opacity: 1 }}
                    >{emoji}</EmojiOption>
                    {getReactionEmojis("global").length > 3 && (
                      <EmojiEditButton onClick={() => removeEmojiSlot("global", i)} style={{ position: "absolute", top: -8, right: -8, width: 20, height: 20, fontSize: 10, background: resolvedTheme.bgElevated, border: `2px solid ${resolvedTheme.border}`, borderRadius: "50%" }}>
                        <i className="fa-solid fa-minus" />
                      </EmojiEditButton>
                    )}
                  </div>
                ))}
                {getReactionEmojis("global").length < 12 && (
                  <EmojiEditButton
                    onClick={() => { const currentSet = [...getReactionEmojis("global")]; if (currentSet.length >= 12) return; const newIndex = currentSet.length; const pool = ["⭐","🎉","💪","🙌","💯","✨","🎶","🌈","☀️","🍕","🌊","🧡","💜","💚","🤩","😎","🥳","🫡","🤝","👀","💡","🌟","🍀","🦋","🐶","🎯","🚀","⚡","🪴","🧸","🎨","🏆","🎸","🌸","🍩","🧁","☕","🫶","🤙","👏","🙏","💎","🔮","🎪","🌻","🐱","🦊","🐻","🌮","🍦","🎲","🛹","🏄","⛷️","🎭","🪩","🫧","🌙","🦄","🐝","🍉","🥑","🧊","🎹","🪻","🌺","🫰","🤟","✌️","🤘","💫","🥂","🍿","☁️","🌴","🦩","🐚","🪸","🎠","🧲"]; currentSet.push(pool[Math.floor(Math.random() * pool.length)]); saveReactionEmojis("global", currentSet); setEmojiPickerSlot(newIndex); }}
                    style={{ width: 44, height: 44, fontSize: 16, background: "transparent", border: `2px dashed ${resolvedTheme.border}`, borderRadius: RADIUS_SM, color: resolvedTheme.textSecondary }}
                  ><i className="fa-solid fa-plus" /></EmojiEditButton>
                )}
                <EmojiEditButton onClick={() => { setEmojiPickerPostId(null); setEmojiPickerSlot(null); }}><i className="fa-solid fa-check" /></EmojiEditButton>
              </ReactionsRow>
              {emojiPickerSlot != null && (
                <EmojiPickerWrap>
                  <Picker data={data} dynamicWidth={true} theme={resolvedTheme === darkTheme ? "dark" : "light"} previewPosition="none" maxFrequentRows={0} emojiSize={32} emojiButtonSize={48} emojiButtonRadius="0.5rem" searchPosition="static" onEmojiSelect={(e) => { replaceEmojiInSlot("global", emojiPickerSlot, e.native); }} />
                </EmojiPickerWrap>
              )}
            </>
          ) : (
            <>
              <ReactionsRow>
                {(() => {
                  const hasAnyReaction = (post.reactions || []).some((r) => r.user_reacted);
                  return getReactionEmojis("posts").map((emoji) => {
                    const userReacted = (post.reactions || []).some((r) => r.emoji === emoji && r.user_reacted);
                    return <EmojiOption key={emoji} $dimmed={hasAnyReaction && !userReacted} onClick={(e) => { if (e.detail > 1) return; handleReact(post.id, emoji, e); }}>{emoji}</EmojiOption>;
                  });
                })()}
                <EmojiEditButton onClick={() => { setEmojiPickerPostId(post.id); setEmojiPickerSlot(null); setQuickReactPickerPostId(null); }}>
                  <i className="fa-solid fa-pen" />
                </EmojiEditButton>
                <QuickReactButton title="React with any emoji" onClick={(e) => { e.stopPropagation(); setQuickReactPickerPostId(quickReactPickerPostId === post.id ? null : post.id); }}>
                  <i className="fa-regular fa-face-smile" />
                </QuickReactButton>
              </ReactionsRow>
              {quickReactPickerPostId === post.id && (
                <EmojiPickerWrap>
                  <Picker data={data} dynamicWidth={true} theme={resolvedTheme === darkTheme ? "dark" : "light"} previewPosition="none" maxFrequentRows={1} emojiSize={32} emojiButtonSize={48} emojiButtonRadius="0.5rem" searchPosition="static" onEmojiSelect={(e) => { handleReact(post.id, e.native); setQuickReactPickerPostId(null); }} onClickOutside={() => setQuickReactPickerPostId(null)} />
                </EmojiPickerWrap>
              )}
            </>
          )}
          <CommentsSection>
            {post.comments && post.comments.length > 0 && (
              <>
                {(() => {
                  const topLevel = post.comments.filter(c => !c.parent_comment_id);
                  const replies = {};
                  post.comments.filter(c => c.parent_comment_id).forEach(c => {
                    if (!replies[c.parent_comment_id]) replies[c.parent_comment_id] = [];
                    replies[c.parent_comment_id].push(c);
                  });
                  const renderComment = (c) => (
                  <CommentRowWithReaction key={c.id} postId={post.id} commentId={c.id} onReact={handleCommentReact}
                    renderContent={(commentReactProps) => (
                      <><CommentRow data-comment-id={c.id} {...commentReactProps}>
                        <CommentAvatar style={{ backgroundImage: `url(${c.author_picture})`, '--tilt': randomTilt() }} />
                        <CommentBody>
                          <CommentAuthor>{c.author_name}</CommentAuthor>
                          {editingComment === c.id ? (
                            <CommentInputRow>
                              <CommentInput value={editCommentText} onChange={(e) => setEditCommentText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleEditComment(c.id, post.id); if (e.key === "Escape") { setEditingComment(null); setEditCommentText(""); } }} autoFocus style={{ color: resolvedTheme.text }} />
                              <CommentPostButton onClick={() => handleEditComment(c.id, post.id)} disabled={isBusy(`edit-comment-${c.id}`)}>
                                {isBusy(`edit-comment-${c.id}`) ? <Spinner /> : <i className="fa-solid fa-check" />}
                              </CommentPostButton>
                            </CommentInputRow>
                          ) : (
                            <>
                              <CommentText style={c.content === "thinking..." || c.content === "generated a game (old version)" ? { color: "#999" } : undefined}>
                                {c.content === "thinking..." || c.content === "generated a game (old version)" ? c.content : renderText(c.content)}
                              </CommentText>
                              {c.content !== "thinking..." && <>{" "}<CommentTime>{timeAgo(c.created_at)}</CommentTime></>}
                            </>
                          )}
                        </CommentBody>
                        {editingComment !== c.id && c.content !== "thinking..." && (
                          <PostMenuButton onClick={() => {
                            // Focus bottom input SYNCHRONOUSLY to capture iOS keyboard
                            const existing = commentRefs.current[post.id];
                            const cursorPos = existing?.selectionStart ?? existing?.value?.length ?? 0;
                            if (existing) existing.focus();
                            // Thread under the top-level parent (flatten nesting)
                            const parentId = c.parent_comment_id || c.id;
                            setReplyingTo(prev => ({ ...prev, [post.id]: { commentId: parentId, authorName: c.author_name } }));
                            // After re-render, transfer focus to the inline input and restore cursor
                            setTimeout(() => { const ref = commentRefs.current[post.id]; if (ref) { ref.focus(); ref.setSelectionRange(cursorPos, cursorPos); ref.scrollIntoView({ behavior: "smooth", block: "center" }); } }, 100);
                          }} style={{ color: resolvedTheme.textSecondary, alignSelf: "flex-start", marginTop: 2 }}>
                            <i className="fa-solid fa-reply" style={{ fontSize: 12, opacity: 0.5 }} />
                          </PostMenuButton>
                        )}
                        {(c.user_id === user.id || (c.author_name === "Sol" && user.email === "leo@leomancinidesign.com") || c.mini_game) && editingComment !== c.id && (
                          <PostMenuWrapper onTouchStart={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()} onDoubleClick={e => e.stopPropagation()}>
                            <PostMenuButton onClick={(e) => { e.stopPropagation(); setOpenCommentMenuId(openCommentMenuId === c.id ? null : c.id); }}>
                              <i className="fa-solid fa-ellipsis-vertical" />
                            </PostMenuButton>
                            {openCommentMenuId === c.id && (
                              <PostMenu onClick={(e) => e.stopPropagation()}>
                                {c.mini_game && (
                                  <PostMenuItem onClick={() => { toggleGameAudio(c.id); setOpenCommentMenuId(null); }}>
                                    <i className={gameAudioEnabled[c.id] ? "fa-solid fa-volume-xmark" : "fa-solid fa-volume-high"} /> {gameAudioEnabled[c.id] ? "Disable audio" : "Enable audio"}
                                  </PostMenuItem>
                                )}
                                {c.user_id === user.id && (
                                  <PostMenuItem onClick={() => { setOpenCommentMenuId(null); setEditingComment(c.id); setEditCommentText(c.content); }}>
                                    <i className="fa-solid fa-pen" /> Edit
                                  </PostMenuItem>
                                )}
                                {(c.user_id === user.id || (c.author_name === "Sol" && user.email === "leo@leomancinidesign.com")) && (
                                  <PostMenuItem $danger onClick={() => handleDeleteComment(c.id, post.id)}>
                                    <i className="fa-solid fa-trash" /> Delete
                                  </PostMenuItem>
                                )}
                              </PostMenu>
                            )}
                          </PostMenuWrapper>
                        )}
                      </CommentRow>
                      {c.mini_game && (
                        <GameFrameWrap style={{ marginTop: 8 }}><GameFrameInner data-game-id={c.id} srcDoc={getGameSrcDoc(c.mini_game, gameAudioEnabled[c.id])} sandbox="allow-scripts allow-same-origin" title="Mini game" /></GameFrameWrap>
                      )}
                      {c.image && (
                        <PostImage src={`/api/uploads/${c.image}`} style={{ marginTop: 8, borderRadius: RADIUS, cursor: "default" }}
                          onDoubleClick={() => handleCommentReact(post.id, c.id, null, null)}
                          onTouchStart={(e) => { e.target._tapY = e.touches[0].clientY; e.target._tapTime = Date.now(); }}
                          onTouchEnd={(e) => { const dy = Math.abs((e.changedTouches[0]?.clientY || 0) - (e.target._tapY || 0)); const now = Date.now(); if (dy < 10 && e.target._lastTap && now - e.target._lastTap < 300) { e.preventDefault(); handleCommentReact(post.id, c.id, { clientX: e.changedTouches[0].clientX, clientY: e.changedTouches[0].clientY, target: e.target }, null); e.target._lastTap = 0; } else { e.target._lastTap = now; } }}
                        />
                      )}
                      {c.comment_reactions && c.comment_reactions.length > 0 && (
                        <CommentTime style={{ display: "flex", gap: 12, marginTop: c.image ? 10 : 6, marginLeft: 32, flexWrap: "wrap" }}>
                          {c.comment_reactions.map((r) => (
                            <span key={r.emoji} style={r.user_reacted ? { cursor: "pointer" } : undefined}
                              onClick={r.user_reacted ? () => { if (commentReactionPicker?.commentId === c.id) { setCommentReactionPicker(null); } else { setTimeout(() => setCommentReactionPicker({ postId: post.id, commentId: c.id }), 0); } } : undefined}
                            >{r.emoji}&ensp;<span style={{ fontWeight: 600, color: resolvedTheme.text }}>{r.names.join(", ")}</span></span>
                          ))}
                        </CommentTime>
                      )}
                      {commentReactionPicker?.commentId === c.id && (
                        <EmojiPickerWrap onTouchStart={e => e.stopPropagation()} onTouchMove={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()} onDoubleClick={e => e.stopPropagation()}>
                          <Picker data={data} dynamicWidth={true} theme={resolvedTheme === darkTheme ? "dark" : "light"} previewPosition="none" maxFrequentRows={0} emojiSize={32} emojiButtonSize={48} emojiButtonRadius="0.5rem" searchPosition="static"
                            onEmojiSelect={async (e) => {
                              const res = await fetch(`/api/comments/${c.id}/react`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emoji: e.native }) });
                              if (res.ok) { const d = await res.json(); updatePostInState((p) => p.id !== post.id ? p : { ...p, comments: (p.comments || []).map((cm) => cm.id === c.id ? { ...cm, comment_reactions: d.comment_reactions } : cm) }); }
                              setCommentReactionPicker(null);
                            }}
                            onClickOutside={() => setCommentReactionPicker(null)}
                          />
                        </EmojiPickerWrap>
                      )}
                      </>
                    )}
                  />
                  );
                  return topLevel.map((c, ci) => (
                    <ThreadContainer key={c.id}>
                      {renderComment(c)}
                      {replies[c.id] && replies[c.id].length > 0 && (
                        collapsedThreads[c.id] ? (
                          <CollapsedThreadPill onClick={() => setCollapsedThreads(prev => ({ ...prev, [c.id]: false }))}>
                            <i className="fa-solid fa-chevron-down" style={{ fontSize: 10 }} />
                            {replies[c.id].length} {replies[c.id].length === 1 ? "reply" : "replies"}
                          </CollapsedThreadPill>
                        ) : (
                          <ThreadedReplyGroup>
                            {replies[c.id].map(r => renderComment(r))}
                            {replies[c.id].length > 1 && (
                              <CollapseThreadButton onClick={() => setCollapsedThreads(prev => ({ ...prev, [c.id]: true }))}>
                                <i className="fa-solid fa-chevron-up" style={{ fontSize: 10 }} /> Hide replies
                              </CollapseThreadButton>
                            )}
                          </ThreadedReplyGroup>
                        )
                      )}
                      {(() => {
                        // Show inline reply input if replying to this comment or one of its replies
                        const replyTarget = replyingTo[post.id];
                        const isReplyingHere = replyTarget && (replyTarget.commentId === c.id || replies[c.id]?.some(r => r.id === replyTarget.commentId));
                        if (!isReplyingHere) return null;
                        return (
                          <div style={{ marginTop: 8, marginLeft: 32, ...(ci < topLevel.length - 1 ? { marginBottom: 12 } : {}) }}>
                            <CommentInputRow>
                              <button onClick={() => setReplyingTo(prev => { const next = { ...prev }; delete next[post.id]; return next; })} style={{ border: "none", background: resolvedTheme.bgControl, cursor: "pointer", color: resolvedTheme.textSecondary, padding: 0, fontSize: 16, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", width: 40, minWidth: 40, height: 40, borderRadius: "50%" }}>
                                <i className="fa-solid fa-xmark" />
                              </button>
                              <CommentInputWrapper>
                                <CommentHighlight>{renderHighlight(commentInputs[post.id] || "")}</CommentHighlight>
                                <CommentInput
                                  ref={(el) => { if (el) commentRefs.current[post.id] = el; }}
                                  placeholder={`Reply to ${replyTarget.authorName}...`}
                                  rows={1}
                                  value={commentInputs[post.id] || ""}
                                  onFocus={(e) => { e.target.style.height = e.target.scrollHeight + "px"; }}
                                  onChange={(e) => { const v = e.target.value; const fixed = fixMentionCasing(v); if (fixed !== v) { const pos = e.target.selectionStart + (fixed.length - v.length); e.target.value = fixed; e.target.setSelectionRange(pos, pos); } setCommentInputs((prev) => ({ ...prev, [post.id]: fixed })); handleMentionInput(fixed, post.id); e.target.style.height = "0"; e.target.style.height = e.target.scrollHeight + "px"; e.target.scrollTop = 0; }}
                                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleComment(post.id); } }}
                                />
                              </CommentInputWrapper>
                              {(commentInputs[post.id] || "").trim() && (
                                <CommentPostButton onClick={() => handleComment(post.id)} disabled={isBusy(`comment-${post.id}`)}>
                                  {isBusy(`comment-${post.id}`) ? <Spinner /> : <i className="fa-solid fa-arrow-up" />}
                                </CommentPostButton>
                              )}
                            </CommentInputRow>
                          </div>
                        );
                      })()}
                    </ThreadContainer>
                  ));
                })()}
              </>
            )}
            {<div style={{ position: "relative", ...(replyingTo[post.id] ? { height: 0, overflow: "hidden", margin: 0, padding: 0 } : {}) }}>
              <CommentInputRow>
                <CommentInputWrapper>
                  <CommentHighlight>{renderHighlight(commentInputs[post.id] || "")}</CommentHighlight>
                  <CommentInput
                    ref={(el) => { if (!replyingTo[post.id]) commentRefs.current[post.id] = el; }}
                    placeholder={replyingTo[post.id] ? `Reply to ${replyingTo[post.id].authorName}...` : "Add a comment..."}
                    rows={1}
                    value={commentInputs[post.id] || ""}
                    onFocus={(e) => { e.target.style.height = e.target.scrollHeight + "px"; }}
                    onChange={(e) => { const v = e.target.value; const fixed = fixMentionCasing(v); if (fixed !== v) { const pos = e.target.selectionStart + (fixed.length - v.length); e.target.value = fixed; e.target.setSelectionRange(pos, pos); } setCommentInputs((prev) => ({ ...prev, [post.id]: fixed })); handleMentionInput(fixed, post.id); e.target.style.height = "0"; e.target.style.height = e.target.scrollHeight + "px"; e.target.scrollTop = 0; }}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleComment(post.id); } }}
                  />
                </CommentInputWrapper>
                {(commentInputs[post.id] || "").trim() && (
                  <CommentPostButton onClick={() => handleComment(post.id)} disabled={isBusy(`comment-${post.id}`)}>
                    {isBusy(`comment-${post.id}`) ? <Spinner /> : <i className="fa-solid fa-arrow-up" />}
                  </CommentPostButton>
                )}
              </CommentInputRow>
              {mentionQuery && mentionQuery.field === post.id && (() => {
                const comments = post.comments || [];
                const commenterLastIndex = {};
                comments.forEach((c, i) => { commenterLastIndex[c.user_id] = i; });
                const reactorNames = new Set((post.reactions || []).flatMap(r => r.names || []));
                const filtered = mentionUsers.filter((u) => u.name.toLowerCase().includes(mentionQuery.query));
                if (!filtered.length) return null;
                const sorted = [...filtered].sort((a, b) => {
                  const aComment = commenterLastIndex[a.id] !== undefined;
                  const bComment = commenterLastIndex[b.id] !== undefined;
                  if (aComment && !bComment) return -1;
                  if (!aComment && bComment) return 1;
                  if (aComment && bComment) return commenterLastIndex[b.id] - commenterLastIndex[a.id];
                  const aReact = reactorNames.has(a.name);
                  const bReact = reactorNames.has(b.name);
                  if (aReact && !bReact) return -1;
                  if (!aReact && bReact) return 1;
                  return 0;
                });
                return (
                  <MentionDropdown>
                    {sorted.map((u) => (
                      <MentionOption key={u.id} onMouseDown={(e) => { e.preventDefault(); insertMention(u.name, post.id); }} onTouchStart={(e) => { e.target._touchY = e.touches[0].clientY; }} onTouchEnd={(e) => { if (Math.abs((e.changedTouches[0]?.clientY || 0) - (e.target._touchY || 0)) < 10) { e.preventDefault(); insertMention(u.name, post.id); } }}>
                        <MentionAvatar style={{ backgroundImage: `url(${u.picture})` }} /> {u.name}
                      </MentionOption>
                    ))}
                  </MentionDropdown>
                );
              })()}
            </div>}
          </CommentsSection>
        </PostItem>
      )}
    />
  );

  if (loading) return null;

  if (!user) {
    return (
      <ThemePrefContext.Provider value={{ preference: themePref, setPreference: updateThemePref }}>
        <ThemeProvider theme={resolvedTheme}>
          <GlobalStyle />
          <Page>
            <LoginCard>
              <Title>Cloud</Title>
              <Subtitle>Share your day</Subtitle>
              <SignInButton href={`/api/auth/google${window.location.search ? `?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}` : ''}`}>Log in with Google</SignInButton>
            </LoginCard>
          </Page>
        </ThemeProvider>
      </ThemePrefContext.Provider>
    );
  }

  return (
    <ThemePrefContext.Provider value={{ preference: themePref, setPreference: updateThemePref }}>
      <ThemeProvider theme={resolvedTheme}>
        <GlobalStyle />
        <Page>
      {lightboxSrc && <PhotoLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
      {commentDoubleTapPicker && (() => {
        const PICKER_W = 56 * getReactionEmojis("comments").length + 24; // approx width
        const PICKER_H = 60;
        const vpW = window.innerWidth;
        const vpH = window.innerHeight;
        const isMobileView = vpW < 600;
        let left = isMobileView ? vpW / 2 : commentDoubleTapPicker.x;
        let top  = commentDoubleTapPicker.y - PICKER_H - 16;
        if (!isMobileView) left = Math.max(PICKER_W / 2 + 12, Math.min(left, vpW - PICKER_W / 2 - 12));
        top  = top < 12 ? commentDoubleTapPicker.y + 20 : top;
        return (
          <>
            <DoubleTapPickerBackdrop onClick={() => { if (Date.now() - commentDoubleTapPicker.openedAt > 300) setCommentDoubleTapPicker(null); }} />
            <DoubleTapPickerPopover ref={pickerPopoverRef} $scrollLeft={pickerScroll.left} $scrollRight={pickerScroll.right} style={{ left, top, transform: "translate(-50%, 0)" }}>
              <DoubleTapPickerScroll ref={pickerScrollRef} onScroll={(e) => {
                const el = e.target;
                setPickerScroll({ left: el.scrollLeft > 2, right: el.scrollLeft < el.scrollWidth - el.clientWidth - 2 });
              }}>{(() => {
                const post = posts.find(p => p.id === commentDoubleTapPicker.postId);
                const comment = post?.comments?.find(c => c.id === commentDoubleTapPicker.commentId);
                const userReactedEmoji = comment?.comment_reactions?.find(r => r.user_reacted)?.emoji;
                return getReactionEmojis("comments").map((emoji) => (
                <DoubleTapPickerEmoji
                  key={emoji}
                  style={{ opacity: userReactedEmoji && userReactedEmoji !== emoji ? 0.35 : 1 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    const { postId, commentId } = commentDoubleTapPicker;
                    setCommentDoubleTapPicker(null);
                    handleCommentReact(postId, commentId, { clientX: commentDoubleTapPicker.x, clientY: commentDoubleTapPicker.y, target: e.target }, emoji);
                  }}
                >
                  {emoji}
                </DoubleTapPickerEmoji>
              ));
              })()}</DoubleTapPickerScroll>
            </DoubleTapPickerPopover>
          </>
        );
      })()}
      <Header>
        {tab === "profile" || tab === "user-profile" ? (
          <BackButton onClick={() => window.history.back()}><i className="fa-solid fa-arrow-left" /> Back</BackButton>
        ) : (
          <>
            <HeaderProfile onClick={() => setTab("profile")}>
              <SmallAvatar style={{ backgroundImage: `url(${user.picture})`, '--tilt': randomTilt() }} />
              <HeaderName>{user.name}</HeaderName>
            </HeaderProfile>
            <SegmentedControl>
              <Segment $active={tab === "feed"} onClick={() => setTab("feed")} style={{ minWidth: 90 }}>
                Feed
              </Segment>
              <Segment $active={tab === "people"} onClick={() => { setTab("people"); loadUsers(); loadFollowRequests(); loadFollowers(); loadConnectionDegrees(); }} style={{ minWidth: 90 }}>
                People
              </Segment>
            </SegmentedControl>
          </>
        )}
      </Header>
      <Content>
        {isMobile && !isStandalone && !installBannerDismissed && tab === "feed" && (
          <Banner>
            <BannerText>Add Cloud to your home screen to turn on push notifications</BannerText>
            <BannerDismiss onClick={() => { setInstallBannerDismissed(true); localStorage.setItem("install-banner-dismissed", "true"); }}>
              <i className="fa-solid fa-xmark" />
            </BannerDismiss>
          </Banner>
        )}
        {isMobile && isStandalone && !notifBannerDismissed && pushSupported && pushPrefs && !pushPrefs.enabled && tab === "feed" && (
          <Banner>
            <BannerText>Turn on notifications</BannerText>
            <BannerButton onClick={subscribeToPush}>Enable</BannerButton>
            <BannerDismiss onClick={() => { setNotifBannerDismissed(true); localStorage.setItem("notif-banner-dismissed", "true"); }}>
              <i className="fa-solid fa-xmark" />
            </BannerDismiss>
          </Banner>
        )}
        {tab === "profile" ? (
          <ProfilePage>
            <ProfileAvatar style={{ backgroundImage: `url(${user.picture})`, '--tilt': randomTilt() }} />
            {editingName !== null ? (
              <form onSubmit={(e) => {
                e.preventDefault();
                const trimmed = editingName.trim();
                fetch("/api/profile/name", {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ display_name: trimmed || null }),
                })
                  .then((res) => { if (res.ok) return res.json(); })
                  .then((data) => {
                    if (data) { setUser((u) => ({ ...u, name: data.name, display_name: data.display_name })); loadFeed(); }
                  })
                  .catch(() => {});
                setEditingName(null);
              }} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 4 }}>
                <input
                  autoFocus
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  placeholder={user.google_name || user.name}
                  style={{
                    fontSize: 22, fontWeight: 700, textAlign: "center", border: `2px solid ${resolvedTheme.border}`,
                    borderRadius: RADIUS, padding: "6px 12px", outline: "none", background: resolvedTheme.bgInput,
                    color: resolvedTheme.text, fontFamily: "inherit", width: 200,
                  }}
                />
                <CommentPostButton type="submit" style={{ width: 36, height: 36 }}>
                  <i className="fa-solid fa-check" />
                </CommentPostButton>
              </form>
            ) : (
              <ProfileName onClick={() => setEditingName(user.display_name || "")} style={{ cursor: "pointer" }}>
                {user.name} <i className="fa-solid fa-pen" style={{ fontSize: 14, color: resolvedTheme.textSecondary, marginLeft: 4 }} />
              </ProfileName>
            )}
            <ProfileEmail>{user.email}</ProfileEmail>
            <ThemeToggleWrap>
              <ThemeToggleLabel>Appearance</ThemeToggleLabel>
              <ThemeToggle>
                <ThemeSegment $active={themePref === "system"} onClick={() => updateThemePref("system")}>System</ThemeSegment>
                <ThemeSegment $active={themePref === "light"} onClick={() => updateThemePref("light")}>Light</ThemeSegment>
                <ThemeSegment $active={themePref === "dark"} onClick={() => updateThemePref("dark")}>Dark</ThemeSegment>
              </ThemeToggle>
            </ThemeToggleWrap>
            {pushPrefs && (
              <PushSection>
                <ThemeToggleLabel>Push Notifications</ThemeToggleLabel>
                <PushRow onClick={(e) => { e.preventDefault(); pushPrefs.enabled ? unsubscribeFromPush() : subscribeToPush(); }}>
                  <PushRowLabel>Enable notifications</PushRowLabel>
                  <ToggleTrack $on={pushPrefs.enabled}><ToggleThumb $on={pushPrefs.enabled} /></ToggleTrack>
                </PushRow>
                {pushPrefs.enabled && (
                  <>
                    <PushRow onClick={(e) => { e.preventDefault(); updatePushPref("new_posts", !pushPrefs.new_posts); }}>
                      <PushRowLabel>New posts from friends</PushRowLabel>
                      <ToggleTrack $on={pushPrefs.new_posts}><ToggleThumb $on={pushPrefs.new_posts} /></ToggleTrack>
                    </PushRow>
                    <PushRow onClick={(e) => { e.preventDefault(); updatePushPref("mentions", !pushPrefs.mentions); }}>
                      <PushRowLabel>Mentions</PushRowLabel>
                      <ToggleTrack $on={pushPrefs.mentions}><ToggleThumb $on={pushPrefs.mentions} /></ToggleTrack>
                    </PushRow>
                    <PushRow onClick={(e) => { e.preventDefault(); updatePushPref("reactions", !pushPrefs.reactions); }}>
                      <PushRowLabel>Reactions</PushRowLabel>
                      <ToggleTrack $on={pushPrefs.reactions}><ToggleThumb $on={pushPrefs.reactions} /></ToggleTrack>
                    </PushRow>
                    <PushRow onClick={(e) => { e.preventDefault(); updatePushPref("comments", !pushPrefs.comments); }}>
                      <PushRowLabel>Comments on your posts</PushRowLabel>
                      <ToggleTrack $on={pushPrefs.comments}><ToggleThumb $on={pushPrefs.comments} /></ToggleTrack>
                    </PushRow>
                    <PushRow onClick={(e) => { e.preventDefault(); updatePushPref("replies", !pushPrefs.replies); }}>
                      <PushRowLabel>Replies in threads you're in</PushRowLabel>
                      <ToggleTrack $on={pushPrefs.replies}><ToggleThumb $on={pushPrefs.replies} /></ToggleTrack>
                    </PushRow>
                    <PushRow onClick={(e) => { e.preventDefault(); updatePushPref("sol_posts", !pushPrefs.sol_posts); }}>
                      <PushRowLabel>Sol's posts</PushRowLabel>
                      <ToggleTrack $on={pushPrefs.sol_posts}><ToggleThumb $on={pushPrefs.sol_posts} /></ToggleTrack>
                    </PushRow>
                  </>
                )}
              </PushSection>
            )}
            <PushSection>
              <ThemeToggleLabel>Games</ThemeToggleLabel>
              <PushRow onClick={(e) => { e.preventDefault(); const v = !gameLeaderboardOptOut; setGameLeaderboardOptOut(v); fetch("/api/profile/game-prefs", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leaderboard_opt_out: v }) }); }}>
                <PushRowLabel>Hide me from leaderboards</PushRowLabel>
                <ToggleTrack $on={gameLeaderboardOptOut}><ToggleThumb $on={gameLeaderboardOptOut} /></ToggleTrack>
              </PushRow>
            </PushSection>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
              <LogoutButton onClick={listsConnected ? () => { fetch("/api/lists/connect", { method: "DELETE" }).then(() => { setListsConnected(false); setListsSaved({}); setSavedPlacesData(null); setListsSavedLoaded(true); }); } : connectLists} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <img src="https://lists.fcc.lol/apple-touch-icon.png?v=2" alt="" style={{ width: 18, height: 18, borderRadius: 4 }} />
                {listsConnected ? "Disconnect Lists App account" : "Connect Lists App account"}
              </LogoutButton>
              <LogoutButton onClick={handleLogout} disabled={isBusy("logout")}>{isBusy("logout") ? <Spinner /> : "Log out"}</LogoutButton>
            </div>
          </ProfilePage>
        ) : tab === "feed" ? (
          <>
            <ComposeBox>
              <ComposeWrapper>
                <ComposeHighlight ref={composeHighlightRef}>{renderHighlight(compose)}</ComposeHighlight>
                <ComposeInput
                  ref={composeRef}
                  rows={3}
                  placeholder="What's on your mind?"
                  value={compose}
                  onChange={(e) => { const v = e.target.value; const fixed = fixMentionCasing(v); if (fixed !== v) { const pos = e.target.selectionStart + (fixed.length - v.length); e.target.value = fixed; e.target.setSelectionRange(pos, pos); } setCompose(fixed); handleMentionInput(fixed, "compose"); fetchOgPreview(fixed); }}
                  onScroll={(e) => { if (composeHighlightRef.current) composeHighlightRef.current.scrollTop = e.target.scrollTop; }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && e.metaKey) handlePost();
                  }}
                />
                {mentionQuery && mentionQuery.field === "compose" && (() => {
                  const filtered = mentionUsers.filter((u) => u.name.toLowerCase().includes(mentionQuery.query));
                  if (!filtered.length) return null;
                  return (
                    <MentionDropdown>
                      {filtered.map((u) => (
                        <MentionOption key={u.id} onMouseDown={(e) => { e.preventDefault(); insertMention(u.name, "compose"); }} onTouchStart={(e) => { e.target._touchY = e.touches[0].clientY; }} onTouchEnd={(e) => { if (Math.abs((e.changedTouches[0]?.clientY || 0) - (e.target._touchY || 0)) < 10) { e.preventDefault(); insertMention(u.name, "compose"); } }}>
                          <MentionAvatar style={{ backgroundImage: `url(${u.picture})` }} /> {u.name}
                        </MentionOption>
                      ))}
                    </MentionDropdown>
                  );
                })()}
              </ComposeWrapper>
              {prefillLoading && !prefillImageLoaded && (
                <div style={{ marginTop: 8, borderRadius: RADIUS, background: resolvedTheme.bgControl, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, color: resolvedTheme.textSecondary, fontSize: 14, fontWeight: 500, width: "100%", aspectRatio: (prefillLoading?.width && prefillLoading?.height) ? `${prefillLoading.width} / ${prefillLoading.height}` : "1", overflow: "hidden", outline: "2px solid rgba(0, 0, 0, 0.1)", outlineOffset: "-2px", boxSizing: "border-box" }}>
                  <Spinner size="28px" />
                  {prefillLoading?.source ? `Loading content from ${prefillLoading.source}...` : "Loading content..."}
                </div>
              )}
              {mediaPreviews.length > 0 && (!prefillLoading || prefillImageLoaded) && (
                <PostMediaContainer $count={mediaPreviews.length} $belowMedia={!!ogPreview || !!selectedLocation} style={{ marginTop: 8, ...(ogPreview || selectedLocation ? { marginBottom: "4px" } : {}) }}>
                  {(() => {
                    const previewBelowMedia = !!ogPreview || !!selectedLocation;
                    const previewRadiusStyle = mediaPreviews.length === 1 && previewBelowMedia ? { borderRadius: `${RADIUS} ${RADIUS} 4px 4px` } : undefined;
                    return mediaPreviews.map((preview, i) => (
                    <MediaPreview key={i}>
                      {preview.type === "video" ? (
                        <VideoWrap style={{ ...(preview.width && preview.height ? { aspectRatio: `${preview.width} / ${preview.height}` } : {}), ...previewRadiusStyle }}><PostVideo src={preview.url} autoPlay loop muted playsInline style={preview.width && preview.height ? { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" } : undefined} /></VideoWrap>
                      ) : (
                        <PostImage src={preview.url} $single={mediaPreviews.length === 1} style={previewRadiusStyle} />
                      )}
                      {mediaSources[i] === "mosaic" && <MosaicBadge href="https://mosaic.fcc.lol" target="_blank" rel="noopener noreferrer"><MosaicBadgeBg />Made with Mosaic <span style={{ opacity: 0.75, fontWeight: 400 }}>Try it <i className="fa-solid fa-arrow-right" style={{ fontSize: 11 }} /></span></MosaicBadge>}
                      {mediaSources[i] === "zap" && <MosaicBadge href="https://zap.fcc.lol" target="_blank" rel="noopener noreferrer"><MosaicBadgeBg />Made with Zap <span style={{ opacity: 0.75, fontWeight: 400 }}>Try it <i className="fa-solid fa-arrow-right" style={{ fontSize: 11 }} /></span></MosaicBadge>}
                      <RemoveMedia onClick={() => removeMedia(i)}><i className="fa-solid fa-xmark" /></RemoveMedia>
                    </MediaPreview>
                  ));
                  })()}
                </PostMediaContainer>
              )}
              {ogPreview && (
                <LinkPreviewCard as="div" $static style={{ cursor: "default", position: "relative", ...(mediaPreviews.length > 0 || selectedLocation ? { borderRadius: `${mediaPreviews.length > 0 ? "4px" : RADIUS} ${mediaPreviews.length > 0 ? "4px" : RADIUS} ${selectedLocation ? "4px" : RADIUS} ${selectedLocation ? "4px" : RADIUS}` } : {}), ...(selectedLocation ? { marginBottom: "4px" } : {}) }}>
                  {ogPreview.image && <LinkPreviewImageWrap className="link-image-wrap" style={mediaPreviews.length > 0 ? { borderRadius: "4px 4px 0 0" } : undefined}><LinkPreviewImage src={ogPreview.image} /></LinkPreviewImageWrap>}
                  <LinkPreviewBody className="link-body" $hasImage={!!ogPreview.image}>
                    {ogPreview.title && <LinkPreviewTitle>{ogPreview.title}</LinkPreviewTitle>}
                    {ogPreview.description && <LinkPreviewDesc>{ogPreview.description}</LinkPreviewDesc>}
                    {ogPreview.siteName && <LinkPreviewSite>{ogPreview.siteName}</LinkPreviewSite>}
                  </LinkPreviewBody>
                  <RemoveMedia onClick={() => { setOgPreview(null); ogFetchedUrl.current = "dismissed"; }}><i className="fa-solid fa-xmark" /></RemoveMedia>
                </LinkPreviewCard>
              )}
              {selectedLocation && (
                <PostLocation style={{ position: "relative" }}>
                  <PostMapWrapper className="map-wrapper" style={(mediaPreviews.length > 0 || ogPreview) ? { borderRadius: "4px 4px 0 0" } : undefined}>
                    <PostMap
                      src={`/api/staticmap?lat=${selectedLocation.lat}&lng=${selectedLocation.lng}&v=4`}
                      alt={selectedLocation.name}
                    />
                  </PostMapWrapper>
                  <PostPlaceName className="place-name">
                    <span>{selectedLocation.name}</span>
                    {selectedLocation.address && <PostPlaceAddress>{shortAddress(selectedLocation.address)}</PostPlaceAddress>}
                  </PostPlaceName>
                  <RemoveLocation onClick={() => setSelectedLocation(null)}>
                    <i className="fa-solid fa-xmark" />
                  </RemoveLocation>
                </PostLocation>
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
                  disabled={posting || (!compose.trim() && mediaFiles.length === 0 && !selectedLocation)}
                >
                  <span style={{ visibility: posting ? "hidden" : "visible" }}>Post</span>
                  {posting && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><Spinner /></div>}
                </PostButton>
              </ComposeActions>
            </ComposeBox>
            {followRequests.length > 0 && (
              <SuggestionsBox>
                <SectionTitle>Follow requests</SectionTitle>
                {followRequests.map((r) => (
                  <UserRow key={r.id}>
                    <UserInfo>
                      <UserAvatar style={{ backgroundImage: `url(${r.picture})`, '--tilt': randomTilt() }} />
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
              users.filter((u) => !u.is_following && u.follow_status !== "pending").length > 0 && (
              <SuggestionsBox>
                <SectionHeader $open={suggestionsOpen}>
                  <SectionTitle style={{ marginBottom: 0 }}>People you might know</SectionTitle>
                  <CollapseButton
                    onClick={() => setSuggestionsOpen((o) => !o)}
                    aria-label={suggestionsOpen ? "Collapse suggestions" : "Expand suggestions"}
                  >
                    <i className={`fa-solid fa-chevron-${suggestionsOpen ? "up" : "down"}`} />
                  </CollapseButton>
                </SectionHeader>
                {suggestionsOpen && users
                  .filter((u) => !u.is_following)
                  .map((u) => (
                    <UserRow key={u.id}>
                      <UserInfo>
                        <UserAvatar style={{ backgroundImage: `url(${u.picture})`, '--tilt': randomTilt() }} />
                        <UserName>{u.name}</UserName>
                      </UserInfo>
                      <FollowBtn user={u} onFollow={handleFollow} busy={isBusy(`follow-${u.id}`)} />
                    </UserRow>
                  ))}
              </SuggestionsBox>
            )}
            {posts.length === 0 ? (
              <EmptyState><BigSpinner /></EmptyState>
            ) : (
              posts.map((post) => renderPostCard(post))
            )}
            {feedLoadingMore && <EmptyState><BigSpinner /></EmptyState>}
          </>
        ) : tab === "user-profile" ? (
          viewingProfileLoading ? (
            <EmptyState><BigSpinner /></EmptyState>
          ) : viewingProfile ? (
            <>
              <UserProfileHeader>
                <UserProfileAvatar style={{ backgroundImage: `url(${viewingProfile.profile.picture})`, '--tilt': randomTilt() }} />
                <UserProfileName>{viewingProfile.profile.name}</UserProfileName>
                {(viewingProfile.profile.follows_you || viewingProfile.profile.is_following) && (
                  <PeopleCardStatus>
                    {viewingProfile.profile.follows_you && viewingProfile.profile.is_following ? "Friends" : viewingProfile.profile.follows_you ? "Follows you" : "Following"}
                  </PeopleCardStatus>
                )}
                <div style={{ marginTop: 24 }} />
                <FollowBtn
                  user={{
                    id: viewingProfile.profile.id,
                    follow_status: viewingProfile.profile.follow_status,
                    is_following: viewingProfile.profile.is_following,
                    follows_you: viewingProfile.profile.follows_you,
                  }}
                  onFollow={(id, status) => {
                    handleFollow(id, status);
                    // Refresh profile after follow action
                    setTimeout(() => loadUserProfile(viewingProfile.profile.id), 500);
                  }}
                  busy={isBusy(`follow-${viewingProfile.profile.id}`)}
                />
              </UserProfileHeader>
              {!viewingProfile.canViewPosts ? (
                <UserProfilePrivate>
                  <i className="fa-solid fa-lock" style={{ fontSize: 24, marginBottom: 12, display: "block" }} />
                  Follow {viewingProfile.profile.name} to see their posts
                </UserProfilePrivate>
              ) : viewingProfile._postsLoading ? (
                <EmptyState><BigSpinner /></EmptyState>
              ) : viewingProfile.posts.length === 0 ? (
                <EmptyState>No posts yet</EmptyState>
              ) : (
                viewingProfile.posts.map((post) => renderPostCard(post, { disableProfileLink: true }))
              )}
            </>
          ) : null
        ) : (
          <>
            <SegmentedControl style={{ marginBottom: 8 }}>
              <Segment $active={peopleFilter === "friends"} onClick={() => setPeopleFilter("friends")}>Friends</Segment>
              <Segment $active={peopleFilter === "fof"} onClick={() => setPeopleFilter("fof")}>Connected</Segment>
              <Segment $active={peopleFilter === "all"} onClick={() => setPeopleFilter("all")}>Everyone</Segment>
            </SegmentedControl>
            <FilterDescription>
              {peopleFilter === "friends" && "Mutual followers"}
              {peopleFilter === "fof" && "One-way followers"}
              {peopleFilter === "all" && "Everyone on Cloud"}
            </FilterDescription>
            <PeopleGrid $compact={peopleFilter === "friends"}>
              {users.length === 0 ? (
                <EmptyState style={{ gridColumn: "1 / -1" }}>No other users yet</EmptyState>
              ) : (
                users
                  .filter((u) => peopleFilter === "all" || (peopleFilter === "friends" && connectionDegrees[u.id] === 1) || (peopleFilter === "fof" && connectionDegrees[u.id] === 2))
                  .map((u) => (
                  <PeopleCard key={u.id} onClick={() => loadUserProfile(u.id)} style={{ cursor: "pointer" }}>
                    <PeopleCardAvatar style={{ backgroundImage: `url(${u.picture})`, '--tilt': randomTilt() }} />
                    <div style={{ maxWidth: "100%", overflow: "hidden" }}>
                      <PeopleCardName>{u.name.includes(" ") ? u.name.split(" ")[0] : u.name}</PeopleCardName>
                      {peopleFilter !== "friends" && (u.follows_you || !!u.is_following) && (
                        <PeopleCardStatus>
                          {u.follows_you && u.is_following ? "Friends" : u.follows_you ? "Follows you" : "Following"}
                        </PeopleCardStatus>
                      )}
                    </div>
                  </PeopleCard>
                ))
              )}
            </PeopleGrid>
          </>
        )}
      </Content>
    </Page>
    </ThemeProvider>
    </ThemePrefContext.Provider>
  );
}

export default App;
