import { useState, useEffect } from "react";
import { getServerUrl } from "../utils/getServerUrl";

export default function NetworkInfo() {
  const [showInstructions, setShowInstructions] = useState(false);
  const [localIP, setLocalIP] = useState("192.168.x.x");
  const [serverStatus, setServerStatus] = useState("checking");

  useEffect(() => {
    const serverUrl = getServerUrl();

    fetch(`${serverUrl}/health`, {
      mode: "cors",
      signal: AbortSignal.timeout(5000),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Server not responding properly");
        setServerStatus("online");
        return res.json();
      })
      .then((data) => setLocalIP(data.ip || "192.168.x.x"))
      .catch(() => {
        setServerStatus("offline");
        const hostname = window.location.hostname;
        setLocalIP(
          hostname === "localhost" || hostname === "127.0.0.1"
            ? "192.168.x.x"
            : hostname
        );
      });
  }, []);

  return (
    <div className="network-info">
      <button
        onClick={() => setShowInstructions(!showInstructions)}
        className="btn btn-secondary btn-small"
      >
        🌐 Network Info
      </button>

      {showInstructions && (
        <div className="network-panel">
          <div style={{ marginBottom: "var(--space-md)" }}>
            <div className="network-label">Server Status</div>
            <div
              className="network-value"
              style={{
                color:
                  serverStatus === "online"
                    ? "var(--success)"
                    : "var(--danger)",
              }}
            >
              {serverStatus.toUpperCase()}
            </div>
          </div>

          <div style={{ marginBottom: "var(--space-md)" }}>
            <div className="network-label">Local Access URL</div>
            <div className="network-value">
              {`${window.location.protocol}//${localIP}:${window.location.port}`}
            </div>
          </div>

          <div style={{ marginBottom: "var(--space-md)" }}>
            <div className="network-label">Backend Server</div>
            <div className="network-value">
              {`${window.location.protocol}//${localIP}:5000`}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: "var(--space-sm)",
              marginTop: "var(--space-lg)",
            }}
          >
            <button
              className="btn btn-small"
              onClick={() =>
                navigator.clipboard.writeText(
                  `${window.location.protocol}//${localIP}:${window.location.port}`
                )
              }
            >
              📋 Copy URL
            </button>
            <button
              className="btn btn-ghost btn-small"
              onClick={() => setShowInstructions(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
