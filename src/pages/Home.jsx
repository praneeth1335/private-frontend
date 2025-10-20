import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import NetworkInfo from "../components/NetworkInfo";

export default function Home() {
  const [username, setUsername] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "dark");
  const navigate = useNavigate();

  // Theme persistence
  useEffect(() => {
    document.body.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

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

  const wakeUpServer = () => {
    window.open("https://private-backend-k0py.onrender.com/", "_blank");
  };

  return (
    <div className="home-container">
      <button onClick={toggleTheme} className="theme-toggle-btn">
        {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
      </button>
      <div className="join-card">
        <h1>🔒 Secure Chat</h1>
        <p className="subtitle">Private, encrypted room conversations</p>

        {/* Server Wake-up Notice */}
        <div className="server-wakeup-notice">
          <div className="server-wakeup-icon">⚠️</div>
          <div className="server-wakeup-content">
            <h3>Server May Be Asleep</h3>
            <p>
              The backend server might be in sleep mode. If you see "Cannot GET
              /" or connection issues, please wake it up first!
            </p>
            <div className="server-wakeup-instructions">
              <p>
                <strong>Instructions:</strong>
              </p>
              <ol>
                <li>Click the button below to wake up the server</li>
                <li>Wait until you see "Cannot GET /" page</li>
                <li>Come back here and join your chat room</li>
                <li>Server stays active for 15 minutes after waking</li>
              </ol>
            </div>
            <button onClick={wakeUpServer} className="wake-up-server-btn">
              🚀 Wake Up Server Now
            </button>
          </div>
        </div>

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
            {isLoading ? (
              <div className="loading-spinner"></div>
            ) : (
              <>
                <span className="join-icon">🚀</span> Join Secure Room
              </>
            )}
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
