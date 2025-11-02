import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import Message from "../components/Message";
import { getServerUrl } from "../utils/getServerUrl";
import { useDropzone } from "react-dropzone";

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
  const [theme, setTheme] = useState(
    localStorage.getItem("premium-chat-theme") || "dark"
  );
  const [uploadProgress, setUploadProgress] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 820);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const socketRef = useRef(null);
  const fileInputRef = useRef(null);

  const username = localStorage.getItem("username");

  useEffect(() => {
    document.body.setAttribute("data-theme", theme);
    localStorage.setItem("premium-chat-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  useEffect(() => {
    if (!username) {
      navigate("/");
      return;
    }

    const connectSocket = async () => {
      setIsLoading(true);
      const socketUrl = getServerUrl();

      try {
        await fetch(`${socketUrl}/health`, {
          signal: AbortSignal.timeout(5000),
        });
      } catch (err) {
        console.warn("Server health check failed:", err);
      }

      const newSocket = io(socketUrl, {
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 15,
        reconnectionDelay: 1000,
        timeout: 15000,
      });

      socketRef.current = newSocket;

      newSocket.on("connect", () => {
        setIsConnected(true);
        setError("");
        setIsLoading(false);

        newSocket.emit("joinRoom", {
          username: username,
          roomCode: roomCode,
        });

        showToast("Connected to chat", "success");
      });

      newSocket.on("disconnect", (reason) => {
        setIsConnected(false);
        if (reason === "io server disconnect") {
          setError("Server disconnected. Please refresh.");
        }
      });

      newSocket.on("connect_error", (error) => {
        let errorMessage = "Connection failed. ";
        if (error.message.includes("ECONNREFUSED")) {
          errorMessage += "Server unavailable.";
        } else if (error.message.includes("timeout")) {
          errorMessage += "Request timeout.";
        } else {
          errorMessage += error.message;
        }

        setError(errorMessage);
        setIsConnected(false);
        setIsLoading(false);
      });

      newSocket.on("reconnect_attempt", (attempt) => {
        setError(`Reconnecting... (${attempt}/15)`);
      });

      newSocket.on("reconnect", () => {
        setError("");
        setIsConnected(true);
        newSocket.emit("joinRoom", {
          username: username,
          roomCode: roomCode,
        });
      });

      newSocket.on("reconnect_failed", () => {
        setError("Reconnection failed. Please refresh.");
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
        setTypingUsers((prev) => new Set([...prev, typingUsername]));
      });

      newSocket.on("userStoppedTyping", (stoppedUsername) => {
        setTypingUsers((prev) => {
          const newSet = new Set(prev);
          newSet.delete(stoppedUsername);
          return newSet;
        });
      });

      newSocket.on("fileDeleted", ({ key }) => {
        setMessages((prev) => prev.filter((msg) => msg.fileKey !== key));
      });

      setSocket(newSocket);

      return () => {
        if (socketRef.current) {
          socketRef.current.close();
        }
      };
    };

    connectSocket();
  }, [roomCode, username, navigate]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !socket || !isConnected) {
      showToast("Cannot send message", "error");
      return;
    }

    const messageToSend = newMessage.trim().substring(0, 1000);
    socket.emit("sendMessage", messageToSend);
    setNewMessage("");
    setIsTyping(false);
    socket.emit("typingStop");

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleTyping = useCallback(() => {
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
  }, [socket, isConnected, isTyping]);

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  const onDrop = useCallback(
    (acceptedFiles) => {
      acceptedFiles.forEach((file) => {
        if (!socket || !isConnected) {
          showToast("Not connected to server", "error");
          return;
        }

        const fileType = file.type || "application/octet-stream";
        const extension = file.name.split(".").pop().toLowerCase();

        socket.emit("requestUploadUrl", {
          filename: file.name,
          fileType: fileType,
        });

        socket.once("uploadUrl", async ({ presignedUrl, fileUrl, key }) => {
          try {
            const xhr = new XMLHttpRequest();
            xhr.open("PUT", presignedUrl, true);

            xhr.upload.onprogress = (event) => {
              if (event.lengthComputable) {
                const percent = Math.round((event.loaded / event.total) * 100);
                setUploadProgress({ file: file.name, percent });
              }
            };

            xhr.setRequestHeader("Content-Type", fileType);
            xhr.onload = () => {
              if (xhr.status === 200) {
                socket.emit("fileUploaded", {
                  fileUrl,
                  filename: file.name,
                  key,
                  extension,
                });
                showToast("File uploaded successfully", "success");
                setTimeout(() => setUploadProgress(null), 1000);
              } else {
                showToast("File upload failed", "error");
                setUploadProgress(null);
              }
            };

            xhr.onerror = () => {
              showToast("File upload failed", "error");
              setUploadProgress(null);
            };

            xhr.send(file);
          } catch (err) {
            showToast("File upload failed", "error");
            setUploadProgress(null);
          }
        });
      });
    },
    [socket, isConnected]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [],
      "image/png": [],
      "image/gif": [],
      "image/webp": [],
      "application/pdf": [],
      "application/msword": [],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        [],
      "text/plain": [],
      "application/json": [],
      "application/zip": [],
    },
    multiple: true,
    maxSize: 25 * 1024 * 1024,
    noClick: true,
  });

  const handleLeaveRoom = () => {
    if (window.confirm("Are you sure you want to leave this chat room?")) {
      if (socket) {
        socket.emit("leaveRoom");
        socket.close();
      }
      localStorage.removeItem("username");
      navigate("/");
    }
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

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode).then(() => {
      showToast("Room code copied to clipboard", "success");
    });
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

  const renderLoadingSkeletons = () =>
    Array.from({ length: 5 }).map((_, index) => (
      <div
        key={index}
        className={`skeleton skeleton-message ${
          index % 2 === 0 ? "other" : "self"
        }`}
      >
        <div className="skeleton-avatar"></div>
        <div style={{ flex: 1 }}>
          <div className="skeleton-line short"></div>
          <div className="skeleton-line medium"></div>
          <div className="skeleton-line long"></div>
        </div>
      </div>
    ));

  return (
    <div className="chat-container">
      <div
        className={`sidebar-backdrop ${isSidebarOpen ? "open" : ""}`}
        onClick={toggleSidebar}
      ></div>

      {!isConnected && (
        <div className="connection-status">
          <div
            className={`status-indicator ${isConnected ? "" : "offline"}`}
          ></div>
          <span>{isConnected ? "Connected" : "Disconnected"}</span>
          {!isConnected && (
            <button
              onClick={handleReconnect}
              className="btn btn-small reconnect-btn"
            >
              Reconnect
            </button>
          )}
        </div>
      )}

      <div className="chat-header">
        <div className="header-left">
          <div className="room-info">
            <div className="room-title">Premium Chat</div>
            <div className="room-sub">Real-time messaging</div>
            <div className="room-code-wrapper">
              <div className="room-code" onClick={copyRoomCode}>
                <span>{roomCode}</span>
                <span>📋</span>
              </div>
            </div>
          </div>
        </div>

        <div className="header-right">
          <div className="user-count">
            <span>{users.length} online</span>
          </div>

          <button
            onClick={toggleTheme}
            className="btn btn-icon theme-toggle-btn"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>

          <button
            onClick={toggleSidebar}
            className="btn btn-icon toggle-users-btn"
          >
            👥
          </button>

          <button onClick={handleLeaveRoom} className="btn btn-ghost leave-btn">
            Leave
          </button>
        </div>
      </div>

      <div className="messages-section">
        {error && (
          <div className="error-banner">
            <span>{error}</span>
            {!isConnected && (
              <button
                onClick={handleReconnect}
                className="btn btn-small error-reconnect-btn"
              >
                Reconnect
              </button>
            )}
          </div>
        )}

        <div className="messages-container">
          <div className="messages-list">
            {isLoading ? (
              <div className="loading-container">
                {renderLoadingSkeletons()}
              </div>
            ) : messages.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">💬</div>
                <h3 className="empty-title">Welcome to Premium Chat</h3>
                <p>Start the conversation by sending your first message</p>
              </div>
            ) : (
              messages.map((msg, index) => (
                <Message
                  key={msg.id}
                  message={msg}
                  currentUser={username}
                  socket={socket}
                  previousMessage={messages[index - 1]}
                />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="typing-indicator">{getTypingText()}</div>

        <div
          {...getRootProps({
            className: `input-section ${isDragActive ? "active" : ""}`,
          })}
        >
          <input {...getInputProps()} />
          <div className="input-container">
            {uploadProgress && (
              <div className="upload-progress">
                <div className="upload-progress-text">
                  Uploading {uploadProgress.file}: {uploadProgress.percent}%
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${uploadProgress.percent}%` }}
                  ></div>
                </div>
              </div>
            )}

            <form onSubmit={handleSendMessage} className="input-form">
              <div className="input-wrapper">
                <textarea
                  className="message-input"
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value);
                    handleTyping();
                  }}
                  onKeyDown={handleKeyPress}
                  placeholder={
                    isDragActive
                      ? "Drop files here to upload..."
                      : "Type your message..."
                  }
                  maxLength={1000}
                  disabled={!isConnected || isLoading}
                  rows="1"
                  onInput={(e) => {
                    e.target.style.height = "auto";
                    e.target.style.height = `${Math.min(
                      e.target.scrollHeight,
                      120
                    )}px`;
                  }}
                />
                <div className="char-count">{newMessage.length}/1000</div>
              </div>

              <div className="input-actions">
                <button
                  type="button"
                  className="btn btn-icon file-attach-btn"
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach files"
                >
                  📎
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: "none" }}
                  onChange={(e) => onDrop(Array.from(e.target.files))}
                  multiple
                />

                <button
                  type="submit"
                  className="btn btn-primary btn-icon send-btn"
                  disabled={!newMessage.trim() || !isConnected || isLoading}
                  title="Send message"
                >
                  ✈️
                </button>
              </div>
            </form>

            {isDragActive && (
              <div className="dropzone active">
                <p>📁 Drop files here to upload</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={`users-sidebar ${isSidebarOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <h3 className="sidebar-title">Online Users</h3>
          <div className="sidebar-header-right">
            <div className="user-count-badge">{users.length}</div>
            <button
              onClick={toggleSidebar}
              className="btn btn-icon sidebar-close"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="users-list">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="user-item">
                <div
                  className="user-avatar skeleton"
                  style={{ background: "var(--bg-2)" }}
                ></div>
                <div style={{ flex: 1 }}>
                  <div className="skeleton-line short"></div>
                  <div
                    className="skeleton-line short"
                    style={{ width: "60%" }}
                  ></div>
                </div>
              </div>
            ))
          ) : users.length === 0 ? (
            <div className="empty-state" style={{ padding: "2rem 1rem" }}>
              <div className="empty-icon">👥</div>
              <p>No other users online</p>
            </div>
          ) : (
            users.map((user, index) => (
              <div key={`${user}-${index}`} className="user-item">
                <div className="user-avatar">
                  {user.charAt(0).toUpperCase()}
                  <div className="status-dot"></div>
                </div>
                <div className="user-name">
                  {user}
                  {user === username && <span className="user-badge">You</span>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
