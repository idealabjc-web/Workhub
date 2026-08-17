import { useEffect, useState } from "react";
import { LogIn, LogOut, MapPin, Clock, AlertTriangle, CheckCircle, Navigation, ShieldCheck, Settings, Globe } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

interface OfficeLocation {
  name: string;
  lat: number;
  lng: number;
  radius_meters: number;
}

interface TodayAttendance {
  id: string;
  check_in?: string;
  check_out?: string;
  check_in_lat?: number;
  check_in_lng?: number;
  check_out_lat?: number;
  check_out_lng?: number;
  status: string;
  is_late: boolean;
  overtime_hours?: number;
  notes?: string;
}

interface TodayStatusData {
  date: string;
  employee_id: string;
  branch: string;
  office_location: OfficeLocation;
  allow_remote_checkin?: boolean;
  attendance: TodayAttendance | null;
}

function parseUtcDate(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  const hasTimezone = dateStr.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(dateStr);
  const normalized = hasTimezone ? dateStr : `${dateStr}Z`;
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
}

function formatLocalTime(dateStr?: string | null, fallback = "—"): string {
  const d = parseUtcDate(dateStr);
  return d ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : fallback;
}

export default function CheckInOutCard({ onStatusChange }: { onStatusChange?: () => void }) {
  const { user } = useAuth();
  const isHR = user && ["SUPER_ADMIN", "HR", "MANAGER", "FINANCE"].includes(user.role);

  const [data, setData] = useState<TodayStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Geolocation state
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [remoteAllowed, setRemoteAllowed] = useState(false);

  // Live work duration counter
  const [workDuration, setWorkDuration] = useState<string>("");

  const loadStatus = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/attendance/today-status");
      setData(res.data);
      if (res.data.allow_remote_checkin !== undefined) {
        setRemoteAllowed(Boolean(res.data.allow_remote_checkin));
      }
    } catch (err: any) {
      console.error("Failed to fetch today status", err);
    } finally {
      setLoading(false);
    }
  };

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by your browser");
      setGettingLocation(false);
      return;
    }

    setGettingLocation(true);
    setGeoError(null);

    // Fast attempt 1: High accuracy (short 4s timeout)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGettingLocation(false);
      },
      () => {
        // Fallback attempt 2: Standard accuracy (Wi-Fi / IP positioning, fast & reliable)
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            setGettingLocation(false);
          },
          (fallbackErr) => {
            setGettingLocation(false);
            if (fallbackErr.code === fallbackErr.PERMISSION_DENIED) {
              setGeoError("Location permission denied in browser settings.");
            } else {
              setGeoError("GPS signal weak. Check-in is enabled via Remote Access.");
            }
          },
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
        );
      },
      { enableHighAccuracy: true, timeout: 4000, maximumAge: 30000 }
    );
  };

  useEffect(() => {
    loadStatus();
    requestLocation();
  }, []);

  // Calculate distance whenever coords or office_location changes
  useEffect(() => {
    if (!coords || !data?.office_location) return;

    const lat1 = coords.lat;
    const lon1 = coords.lng;
    const lat2 = data.office_location.lat;
    const lon2 = data.office_location.lng;

    const R = 6371000; // Radius of Earth in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const dPhi = ((lat2 - lat1) * Math.PI) / 180;
    const dLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;

    setDistanceMeters(Math.round(d));
  }, [coords, data?.office_location]);

  // Live timer for work duration if checked in and not checked out
  useEffect(() => {
    if (!data?.attendance?.check_in || data.attendance.check_out) {
      setWorkDuration("");
      return;
    }

    const checkInDate = parseUtcDate(data.attendance.check_in);
    if (!checkInDate) return;
    const checkInTime = checkInDate.getTime();

    const updateTimer = () => {
      const now = new Date().getTime();
      const diffMs = Math.max(0, now - checkInTime);
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diffMs % (1000 * 60)) / 1000);

      setWorkDuration(`${hours}h ${mins}m ${secs}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [data?.attendance]);

  const handleCheckIn = async () => {
    setError(null);
    setSuccess(null);

    setActionLoading(true);
    try {
      await api.post("/api/attendance/check-in", {
        employee_id: user?.employee_id || data?.employee_id,
        latitude: coords?.lat || 0.0,
        longitude: coords?.lng || 0.0,
      });
      setSuccess("Checked in successfully!");
      await loadStatus();
      if (onStatusChange) onStatusChange();
    } catch (err: any) {
      let detailMsg = "Check-in failed. Please try again.";
      if (err.response?.data?.detail) {
        const d = err.response.data.detail;
        if (typeof d === "string") detailMsg = d;
        else if (Array.isArray(d)) detailMsg = d.map((x: any) => x.msg || JSON.stringify(x)).join(", ");
        else detailMsg = JSON.stringify(d);
      }
      setError(detailMsg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setError(null);
    setSuccess(null);

    setActionLoading(true);
    try {
      await api.post("/api/attendance/check-out", {
        employee_id: user?.employee_id || data?.employee_id,
        latitude: coords?.lat || 0.0,
        longitude: coords?.lng || 0.0,
      });
      setSuccess("Checked out successfully!");
      await loadStatus();
      if (onStatusChange) onStatusChange();
    } catch (err: any) {
      let detailMsg = "Check-out failed. Please try again.";
      if (err.response?.data?.detail) {
        const d = err.response.data.detail;
        if (typeof d === "string") detailMsg = d;
        else if (Array.isArray(d)) detailMsg = d.map((x: any) => x.msg || JSON.stringify(x)).join(", ");
        else detailMsg = JSON.stringify(d);
      }
      setError(detailMsg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSetCurrentAsOffice = async () => {
    if (!coords || !data) {
      setError("Please acquire your GPS location first by clicking 'Refresh GPS'");
      return;
    }
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await api.post("/api/attendance/set-office-location", {
        branch: data.branch,
        name: `${data.branch} Office Premises`,
        lat: coords.lat,
        lng: coords.lng,
        radius_meters: 1000.0,
      });
      setSuccess(`Updated office location coordinates for ${data.branch}!`);
      await loadStatus();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to update office location");
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleRemote = async () => {
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await api.post("/api/attendance/toggle-remote-checkin");
      setRemoteAllowed(res.data.allow_remote_checkin);
      setSuccess(`Remote check-in is now ${res.data.allow_remote_checkin ? "ENABLED (Geofence Bypassed)" : "DISABLED (Strict Geofence)"}`);
      await loadStatus();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to toggle remote check-in");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="card p-5 flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  const att = data?.attendance;
  const office = data?.office_location;

  const isCheckedIn = Boolean(att?.check_in && !att?.check_out);
  const isCheckedOut = Boolean(att?.check_in && att?.check_out);
  const isNotCheckedIn = !att?.check_in;

  const isWithinGeofence = remoteAllowed || (distanceMeters !== null && office ? distanceMeters <= office.radius_meters : false);

  return (
    <div className="card p-5 space-y-4 border-l-4 border-l-brand-500 shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="text-brand-500" size={18} /> Daily Check-In & Check-Out
          </h2>
          <p className="text-xs text-slate-400">
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>

        {/* Current Status Badge */}
        <div>
          {isNotCheckedIn && (
            <span className="badge bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 gap-1 font-semibold">
              <Clock size={12} /> Not Checked In
            </span>
          )}
          {isCheckedIn && (
            <span className="badge bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 gap-1 font-semibold animate-pulse">
              <CheckCircle size={12} /> Checked In ({workDuration})
            </span>
          )}
          {isCheckedOut && (
            <span className="badge bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 gap-1 font-semibold">
              <CheckCircle size={12} /> Day Completed
            </span>
          )}
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/30 p-3 text-xs text-red-700 dark:text-red-300 flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
          {isHR && (
            <button
              onClick={handleToggleRemote}
              className="px-2 py-1 rounded bg-brand-500 text-white font-bold text-[10px] shrink-0 hover:bg-brand-600"
            >
              Enable Remote Check-In
            </button>
          )}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 p-3 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle size={16} className="shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Location Geofence Status */}
      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <MapPin size={14} className="text-brand-500" /> Assigned Premises: <b>{office?.name || "Idealab Main Campus"}</b>
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={requestLocation}
              disabled={gettingLocation}
              className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1 disabled:opacity-50"
            >
              <Navigation size={12} className={gettingLocation ? "animate-spin" : ""} />
              {gettingLocation ? "Locating..." : "Refresh GPS"}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
          {remoteAllowed ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                <Globe size={13} /> Remote / Any Location Allowed
              </span>
            </div>
          ) : geoError ? (
            <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1 font-medium text-[11px]">
              <AlertTriangle size={13} /> {geoError}
            </span>
          ) : distanceMeters !== null ? (
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                  isWithinGeofence
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                    : "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300"
                }`}
              >
                {isWithinGeofence ? <ShieldCheck size={13} /> : <AlertTriangle size={13} />}
                {isWithinGeofence ? "Inside Office Location" : "Outside Office Location"}
              </span>
              <span className="text-slate-500 text-[11px]">
                ({distanceMeters < 1000 ? `${distanceMeters}m` : `${(distanceMeters / 1000).toFixed(2)}km`} from office, max allowed: {office?.radius_meters}m)
              </span>
            </div>
          ) : (
            <span className="text-slate-400 text-[11px]">Acquiring GPS coordinates...</span>
          )}

          {/* Quick Admin Actions */}
          {isHR && (
            <div className="flex items-center gap-1.5 ml-auto">
              {coords && (
                <button
                  onClick={handleSetCurrentAsOffice}
                  disabled={actionLoading}
                  className="px-2 py-0.5 rounded border border-brand-300 text-brand-700 bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/40 dark:text-brand-300 text-[10px] font-bold transition flex items-center gap-1"
                  title="Set your current GPS location as the office premises for this branch"
                >
                  <MapPin size={11} /> Set GPS as Office
                </button>
              )}
              <button
                onClick={handleToggleRemote}
                disabled={actionLoading}
                className="px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-[10px] font-bold transition flex items-center gap-1"
                title="Toggle whether check-in/out is allowed remotely from any location"
              >
                <Globe size={11} /> {remoteAllowed ? "Disable Remote" : "Allow Remote"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Today's Timestamps Summary */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40">
          <p className="text-slate-400 text-[10px] uppercase font-semibold">Check-In Time</p>
          <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
            {formatLocalTime(att?.check_in, "Not checked in")}
          </p>
          {att?.is_late && <span className="text-[10px] font-bold text-amber-600">Late Check-in</span>}
        </div>

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40">
          <p className="text-slate-400 text-[10px] uppercase font-semibold">Check-Out Time</p>
          <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
            {formatLocalTime(att?.check_out, "Not checked out")}
          </p>
          {att?.overtime_hours ? (
            <span className="text-[10px] font-bold text-emerald-600">+{att.overtime_hours}h Overtime</span>
          ) : null}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        {isNotCheckedIn && (
          <button
            onClick={handleCheckIn}
            disabled={actionLoading}
            className="btn-primary flex-1 gap-2 text-sm font-bold py-2.5 shadow-md hover:shadow-brand-500/20 disabled:opacity-50"
          >
            {actionLoading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <LogIn size={16} />
            )}
            Check In Now
          </button>
        )}

        {isCheckedIn && (
          <button
            onClick={handleCheckOut}
            disabled={actionLoading}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm py-2.5 transition shadow-md disabled:opacity-50"
          >
            {actionLoading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <LogOut size={16} />
            )}
            Check Out
          </button>
        )}

        {isCheckedOut && (
          <div className="w-full text-center py-2 text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800">
            ✅ You have completed check-in and check-out for today.
          </div>
        )}
      </div>
    </div>
  );
}
