import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import Message from "../components/Message";
import { getServerUrl } from "../utils/getServerUrl";

export default function ChatRoom() {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState("");
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [isTyping, setIsTyping] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [serverInfo, setServerInfo] = useState("");

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const socketRef = useRef(null);
  const username = localStorage.getItem("username");

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!username) {
      navigate("/");
      return;
    }

    setIsLoading(true);

    const socketUrl = "https://private-backend-k0py.onrender.com";
    console.log(`🔗 Connecting to server: ${socketUrl}`);
    setServerInfo(`Connecting to: ${socketUrl.replace("http://", "")}`);

    const newSocket = io("https://private-backend-k0py.onrender.com", {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socketRef.current = newSocket;

    newSocket.on("connect", () => {
      console.log("✅ Connected to server");
      setIsConnected(true);
      setError("");
      setServerInfo(`Connected to: ${socketUrl.replace("http://", "")}`);
      setIsLoading(false);
      newSocket.emit("joinRoom", {
        username: username,
        roomCode: roomCode,
      });
    });

    newSocket.on("disconnect", (reason) => {
      console.log("❌ Disconnected from server:", reason);
      setIsConnected(false);
      setServerInfo(`Disconnected: ${reason}`);

      if (reason === "io server disconnect") {
        setError("Server disconnected you. Please refresh the page.");
      }
    });

    newSocket.on("connect_error", (error) => {
      console.error("Connection error:", error);

      let errorMessage = "Failed to connect to chat server. ";

      if (error.message.includes("ECONNREFUSED")) {
        errorMessage += `Make sure the server is running at ${socketUrl}`;
      } else if (error.message.includes("timeout")) {
        errorMessage += "Connection timeout. Check your network.";
      } else {
        errorMessage += error.message;
      }

      setError(errorMessage);
      setIsConnected(false);
      setIsLoading(false);
    });

    newSocket.on("reconnect_attempt", (attempt) => {
      console.log(`🔄 Reconnection attempt ${attempt}`);
      setError(`Reconnecting... (Attempt ${attempt}/10)`);
    });

    newSocket.on("reconnect", () => {
      console.log("✅ Reconnected to server");
      setError("");
      setIsConnected(true);
      newSocket.emit("joinRoom", {
        username: username,
        roomCode: roomCode,
      });
    });

    newSocket.on("reconnect_failed", () => {
      console.error("❌ Reconnection failed");
      setError("Failed to reconnect. Please refresh the page.");
    });

    newSocket.on("error", (errorMsg) => {
      setError(errorMsg);
      setTimeout(() => setError(""), 5000);
    });

    newSocket.on("loadMessages", (msgList) => {
      setMessages(msgList || []);
      setIsLoading(false);
    });

    newSocket.on("message", (msgData) => {
      setMessages((prev) => [...prev, msgData]);
    });

    newSocket.on("systemMessage", (sysMsg) => {
      setMessages((prev) => [...prev, sysMsg]);
    });

    newSocket.on("roomUsers", (userList) => {
      setUsers(userList || []);
    });

    newSocket.on("userTyping", (typingUsername) => {
      setTypingUsers((prev) => {
        const newSet = new Set(prev);
        newSet.add(typingUsername);
        return newSet;
      });
    });

    newSocket.on("userStoppedTyping", (stoppedUsername) => {
      setTypingUsers((prev) => {
        const newSet = new Set(prev);
        newSet.delete(stoppedUsername);
        return newSet;
      });
    });

    setSocket(newSocket);

    const handleBeforeUnload = () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [roomCode, username, navigate]);

  const handleSendMessage = (e) => {
    e.preventDefault();

    if (!newMessage.trim() || !socket || !isConnected) return;

    const messageToSend = newMessage.trim().substring(0, 1000);
    socket.emit("sendMessage", messageToSend);
    setNewMessage("");

    setIsTyping(false);
    socket.emit("typingStop");

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleTyping = () => {
    if (!socket || !isConnected) return;

    if (!isTyping) {
      setIsTyping(true);
      socket.emit("typingStart");
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socket.emit("typingStop");
    }, 1000);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  const handleLeaveRoom = () => {
    if (socket) {
      socket.close();
    }
    localStorage.removeItem("username");
    navigate("/");
  };

  const handleReconnect = () => {
    if (socketRef.current) {
      socketRef.current.connect();
    }
  };

  const getTypingText = () => {
    const typingArray = Array.from(typingUsers);
    if (typingArray.length === 0) return "";
    if (typingArray.length === 1) return `${typingArray[0]} is typing...`;
    if (typingArray.length === 2)
      return `${typingArray[0]} and ${typingArray[1]} are typing...`;
    return `${typingArray[0]} and ${
      typingArray.length - 1
    } others are typing...`;
  };

  const formatUserCount = () => {
    return `${users.length} ${users.length === 1 ? "user" : "users"} online`;
  };

  const renderLoadingSkeletons = () => {
    return Array.from({ length: 5 }).map((_, index) => (
      <div
        key={index}
        className="message skeleton"
        style={{ height: "60px", marginBottom: "1rem" }}
      ></div>
    ));
  };

  return (
    <div className="chat-container">
      <div
        className={`connection-status ${
          isConnected ? "connected" : "disconnected"
        }`}
      >
        {isConnected ? "🟢 Connected" : "🔴 Disconnected"}
        <span className="server-info">({serverInfo})</span>
        {!isConnected && (
          <button onClick={handleReconnect} className="reconnect-btn">
            Reconnect
          </button>
        )}
      </div>

      <div className="chat-header">
        <div className="header-content">
          <div className="room-info">
            <h1>Secure Chat Room</h1>
            <div className="room-code">
              <span className="room-icon">🔒</span>
              Room: {roomCode}
            </div>
          </div>
          <div className="user-info">
            <div className="user-count">
              <span className="user-icon">👥</span>
              {formatUserCount()}
            </div>
            <button onClick={handleLeaveRoom} className="leave-btn">
              <span className="leave-icon">🚪</span>
              Leave Room
            </button>
          </div>
        </div>
      </div>

      <div className="chat-main">
        <div className="messages-section">
          {error && (
            <div className="error-message">
              <span className="error-icon">⚠️</span>
              {error}
              {!isConnected && (
                <button
                  onClick={handleReconnect}
                  className="reconnect-btn-inline"
                >
                  Reconnect
                </button>
              )}
            </div>
          )}

          <div className="messages-container">
            <div className="messages-list">
              {isLoading ? (
                renderLoadingSkeletons()
              ) : messages.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">💬</div>
                  <h3>No messages yet</h3>
                  <p>Start the conversation by sending a message!</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <Message key={msg.id} message={msg} currentUser={username} />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {getTypingText() && (
            <div className="typing-indicator">
              <div className="typing-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
              {getTypingText()}
            </div>
          )}

          <div className="input-section">
            <form onSubmit={handleSendMessage} className="message-input-form">
              <div className="input-wrapper">
                <textarea
                  className="message-input"
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value);
                    handleTyping();
                  }}
                  onKeyPress={handleKeyPress}
                  placeholder="Type a secure message... (Press Enter to send, Shift+Enter for new line)"
                  maxLength={1000}
                  disabled={!isConnected || isLoading}
                  rows="2"
                />
                <div className="message-counter">{newMessage.length}/1000</div>
              </div>
              <button
                type="submit"
                className="send-btn"
                disabled={!newMessage.trim() || !isConnected || isLoading}
              >
                {isLoading ? (
                  <div className="loading-spinner"></div>
                ) : (
                  <>
                    <span className="send-icon">✈️</span>
                    Send
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        <div className="users-sidebar">
          <div className="sidebar-header">
            <h3>Online Users</h3>
            <div className="user-count-badge">{users.length}</div>
          </div>
          <div className="users-list">
            {users.length === 0 ? (
              <div className="empty-users">
                <span className="empty-users-icon">👥</span>
                <p>No users online</p>
              </div>
            ) : (
              users.map((user, index) => (
                <div key={`${user}-${index}`} className="user-item">
                  <div className="user-avatar">
                    {user.charAt(0).toUpperCase()}
                    <div className="status-indicator"></div>
                  </div>
                  <span className="user-name">
                    {user}
                    {user === username && (
                      <span className="you-badge">You</span>
                    )}
                  </span>
                </div>
              ))
            )}
          </div>
          <div className="sidebar-footer">
            <div className="security-badge">
              <span className="lock-icon">🔒</span>
              End-to-End Encrypted
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
