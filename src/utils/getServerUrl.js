export const getServerUrl = () => {
  const envUrl = import.meta.env.VITE_SOCKET_URL;
  if (envUrl && envUrl !== "auto") {
    return envUrl; // explicit Render backend URL
  }

  const { hostname, protocol } = window.location;

  // Local development
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "http://localhost:5000";
  }

  // Render production
  return `${protocol}//${hostname}`; // remove :5000
};
