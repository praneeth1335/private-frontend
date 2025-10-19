import { useState, useEffect } from "react";
import PropTypes from "prop-types";

export default function Message({ message, currentUser, socket }) {
  const [downloadUrl, setDownloadUrl] = useState(null);

  useEffect(() => {
    if (message.type === "file" && socket) {
      const urlMatch = message.content.match(
        /\(https:\/\/.*\.amazonaws\.com\/(rooms\/[^)]+)\)/
      );
      if (urlMatch && urlMatch[1]) {
        socket.emit("requestDownloadUrl", { key: urlMatch[1] });
        socket.on("downloadUrl", ({ key, downloadUrl }) => {
          if (key === urlMatch[1]) {
            setDownloadUrl(downloadUrl);
          }
        });
      }
    }
    return () => {
      if (message.type === "file" && socket) {
        socket.off("downloadUrl");
      }
    };
  }, [message, socket]);

  const handleDelete = () => {
    if (socket && message.fileKey && message.uploaderSocketId === socket.id) {
      socket.emit("deleteFile", { key: message.fileKey });
    }
  };

  const isSelf = message.username === currentUser;

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderContent = () => {
    if (message.type === "file") {
      const [prefix, rest] = message.content.split("(");
      const filename = prefix.replace(/📎 /, "").trim();
      const extension = filename.split(".").pop().toLowerCase();
      const isImage = ["jpg", "jpeg", "png", "gif"].includes(extension);
      return (
        <div className="file-message">
          <div className="file-link">
            <span className={`file-icon ${extension}`}></span>
            {filename}
          </div>
          <div className="file-actions">
            <button
              className="download-file-btn"
              disabled={!downloadUrl}
              onClick={() => window.open(downloadUrl, "_blank")}
              title="Download file"
            >
              ⬇️ Download
            </button>
            {isSelf && message.fileKey && (
              <button
                className="delete-file-btn"
                onClick={handleDelete}
                title="Delete file"
              >
                🗑️ Delete
              </button>
            )}
          </div>
          {isImage && downloadUrl && (
            <img src={downloadUrl} alt={filename} className="file-preview" />
          )}
        </div>
      );
    }
    return message.content;
  };

  return (
    <div
      className={`message ${
        isSelf ? "self" : message.type === "system" ? "system" : "other"
      }`}
    >
      {message.type !== "system" && (
        <div className="message-header">
          <span className="message-username">{message.username}</span>
          <span className="message-time">
            {formatTimestamp(message.timestamp)}
          </span>
        </div>
      )}
      <div className="message-content">{renderContent()}</div>
    </div>
  );
}

Message.propTypes = {
  message: PropTypes.shape({
    id: PropTypes.string.isRequired,
    username: PropTypes.string,
    content: PropTypes.string.isRequired,
    timestamp: PropTypes.string.isRequired,
    type: PropTypes.oneOf(["user", "system", "file"]).isRequired,
    fileKey: PropTypes.string,
    uploaderSocketId: PropTypes.string,
  }).isRequired,
  currentUser: PropTypes.string.isRequired,
  socket: PropTypes.object,
};
