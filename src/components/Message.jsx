import { useState, useEffect } from "react";
import PropTypes from "prop-types";

export default function Message({
  message,
  currentUser,
  socket,
  previousMessage,
}) {
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (message.type === "file" && socket) {
      // Improved URL matching to handle different S3 URL formats
      const urlMatch =
        message.content.match(
          /\(https:\/\/.*\.amazonaws\.com\/(rooms\/[^)]+)\)/
        ) ||
        message.fileUrl?.match(/https:\/\/.*\.amazonaws\.com\/(rooms\/[^)]+)/);

      const fileKey = urlMatch ? urlMatch[1] : message.fileKey;

      if (fileKey) {
        socket.emit("requestDownloadUrl", { key: fileKey });

        const handleDownloadUrl = ({ key, downloadUrl }) => {
          if (key === fileKey) {
            setDownloadUrl(downloadUrl);
          }
        };

        socket.on("downloadUrl", handleDownloadUrl);

        return () => {
          socket.off("downloadUrl", handleDownloadUrl);
        };
      }
    }
  }, [message, socket]);

  const handleDelete = () => {
    if (
      socket &&
      message.fileKey &&
      message.uploaderSocketId === socket.id &&
      window.confirm("Are you sure you want to delete this file for everyone?")
    ) {
      socket.emit("deleteFile", { key: message.fileKey });
    }
  };

  const isSelf = message.username === currentUser;
  const isSystem = message.type === "system";

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const isSameDay = (timestamp1, timestamp2) => {
    if (!timestamp2) return false;
    const date1 = new Date(timestamp1);
    const date2 = new Date(timestamp2);
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  };

  const shouldShowDate = () => {
    if (!previousMessage) return true;
    return !isSameDay(message.timestamp, previousMessage.timestamp);
  };

  const renderContent = () => {
    if (message.type === "file") {
      // Improved filename extraction
      const filename =
        message.fileName ||
        message.content.split("(")[0]?.replace(/📎 /, "").trim() ||
        "Unknown File";

      const extension = filename.split(".").pop().toLowerCase();
      const isImage = ["jpg", "jpeg", "png", "gif", "webp"].includes(extension);

      const handleDownload = async () => {
        if (!downloadUrl) return;

        try {
          // 1. Fetch the file
          const response = await fetch(downloadUrl);
          if (!response.ok) throw new Error("Network response was not ok");
          const blob = await response.blob();

          // 2. Create a local object URL for the blob
          const blobUrl = window.URL.createObjectURL(blob);

          // 3. Create a temporary link to trigger the download
          const link = document.createElement("a");
          link.href = blobUrl;
          link.setAttribute("download", filename || "download");
          document.body.appendChild(link);
          link.click();

          // 4. Clean up the temporary link and object URL
          document.body.removeChild(link);
          window.URL.revokeObjectURL(blobUrl);
        } catch (error) {
          console.error("Download failed:", error);
          // Fallback to original behavior if blob download fails
          window.open(downloadUrl, "_blank");
        }
      };

      return (
        <>
          <div className="file-preview">
            <div className="file-info">
              <div className="file-icon">{getFileIcon(extension)}</div>
              <div className="file-details">
                <div className="file-name" title={filename}>
                  {filename.length > 30
                    ? `${filename.substring(0, 30)}...`
                    : filename}
                </div>
                <div className="file-size">
                  {message.fileSize || "Unknown size"}
                </div>
              </div>
            </div>

            <div className="file-actions">
              <button
                className="btn btn-small btn-secondary"
                disabled={!downloadUrl}
                onClick={handleDownload}
                title="Download file"
              >
                {downloadUrl ? "📥 Download" : "⏳ Loading..."}
              </button>

              {isSelf && message.fileKey && (
                <button
                  className="btn btn-small"
                  onClick={handleDelete}
                  title="Delete file for everyone"
                  style={{ background: "var(--danger)", color: "white" }}
                >
                  🗑️ Delete
                </button>
              )}
            </div>
          </div>

          {isImage && downloadUrl && (
            <img
              src={downloadUrl}
              alt={filename}
              className="file-image"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
              style={{
                opacity: imageLoaded ? 1 : 0,
                transition: "opacity 0.3s ease",
                maxWidth: "400px",
                maxHeight: "400px",
                width: "100%",
                objectFit: "cover",
                marginTop: "var(--space-sm)",
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
              }}
              onClick={() => window.open(downloadUrl, "_blank")}
            />
          )}
        </>
      );
    }

    return (
      <div className="message-content">
        {formatMessageContent(message.content)}
      </div>
    );
  };

  const getFileIcon = (extension) => {
    const iconMap = {
      jpg: "🖼️",
      jpeg: "🖼️",
      png: "🖼️",
      gif: "🖼️",
      webp: "🖼️",
      pdf: "📄",
      doc: "📝",
      docx: "📝",
      txt: "📄",
      json: "📋",
      zip: "📦",
      mp4: "🎥",
      mp3: "🎵",
      wav: "🎵",
    };
    return iconMap[extension] || "📎";
  };

  const formatMessageContent = (content) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = content.split(urlRegex);

    if (parts.length === 1) {
      // No URLs found, return plain text
      return content;
    }

    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="message-link"
            title={part}
          >
            {part.length > 50 ? `${part.substring(0, 50)}...` : part}
          </a>
        );
      }
      return part;
    });
  };

  // Get user role color if available
  const getUserRoleColor = () => {
    // This would need to be passed as a prop or fetched from context
    // For now, it's a placeholder for future enhancement
    return null;
  };

  return (
    <>
      {shouldShowDate() && (
        <div className="date-separator">
          <span className="date-label">{formatDate(message.timestamp)}</span>
        </div>
      )}

      <div
        className={`message ${isSelf ? "self" : "other"} ${
          isSystem ? "system" : ""
        }`}
      >
        {!isSystem && !isSelf && (
          <div
            className="message-avatar"
            style={
              getUserRoleColor()
                ? {
                    background: getUserRoleColor(),
                    boxShadow: `0 0 10px ${getUserRoleColor()}40`,
                  }
                : {}
            }
          >
            {message.username?.charAt(0).toUpperCase()}
          </div>
        )}

        <div className="message-content-wrapper">
          {!isSystem && (
            <div className="message-header">
              <div
                className="message-username"
                style={getUserRoleColor() ? { color: getUserRoleColor() } : {}}
              >
                {message.username}
                {/* Placeholder for role badge - would need role data */}
                {/* {message.role && message.role !== 'member' && (
                  <span className={`role-badge-mini ${message.role}`}>
                    {message.role === 'leader' ? '👑' : '⭐'}
                  </span>
                )} */}
              </div>
              <div className="message-time">
                {formatTimestamp(message.timestamp)}
              </div>
            </div>
          )}

          {renderContent()}
        </div>

        {!isSystem && isSelf && (
          <div className="message-avatar self-avatar">
            {message.username?.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
    </>
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
    fileUrl: PropTypes.string,
    fileName: PropTypes.string,
    uploaderSocketId: PropTypes.string,
    fileSize: PropTypes.string,
    // role: PropTypes.oneOf(['leader', 'co-leader', 'member']), // For future enhancement
  }).isRequired,
  currentUser: PropTypes.string.isRequired,
  socket: PropTypes.object,
  previousMessage: PropTypes.object,
};
