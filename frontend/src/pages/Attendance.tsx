import { useEffect, useState } from "react";
import {
  CalendarCheck, ChevronLeft, ChevronRight, Download, Upload, Plus, Check, X,
  Lock, Unlock, RefreshCw, AlertCircle, FileSpreadsheet, Filter, Info
} from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import * as XLSX from "xlsx";
import CheckInOutCard from "../components/CheckInOutCard";

interface AttendanceRow {
  id: string; employee_id: string; date: string; check_in?: string;
  check_out?: string; status: string; is_late: boolean; notes?: string;
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

const STATUS_CODES: Record<string, { abbr: string; name: string; cls: string }> = {
  PRESENT:  { abbr: "P",   name: "Present",        cls: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300" },
  ABSENT:   { abbr: "A",   name: "Absent",         cls: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950/60 dark:text-red-300" },
  LEAVE:    { abbr: "L",   name: "Leave",          cls: "bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-950/60 dark:text-violet-300" },
  HALF_DAY: { abbr: "HD",  name: "Half Day",       cls: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300" },
  WFH:      { abbr: "WFH", name: "Work From Home", cls: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300" },
  HOLIDAY:  { abbr: "H",   name: "Holiday",        cls: "bg-pink-100 text-pink-800 border-pink-300 dark:bg-pink-950/60 dark:text-pink-300" },
  WEEK_OFF: { abbr: "WO",  name: "Week Off",       cls: "bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-400" },
};

const ABBR_TO_STATUS: Record<string, string> = {
  P: "PRESENT", A: "ABSENT", L: "LEAVE", HD: "HALF_DAY", WFH: "WFH", H: "HOLIDAY", WO: "WEEK_OFF",
};

function formatLocalTime(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const hasTimezone = dateStr.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(dateStr);
  const normalized = hasTimezone ? dateStr : `${dateStr}Z`;
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? "—" : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function Attendance() {
  const { user } = useAuth();
  const isHR = user && ["SUPER_ADMIN", "HR", "MANAGER", "FINANCE"].includes(user.role);
  const isEmployeeOnly = user?.role === "EMPLOYEE";

  const [activeTab, setActiveTab] = useState<"personal" | "pagara" | "corrections">("personal");
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData | null>(null);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [branchFilter, setBranchFilter] = useState("");
  const [loading, setLoading] = useState(false);

  // Pagara Cell Editor Popover state
  const [editingCell, setEditingCell] = useState<{ empId: string; day: number; currentStatus: string } | null>(null);

  // Correction Request State
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [corrForm, setCorrForm] = useState({ date: new Date().toISOString().slice(0, 10), requested_status: "PRESENT", reason: "" });

  // Excel Import Modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);

  const loadPersonal = () => {
    api.get("/api/attendance", { params: { employee_id: user?.employee_id, month } })
      .then((r) => setRows(r.data))
      .catch(() => {});
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
    else if (activeTab === "pagara") loadMonthlyGrid();
    else if (activeTab === "corrections") loadCorrections();
  }, [activeTab, month, branchFilter]);

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

      // Optimistically update local monthly grid data
      setMonthlyData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          employees: prev.employees.map((emp) => {
            if (emp.employee_id === empId) {
              return {
                ...emp,
                days: { ...emp.days, [day]: newStatus },
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
          <p className="text-sm text-slate-400">Pagara book entry, personal logs, and correction requests</p>
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
              <button
                onClick={() => setActiveTab("pagara")}
                className={`px-3.5 py-1.5 text-xs font-semibold transition ${
                  activeTab === "pagara" ? "bg-brand-500 text-white" : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
                }`}
              >
                Pagara Grid (HR)
              </button>
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
              <button onClick={() => setShowImportModal(true)} className="btn-secondary gap-1.5 text-xs py-1.5">
                <Upload size={14} /> Import Excel
              </button>
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
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button onClick={() => setMonth(m => { const d = new Date(m + "-01"); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7); })} className="btn-secondary !px-2 !py-1.5">
            <ChevronLeft size={15} />
          </button>
          <input type="month" className="input w-36 text-xs py-1.5" value={month} onChange={(e) => setMonth(e.target.value)} />
          <button onClick={() => setMonth(m => { const d = new Date(m + "-01"); d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0, 7); })} className="btn-secondary !px-2 !py-1.5">
            <ChevronRight size={15} />
          </button>
        </div>

        {activeTab === "pagara" && isHR && (
          <>
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
          </>
        )}
      </div>

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
            <thead className="border-b border-slate-200 uppercase text-[10px] text-slate-400 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Day</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Check In</th>
                <th className="px-4 py-3">Check Out</th>
                <th className="px-4 py-3">Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const cfg = STATUS_CODES[r.status] || STATUS_CODES.PRESENT;
                const d = new Date(r.date);
                return (
                  <tr key={r.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                    <td className="px-4 py-3 font-semibold">{d.toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-slate-400">{d.toLocaleDateString("en", { weekday: "short" })}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded border font-bold text-[10px] ${cfg.cls}`}>{cfg.abbr} - {cfg.name}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatLocalTime(r.check_in)}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatLocalTime(r.check_out)}</td>
                    <td className="px-4 py-3 text-slate-400">{r.notes || "—"}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">No attendance records for {month}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        </div>
      )}

      {/* TAB 2: PAGARA MANUAL GRID EDITOR (HR ONLY) */}
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

                    {/* Day Cells: Click to open direct status picker */}
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
          </div>
        </div>
      )}

      {/* TAB 3: CORRECTIONS */}
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
              <thead className="border-b border-slate-200 uppercase text-[10px] text-slate-400 dark:border-slate-800">
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
                    <td className="px-4 py-3 font-semibold">{new Date(c.date).toLocaleDateString()}</td>
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
    </div>
  );
}
