import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import NetworkInfo from "../components/NetworkInfo";
import { getServerUrl } from "../utils/getServerUrl";

export default function Home() {
  const [username, setUsername] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [theme, setTheme] = useState(
    localStorage.getItem("premium-chat-theme") || "dark"
  );
  const [showRoomOptions, setShowRoomOptions] = useState(false);
  const [isPersistent, setIsPersistent] = useState(false);
  const [persistenceDays, setPersistenceDays] = useState(7);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    document.body.setAttribute("data-theme", theme);
    localStorage.setItem("premium-chat-theme", theme);
  }, [theme]);

  useEffect(() => {
    const quotes = document.querySelectorAll(".quote-slide");
    let currentQuote = 0;

    const rotateQuotes = () => {
      quotes.forEach((quote) => {
        quote.classList.remove("active");
      });

      if (quotes[currentQuote]) {
        quotes[currentQuote].classList.add("active");
      }

      currentQuote = (currentQuote + 1) % quotes.length;
    };

    if (quotes.length > 0) {
      quotes[0].classList.add("active");
      const interval = setInterval(rotateQuotes, 4000);
      return () => clearInterval(interval);
    }
  }, []);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!username.trim()) {
      showToast("Please enter your name", "error");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const sanitizedUsername = username.trim().substring(0, 20);
      const sanitizedRoomCode = roomCode.trim().toUpperCase().substring(0, 20);

      localStorage.setItem("username", sanitizedUsername);

      const serverUrl = getServerUrl();

      // Test the connection first
      try {
        const testResponse = await fetch(`${serverUrl}/health`);
        if (!testResponse.ok) {
          throw new Error("Server is not responding");
        }
      } catch (testError) {
        setError(
          "Cannot connect to server. Please check if the server is running."
        );
        showToast("Cannot connect to server", "error");
        setIsLoading(false);
        return;
      }

      let requestBody;
      let finalRoomCode = sanitizedRoomCode;

      if (sanitizedRoomCode) {
        // Join existing room
        requestBody = {
          code: sanitizedRoomCode,
          username: sanitizedUsername,
          createNew: false,
        };
      } else {
        // Create new room
        requestBody = {
          username: sanitizedUsername,
          createNew: true,
          isPersistent: isPersistent,
          persistenceDays: persistenceDays,
        };
      }

      console.log("📤 Sending request to server:", requestBody);

      const response = await fetch(`${serverUrl}/api/rooms/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (response.ok) {
        console.log("✅ Room join successful:", data);
        finalRoomCode = sanitizedRoomCode || data.room.code;

        // Store room info in localStorage for the chat room to use
        localStorage.setItem("currentRoom", finalRoomCode);
        localStorage.setItem("userRole", data.userRole);
        localStorage.setItem("isPersistent", data.room.isPersistent.toString());
        localStorage.setItem(
          "persistenceDays",
          data.room.persistenceDays.toString()
        );
        localStorage.setItem("createdBy", data.room.createdBy);

        showToast(
          sanitizedRoomCode
            ? "Joined room successfully!"
            : "Room created successfully!",
          "success"
        );
        navigate(`/chat/${encodeURIComponent(finalRoomCode)}`);
      } else {
        setError(data.msg || "Failed to join room");
        showToast(data.msg || "Failed to join room", "error");
      }
    } catch (error) {
      console.error("❌ Navigation error:", error);
      setError("Connection error: " + error.message);
      showToast("Connection error: " + error.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const wakeUpServer = () => {
    showToast("Waking up server...", "info");
    const serverUrl = getServerUrl();
    const newWindow = window.open(
      `${serverUrl}/health`,
      "_blank",
      "noopener,noreferrer"
    );
    if (newWindow) newWindow.opener = null;
  };

  const showToast = (message, type = "info") => {
    // Remove existing toasts
    const existingToasts = document.querySelectorAll(".toast");
    existingToasts.forEach((toast) => toast.remove());

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
            <span class="toast-icon">${
              type === "error" ? "⚠️" : type === "success" ? "✅" : "ℹ️"
            }</span>
            <span class="toast-content">${message}</span>
        `;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-10px)";
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  };

  return (
    <div className="home-container">
      <button
        onClick={toggleTheme}
        className="btn btn-icon theme-toggle-btn"
        aria-label="Toggle theme"
      >
        {theme === "dark" ? "☀️" : "🌙"}
      </button>

      <div className="home-card">
        <div className="home-header">
          <div className="home-logo">💬</div>
          <h1 className="home-title">The Vanishing Point</h1>
          <p className="home-subtitle">Where every word fades into silence</p>
        </div>

        <div className="inspirational-quotes">
          <div className="quote-slide active">
            Conversations that disappear — just like they should.
          </div>
          <div className="quote-slide">
            No history. No trace. Just presence.
          </div>
          <div className="quote-slide">Talk freely. Leave nothing behind.</div>
          <div className="quote-slide">
            The safest chat is the one that vanishes.
          </div>
        </div>

        <div className="server-status">
          <div className="status-indicator">
            <div className="status-dot"></div>
            <span>Server may be asleep, Wake it up!</span>
          </div>
          <button
            onClick={wakeUpServer}
            className="btn btn-secondary btn-small"
          >
            🔄 Refresh
          </button>
        </div>

        {error && (
          <div
            className="error-banner"
            style={{
              background: "rgba(239, 68, 68, 0.1)",
              color: "var(--danger)",
              padding: "0.75rem",
              borderRadius: "var(--radius-md)",
              marginBottom: "var(--space-md)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              fontSize: "0.9rem",
            }}
          >
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleJoin} className="horizontal-form">
          <div className="form-row">
            <div className="input-field compact">
              <input
                type="text"
                className="input"
                placeholder="Your name"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={20}
                required
                disabled={isLoading}
              />
            </div>

            <div className="input-field compact">
              <input
                type="text"
                className="input"
                placeholder="Room code (leave empty for new)"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                maxLength={20}
                disabled={isLoading}
              />
            </div>

            {!roomCode && (
              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={() => setShowRoomOptions(!showRoomOptions)}
                disabled={isLoading}
                title="Room options"
              >
                ⚙️
              </button>
            )}

            <button
              type="submit"
              className="btn btn-primary join-btn compact"
              disabled={isLoading || !username.trim()}
            >
              {isLoading ? (
                <>
                  <div className="loading-spinner"></div>
                  {roomCode ? "Joining..." : "Creating..."}
                </>
              ) : roomCode ? (
                "Join Chat"
              ) : (
                "Create Room"
              )}
            </button>
          </div>

          {showRoomOptions && !roomCode && (
            <div className="room-options">
              <div className="option-row">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={isPersistent}
                    onChange={(e) => setIsPersistent(e.target.checked)}
                    disabled={isLoading}
                  />
                  <span>Persistent Chat</span>
                </label>

                {isPersistent && (
                  <select
                    value={persistenceDays}
                    onChange={(e) => setPersistenceDays(Number(e.target.value))}
                    className="persistence-select"
                    disabled={isLoading}
                  >
                    <option value={1}>1 day</option>
                    <option value={7}>7 days</option>
                    <option value={30}>30 days</option>
                    <option value={90}>90 days</option>
                  </select>
                )}
              </div>
              <p className="option-hint">
                {isPersistent
                  ? `Chat will be saved for ${persistenceDays} day${
                      persistenceDays > 1 ? "s" : ""
                    }`
                  : "Chat messages will disappear after 7 days"}
              </p>
            </div>
          )}
        </form>

        <div className="feature-highlights">
          <div className="feature-item">
            <span className="feature-icon">💬</span>
            <div className="feature-text">
              <strong>Real-time Chat</strong>
              <span>Instant messaging</span>
            </div>
          </div>
          <div className="feature-item">
            <span className="feature-icon">🔒</span>
            <div className="feature-text">
              <strong>Privacy First</strong>
              <span>Secure conversations</span>
            </div>
          </div>
          <div className="feature-item">
            <span className="feature-icon">📁</span>
            <div className="feature-text">
              <strong>File Sharing</strong>
              <span>Share images & files</span>
            </div>
          </div>
        </div>

        <div className="mindful-moment">
          <div className="mindful-icon">🌿</div>
          <p className="mindful-text">
            A quiet corner for meaningful conversation.
          </p>
        </div>

        <div className="home-footer">
          <div className="home-credit">
            Crafted with excellence by B Sai Praneeth
          </div>
          <NetworkInfo />
        </div>
      </div>
    </div>
  );
}
