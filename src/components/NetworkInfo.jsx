import { useState, useEffect } from "react";
import { getServerUrl } from "../utils/getServerUrl";

export default function NetworkInfo() {
  const [showInstructions, setShowInstructions] = useState(false);
  const [localIP, setLocalIP] = useState("192.168.x.x");

  useEffect(() => {
    const serverUrl = getServerUrl();
    fetch(`${serverUrl}/info`, { mode: "cors" })
      .then((res) => {
        if (!res.ok) throw new Error("Network response was not ok");
        return res.json();
      })
      .then((data) => setLocalIP(data.ip || "192.168.x.x"))
      .catch(() => {
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
        className="info-btn"
      >
        ℹ️ Network Access
      </button>

      {showInstructions && (
        <div className="network-instructions">
          <h4>Allow Other Devices to Join:</h4>
          <ol>
            <li>Ensure all devices are on the same WiFi network.</li>
            <li>
              Other devices should access:{" "}
              <code>{`${window.location.protocol}//${localIP}:${window.location.port}`}</code>
            </li>
            <li>
              Server is running on:{" "}
              <code>{`${window.location.protocol}//${localIP}:5000`}</code>
            </li>
          </ol>
        </div>
      )}
    </div>
  );
}
