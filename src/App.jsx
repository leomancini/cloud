import React, { useState, useEffect, useRef } from "react";
import styled from "styled-components";

const RADIUS = "10px";
const RADIUS_SM = "6px";
const BORDER = "#eee";
const TEXT = "#333";
const TEXT_SECONDARY = "#999";
const ICON_GAP = "8px";

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

  &:focus {
    border-color: #ccc;
  }
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
  border-radius: ${RADIUS};
  overflow: hidden;
`;

const PostImage = styled.img`
  width: 100%;
  display: block;
  border-radius: ${RADIUS};
`;

const PostVideo = styled.video`
  width: 100%;
  display: block;
  border-radius: ${RADIUS};
`;

const PostButton = styled.button`
  padding: 8px 20px;
  border-radius: ${RADIUS};
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  background: black;
  color: white;

  &:hover {
    background: #222;
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
  margin-bottom: 8px;
`;

const Avatar = styled.img`
  width: 36px;
  height: 36px;
  border-radius: 50%;
`;

const PostAuthor = styled.span`
  font-size: 14px;
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
  line-height: 1.5;
  white-space: pre-wrap;
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

const FollowButton = styled.button`
  padding: 8px 18px;
  border-radius: ${RADIUS};
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid ${(p) => (p.$following ? "#ddd" : "black")};
  background: ${(p) => (p.$following ? "white" : "black")};
  color: ${(p) => (p.$following ? "#666" : "white")};

  &:hover {
    background: ${(p) => (p.$following ? "#f5f5f5" : "#222")};
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

const SuggestionsTitle = styled.div`
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
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 8) return `${hours}h ago`;
  return date.toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function App() {
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [tab, setTab] = useState("feed");
  const [compose, setCompose] = useState("");
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
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
        }
      });
  }, []);

  const loadFeed = () => {
    fetch("/api/feed")
      .then((res) => res.json())
      .then((data) => setPosts(data.posts));
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

  const handleMediaSelect = (e) => {
    const files = Array.from(e.target.files);
    setMediaFiles((prev) => [...prev, ...files]);
    const newPreviews = files.map((file) => ({
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
    if (!compose.trim() && mediaFiles.length === 0) return;
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
    setSelectedLocation(null);
    mediaPreviews.forEach((p) => URL.revokeObjectURL(p.url));
    setMediaFiles([]);
    setMediaPreviews([]);
    loadFeed();
  };

  const handleDelete = async (id) => {
    setOpenMenuId(null);
    await fetch(`/api/posts/${id}`, { method: "DELETE" });
    setPosts((prev) => prev.filter((p) => p.id !== id));
  };

  const handleFollow = async (id, isFollowing) => {
    const endpoint = isFollowing ? `/api/unfollow/${id}` : `/api/follow/${id}`;
    await fetch(endpoint, { method: "POST" });
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id ? { ...u, is_following: isFollowing ? 0 : 1 } : u
      )
    );
    loadFeed();
  };

  const handleLogout = async () => {
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
              <Segment $active={tab === "people"} onClick={() => setTab("people")}>
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
            <LogoutButton onClick={handleLogout}>Log out</LogoutButton>
          </ProfilePage>
        ) : tab === "feed" ? (
          <>
            <ComposeBox>
              <ComposeInput
                rows={3}
                placeholder="What's on your mind?"
                value={compose}
                onChange={(e) => setCompose(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.metaKey) handlePost();
                }}
              />
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
                  disabled={!compose.trim() && mediaFiles.length === 0}
                >
                  Post
                </PostButton>
              </ComposeActions>
            </ComposeBox>
            {users.filter((u) => u.is_following).length < 5 &&
              users.filter((u) => !u.is_following).length > 0 && (
              <SuggestionsBox>
                <SuggestionsTitle>People you might know</SuggestionsTitle>
                {users
                  .filter((u) => !u.is_following)
                  .map((u) => (
                    <UserRow key={u.id}>
                      <UserInfo>
                        <UserAvatar src={u.picture} alt={u.name} />
                        <UserName>{u.name}</UserName>
                      </UserInfo>
                      <FollowButton
                        $following={false}
                        onClick={() => handleFollow(u.id, u.is_following)}
                      >
                        Follow
                      </FollowButton>
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
                    <PostAuthor>{post.author_name}</PostAuthor>
                    <PostTime>{timeAgo(post.created_at)}</PostTime>
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
                  {post.content && <PostContent>{post.content}</PostContent>}
                  {post.media && post.media.length > 0 && (
                    <PostMediaContainer>
                      {post.media.map((m, i) =>
                        m.type === "video" ? (
                          <PostVideo
                            key={i}
                            src={m.url}
                            autoPlay
                            loop
                            muted
                            playsInline
                          />
                        ) : (
                          <PostImage key={i} src={m.url} />
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
                </PostItem>
              ))
            )}
          </>
        ) : (
          <UserList>
            {users.length === 0 ? (
              <EmptyState>No other users yet</EmptyState>
            ) : (
              users.map((u) => (
                <UserRow key={u.id}>
                  <UserInfo>
                    <UserAvatar src={u.picture} alt={u.name} />
                    <UserName>{u.name}</UserName>
                  </UserInfo>
                  <FollowButton
                    $following={u.is_following}
                    onClick={() => handleFollow(u.id, u.is_following)}
                  >
                    {u.is_following ? "Following" : "Follow"}
                  </FollowButton>
                </UserRow>
              ))
            )}
          </UserList>
        )}
      </Content>
    </Page>
  );
}

export default App;
