import { useEffect, useState, useMemo } from "react";
import {
  CalendarCheck, ChevronLeft, ChevronRight, Download, Upload, Plus, Check, X,
  Lock, Unlock, FileSpreadsheet, Search, RotateCcw, Trash2, Clock, CheckCircle
} from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import * as XLSX from "xlsx";
import CheckInOutCard from "../components/CheckInOutCard";

interface AttendanceRow {
  id: string;
  employee_id: string;
  date: string;
  check_in?: string;
  check_out?: string;
  status: string;
  is_late: boolean;
  notes?: string;
  employee_name?: string;
  employee_number?: string;
  branch?: string;
}

interface MonthlyData {
  month: string;
  days_in_month: number;
  is_finalized: boolean;
  employees: Array<{
    employee_id: string; employee_number: string; name: string; branch: string;
    days: Record<number, string>; present: number; absent: number; leave: number;
    wfh: number; half_day: number; holiday: number; week_off: number; attendance_pct: number;
  }>;
}

interface Correction {
  id: string; employee_id: string; date: string; requested_status: string;
  reason: string; status: string; created_at: string;
}

const STATUS_CODES: Record<string, { abbr: string; name: string; label: string; cls: string }> = {
  PRESENT:  { abbr: "P",   name: "Present",        label: "P - Present",          cls: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300" },
  ABSENT:   { abbr: "A",   name: "Absent",         label: "A - Absent",           cls: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950/60 dark:text-red-300" },
  LEAVE:    { abbr: "L",   name: "Leave",          label: "L - Leave",            cls: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300" },
  HALF_DAY: { abbr: "HD",  name: "Half Day",       label: "HD - Half Day",        cls: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300" },
  WFH:      { abbr: "WFH", name: "Work From Home", label: "WFH - Work From Home", cls: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300" },
  HOLIDAY:  { abbr: "H",   name: "Holiday",        label: "H - Holiday",          cls: "bg-pink-100 text-pink-800 border-pink-300 dark:bg-pink-950/60 dark:text-pink-300" },
  WEEK_OFF: { abbr: "WO",  name: "Week Off",       label: "WO - Week Off",        cls: "bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-400" },
};

const ABBR_TO_STATUS: Record<string, string> = {
  P: "PRESENT", A: "ABSENT", L: "LEAVE", HD: "HALF_DAY", WFH: "WFH", H: "HOLIDAY", WO: "WEEK_OFF",
};

function formatDateMDY(dateStr: string): string {
  if (!dateStr) return "—";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      return `${month}/${day}/${year}`;
    }
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? dateStr : `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

function formatDayName(dateStr: string): string {
  if (!dateStr) return "—";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      const d = new Date(year, month - 1, day);
      return d.toLocaleDateString("en-US", { weekday: "short" });
    }
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US", { weekday: "short" });
}

/**
 * Parse an ISO or datetime string directly into a local Date without UTC offset shifts.
 */
function parseLocalDate(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  const str = dateStr.trim();
  if (!str || str === "null" || str === "None") return null;

  // Handle bare time e.g. "09:30" or "09:30:00"
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(str)) {
    const parts = str.split(":").map(Number);
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), parts[0] || 0, parts[1] || 0, parts[2] || 0);
  }

  // Check if string contains standard ISO format with timezone offset
  if (str.includes("Z") || str.includes("+") || (str.includes("-") && str.lastIndexOf("-") > 10)) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d;
  }

  const sep = str.includes("T") ? "T" : str.includes(" ") ? " " : null;
  if (sep) {
    const [dPart, tPart] = str.split(sep);
    if (dPart && tPart) {
      const [yr, mo, dy] = dPart.split("-").map(Number);
      const [rawH, rawM, rawS] = tPart.split(":").map(Number);
      if (!isNaN(yr) && !isNaN(mo) && !isNaN(dy)) {
        let h = rawH || 0;
        let m = rawM || 0;
        const s = rawS || 0;

        // Auto-convert UTC stored times to Indian Standard Time (IST +5:30):
        // Early morning 1-6 AM UTC check-in -> convert to IST (e.g. 04:00 UTC -> 09:30 AM IST)
        if (h >= 1 && h <= 6) {
          h += 5;
          m += 30;
          if (m >= 60) {
            h += 1;
            m -= 60;
          }
        } else if (h >= 12 && h <= 15) {
          // Mid-day 12-15 UTC check-out -> convert to IST (e.g. 13:00 UTC -> 18:30 / 06:30 PM IST)
          h += 5;
          m += 30;
          if (m >= 60) {
            h += 1;
            m -= 60;
          }
        }

        return new Date(yr, mo - 1, dy, h, m, s);
      }
    }
  }

  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Format timestamp into standard local "HH:MM AM/PM".
 */
function formatLocalTime(dateStr?: string | null, fallback = "—"): string {
  if (!dateStr) return fallback;
  const d = parseLocalDate(dateStr);
  if (!d) return fallback;
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
}



export default function Attendance() {
  const { user } = useAuth();
  const isHR = user && ["SUPER_ADMIN", "HR", "MANAGER", "FINANCE"].includes(user.role);
  const canEditAttendance = user && ["SUPER_ADMIN", "HR", "MANAGER"].includes(user.role);

  const [activeTab, setActiveTab] = useState<"personal" | "all_employees" | "pagara" | "corrections">("personal");
  const [viewMode, setViewMode] = useState<"day" | "month">("day");
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [allEmployees, setAllEmployees] = useState<Array<{ id: string; employee_number: string; first_name: string; last_name: string; branch: string }>>([]);
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [monthlyData, setMonthlyData] = useState<MonthlyData | null>(null);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [branchFilter, setBranchFilter] = useState("");
  const [loading, setLoading] = useState(false);

  // Pagara Cell Editor Popover state
  const [editingCell, setEditingCell] = useState<{ empId: string; day: number; currentStatus: string } | null>(null);

  // HR Time Edit Modal state
  const [editingTimeRow, setEditingTimeRow] = useState<AttendanceRow | null>(null);
  const [timeForm, setTimeForm] = useState({ check_in: "", check_out: "", status: "PRESENT", notes: "" });

  // Correction Request State
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [corrForm, setCorrForm] = useState({ date: new Date().toISOString().slice(0, 10), requested_status: "PRESENT", reason: "" });

  // Excel Import Modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);

  // Bulk Time Change Modal
  const [showBulkTimeModal, setShowBulkTimeModal] = useState(false);
  const [bulkTimeForm, setBulkTimeForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    branch: "",
    check_in: "09:30",
    check_out: "18:30",
    status: "PRESENT",
    notes: "Office standard timings updated by HR",
  });
  const [bulkLoading, setBulkLoading] = useState(false);

  const handleApplyBulkTime = async (e: React.FormEvent) => {
    e.preventDefault();
    setBulkLoading(true);
    try {
      const res = await api.post("/api/attendance/bulk-time", {
        date: bulkTimeForm.date,
        branch: bulkTimeForm.branch || undefined,
        check_in: bulkTimeForm.check_in,
        check_out: bulkTimeForm.check_out,
        status: bulkTimeForm.status,
        notes: bulkTimeForm.notes,
      });
      alert(res.data.message || "Attendance timestamps successfully updated for all employees!");
      setShowBulkTimeModal(false);
      if (viewMode === "day") {
        setSelectedDate(bulkTimeForm.date);
        loadDayAttendance();
      } else {
        loadAllAttendance();
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to bulk update attendance time");
    } finally {
      setBulkLoading(false);
    }
  };

  const handleOpenTimeEdit = (r: AttendanceRow) => {
    setEditingTimeRow(r);
    /**
     * Extract HH:MM from a datetime string directly (no Date constructor).
     */
    const getHHMM = (dtStr?: string | null) => {
      if (!dtStr) return "";
      const str = dtStr.trim();
      if (/^\d{1,2}:\d{2}$/.test(str)) return str;
      const d = parseLocalDate(dtStr);
      if (!d) return "";
      const h = String(d.getHours()).padStart(2, "0");
      const m = String(d.getMinutes()).padStart(2, "0");
      return `${h}:${m}`;
    };


    setTimeForm({
      check_in: getHHMM(r.check_in),
      check_out: getHHMM(r.check_out),
      status: r.status || "PRESENT",
      notes: r.notes || "",
    });
  };

  const handleSaveTimeEdit = async () => {
    if (!editingTimeRow) return;
    try {
      const res = await api.patch(`/api/attendance/${editingTimeRow.id}/time`, {
        employee_id: editingTimeRow.employee_id,
        date: editingTimeRow.date,
        check_in: timeForm.check_in,
        check_out: timeForm.check_out,
        status: timeForm.status,
        notes: timeForm.notes,
      });
      setRows((prev) => {
        const matchIdx = prev.findIndex(
          (row) => row.id === editingTimeRow.id || row.id === res.data.id || (row.employee_id === res.data.employee_id && row.date === res.data.date)
        );
        if (matchIdx >= 0) {
          const next = [...prev];
          next[matchIdx] = { ...next[matchIdx], ...res.data };
          return next;
        }
        return [res.data, ...prev];
      });
      setEditingTimeRow(null);
      if (activeTab === "personal") loadPersonal();
      else if (activeTab === "all_employees") {
        if (viewMode === "day") loadDayAttendance();
        else loadAllAttendance();
      } else if (activeTab === "pagara") {
        loadMonthlyGrid();
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to update attendance time");
    }
  };

  const loadEmployeesList = async () => {
    try {
      const r = await api.get("/api/employees");
      setAllEmployees(r.data || []);
    } catch {}
  };

  const loadPersonal = () => {
    api.get("/api/attendance", { params: { employee_id: user?.employee_id, month } })
      .then((r) => setRows(r.data))
      .catch(() => {});
  };

  const loadAllAttendance = () => {
    setLoading(true);
    api.get("/api/attendance", { params: { month, branch: branchFilter || undefined } })
      .then((r) => setRows(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const loadDayAttendance = () => {
    setLoading(true);
    if (allEmployees.length === 0) {
      loadEmployeesList();
    }
    api.get("/api/attendance", { params: { start_date: selectedDate, end_date: selectedDate, branch: branchFilter || undefined } })
      .then((r) => setRows(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const loadMonthlyGrid = async () => {
    setLoading(true);
    try {
      const r = await api.get("/api/attendance/monthly-summary", {
        params: { month, branch: branchFilter || undefined },
      });
      setMonthlyData(r.data);
    } catch { }
    setLoading(false);
  };

  const loadCorrections = () => {
    api.get("/api/attendance/corrections").then((r) => setCorrections(r.data)).catch(() => {});
  };

  useEffect(() => {
    if (activeTab === "personal") loadPersonal();
    else if (activeTab === "all_employees") {
      if (viewMode === "day") {
        loadDayAttendance();
      } else {
        loadAllAttendance();
      }
    }
    else if (activeTab === "pagara") loadMonthlyGrid();
    else if (activeTab === "corrections") loadCorrections();
  }, [activeTab, viewMode, selectedDate, month, branchFilter]);

  const filteredRows = rows.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const nameMatch = r.employee_name?.toLowerCase().includes(q);
    const numMatch = r.employee_number?.toLowerCase().includes(q);
    const dateMatch = r.date?.includes(q);
    return Boolean(nameMatch || numMatch || dateMatch);
  });

  const daySheetRows = useMemo(() => {
    if (viewMode !== "day") return [];

    let empList = allEmployees;
    if (branchFilter) {
      empList = empList.filter((e) => e.branch === branchFilter);
    }

    const attMap = new Map<string, AttendanceRow>();
    rows.forEach((r) => attMap.set(r.employee_id, r));

    const parts = selectedDate.split("-");
    const yr = parseInt(parts[0], 10);
    const mo = parseInt(parts[1], 10);
    const dy = parseInt(parts[2], 10);
    const isSunday = !isNaN(yr) && !isNaN(mo) && !isNaN(dy) && new Date(yr, mo - 1, dy).getDay() === 0;

    const merged: AttendanceRow[] = empList.map((emp) => {
      const existing = attMap.get(emp.id);
      if (existing) {
        return {
          ...existing,
          employee_name: existing.employee_name || `${emp.first_name} ${emp.last_name}`,
          employee_number: existing.employee_number || emp.employee_number,
          branch: existing.branch || emp.branch,
        };
      }
      return {
        id: `virtual-${emp.id}`,
        employee_id: emp.id,
        date: selectedDate,
        status: isSunday ? "WEEK_OFF" : "ABSENT",
        is_late: false,
        employee_name: `${emp.first_name} ${emp.last_name}`,
        employee_number: emp.employee_number,
        branch: emp.branch,
      };
    });

    if (!searchQuery.trim()) return merged;
    const q = searchQuery.toLowerCase();
    return merged.filter((r) => {
      const nameMatch = r.employee_name?.toLowerCase().includes(q);
      const numMatch = r.employee_number?.toLowerCase().includes(q);
      return Boolean(nameMatch || numMatch);
    });
  }, [viewMode, allEmployees, rows, selectedDate, branchFilter, searchQuery]);

  const dayStats = useMemo(() => {
    const stats = { total: daySheetRows.length, present: 0, absent: 0, leave: 0, wfh: 0, half_day: 0, week_off: 0, holiday: 0 };
    daySheetRows.forEach((r) => {
      const s = r.status?.toUpperCase();
      if (s === "PRESENT") stats.present++;
      else if (s === "ABSENT") stats.absent++;
      else if (s === "LEAVE") stats.leave++;
      else if (s === "WFH") stats.wfh++;
      else if (s === "HALF_DAY") stats.half_day++;
      else if (s === "WEEK_OFF") stats.week_off++;
      else if (s === "HOLIDAY") stats.holiday++;
    });
    return stats;
  }, [daySheetRows]);

  const exportDaySheetExcel = () => {
    const exportRows = daySheetRows.map((r) => ({
      "Employee #": r.employee_number || "—",
      "Employee Name": r.employee_name || "—",
      "Branch": r.branch || "—",
      "Date": formatDateMDY(r.date),
      "Day": formatDayName(r.date),
      "Status": STATUS_CODES[r.status]?.name || r.status,
      "Check In": formatLocalTime(r.check_in),
      "Check Out": formatLocalTime(r.check_out),
      "Notes": r.notes || "—",
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Attendance_${selectedDate}`);
    XLSX.writeFile(wb, `Day_Attendance_Sheet_${selectedDate}.xlsx`);
  };

  const exportLogsExcel = () => {
    const exportRows = filteredRows.map((r) => ({
      "Employee #": r.employee_number || "—",
      "Employee Name": r.employee_name || "—",
      "Branch": r.branch || "—",
      "Date": formatDateMDY(r.date),
      "Day": formatDayName(r.date),
      "Status": STATUS_CODES[r.status]?.name || r.status,
      "Check In": formatLocalTime(r.check_in),
      "Check Out": formatLocalTime(r.check_out),
      "Notes": r.notes || "—",
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Logs_${month}`);
    XLSX.writeFile(wb, `Attendance_Logs_${month}.xlsx`);
  };

  const handleDeleteRow = async (id: string, empName?: string, dateStr?: string) => {
    if (!confirm(`Undo / delete attendance record for ${empName || "employee"} on ${formatDateMDY(dateStr || "")}?`)) return;
    try {
      await api.delete(`/api/attendance/${id}`);
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to delete attendance record");
    }
  };

  // Pagara Cell Click handler: saves updated status directly
  const handleCellStatusSelect = async (newStatus: string) => {
    if (!editingCell || !monthlyData || monthlyData.is_finalized) return;
    const { empId, day } = editingCell;
    const dayStr = day < 10 ? `0${day}` : `${day}`;
    const dateStr = `${month}-${dayStr}`;

    try {
      await api.patch("/api/attendance/cell", {
        employee_id: empId,
        date: dateStr,
        status: newStatus,
      });

      const updatedVal = newStatus === "CLEAR" ? "" : newStatus;

      setMonthlyData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          employees: prev.employees.map((emp) => {
            if (emp.employee_id === empId) {
              return {
                ...emp,
                days: { ...emp.days, [day]: updatedVal },
              };
            }
            return emp;
          }),
        };
      });
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to update attendance cell");
    } finally {
      setEditingCell(null);
    }
  };

  const toggleFinalize = async () => {
    if (!confirm(`Toggle finalization for ${month}?`)) return;
    await api.post("/api/attendance/finalize", null, { params: { month, branch: branchFilter || undefined } }).catch(() => {});
    loadMonthlyGrid();
  };

  const handleApplyCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.employee_id) return;
    await api.post("/api/attendance/corrections", {
      ...corrForm,
      employee_id: user.employee_id,
    }).catch(() => {});
    setShowCorrectionModal(false);
    setCorrForm({ date: new Date().toISOString().slice(0, 10), requested_status: "PRESENT", reason: "" });
    loadCorrections();
  };

  const handleReviewCorrection = async (id: string, status: string) => {
    await api.patch(`/api/attendance/corrections/${id}`, null, { params: { status } }).catch(() => {});
    loadCorrections();
  };

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsName = wb.SheetNames[0];
        const data = XLSX.utils.sheet_to_json(wb.Sheets[wsName]) as any[];

        const records = data.map((row) => ({
          employee_id: row["Employee ID"] || row["employee_id"],
          date: row["Date"] || row["date"],
          status: ABBR_TO_STATUS[row["Status"]] || row["Status"] || "PRESENT",
        })).filter(r => r.employee_id && r.date);

        await api.post("/api/attendance/import", { records });
        setShowImportModal(false);
        if (activeTab === "pagara") loadMonthlyGrid();
        else if (activeTab === "all_employees") loadAllAttendance();
        else loadPersonal();
        alert(`Successfully imported ${records.length} attendance records!`);
      } catch (err: any) {
        alert("Error parsing or importing Excel file: " + (err.message || err));
      } finally {
        setImporting(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const exportMonthlyExcel = () => {
    if (!monthlyData) return;
    const exportRows = monthlyData.employees.map((e) => {
      const r: Record<string, any> = {
        "Emp #": e.employee_number,
        "Name": e.name,
        "Branch": e.branch,
      };
      for (let d = 1; d <= monthlyData.days_in_month; d++) {
        r[`Day ${d}`] = STATUS_CODES[e.days[d]]?.abbr || "";
      }
      r["Present"] = e.present;
      r["Absent"] = e.absent;
      r["Leave"] = e.leave;
      r["WFH"] = e.wfh;
      r["Attendance%"] = `${e.attendance_pct}%`;
      return r;
    });
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Attendance_${month}`);
    XLSX.writeFile(wb, `Pagara_Attendance_${month}.xlsx`);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <CalendarCheck size={22} className="text-brand-500" /> Attendance Management
          </h1>
          <p className="text-sm text-slate-400">Personal logs, team check-in & check-out records, and monthly grid</p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {/* Tab Switcher */}
          <div className="flex rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 shadow-xs">
            <button
              onClick={() => setActiveTab("personal")}
              className={`px-3.5 py-1.5 text-xs font-semibold transition ${
                activeTab === "personal" ? "bg-brand-500 text-white" : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              My Attendance
            </button>
            {isHR && (
              <>
                <button
                  onClick={() => setActiveTab("all_employees")}
                  className={`px-3.5 py-1.5 text-xs font-semibold transition ${
                    activeTab === "all_employees" ? "bg-brand-500 text-white" : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
                  }`}
                >
                  All Employees Logs
                </button>
                <button
                  onClick={() => setActiveTab("pagara")}
                  className={`px-3.5 py-1.5 text-xs font-semibold transition ${
                    activeTab === "pagara" ? "bg-brand-500 text-white" : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
                  }`}
                >
                  Pagara Grid (HR)
                </button>
              </>
            )}
            <button
              onClick={() => setActiveTab("corrections")}
              className={`px-3.5 py-1.5 text-xs font-semibold transition ${
                activeTab === "corrections" ? "bg-brand-500 text-white" : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              Corrections
            </button>
          </div>

          {isHR && (
            <>
              {activeTab === "all_employees" && (
                <button
                  onClick={() => {
                    setBulkTimeForm((prev) => ({
                      ...prev,
                      date: viewMode === "day" ? selectedDate : new Date().toISOString().slice(0, 10),
                      branch: branchFilter || "",
                    }));
                    setShowBulkTimeModal(true);
                  }}
                  className="btn-primary gap-1.5 text-xs py-1.5 bg-brand-600 hover:bg-brand-700 text-white shadow-xs"
                  title="Change check-in & check-out time for all employees at once"
                >
                  <Clock size={14} /> Bulk Change Time
                </button>
              )}
              <button onClick={() => setShowImportModal(true)} className="btn-secondary gap-1.5 text-xs py-1.5">
                <Upload size={14} /> Import Excel
              </button>
              {activeTab === "all_employees" && (
                <button onClick={viewMode === "day" ? exportDaySheetExcel : exportLogsExcel} className="btn-secondary gap-1.5 text-xs py-1.5">
                  <Download size={14} /> Export {viewMode === "day" ? "Day Sheet" : "Logs"}
                </button>
              )}
              {activeTab === "pagara" && (
                <button onClick={exportMonthlyExcel} className="btn-secondary gap-1.5 text-xs py-1.5">
                  <Download size={14} /> Export Grid
                </button>
              )}
            </>
          )}


          {!isHR && (
            <button onClick={() => setShowCorrectionModal(true)} className="btn-primary gap-1.5 text-xs py-1.5">
              <Plus size={14} /> Request Correction
            </button>
          )}
        </div>
      </div>

      {/* Month & Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {activeTab === "all_employees" && isHR && (
            <div className="flex rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 shadow-xs mr-2">
              <button
                onClick={() => setViewMode("day")}
                className={`px-3 py-1.5 text-xs font-semibold transition ${
                  viewMode === "day" ? "bg-brand-500 text-white" : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
                }`}
              >
                Day Sheet
              </button>
              <button
                onClick={() => setViewMode("month")}
                className={`px-3 py-1.5 text-xs font-semibold transition ${
                  viewMode === "month" ? "bg-brand-500 text-white" : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
                }`}
              >
                Monthly Logs
              </button>
            </div>
          )}

          {activeTab === "all_employees" && viewMode === "day" && isHR ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSelectedDate((prev) => {
                  const parts = prev.split("-");
                  const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                  d.setDate(d.getDate() - 1);
                  const yr = d.getFullYear();
                  const mo = String(d.getMonth() + 1).padStart(2, "0");
                  const dy = String(d.getDate()).padStart(2, "0");
                  return `${yr}-${mo}-${dy}`;
                })}
                className="btn-secondary !px-2 !py-1.5"
                title="Previous Day"
              >
                <ChevronLeft size={15} />
              </button>
              <input
                type="date"
                className="input w-36 text-xs py-1.5"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
              <button
                onClick={() => setSelectedDate((prev) => {
                  const parts = prev.split("-");
                  const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                  d.setDate(d.getDate() + 1);
                  const yr = d.getFullYear();
                  const mo = String(d.getMonth() + 1).padStart(2, "0");
                  const dy = String(d.getDate()).padStart(2, "0");
                  return `${yr}-${mo}-${dy}`;
                })}
                className="btn-secondary !px-2 !py-1.5"
                title="Next Day"
              >
                <ChevronRight size={15} />
              </button>
              <button
                onClick={() => setSelectedDate(new Date().toISOString().slice(0, 10))}
                className="btn-secondary text-xs px-2.5 py-1.5 font-medium ml-1"
              >
                Today
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <button onClick={() => setMonth(m => { const d = new Date(m + "-01"); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7); })} className="btn-secondary !px-2 !py-1.5">
                <ChevronLeft size={15} />
              </button>
              <input type="month" className="input w-36 text-xs py-1.5" value={month} onChange={(e) => setMonth(e.target.value)} />
              <button onClick={() => setMonth(m => { const d = new Date(m + "-01"); d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0, 7); })} className="btn-secondary !px-2 !py-1.5">
                <ChevronRight size={15} />
              </button>
            </div>
          )}
        </div>

        {activeTab === "all_employees" && isHR && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search employee or ID..."
                className="input pl-8 text-xs py-1.5 w-48"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select className="input text-xs py-1.5 w-36" value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
              <option value="">All Branches</option>
              <option value="IDEALAB">Idealab</option>
              <option value="UGC">UGC</option>
              <option value="VIZAG">Vizag</option>
            </select>
          </div>
        )}

        {activeTab === "pagara" && isHR && (
          <div className="flex items-center gap-2">
            <select className="input w-36 text-xs py-1.5" value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
              <option value="">All Branches</option>
              <option value="IDEALAB">Idealab</option>
              <option value="UGC">UGC</option>
              <option value="VIZAG">Vizag</option>
            </select>

            <button
              onClick={toggleFinalize}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                monthlyData?.is_finalized
                  ? "bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {monthlyData?.is_finalized ? <Lock size={13} /> : <Unlock size={13} />}
              {monthlyData?.is_finalized ? "Finalized (Locked)" : "Draft (Editable)"}
            </button>
          </div>
        )}
      </div>

      {/* Day Sheet Summary KPIs */}
      {activeTab === "all_employees" && viewMode === "day" && isHR && (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
          <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <p className="text-[10px] uppercase font-bold text-slate-400">Total Staff</p>
            <p className="text-lg font-extrabold text-slate-800 dark:text-slate-100">{dayStats.total}</p>
          </div>
          <div className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20">
            <p className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">Present</p>
            <p className="text-lg font-extrabold text-emerald-700 dark:text-emerald-300">{dayStats.present}</p>
          </div>
          <div className="p-3 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20">
            <p className="text-[10px] uppercase font-bold text-red-600 dark:text-red-400">Absent</p>
            <p className="text-lg font-extrabold text-red-700 dark:text-red-300">{dayStats.absent}</p>
          </div>
          <div className="p-3 rounded-xl border border-purple-200 dark:border-purple-900/40 bg-purple-50/50 dark:bg-purple-950/20">
            <p className="text-[10px] uppercase font-bold text-purple-600 dark:text-purple-400">On Leave</p>
            <p className="text-lg font-extrabold text-purple-700 dark:text-purple-300">{dayStats.leave}</p>
          </div>
          <div className="p-3 rounded-xl border border-blue-200 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20">
            <p className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400">WFH</p>
            <p className="text-lg font-extrabold text-blue-700 dark:text-blue-300">{dayStats.wfh}</p>
          </div>
          <div className="p-3 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20">
            <p className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400">Half Day</p>
            <p className="text-lg font-extrabold text-amber-700 dark:text-amber-300">{dayStats.half_day}</p>
          </div>
          <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-800/40">
            <p className="text-[10px] uppercase font-bold text-slate-500">Week Off</p>
            <p className="text-lg font-extrabold text-slate-700 dark:text-slate-300">{dayStats.week_off}</p>
          </div>
        </div>
      )}

      {/* Legend for Status Codes */}
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
        <span className="font-semibold text-slate-500 mr-1">Status Codes:</span>
        {Object.entries(STATUS_CODES).map(([k, cfg]) => (
          <span key={k} className={`px-2 py-0.5 rounded border text-[10px] font-bold ${cfg.cls}`}>
            {cfg.abbr} = {cfg.name}
          </span>
        ))}
      </div>

      {/* TAB 1: PERSONAL ATTENDANCE LOG */}
      {activeTab === "personal" && (
        <div className="space-y-4">
          <CheckInOutCard onStatusChange={loadPersonal} />
          <div className="card overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 uppercase text-[10px] font-bold text-slate-400 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3">DATE</th>
                  <th className="px-4 py-3">DAY</th>
                  <th className="px-4 py-3">STATUS</th>
                  <th className="px-4 py-3">CHECK IN</th>
                  <th className="px-4 py-3">CHECK OUT</th>
                  <th className="px-4 py-3">NOTES</th>
                  {canEditAttendance && <th className="px-4 py-3 text-right">ACTION</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const cfg = STATUS_CODES[r.status] || STATUS_CODES.PRESENT;
                  return (
                    <tr key={r.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-3.5 font-semibold text-slate-800 dark:text-slate-200">{formatDateMDY(r.date)}</td>
                      <td className="px-4 py-3.5 text-slate-400 font-medium">{formatDayName(r.date)}</td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md border font-semibold text-[11px] ${cfg.cls}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-medium text-slate-700 dark:text-slate-300">{formatLocalTime(r.check_in)}</td>
                      <td className="px-4 py-3.5 font-medium text-slate-700 dark:text-slate-300">{formatLocalTime(r.check_out)}</td>
                      <td className="px-4 py-3.5 text-slate-400">{r.notes || "—"}</td>
                      {canEditAttendance && (
                        <td className="px-4 py-3.5 text-right">
                          <button
                            onClick={() => handleOpenTimeEdit(r)}
                            className="p-1.5 rounded-lg text-brand-600 hover:text-brand-700 hover:bg-brand-50 dark:hover:bg-brand-950/40 transition"
                            title="Edit check-in & check-out time"
                          >
                            <Clock size={15} />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr><td colSpan={canEditAttendance ? 7 : 6} className="px-4 py-10 text-center text-slate-400">No attendance records for {month}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: ALL EMPLOYEES ATTENDANCE LOG (HR VIEW) */}
      {activeTab === "all_employees" && isHR && (
        <div className="space-y-4">
          <div className="card overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 uppercase text-[10px] font-bold text-slate-400 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-4 py-3">EMPLOYEE</th>
                    <th className="px-4 py-3">DATE</th>
                    <th className="px-4 py-3">DAY</th>
                    <th className="px-4 py-3">STATUS</th>
                    <th className="px-4 py-3">CHECK IN</th>
                    <th className="px-4 py-3">CHECK OUT</th>
                    <th className="px-4 py-3">NOTES</th>
                    <th className="px-4 py-3 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {(viewMode === "day" ? daySheetRows : filteredRows).map((r) => {
                    const cfg = STATUS_CODES[r.status] || STATUS_CODES.PRESENT;
                    const isVirtual = r.id.startsWith("virtual-");
                    return (
                      <tr key={r.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="px-4 py-3.5">
                          <p className="font-semibold text-slate-800 dark:text-slate-100">{r.employee_name || "Staff Member"}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{r.employee_number || ""} {r.branch ? `· ${r.branch}` : ""}</p>
                        </td>
                        <td className="px-4 py-3.5 font-semibold text-slate-800 dark:text-slate-200">{formatDateMDY(r.date)}</td>
                        <td className="px-4 py-3.5 text-slate-400 font-medium">{formatDayName(r.date)}</td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-md border font-semibold text-[11px] ${cfg.cls}`}>
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-medium text-slate-700 dark:text-slate-300">{formatLocalTime(r.check_in)}</td>
                        <td className="px-4 py-3.5 font-medium text-slate-700 dark:text-slate-300">{formatLocalTime(r.check_out)}</td>
                        <td className="px-4 py-3.5 text-slate-400">{r.notes || "—"}</td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {canEditAttendance && (
                              <button
                                onClick={() => handleOpenTimeEdit(r)}
                                className="p-1.5 rounded-lg text-brand-600 hover:text-brand-700 hover:bg-brand-50 dark:hover:bg-brand-950/40 transition"
                                title={isVirtual ? "Set check-in & check-out time" : "Edit check-in & check-out time"}
                              >
                                <Clock size={15} />
                              </button>
                            )}
                            {!isVirtual && (
                              <button
                                onClick={() => handleDeleteRow(r.id, r.employee_name, r.date)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                                title="Undo / Delete mistaken attendance entry"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {(viewMode === "day" ? daySheetRows : filteredRows).length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">No attendance records found for selected filter</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: PAGARA MANUAL GRID EDITOR (HR ONLY) */}
      {activeTab === "pagara" && isHR && (
        <div className="card overflow-x-auto relative">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            </div>
          ) : monthlyData ? (
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
                  <th className="sticky left-0 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-slate-500 font-bold uppercase text-[10px] min-w-36 z-20 shadow-xs">Employee</th>
                  {Array.from({ length: monthlyData.days_in_month }, (_, i) => (
                    <th key={i + 1} className="px-1 py-2 text-center text-slate-500 font-bold text-[10px] min-w-8">{i + 1}</th>
                  ))}
                  <th className="px-2 py-2 text-center text-emerald-600 font-bold text-[10px] min-w-8">P</th>
                  <th className="px-2 py-2 text-center text-red-600 font-bold text-[10px] min-w-8">A</th>
                  <th className="px-2 py-2 text-center text-violet-600 font-bold text-[10px] min-w-8">L</th>
                  <th className="px-2 py-2 text-center text-blue-600 font-bold text-[10px] min-w-8">WFH</th>
                  <th className="px-2 py-2 text-center text-slate-700 dark:text-slate-300 font-bold text-[10px] min-w-12">%</th>
                </tr>
              </thead>
              <tbody>
                {monthlyData.employees.map((emp) => (
                  <tr key={emp.employee_id} className="border-b border-slate-100 last:border-0 dark:border-slate-800 hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="sticky left-0 bg-white dark:bg-slate-900 px-3 py-2 z-10 shadow-xs">
                      <p className="font-semibold text-slate-900 dark:text-white truncate max-w-32">{emp.name}</p>
                      <p className="text-[10px] text-slate-400">{emp.employee_number}</p>
                    </td>

                    {Array.from({ length: monthlyData.days_in_month }, (_, i) => {
                      const dayNum = i + 1;
                      const statusKey = emp.days[dayNum] || "";
                      const cfg = STATUS_CODES[statusKey];

                      return (
                        <td key={dayNum} className="px-0.5 py-1 text-center relative">
                          <button
                            disabled={monthlyData.is_finalized}
                            onClick={() => setEditingCell({ empId: emp.employee_id, day: dayNum, currentStatus: statusKey })}
                            className={`w-6 h-6 rounded text-[9px] font-bold transition flex items-center justify-center mx-auto border ${
                              cfg ? cfg.cls : "border-dashed border-slate-200 dark:border-slate-700 text-slate-300 hover:border-brand-500"
                            } ${monthlyData.is_finalized ? "cursor-not-allowed opacity-80" : "hover:scale-110 shadow-xs"}`}
                            title={`Click to set status for Day ${dayNum}`}
                          >
                            {cfg ? cfg.abbr : "-"}
                          </button>
                        </td>
                      );
                    })}

                    <td className="px-2 py-2 text-center font-bold text-emerald-600">{emp.present}</td>
                    <td className="px-2 py-2 text-center font-bold text-red-600">{emp.absent}</td>
                    <td className="px-2 py-2 text-center font-bold text-violet-600">{emp.leave}</td>
                    <td className="px-2 py-2 text-center font-bold text-blue-600">{emp.wfh}</td>
                    <td className="px-2 py-2 text-center">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        emp.attendance_pct >= 90 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40" : emp.attendance_pct >= 75 ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40" : "bg-red-50 text-red-700 dark:bg-red-950/40"
                      }`}>
                        {emp.attendance_pct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      )}

      {/* CELL EDIT POPOVER MODAL */}
      {editingCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setEditingCell(null)}>
          <div className="card p-5 max-w-xs w-full space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <p className="font-bold text-sm">Set Day {editingCell.day} Status</p>
              <button onClick={() => setEditingCell(null)}><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(STATUS_CODES).map(([k, cfg]) => (
                <button
                  key={k}
                  onClick={() => handleCellStatusSelect(k)}
                  className={`p-2.5 rounded-lg border text-xs font-bold transition flex items-center justify-between ${cfg.cls} hover:opacity-90`}
                >
                  <span>{cfg.name}</span>
                  <span className="text-xs">{cfg.abbr}</span>
                </button>
              ))}
            </div>

            <div className="pt-1">
              <button
                onClick={() => handleCellStatusSelect("CLEAR")}
                className="w-full p-2 rounded-lg border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:border-red-800 dark:text-red-300 text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                <RotateCcw size={14} /> Clear / Reset Cell (Undo Mistake)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CORRECTIONS */}
      {activeTab === "corrections" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Attendance Correction Requests</h3>
            {!isHR && (
              <button onClick={() => setShowCorrectionModal(true)} className="btn-primary gap-1 text-xs">
                <Plus size={14} /> Apply Correction
              </button>
            )}
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 uppercase text-[10px] font-bold text-slate-400 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Requested Status</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Status</th>
                  {isHR && <th className="px-4 py-3">Action</th>}
                </tr>
              </thead>
              <tbody>
                {corrections.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                    <td className="px-4 py-3 font-semibold">{formatDateMDY(c.date)}</td>
                    <td className="px-4 py-3">
                      <span className="badge bg-brand-50 text-brand-700">{STATUS_CODES[c.requested_status]?.name || c.requested_status}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 max-w-48 truncate">{c.reason}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${
                        c.status === "APPROVED" ? "bg-emerald-100 text-emerald-700" : c.status === "REJECTED" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                      }`}>{c.status}</span>
                    </td>
                    {isHR && (
                      <td className="px-4 py-3">
                        {c.status === "PENDING" && (
                          <div className="flex gap-1">
                            <button onClick={() => handleReviewCorrection(c.id, "APPROVED")} className="btn-primary !px-2 !py-1 text-[10px] gap-1">
                              <Check size={11} /> Approve
                            </button>
                            <button onClick={() => handleReviewCorrection(c.id, "REJECTED")} className="btn-secondary !px-2 !py-1 text-[10px] gap-1">
                              <X size={11} /> Reject
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {corrections.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No correction requests</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REQUEST CORRECTION MODAL */}
      {showCorrectionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowCorrectionModal(false)}>
          <form onSubmit={handleApplyCorrection} className="card p-5 max-w-md w-full space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-base">Request Attendance Correction</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Date *</label>
                <input required type="date" className="input text-sm" value={corrForm.date} onChange={(e) => setCorrForm({ ...corrForm, date: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Requested Status *</label>
                <select className="input text-sm" value={corrForm.requested_status} onChange={(e) => setCorrForm({ ...corrForm, requested_status: e.target.value })}>
                  {Object.entries(STATUS_CODES).map(([k, cfg]) => <option key={k} value={k}>{cfg.name} ({cfg.abbr})</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Reason *</label>
                <textarea required rows={3} placeholder="Explain why correction is needed..." className="input text-sm" value={corrForm.reason} onChange={(e) => setCorrForm({ ...corrForm, reason: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary flex-1">Submit Request</button>
              <button type="button" className="btn-secondary" onClick={() => setShowCorrectionModal(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* EXCEL IMPORT MODAL */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowImportModal(false)}>
          <div className="card p-6 max-w-md w-full space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base flex items-center gap-2">
                <FileSpreadsheet size={18} className="text-brand-500" /> Excel Attendance Import
              </h3>
              <button onClick={() => setShowImportModal(false)}><X size={16} className="text-slate-400" /></button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Upload an `.xlsx` or `.csv` file with columns: <b>Employee ID</b> (or <code>employee_id</code>), <b>Date</b> (<code>YYYY-MM-DD</code>), and <b>Status</b> (<code>P</code>, <code>A</code>, <code>L</code>, <code>HD</code>, <code>WFH</code>).
            </p>

            <div className="p-4 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center">
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleExcelImport} disabled={importing} className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100" />
            </div>

            {importing && (
              <div className="flex items-center justify-center gap-2 text-xs text-brand-600 font-medium py-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                Importing data...
              </div>
            )}

            <div className="flex justify-end">
              <button onClick={() => setShowImportModal(false)} className="btn-secondary text-xs">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* HR Edit Check-In / Check-Out Time Modal */}
      {editingTimeRow && canEditAttendance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-md p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Clock size={18} className="text-brand-500" /> Edit Check-In / Check-Out Time
              </h3>
              <button onClick={() => setEditingTimeRow(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-xs space-y-1">
              <p className="font-semibold text-slate-800 dark:text-slate-200">{editingTimeRow.employee_name || "Staff Member"}</p>
              <p className="text-slate-500">Date: {formatDateMDY(editingTimeRow.date)} ({formatDayName(editingTimeRow.date)})</p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Check-In Time</label>
                <input
                  type="time"
                  className="input w-full text-sm"
                  value={timeForm.check_in}
                  onChange={(e) => setTimeForm({ ...timeForm, check_in: e.target.value })}
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Check-Out Time</label>
                <input
                  type="time"
                  className="input w-full text-sm"
                  value={timeForm.check_out}
                  onChange={(e) => setTimeForm({ ...timeForm, check_out: e.target.value })}
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Attendance Status</label>
                <select
                  className="input w-full text-sm"
                  value={timeForm.status}
                  onChange={(e) => setTimeForm({ ...timeForm, status: e.target.value })}
                >
                  <option value="PRESENT">PRESENT</option>
                  <option value="WFH">WFH (Work From Home)</option>
                  <option value="HALF_DAY">HALF DAY</option>
                  <option value="ABSENT">ABSENT</option>
                  <option value="LEAVE">LEAVE</option>
                  <option value="WEEK_OFF">WEEK OFF</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Notes / Reason for Correction</label>
                <textarea
                  className="input w-full text-xs"
                  rows={2}
                  placeholder="e.g. Corrected check-in time per HR approval"
                  value={timeForm.notes}
                  onChange={(e) => setTimeForm({ ...timeForm, notes: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button onClick={() => setEditingTimeRow(null)} className="btn-secondary text-xs">Cancel</button>
              <button onClick={handleSaveTimeEdit} className="btn-primary text-xs">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Change Attendance Time Modal for All Employees */}
      {showBulkTimeModal && isHR && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-md p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Clock size={18} className="text-brand-500" /> Bulk Change Time for Employees
              </h3>
              <button onClick={() => setShowBulkTimeModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleApplyBulkTime} className="space-y-3.5 text-xs">
              <div className="p-3 bg-brand-50/60 dark:bg-brand-950/30 rounded-xl text-xs space-y-1 text-slate-700 dark:text-slate-300 border border-brand-100 dark:border-brand-900/50">
                <p className="font-semibold text-brand-700 dark:text-brand-300 flex items-center gap-1.5">
                  <CheckCircle size={14} /> Apply to All Active Staff
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  This will set the check-in, check-out, and attendance status for all employees for the selected date.
                </p>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Target Date</label>
                <input
                  type="date"
                  required
                  className="input w-full text-sm font-medium"
                  value={bulkTimeForm.date}
                  onChange={(e) => setBulkTimeForm({ ...bulkTimeForm, date: e.target.value })}
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Branch Scope</label>
                <select
                  className="input w-full text-sm"
                  value={bulkTimeForm.branch}
                  onChange={(e) => setBulkTimeForm({ ...bulkTimeForm, branch: e.target.value })}
                >
                  <option value="">All Branches</option>
                  <option value="IDEALAB">Lotus Idealab Campus</option>
                  <option value="UGC">Lotus UGC Office</option>
                  <option value="VIZAG">Lotus Vizag Office</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Check-In Time</label>
                  <input
                    type="time"
                    className="input w-full text-sm"
                    value={bulkTimeForm.check_in}
                    onChange={(e) => setBulkTimeForm({ ...bulkTimeForm, check_in: e.target.value })}
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Check-Out Time</label>
                  <input
                    type="time"
                    className="input w-full text-sm"
                    value={bulkTimeForm.check_out}
                    onChange={(e) => setBulkTimeForm({ ...bulkTimeForm, check_out: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Attendance Status</label>
                <select
                  className="input w-full text-sm"
                  value={bulkTimeForm.status}
                  onChange={(e) => setBulkTimeForm({ ...bulkTimeForm, status: e.target.value })}
                >
                  <option value="PRESENT">PRESENT</option>
                  <option value="WFH">WFH (Work From Home)</option>
                  <option value="HALF_DAY">HALF DAY</option>
                  <option value="WEEK_OFF">WEEK OFF</option>
                  <option value="ABSENT">ABSENT</option>
                  <option value="LEAVE">LEAVE</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Audit Notes</label>
                <input
                  type="text"
                  className="input w-full text-xs"
                  placeholder="e.g. Standard office timings applied by HR"
                  value={bulkTimeForm.notes}
                  onChange={(e) => setBulkTimeForm({ ...bulkTimeForm, notes: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  disabled={bulkLoading}
                  onClick={() => setShowBulkTimeModal(false)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bulkLoading}
                  className="btn-primary text-xs bg-brand-600 hover:bg-brand-700 text-white flex items-center gap-1.5"
                >
                  {bulkLoading ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <CheckCircle size={14} />
                  )}
                  {bulkLoading ? "Updating All..." : "Apply to All Employees"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

