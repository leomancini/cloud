import React, { useState, useEffect, useRef } from "react";
import styled from "styled-components";

const Page = styled.div`
  min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
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
  border-radius: 8px;
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
  border-radius: 8px;
  padding: 3px;
`;

const Segment = styled.button`
  padding: 6px 16px;
  border-radius: 6px;
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
  border-radius: 8px;
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
  border-bottom: 1px solid #eee;
  padding-bottom: 24px;
`;

const ComposeInput = styled.textarea`
  width: 100%;
  border: 1px solid #eee;
  border-radius: 12px;
  padding: 14px;
  font-size: 16px;
  font-family: inherit;
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
  border-radius: 8px;
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
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 16px;
  font-family: inherit;
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
  border: 1px solid #eee;
  border-radius: 8px;
  margin-top: 4px;
  z-index: 10;
  overflow: hidden;
`;

const LocationResult = styled.div`
  padding: 10px 12px;
  cursor: pointer;
  border-bottom: 1px solid #f5f5f5;

  &:last-child {
    border-bottom: none;
  }

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
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding: 8px 12px;
  background: #f5f5f5;
  border-radius: 8px;
  font-size: 13px;
  color: #333;
`;

const RemoveLocation = styled.button`
  margin-left: auto;
  border: none;
  background: none;
  color: #999;
  cursor: pointer;
  font-size: 16px;
  padding: 0 4px;
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
  width: 80px;
  height: 80px;
  border-radius: 8px;
  overflow: hidden;
`;

const PreviewImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const PreviewVideo = styled.video`
  width: 100%;
  height: 100%;
  object-fit: cover;
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
  border-radius: 10px;
  overflow: hidden;
`;

const PostImage = styled.img`
  width: 100%;
  display: block;
  border-radius: 10px;
`;

const PostVideo = styled.video`
  width: 100%;
  display: block;
  border-radius: 10px;
`;

const PostButton = styled.button`
  padding: 8px 20px;
  border-radius: 8px;
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
  border-bottom: 1px solid #eee;
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

const PostContent = styled.p`
  font-size: 15px;
  color: #333;
  margin: 0;
  line-height: 1.5;
  white-space: pre-wrap;
`;

const PostLocation = styled.div`
  margin-top: 10px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid #eee;
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
  color: #333;
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
  border-bottom: 1px solid #eee;
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
  border-radius: 8px;
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

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr + "Z")) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
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
                  <span><i className="fa-solid fa-location-dot" /> {selectedLocation.name}</span>
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
            {posts.length === 0 ? (
              <EmptyState>No posts yet. Follow people to see their posts!</EmptyState>
            ) : (
              posts.map((post) => (
                <PostItem key={post.id}>
                  <PostHeader>
                    <Avatar src={post.author_picture} alt={post.author_name} />
                    <PostAuthor>{post.author_name}</PostAuthor>
                    <PostTime>{timeAgo(post.created_at)}</PostTime>
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
                      <PostMap
                        src={`https://maps.googleapis.com/maps/api/staticmap?center=${post.place_lat},${post.place_lng}&zoom=15&size=500x150&scale=2&markers=color:red|${post.place_lat},${post.place_lng}&key=***REMOVED***`}
                        alt={post.place_name}
                      />
                      <PostPlaceName><i className="fa-solid fa-location-dot" /> {post.place_name}</PostPlaceName>
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
