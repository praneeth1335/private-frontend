import { useState } from "react";
import { useNavigate } from "react-router-dom";
import NetworkInfo from "../components/NetworkInfo";

export default function Home() {
  const [username, setUsername] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleJoin = async (e) => {
    e.preventDefault();

    if (!username.trim() || !roomCode.trim()) {
      alert("Please enter both username and room code");
      return;
    }

    if (username.length > 20 || roomCode.length > 20) {
      alert("Username and room code must be less than 20 characters");
      return;
    }

    setIsLoading(true);

    try {
      const sanitizedUsername = username.trim().substring(0, 20);
      const sanitizedRoomCode = roomCode.trim().substring(0, 20);

      localStorage.setItem("username", sanitizedUsername);
      navigate(`/chat/${encodeURIComponent(sanitizedRoomCode)}`);
    } catch (error) {
      console.error("Navigation error:", error);
      alert("Failed to join room. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="home-container">
      <div className="join-card">
        <h1>🔒 Secure Chat</h1>
        <p className="subtitle">Private, encrypted room conversations</p>

        <form onSubmit={handleJoin} className="input-group">
          <div className="input-field">
            <div className="icon">👤</div>
            <input
              type="text"
              placeholder="Enter your name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={20}
              required
              disabled={isLoading}
            />
          </div>

          <div className="input-field">
            <div className="icon">🔑</div>
            <input
              type="text"
              placeholder="Enter room code"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              maxLength={20}
              required
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            className={`join-btn ${isLoading ? "loading" : ""}`}
            disabled={isLoading}
          >
            {isLoading ? "Joining..." : "Join Secure Room"}
          </button>
        </form>

        <div className="security-notice">
          <p>🔒 Your privacy is protected with:</p>
          <div className="security-features">
            <span className="feature-tag">End-to-End Encryption</span>
            <span className="feature-tag">No Message Storage</span>
            <span className="feature-tag">Secure WebSockets</span>
          </div>
        </div>
      </div>
      {import.meta.env.DEV && <NetworkInfo />}
      <div className="developer-credit">Developed by B Sai Praneeth</div>
    </div>
  );
}
