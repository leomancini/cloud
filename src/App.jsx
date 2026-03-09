import React, { useState, useEffect } from "react";
import styled from "styled-components";

const Page = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: #f5f5f5;
`;

const Card = styled.div`
  background: white;
  border-radius: 16px;
  padding: 40px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  text-align: center;
  min-width: 300px;
`;

const Avatar = styled.img`
  width: 80px;
  height: 80px;
  border-radius: 50%;
  margin-bottom: 16px;
`;

const Name = styled.h1`
  font-size: 22px;
  color: #333;
  margin: 0 0 4px;
`;

const Email = styled.p`
  font-size: 14px;
  color: #888;
  margin: 0 0 24px;
`;

const Button = styled.a`
  display: inline-block;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
  border: none;
  background: #333;
  color: white;

  &:hover {
    background: #555;
  }
`;

const LogoutButton = styled.button`
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  border: 1px solid #ddd;
  background: white;
  color: #666;

  &:hover {
    background: #f5f5f5;
  }
`;

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        setUser(data.user);
        setLoading(false);
      });
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  };

  if (loading) return null;

  return (
    <Page>
      <Card>
        {user ? (
          <>
            <Avatar src={user.picture} alt={user.name} />
            <Name>{user.name}</Name>
            <Email>{user.email}</Email>
            <LogoutButton onClick={handleLogout}>Sign out</LogoutButton>
          </>
        ) : (
          <>
            <Name style={{ marginBottom: 24 }}>Cloud</Name>
            <Button href="/api/auth/google">Sign in with Google</Button>
          </>
        )}
      </Card>
    </Page>
  );
}

export default App;
