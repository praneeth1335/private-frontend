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
  const [userRole, setUserRole] = useState("member");
  const [showUserMenu, setShowUserMenu] = useState(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [roomInfo, setRoomInfo] = useState(null);

  const messageEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const socketRef = useRef(null);
  const fileInputRef = useRef(null);
  const exportMenuRef = useRef(null);

  const username = localStorage.getItem("username");

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(event.target)
      ) {
        setShowExportMenu(false);
      }
      if (showUserMenu) {
        setShowUserMenu(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showUserMenu]);

  useEffect(() => {
    document.body.setAttribute("data-theme", theme);
    localStorage.setItem("premium-chat-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const scrollToBottom = useCallback(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  // ✅ Updated handleUserAction function
  const handleUserAction = async (user, action) => {
    console.log(`🔄 User action: ${action} on ${user}`);

    if (!socket || !isConnected) {
      showToast("Not connected to server", "error");
      return;
    }

    try {
      if (action === "kick") {
        if (
          window.confirm(`Are you sure you want to kick ${user} from the room?`)
        ) {
          socket.emit("kickUser", { targetUsername: user });
          showToast(`Kicking ${user}...`, "info");
        }
      } else if (action === "make-co-leader") {
        if (
          window.confirm(
            `Make ${user} a co-leader? They will be able to manage users but cannot assign roles.`
          )
        ) {
          socket.emit("assignRole", {
            targetUsername: user,
            newRole: "co-leader",
          });
        }
      } else if (action === "make-member") {
        if (window.confirm(`Remove ${user}'s co-leader role?`)) {
          socket.emit("assignRole", {
            targetUsername: user,
            newRole: "member",
          });
        }
      } else if (action === "transfer-leadership") {
        if (
          window.confirm(
            `Transfer leadership to ${user}? You will become a co-leader. This action cannot be undone.`
          )
        ) {
          socket.emit("assignRole", {
            targetUsername: user,
            newRole: "leader",
          });
        }
      }
    } catch (error) {
      console.error("User action error:", error);
      showToast("Failed to perform action", "error");
    }
    setShowUserMenu(null);
  };

  const exportToPDF = async (includeMedia = false) => {
    try {
      showToast("Generating PDF...", "info");

      const serverUrl = getServerUrl();
      const response = await fetch(`${serverUrl}/api/export/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode,
          includeMedia,
          messages: includeMedia
            ? messages
            : messages.filter((m) => m.type !== "file"),
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `chat-${roomCode}-${
          new Date().toISOString().split("T")[0]
        }.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        showToast("PDF exported successfully", "success");
      } else {
        const errorData = await response.json();
        showToast(errorData.msg || "Failed to export PDF", "error");
      }
    } catch (error) {
      console.error("PDF export error:", error);
      showToast("Failed to export PDF", "error");
    }
    setShowExportMenu(false);
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

        console.log("🔄 Emitting joinRoom with:", { username, roomCode });

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
        let errorMessage = "Connection failed.";
        if (error.message.includes("ECONNREFUSED")) {
          errorMessage += " Server unavailable.";
        } else if (error.message.includes("timeout")) {
          errorMessage += " Request timeout.";
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

      newSocket.on("roomInfo", (info) => {
        console.log("📋 Room info received:", info);
        setRoomInfo(info);
        if (info.userRole) {
          setUserRole(info.userRole);
          localStorage.setItem("userRole", info.userRole);
        }
        if (info.isPersistent !== undefined) {
          localStorage.setItem("isPersistent", info.isPersistent.toString());
        }
        if (info.persistenceDays) {
          localStorage.setItem(
            "persistenceDays",
            info.persistenceDays.toString()
          );
        }
        if (info.createdBy) {
          localStorage.setItem("createdBy", info.createdBy);
        }
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

      // ✅ Added socket event listeners
      newSocket.on("userKicked", ({ username: kickedUser }) => {
        console.log(`User kicked: ${kickedUser}`);
        if (kickedUser === username) {
          showToast("You have been kicked from the room", "error");
          localStorage.removeItem("username");
          localStorage.removeItem("userRole");
          localStorage.removeItem("isPersistent");
          localStorage.removeItem("persistenceDays");
          navigate("/");
        } else {
          showToast(`${kickedUser} was kicked from the room`, "info");
        }
      });

      newSocket.on("roleAssigned", ({ targetUsername, newRole, message }) => {
        console.log(`Role assigned: ${targetUsername} is now ${newRole}`);

        if (targetUsername === username) {
          setUserRole(newRole);
          localStorage.setItem("userRole", newRole);
          showToast(message || `You are now ${newRole}`, "success");
        } else {
          showToast(message || `${targetUsername} is now ${newRole}`, "info");
        }

        // Refresh the users list to show updated roles
        // The server should send an updated roomUsers event
      });

      newSocket.on("kicked", (message) => {
        showToast(message, "error");
        localStorage.removeItem("username");
        localStorage.removeItem("userRole");
        localStorage.removeItem("isPersistent");
        localStorage.removeItem("persistenceDays");
        navigate("/");
      });

      setSocket(newSocket);
    };

    connectSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
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
      localStorage.removeItem("userRole");
      localStorage.removeItem("isPersistent");
      localStorage.removeItem("persistenceDays");
      localStorage.removeItem("createdBy");
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

  // ✅ Updated getRoleBadge function
  const getRoleBadge = (user) => {
    if (user === username) {
      // Show current user's role
      if (userRole === "leader") {
        return (
          <span className="role-badge leader" title="Room Leader">
            👑 Leader
          </span>
        );
      } else if (userRole === "co-leader") {
        return (
          <span className="role-badge co-leader" title="Co-Leader">
            ⭐ Co-Leader
          </span>
        );
      }
      return (
        <span className="user-badge" title="You">
          You
        </span>
      );
    }

    // For other users, you might need to get their roles from room data
    // This is a placeholder - you'll need to implement proper user role tracking
    return null;
  };

  const canManageUsers = () => {
    return userRole === "leader" || userRole === "co-leader";
  };

  const canAssignRoles = () => {
    return userRole === "leader";
  };

  return (
    <div className="chat-container">
      <div
        className={`sidebar-backdrop ${isSidebarOpen ? "open" : ""}`}
        onClick={toggleSidebar}
      ></div>

      {!isConnected && (
        <div className="connection-status">
          <div className={`status-indicator ${isConnected ? "" : "offline"}`}>
            <div className="status-dot"></div>
          </div>
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
                <span> 📋</span>
              </div>
              {roomInfo?.isPersistent && (
                <span
                  className="persistent-badge"
                  title={`Persistent Chat - ${roomInfo.persistenceDays} days`}
                >
                  💾 {roomInfo.persistenceDays}d
                </span>
              )}
              {!roomInfo?.isPersistent && roomInfo && (
                <span
                  className="persistent-badge"
                  style={{ background: "var(--muted)" }}
                  title="Temporary Chat - 7 days"
                >
                  ⏳ 7d
                </span>
              )}
            </div>
            <div className="room-info-row">
              {userRole === "leader" && (
                <span className="room-info-item" title="Room Leader">
                  👑 Leader
                </span>
              )}
              {userRole === "co-leader" && (
                <span className="room-info-item" title="Co-Leader">
                  ⭐ Co-Leader
                </span>
              )}
              {roomInfo?.createdBy && (
                <span
                  className="room-info-item"
                  title={`Created by ${roomInfo.createdBy}`}
                >
                  by {roomInfo.createdBy}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="header-right">
          <div className="user-count">
            <span>{users.length} online</span>
          </div>

          {/* PDF Export Dropdown */}
          {(userRole === "leader" || userRole === "co-leader") && (
            <div className="pdf-export-dropdown" ref={exportMenuRef}>
              <button
                className="btn btn-icon"
                onClick={() => setShowExportMenu(!showExportMenu)}
                title="Export Chat"
              >
                📄
              </button>
              {showExportMenu && (
                <div className="dropdown-menu">
                  <button onClick={() => exportToPDF(false)}>
                    Export PDF (Text Only)
                  </button>
                  <button onClick={() => exportToPDF(true)}>
                    Export PDF (With Media)
                  </button>
                </div>
              )}
            </div>
          )}

          <button
            onClick={toggleTheme}
            className="btn btn-icon theme-toggle-btn"
            title="Toggle theme"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>

          <button
            onClick={toggleSidebar}
            className="btn btn-icon toggle-users-btn"
            title="Toggle users sidebar"
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
            <div ref={messageEndRef} />
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
                  ➤
                </button>
              </div>
            </form>

            {isDragActive && (
              <div className="dropzone active">
                <p>Drop files here to upload</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ✅ Updated Users List Section */}
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
              <div className="empty-icon">👤</div>
              <p>No other users online</p>
            </div>
          ) : (
            users.map((user, index) => {
              // Get user role from room data (you might need to store this in state)
              const isCurrentUser = user === username;

              return (
                <div key={`${user}-${index}`} className="user-item">
                  <div className="user-avatar">
                    {user.charAt(0).toUpperCase()}
                    <div className="status-dot"></div>
                  </div>
                  <div className="user-name">
                    <span className="username-text">{user}</span>
                    {getRoleBadge(user)}
                    {canManageUsers() && !isCurrentUser && (
                      <div className="user-actions">
                        <button
                          className="btn btn-icon btn-small user-menu-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowUserMenu(
                              showUserMenu === user ? null : user
                            );
                          }}
                          title="User actions"
                        >
                          ⋮
                        </button>
                        {showUserMenu === user && (
                          <div className="user-menu">
                            {canAssignRoles() && (
                              <>
                                <button
                                  onClick={() =>
                                    handleUserAction(
                                      user,
                                      "transfer-leadership"
                                    )
                                  }
                                >
                                  👑 Transfer Leadership
                                </button>
                                <button
                                  onClick={() =>
                                    handleUserAction(user, "make-co-leader")
                                  }
                                >
                                  ⭐ Make Co-Leader
                                </button>
                                <button
                                  onClick={() =>
                                    handleUserAction(user, "make-member")
                                  }
                                >
                                  👤 Make Member
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleUserAction(user, "kick")}
                              style={{ color: "var(--danger)" }}
                            >
                              🚫 Kick User
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
