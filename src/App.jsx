import React, { useState, useEffect } from "react";
import styled from "styled-components";

const Page = styled.div`
  min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: #f5f5f5;
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
  background: white;
  border-radius: 16px;
  padding: 40px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  text-align: center;
  min-width: 300px;
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
  background: #333;
  color: white;

  &:hover {
    background: #555;
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

const UserList = styled.div`
  max-width: 500px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const UserRow = styled.div`
  background: white;
  border-radius: 12px;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
`;

const UserInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const Avatar = styled.img`
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
  border: 1px solid ${(p) => (p.$following ? "#ddd" : "#333")};
  background: ${(p) => (p.$following ? "white" : "#333")};
  color: ${(p) => (p.$following ? "#666" : "white")};

  &:hover {
    background: ${(p) => (p.$following ? "#f5f5f5" : "#555")};
  }
`;

const EmptyState = styled.p`
  text-align: center;
  color: #999;
  font-size: 15px;
  margin-top: 40px;
`;

function App() {
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        setUser(data.user);
        setLoading(false);
        if (data.user) loadUsers();
      });
  }, []);

  const loadUsers = () => {
    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => setUsers(data.users));
  };

  const handleFollow = async (id, isFollowing) => {
    const endpoint = isFollowing ? `/api/unfollow/${id}` : `/api/follow/${id}`;
    await fetch(endpoint, { method: "POST" });
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id ? { ...u, is_following: isFollowing ? 0 : 1 } : u
      )
    );
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setUsers([]);
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
        <LogoutButton onClick={handleLogout}>Sign out</LogoutButton>
      </Header>
      <UserList>
        {users.length === 0 ? (
          <EmptyState>No other users yet</EmptyState>
        ) : (
          users.map((u) => (
            <UserRow key={u.id}>
              <UserInfo>
                <Avatar src={u.picture} alt={u.name} />
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
    </Page>
  );
}

export default App;
