import React, { useState, useEffect } from "react";
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

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
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

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const NavButton = styled.button`
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  border: 1px solid ${(p) => (p.$active ? "black" : "#ddd")};
  background: ${(p) => (p.$active ? "black" : "white")};
  color: ${(p) => (p.$active ? "white" : "#666")};

  &:hover {
    background: ${(p) => (p.$active ? "#222" : "#f5f5f5")};
  }
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
  font-size: 15px;
  font-family: inherit;
  resize: none;
  outline: none;
  box-sizing: border-box;

  &:focus {
    border-color: #ccc;
  }
`;

const PostButton = styled.button`
  margin-top: 10px;
  padding: 8px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  background: black;
  color: white;
  float: right;

  &:hover {
    background: #222;
  }

  &:disabled {
    background: #ccc;
    cursor: default;
  }
`;

const ClearFix = styled.div`
  clear: both;
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
  width: 44px;
  height: 44px;
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

  const handlePost = async () => {
    if (!compose.trim()) return;
    await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: compose }),
    });
    setCompose("");
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
          <SignInButton href="/api/auth/google">Sign in with Google</SignInButton>
        </LoginCard>
      </Page>
    );
  }

  return (
    <Page>
      <Header>
        <HeaderLeft>
          <SmallAvatar src={user.picture} alt={user.name} />
          <HeaderName>{user.name}</HeaderName>
        </HeaderLeft>
        <HeaderRight>
          <NavButton $active={tab === "feed"} onClick={() => setTab("feed")}>
            Feed
          </NavButton>
          <NavButton $active={tab === "people"} onClick={() => setTab("people")}>
            People
          </NavButton>
          <LogoutButton onClick={handleLogout}>Sign out</LogoutButton>
        </HeaderRight>
      </Header>
      <Content>
        {tab === "feed" ? (
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
              <PostButton onClick={handlePost} disabled={!compose.trim()}>
                Post
              </PostButton>
              <ClearFix />
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
                  <PostContent>{post.content}</PostContent>
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
