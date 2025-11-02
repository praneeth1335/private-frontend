import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import NetworkInfo from "../components/NetworkInfo";

export default function Home() {
  const [username, setUsername] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [theme, setTheme] = useState(
    localStorage.getItem("premium-chat-theme") || "dark"
  );
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
    if (!username.trim() || !roomCode.trim()) {
      showToast("Please enter both name and room code", "error");
      return;
    }

    setIsLoading(true);
    try {
      const sanitizedUsername = username.trim().substring(0, 20);
      const sanitizedRoomCode = roomCode.trim().substring(0, 20);
      localStorage.setItem("username", sanitizedUsername);

      await new Promise((resolve) => setTimeout(resolve, 300));
      navigate(`/chat/${encodeURIComponent(sanitizedRoomCode)}`);
    } catch (error) {
      console.error("Navigation error:", error);
      showToast("Failed to join room", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const wakeUpServer = () => {
    showToast("Waking up server...", "info");
    const newWindow = window.open(
      "https://private-backend-k0py.onrender.com/health",
      "_blank",
      "noopener,noreferrer"
    );
    if (newWindow) newWindow.opener = null;
  };

  const showToast = (message, type = "info") => {
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
            <span>Server may be at sleep, Wake it up!</span>
          </div>
          <button
            onClick={wakeUpServer}
            className="btn btn-secondary btn-small"
          >
            ⚡ Refresh
          </button>
        </div>

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
                placeholder="Room code"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                maxLength={20}
                required
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary join-btn compact"
              disabled={isLoading || !username.trim() || !roomCode.trim()}
            >
              {isLoading ? (
                <>
                  <div className="loading-spinner"></div>
                  Connecting...
                </>
              ) : (
                <>🚀 Join Chat</>
              )}
            </button>
          </div>
        </form>

        <div className="feature-highlights">
          <div className="feature-item">
            <span className="feature-icon">🌊</span>
            <div className="feature-text">
              <strong>Flow Like Water</strong>
              <span>Real-time messaging</span>
            </div>
          </div>
          <div className="feature-item">
            <span className="feature-icon">🛡️</span>
            <div className="feature-text">
              <strong>Privacy First</strong>
              <span>Secure conversations</span>
            </div>
          </div>
          <div className="feature-item">
            <span className="feature-icon">⚡</span>
            <div className="feature-text">
              <strong>Instant</strong>
              <span>No delays</span>
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
        </div>
      </div>

      {import.meta.env.DEV}
    </div>
  );
}
