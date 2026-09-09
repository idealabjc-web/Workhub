import axios from "axios";

// When both frontend and backend are on the same Vercel domain,
// use relative URLs (empty string). For local dev, set VITE_API_URL.
const API_URL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1"
    ? ""
    : "http://127.0.0.1:8000");

const api = axios.create({ baseURL: API_URL });


api.interceptors.request.use((config) => {
  const token = localStorage.getItem("hr_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const isAuthRoute = err.config?.url?.includes("/api/auth/");
    if (err.response?.status === 401 && !isAuthRoute) {
      const detail = err.response?.data?.detail;
      if (detail === "Invalid token" || detail === "Not authenticated" || detail === "Could not validate credentials") {
        localStorage.removeItem("hr_token");
        localStorage.removeItem("hr_user");
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

export default api;
