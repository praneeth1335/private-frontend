export const getServerUrl = () => {
  const envUrl = import.meta.env.VITE_SOCKET_URL;
  if (envUrl && envUrl !== "auto") {
    return envUrl;
  }

  const { hostname, protocol } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "http://localhost:5000";
  }
  return `${protocol}//${hostname}:5000`;
};
