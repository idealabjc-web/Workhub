import { useEffect, useState } from "react";
import { Search, Plus, Filter, Download, Upload, Eye, Trash2, FileSpreadsheet, X } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import * as XLSX from "xlsx";

interface Employee {
  id: string;
  employee_number: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  designation?: string;
  department_id?: string;
  branch: string;
  status: string;
  date_of_joining: string;
  employment_type: string;
  basic_salary?: number;
}

interface Department {
  id: string;
  name: string;
  branch: string;
}

const branchColors: Record<string, string> = {
  IDEALAB: "bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300",
  UGC: "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300",
  VIZAG: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
};

const statusColors: Record<string, string> = {
  Active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  Inactive: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  "On Leave": "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
};

const EMPTY_FORM = {
  first_name: "", last_name: "", email: "", password: "",
  phone: "", designation: "", branch: "IDEALAB", role: "EMPLOYEE",
  department_id: "", employment_type: "Full-Time", basic_salary: "",
  date_of_joining: new Date().toISOString().slice(0, 10), gender: "Male",
};

export default function Employees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const canManage = user && ["SUPER_ADMIN", "HR"].includes(user.role);

  const load = () => {
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (branchFilter) params.branch = branchFilter;
    if (deptFilter) params.department_id = deptFilter;
    if (statusFilter) params.status = statusFilter;
    api.get("/api/employees", { params }).then((r) => setEmployees(r.data)).catch(() => {});
  };

  useEffect(() => {
    const q = searchParams.get("search");
    if (q) setSearch(q);
    api.get("/api/departments").then((r) => setDepartments(r.data)).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [search, branchFilter, deptFilter, statusFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await api.post("/api/employees", {
        ...form,
        basic_salary: form.basic_salary ? Number(form.basic_salary) : undefined,
        department_id: form.department_id || undefined,
      });
      setShowForm(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to create employee");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
    await api.delete(`/api/employees/${id}`).catch(() => {});
    load();
  };

  const exportExcel = () => {
    const rows = employees.map((e) => ({
      "Employee #": e.employee_number,
      "First Name": e.first_name,
      "Last Name": e.last_name,
      "Email": e.email,
      "Phone": e.phone || "",
      "Designation": e.designation || "",
      "Branch": e.branch,
      "Status": e.status,
      "Joined": new Date(e.date_of_joining).toLocaleDateString(),
      "Employment Type": e.employment_type,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Employees");
    XLSX.writeFile(wb, `employees_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        const wb = XLSX.read(buffer, { type: "array" });
        const wsName = wb.SheetNames[0];
        const data = XLSX.utils.sheet_to_json(wb.Sheets[wsName]) as any[];

        const getVal = (row: any, ...keys: string[]) => {
          const rowKeys = Object.keys(row);
          for (const k of keys) {
            const found = rowKeys.find(
              (rk) => rk.toLowerCase().replace(/[^a-z0-9]/g, "") === k.toLowerCase().replace(/[^a-z0-9]/g, "")
            );
            if (found && row[found] !== undefined && row[found] !== null && String(row[found]).trim() !== "") {
              return String(row[found]).trim();
            }
          }
          return "";
        };

        const records = data.map((row) => {
          let firstName = getVal(row, "first_name", "firstname", "first name");
          let lastName = getVal(row, "last_name", "lastname", "last name", "surname");
          const fullName = getVal(row, "name", "full_name", "fullname", "employee_name");
          const email = getVal(row, "email", "email_address", "e_mail", "mail");

          if ((!firstName || !lastName) && fullName) {
            const parts = fullName.split(" ");
            firstName = parts[0] || "New";
            lastName = parts.slice(1).join(" ") || "Employee";
          }

          const designation = getVal(row, "designation", "role", "title", "job_title", "position");
          const branch = getVal(row, "branch", "location", "office") || "IDEALAB";
          const phone = getVal(row, "phone", "mobile", "contact");
          const salaryVal = getVal(row, "basic_salary", "salary", "pay", "basic");

          return {
            first_name: firstName || "New",
            last_name: lastName || "Employee",
            email: email,
            password: "Employee123!",
            phone: phone || "",
            designation: designation || "",
            branch: branch,
            employment_type: "Full-Time",
            basic_salary: salaryVal ? Number(salaryVal) : 50000,
            role: "EMPLOYEE",
          };
        }).filter(r => r.email && r.email.includes("@"));

        if (records.length === 0) {
          alert("No valid employee records found in file. Please ensure columns include Email and Name.");
          setImporting(false);
          return;
        }

        const res = await api.post("/api/employees/import", { employees: records });
        setShowImportModal(false);
        load();
        alert(`Successfully imported ${res.data.imported} employees!`);
      } catch (err: any) {
        alert("Import failed: " + (err.response?.data?.detail || err.message || "Network Error"));
      } finally {
        setImporting(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const deptName = (id?: string) =>
    departments.find((d) => d.id === id)?.name || "—";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Employees</h1>
          <p className="text-sm text-slate-400">{employees.length} employees across all branches</p>
        </div>
        <div className="flex gap-2">
          {canManage && (
            <button onClick={() => setShowImportModal(true)} className="btn-secondary gap-2" title="Import from Excel/CSV">
              <Upload size={15} /> Import
            </button>
          )}
          <button onClick={exportExcel} className="btn-secondary gap-2" title="Export to Excel">
            <Download size={15} /> Export
          </button>
          {canManage && (
            <button className="btn-primary gap-2" onClick={() => setShowForm((s) => !s)}>
              <Plus size={16} /> Add Employee
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9 text-sm"
            placeholder="Search name, email, designation..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input w-36 text-sm" value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
          <option value="">All Branches</option>
          <option value="IDEALAB">Idealab</option>
          <option value="VIZAG">Vizag</option>
        </select>
        <select className="input w-40 text-sm" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
          <option value="">All Teams</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select className="input w-32 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>

      {/* Add Employee Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="card p-5 space-y-4">
          <h3 className="font-semibold text-sm">New Employee</h3>
          {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2">{error}</p>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <input required placeholder="First name *" className="input text-sm" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
            <input required placeholder="Last name *" className="input text-sm" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
            <input required type="email" placeholder="Email *" className="input text-sm" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input required type="password" placeholder="Temp password *" className="input text-sm" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <input placeholder="Phone" className="input text-sm" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input placeholder="Designation" className="input text-sm" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
            <select className="input text-sm" value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })}>
              <option value="IDEALAB">Idealab</option>
              <option value="VIZAG">Vizag</option>
            </select>
            <select className="input text-sm" value={(form as any).team_name || ""} onChange={(e) => setForm({ ...form, team_name: e.target.value } as any)}>
              <option value="">Select Team</option>
              {["TECH TEAM", "IDIAS", "WYN", "NEXT", "WYNX", "PROSUMMITS", "VOICE", "SIGNATURE", "VIZAG", "ICON", "TECH"].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <select className="input text-sm" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="EMPLOYEE">Employee</option>
              <option value="MANAGER">Manager</option>
              <option value="HR">HR</option>
              <option value="FINANCE">Finance</option>
              <option value="SUPER_ADMIN">Super Admin</option>
            </select>
            <select className="input text-sm" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
              <option value="Male">Male (6 Leaves/Yr)</option>
              <option value="Female">Female (12 Leaves/Yr)</option>
              <option value="Other">Other</option>
            </select>
            <div className="flex flex-col">
              <label className="text-[10px] text-slate-400 font-semibold mb-0.5">Date of Joining *</label>
              <input required type="date" className="input text-sm" value={form.date_of_joining} onChange={(e) => setForm({ ...form, date_of_joining: e.target.value })} />
            </div>
            <input type="number" placeholder="Basic Salary (₹)" className="input text-sm" value={form.basic_salary} onChange={(e) => setForm({ ...form, basic_salary: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? "Creating..." : "Create Employee"}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      {/* Table */}
      <div className="table-wrapper">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800">
            <tr>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Team</th>
              <th className="px-4 py-3">Branch</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              <tr
                key={emp.id}
                className="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50 cursor-pointer"
                onClick={() => navigate(`/employees/${emp.id}`)}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 dark:bg-brand-900 dark:text-brand-300">
                      {emp.first_name[0]}{emp.last_name[0]}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">{emp.first_name} {emp.last_name}</p>
                      <p className="text-xs text-slate-400">{emp.designation || emp.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300 font-medium">{(emp as any).team_name || deptName(emp.department_id)}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${branchColors[emp.branch] || ""}`}>{emp.branch}</span>
                </td>
                <td className="px-4 py-3 text-slate-500">{new Date(emp.date_of_joining).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-slate-500">{emp.employment_type}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${statusColors[emp.status] || ""}`}>{emp.status}</span>
                </td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => navigate(`/employees/${emp.id}`)}
                      className="p-1 text-slate-400 hover:text-brand-500 transition"
                      title="View profile"
                    >
                      <Eye size={15} />
                    </button>
                    {canManage && (
                      <button
                        onClick={() => handleDelete(emp.id, `${emp.first_name} ${emp.last_name}`)}
                        className="p-1 text-slate-400 hover:text-red-500 transition"
                        title="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {employees.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                  No employees found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* EXCEL IMPORT MODAL */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowImportModal(false)}>
          <div className="card p-6 max-w-md w-full space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base flex items-center gap-2">
                <FileSpreadsheet size={18} className="text-brand-500" /> Excel / CSV Employee Import
              </h3>
              <button onClick={() => setShowImportModal(false)}><X size={16} className="text-slate-400" /></button>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Upload `.xlsx` or `.csv` file with columns: <b>First Name</b>, <b>Last Name</b> (or <b>Name</b>), <b>Email</b>, <b>Designation</b>, <b>Branch</b>, <b>Basic Salary</b>.
            </p>
            <div className="p-4 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center">
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleExcelImport} disabled={importing} className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100" />
            </div>
            {importing && (
              <div className="flex items-center justify-center gap-2 text-xs text-brand-600 font-medium py-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                Importing staff data...
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
