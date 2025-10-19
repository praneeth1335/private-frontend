export default function Message({ message, currentUser }) {
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getMessageClass = () => {
    if (message.type === "system") return "system";
    return message.username === currentUser ? "self" : "other";
  };

  const getDisplayName = () => {
    if (message.type === "system") return "System";
    return message.username === currentUser ? "You" : message.username;
  };

  return (
    <div className={`message ${getMessageClass()}`}>
      <div className="message-header">
        <span className="message-username">{getDisplayName()}</span>
        <span className="message-time">{formatTime(message.timestamp)}</span>
      </div>
      <div className="message-content">{message.content}</div>
    </div>
  );
}
