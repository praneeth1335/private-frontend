import { useState, useEffect } from "react";
import { getServerUrl } from "../utils/getServerUrl";

export default function NetworkInfo() {
  const [showInstructions, setShowInstructions] = useState(false);
  const [localIP, setLocalIP] = useState("192.168.x.x");
  const [serverStatus, setServerStatus] = useState("checking");
  const [serverInfo, setServerInfo] = useState(null);

  useEffect(() => {
    const serverUrl = getServerUrl();

    const checkServerStatus = async () => {
      try {
        const response = await fetch(`${serverUrl}/health`, {
          mode: "cors",
          signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) throw new Error("Server not responding properly");

        const data = await response.json();
        setServerStatus("online");
        setLocalIP(data.ip || "192.168.x.x");
        setServerInfo(data);
      } catch (error) {
        console.warn("Server health check failed:", error);
        setServerStatus("offline");
        const hostname = window.location.hostname;
        setLocalIP(
          hostname === "localhost" || hostname === "127.0.0.1"
            ? "192.168.x.x"
            : hostname
        );

        // Try to get server info even if health check fails
        try {
          const infoResponse = await fetch(`${serverUrl}/info`, {
            mode: "cors",
            signal: AbortSignal.timeout(3000),
          });
          if (infoResponse.ok) {
            const infoData = await infoResponse.json();
            setServerInfo(infoData);
          }
        } catch (infoError) {
          console.warn("Server info fetch failed:", infoError);
        }
      }
    };

    checkServerStatus();

    // Optional: Refresh status every 30 seconds when panel is open
    let interval;
    if (showInstructions) {
      interval = setInterval(checkServerStatus, 30000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [showInstructions]);

  const copyToClipboard = (text) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        // You could add a toast notification here
        console.log("Copied to clipboard:", text);
      })
      .catch((err) => {
        console.error("Failed to copy:", err);
      });
  };

  const wakeUpServer = () => {
    const serverUrl = getServerUrl();
    // Open in new tab to wake up sleeping server (common in free hosting)
    window.open(`${serverUrl}/health`, "_blank", "noopener,noreferrer");

    // Also try to fetch to wake it up
    fetch(`${serverUrl}/health`, { mode: "cors" })
      .then(() => {
        console.log("Server wake-up call sent");
        // Refresh the status after a delay
        setTimeout(() => window.location.reload(), 2000);
      })
      .catch(console.error);
  };

  return (
    <div className="network-info">
      <button
        onClick={() => setShowInstructions(!showInstructions)}
        className="btn btn-secondary btn-small"
        title="Network information and server status"
      >
        {serverStatus === "online" ? "🌐" : "🔴"} Network Info
      </button>

      {showInstructions && (
        <div className="network-panel">
          {/* Server Status */}
          <div style={{ marginBottom: "var(--space-md)" }}>
            <div className="network-label">Server Status</div>
            <div
              className="network-value"
              style={{
                color:
                  serverStatus === "online"
                    ? "var(--success)"
                    : serverStatus === "checking"
                    ? "var(--muted)"
                    : "var(--danger)",
                display: "flex",
                alignItems: "center",
                gap: "var(--space-sm)",
              }}
            >
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor:
                    serverStatus === "online"
                      ? "var(--success)"
                      : serverStatus === "checking"
                      ? "var(--muted)"
                      : "var(--danger)",
                }}
              />
              {serverStatus.toUpperCase()}
              {serverStatus === "offline" && (
                <button
                  onClick={wakeUpServer}
                  className="btn btn-small"
                  style={{
                    marginLeft: "auto",
                    padding: "0.2rem 0.5rem",
                    fontSize: "0.7rem",
                  }}
                >
                  🔄 Wake Up
                </button>
              )}
            </div>
          </div>

          {/* Server Information */}
          {serverInfo && (
            <div style={{ marginBottom: "var(--space-md)" }}>
              <div className="network-label">Server Info</div>
              <div className="network-value">
                <div>Version: {serverInfo.version || "1.0.0"}</div>
                <div>Port: {serverInfo.port || "5000"}</div>
                {serverInfo.timestamp && (
                  <div>
                    Last Check:{" "}
                    {new Date(serverInfo.timestamp).toLocaleTimeString()}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Local Access URL */}
          <div style={{ marginBottom: "var(--space-md)" }}>
            <div className="network-label">Frontend URL</div>
            <div className="network-value">
              {`${window.location.protocol}//${localIP}${
                window.location.port ? `:${window.location.port}` : ""
              }`}
            </div>
            <button
              className="btn btn-small btn-ghost"
              onClick={() =>
                copyToClipboard(
                  `${window.location.protocol}//${localIP}${
                    window.location.port ? `:${window.location.port}` : ""
                  }`
                )
              }
              style={{ marginTop: "0.25rem", width: "100%" }}
            >
              📋 Copy Frontend URL
            </button>
          </div>

          {/* Backend Server */}
          <div style={{ marginBottom: "var(--space-md)" }}>
            <div className="network-label">Backend Server</div>
            <div className="network-value">
              {`${window.location.protocol}//${localIP}:5000`}
            </div>
            <button
              className="btn btn-small btn-ghost"
              onClick={() =>
                copyToClipboard(`${window.location.protocol}//${localIP}:5000`)
              }
              style={{ marginTop: "0.25rem", width: "100%" }}
            >
              📋 Copy Backend URL
            </button>
          </div>

          {/* Current Environment */}
          <div style={{ marginBottom: "var(--space-md)" }}>
            <div className="network-label">Environment</div>
            <div className="network-value">
              {import.meta.env.DEV ? "Development" : "Production"}
              {import.meta.env.VITE_SOCKET_URL && (
                <div
                  style={{
                    fontSize: "0.8rem",
                    color: "var(--muted)",
                    marginTop: "0.25rem",
                  }}
                >
                  Custom URL: {import.meta.env.VITE_SOCKET_URL}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div
            style={{
              display: "flex",
              gap: "var(--space-sm)",
              marginTop: "var(--space-lg)",
              flexWrap: "wrap",
            }}
          >
            <button
              className="btn btn-small"
              onClick={() => copyToClipboard(window.location.href)}
            >
              📋 Copy Current URL
            </button>
            <button
              className="btn btn-ghost btn-small"
              onClick={() => setShowInstructions(false)}
            >
              Close
            </button>
          </div>

          {/* Debug Info (only in development) */}
          {import.meta.env.DEV && (
            <div
              style={{
                marginTop: "var(--space-md)",
                paddingTop: "var(--space-md)",
                borderTop: "1px solid var(--border)",
              }}
            >
              <div className="network-label">Debug Info</div>
              <div className="network-value" style={{ fontSize: "0.8rem" }}>
                <div>Hostname: {window.location.hostname}</div>
                <div>Protocol: {window.location.protocol}</div>
                <div>Port: {window.location.port || "default"}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
