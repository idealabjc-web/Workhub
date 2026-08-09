import { useEffect, useState } from "react";
import { Settings as SettingsIcon, ShieldCheck, Building, Layers, History, Save } from "lucide-react";
import api from "../api/client";

interface AuditLog {
  id: string;
  user_email?: string;
  action: string;
  entity_type: string;
  details?: string;
  timestamp: string;
}

export default function Settings() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [activeTab, setActiveTab] = useState<"general" | "audit">("general");
  const [companyName, setCompanyName] = useState("Idealab · UGC · Vizag");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (activeTab === "audit") {
      api.get("/api/settings/audit-logs").then((r) => setAuditLogs(r.data)).catch(() => {});
    }
  }, [activeTab]);

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post("/api/settings", null, { params: { key: "company_name", value: companyName } }).catch(() => {});
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <SettingsIcon size={22} className="text-brand-500" /> Settings & Audit Logs
        </h1>
        <p className="text-sm text-slate-400">System parameters, branch configurations, and activity tracking</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab("general")}
          className={`flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium border-b-2 transition ${
            activeTab === "general" ? "border-brand-500 text-brand-600 dark:text-brand-400" : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Building size={14} /> General Settings
        </button>
        <button
          onClick={() => setActiveTab("audit")}
          className={`flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium border-b-2 transition ${
            activeTab === "audit" ? "border-brand-500 text-brand-600 dark:text-brand-400" : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <History size={14} /> System Audit Logs
        </button>
      </div>

      {activeTab === "general" && (
        <form onSubmit={handleSaveGeneral} className="card p-6 space-y-4 max-w-xl">
          <h2 className="text-base font-bold">Company Profile</h2>
          {saved && <p className="text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 p-2 rounded-lg font-medium">Settings saved successfully!</p>}
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Company / Portal Name</label>
              <input className="input text-sm" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Active Branches</label>
              <div className="flex gap-2">
                <span className="badge bg-brand-100 text-brand-700">IDEALAB</span>
                <span className="badge bg-violet-100 text-violet-700">UGC</span>
                <span className="badge bg-emerald-100 text-emerald-700">VIZAG</span>
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Pagara Attendance Entry Mode</label>
              <p className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                Manual grid cell entry mode enabled for HR. Codes: <b>P</b> (Present), <b>A</b> (Absent), <b>L</b> (Leave), <b>HD</b> (Half Day), <b>WFH</b> (Work From Home), <b>H</b> (Holiday), <b>WO</b> (Week Off).
              </p>
            </div>
          </div>
          <button type="submit" className="btn-primary gap-2 text-xs">
            <Save size={14} /> Save Settings
          </button>
        </form>
      )}

      {activeTab === "audit" && (
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 uppercase text-[10px] text-slate-400 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log) => (
                <tr key={log.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                  <td className="px-4 py-3 text-slate-400">{new Date(log.timestamp).toLocaleString()}</td>
                  <td className="px-4 py-3 font-semibold">{log.user_email || "System"}</td>
                  <td className="px-4 py-3">
                    <span className="badge bg-brand-50 text-brand-700 dark:bg-brand-950/40">{log.action}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300 font-medium">{log.entity_type}</td>
                  <td className="px-4 py-3 text-slate-500 max-w-64 truncate">{log.details || "—"}</td>
                </tr>
              ))}
              {auditLogs.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No audit logs recorded yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
