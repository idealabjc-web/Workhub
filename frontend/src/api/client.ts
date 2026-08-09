import axios from "axios";

// Permanent cloud-hosted backend on Render.com
// This never changes and works from any device worldwide
const API_URL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1"
    ? "https://idealab-workhub-api.onrender.com"
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
    if (err.response?.status === 401) {
      localStorage.removeItem("hr_token");
      localStorage.removeItem("hr_user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default api;
