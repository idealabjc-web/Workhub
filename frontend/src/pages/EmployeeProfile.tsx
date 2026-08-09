import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, User, Briefcase, FileText, Clock, Edit2, Check, X,
  Phone, Mail, MapPin, Heart, Calendar, Building2, Users, Upload, Trash2
} from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

interface Employee {
  id: string;
  employee_number: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  blood_group?: string;
  date_of_birth?: string;
  gender?: string;
  address?: string;
  emergency_contact?: string;
  department_id?: string;
  designation?: string;
  reporting_manager_id?: string;
  branch: string;
  employment_type: string;
  status: string;
  date_of_joining: string;
  basic_salary?: number;
  profile_photo_url?: string;
  user_id?: string;
}

interface Department { id: string; name: string; branch: string; }
interface Document { id: string; doc_type: string; file_name?: string; uploaded_at?: string; }
interface LeaveBalance { id: string; leave_type: string; total: number; used: number; }

const TABS = ["Personal", "Employment", "Documents", "Timeline"] as const;
type Tab = typeof TABS[number];

const branchColors: Record<string, string> = {
  IDEALAB: "bg-brand-100 text-brand-700",
  UGC: "bg-violet-100 text-violet-700",
  VIZAG: "bg-emerald-100 text-emerald-700",
};

const DOC_TYPES = ["Resume", "Aadhaar", "PAN", "Offer Letter", "Appointment Letter", "Experience Letter", "Other"];

const TIMELINE_MOCK = (emp: Employee) => [
  { date: emp.date_of_joining, event: "Joined Company", desc: `Joined as ${emp.designation || "Team Member"} at ${emp.branch}`, icon: "🎉", color: "bg-emerald-500" },
  { date: new Date(new Date(emp.date_of_joining).getTime() + 90 * 86400000).toISOString().slice(0, 10), event: "Probation Completed", desc: "Successfully completed probation period", icon: "✅", color: "bg-brand-500" },
  { date: new Date(new Date(emp.date_of_joining).getTime() + 365 * 86400000).toISOString().slice(0, 10), event: "Work Anniversary", desc: "Completed 1 year with the company", icon: "🏆", color: "bg-amber-500" },
];

export default function EmployeeProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = user && ["SUPER_ADMIN", "HR"].includes(user.role);

  const [emp, setEmp] = useState<Employee | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [tab, setTab] = useState<Tab>("Personal");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Employee>>({});
  const [saving, setSaving] = useState(false);
  const [newDocType, setNewDocType] = useState("Resume");
  const [newDocName, setNewDocName] = useState("");
  const [addingDoc, setAddingDoc] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.get(`/api/employees/${id}`).then((r) => { setEmp(r.data); setEditForm(r.data); }).catch(() => navigate("/employees"));
    api.get("/api/departments").then((r) => setDepartments(r.data)).catch(() => {});
    api.get(`/api/employees/${id}/documents`).then((r) => setDocuments(r.data)).catch(() => {});
    api.get(`/api/employees/${id}/leave-balances`).then((r) => setLeaveBalances(r.data)).catch(() => {});
  }, [id]);

  const handleSave = async () => {
    if (!emp) return;
    setSaving(true);
    try {
      const r = await api.patch(`/api/employees/${emp.id}`, editForm);
      setEmp(r.data);
      setEditing(false);
    } catch { }
    setSaving(false);
  };

  const handleAddDoc = async () => {
    if (!emp) return;
    const r = await api.post(`/api/employees/${emp.id}/documents`, {
      employee_id: emp.id,
      doc_type: newDocType,
      file_name: newDocName || `${newDocType}_document`,
    }).catch(() => null);
    if (r) {
      setDocuments((prev) => [...prev, r.data]);
      setNewDocName("");
      setAddingDoc(false);
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    if (!emp) return;
    await api.delete(`/api/employees/${emp.id}/documents/${docId}`).catch(() => {});
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
  };

  if (!emp) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  const deptName = departments.find((d) => d.id === emp.department_id)?.name || "—";

  return (
    <div className="space-y-5">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/employees")} className="btn-secondary !px-2.5 !py-2">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">{emp.first_name} {emp.last_name}</h1>
          <p className="text-sm text-slate-400">{emp.employee_number} · {emp.designation || "—"}</p>
        </div>
        {canManage && !editing && (
          <button onClick={() => setEditing(true)} className="btn-secondary gap-2">
            <Edit2 size={14} /> Edit Profile
          </button>
        )}
        {editing && (
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="btn-primary gap-2">
              <Check size={14} /> {saving ? "Saving..." : "Save"}
            </button>
            <button onClick={() => { setEditing(false); setEditForm(emp); }} className="btn-secondary gap-2">
              <X size={14} /> Cancel
            </button>
          </div>
        )}
      </div>

      {/* Profile Card */}
      <div className="card p-5 flex flex-wrap items-center gap-5">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-100 text-2xl font-bold text-brand-700 dark:bg-brand-900 dark:text-brand-300 shrink-0">
          {emp.first_name[0]}{emp.last_name[0]}
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <h2 className="text-lg font-bold">{emp.first_name} {emp.last_name}</h2>
          <div className="flex flex-wrap gap-2 text-sm text-slate-500">
            <span className="flex items-center gap-1"><Mail size={13} /> {emp.email}</span>
            {emp.phone && <span className="flex items-center gap-1"><Phone size={13} /> {emp.phone}</span>}
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className={`badge ${branchColors[emp.branch] || ""}`}>{emp.branch}</span>
            <span className="badge bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">{emp.employment_type}</span>
            <span className={`badge ${emp.status === "Active" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{emp.status}</span>
          </div>
        </div>
        {emp.basic_salary && canManage && (
          <div className="text-right shrink-0">
            <p className="text-xs text-slate-400">Basic Salary</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">₹{emp.basic_salary.toLocaleString()}</p>
            <p className="text-xs text-slate-400">per month</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-slate-200 dark:border-slate-800">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium border-b-2 transition ${
              tab === t
                ? "border-brand-500 text-brand-600 dark:text-brand-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            {t === "Personal" && <User size={14} />}
            {t === "Employment" && <Briefcase size={14} />}
            {t === "Documents" && <FileText size={14} />}
            {t === "Timeline" && <Clock size={14} />}
            {t}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "Personal" && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Personal Information</h3>
            <Field label="Full Name" value={`${emp.first_name} ${emp.last_name}`} />
            <Field label="Email" value={emp.email} icon={<Mail size={13} />} />
            <EditableField label="Phone" value={emp.phone || ""} editing={editing}
              editEl={<input className="input text-sm" value={editForm.phone || ""} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />} />
            <EditableField label="Date of Birth" value={emp.date_of_birth ? new Date(emp.date_of_birth).toLocaleDateString() : "—"} editing={editing}
              editEl={<input type="date" className="input text-sm" value={editForm.date_of_birth?.toString().slice(0, 10) || ""} onChange={(e) => setEditForm({ ...editForm, date_of_birth: e.target.value })} />} />
            <EditableField label="Gender" value={emp.gender || "—"} editing={editing}
              editEl={
                <select className="input text-sm" value={editForm.gender || ""} onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}>
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              } />
            <EditableField label="Blood Group" value={emp.blood_group || "—"} editing={editing}
              editEl={
                <select className="input text-sm" value={editForm.blood_group || ""} onChange={(e) => setEditForm({ ...editForm, blood_group: e.target.value })}>
                  <option value="">Select</option>
                  {["A+","A-","B+","B-","O+","O-","AB+","AB-"].map(bg => <option key={bg} value={bg}>{bg}</option>)}
                </select>
              } />
          </div>
          <div className="card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Contact & Emergency</h3>
            <EditableField label="Address" value={emp.address || "—"} editing={editing}
              editEl={<textarea className="input text-sm" rows={3} value={editForm.address || ""} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />} />
            <EditableField label="Emergency Contact" value={emp.emergency_contact || "—"} editing={editing}
              editEl={<input className="input text-sm" value={editForm.emergency_contact || ""} onChange={(e) => setEditForm({ ...editForm, emergency_contact: e.target.value })} />} />
            {/* Leave Balances */}
            {leaveBalances.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-2">Leave Balance</p>
                <div className="grid grid-cols-2 gap-2">
                  {leaveBalances.map((lb) => (
                    <div key={lb.id} className="rounded-lg border border-slate-100 dark:border-slate-800 p-2">
                      <p className="text-xs text-slate-400">{lb.leave_type.replace("_", " ")}</p>
                      <p className="text-sm font-semibold">{lb.total - lb.used} <span className="text-xs font-normal text-slate-400">/ {lb.total} left</span></p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "Employment" && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Employment Details</h3>
            <Field label="Employee Number" value={emp.employee_number} />
            <Field label="Date of Joining" value={new Date(emp.date_of_joining).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })} />
            <Field label="Department" value={deptName} />
            <EditableField label="Designation" value={emp.designation || "—"} editing={editing}
              editEl={<input className="input text-sm" value={editForm.designation || ""} onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })} />} />
            <EditableField label="Branch" value={emp.branch} editing={editing}
              editEl={
                <select className="input text-sm" value={editForm.branch || ""} onChange={(e) => setEditForm({ ...editForm, branch: e.target.value })}>
                  <option value="IDEALAB">Idealab</option>
                  <option value="UGC">UGC</option>
                  <option value="VIZAG">Vizag</option>
                </select>
              } />
          </div>
          <div className="card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Compensation & Status</h3>
            <EditableField label="Employment Type" value={emp.employment_type} editing={editing}
              editEl={
                <select className="input text-sm" value={editForm.employment_type || ""} onChange={(e) => setEditForm({ ...editForm, employment_type: e.target.value })}>
                  <option value="Full-Time">Full-Time</option>
                  <option value="Part-Time">Part-Time</option>
                  <option value="Contract">Contract</option>
                  <option value="Intern">Intern</option>
                </select>
              } />
            <EditableField label="Status" value={emp.status} editing={editing}
              editEl={
                <select className="input text-sm" value={editForm.status || ""} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="On Leave">On Leave</option>
                </select>
              } />
            {canManage && (
              <EditableField label="Basic Salary (₹)" value={emp.basic_salary ? `₹${emp.basic_salary.toLocaleString()}` : "—"} editing={editing}
                editEl={<input type="number" className="input text-sm" value={editForm.basic_salary || ""} onChange={(e) => setEditForm({ ...editForm, basic_salary: Number(e.target.value) })} />} />
            )}
            <Field label="Employee ID" value={emp.id} mono />
          </div>
        </div>
      )}

      {tab === "Documents" && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Documents</h3>
            {canManage && !addingDoc && (
              <button onClick={() => setAddingDoc(true)} className="btn-primary gap-2 text-xs py-1.5">
                <Upload size={13} /> Upload Document
              </button>
            )}
          </div>

          {addingDoc && (
            <div className="flex flex-wrap gap-2 items-end p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <div className="flex-1 min-w-36">
                <label className="text-xs text-slate-400 mb-1 block">Document Type</label>
                <select className="input text-sm" value={newDocType} onChange={(e) => setNewDocType(e.target.value)}>
                  {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="flex-1 min-w-48">
                <label className="text-xs text-slate-400 mb-1 block">File Name</label>
                <input className="input text-sm" placeholder="e.g. resume_v2.pdf" value={newDocName} onChange={(e) => setNewDocName(e.target.value)} />
              </div>
              <button onClick={handleAddDoc} className="btn-primary text-xs py-2">Add</button>
              <button onClick={() => setAddingDoc(false)} className="btn-secondary text-xs py-2">Cancel</button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-900/30 text-brand-600">
                  <FileText size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.doc_type}</p>
                  <p className="text-xs text-slate-400 truncate">{doc.file_name || "Document"}</p>
                  {doc.uploaded_at && (
                    <p className="text-xs text-slate-400">{new Date(doc.uploaded_at).toLocaleDateString()}</p>
                  )}
                </div>
                {canManage && (
                  <button onClick={() => handleDeleteDoc(doc.id)} className="text-slate-400 hover:text-red-500 transition">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
            {documents.length === 0 && (
              <p className="col-span-2 py-8 text-center text-sm text-slate-400">No documents uploaded yet</p>
            )}
          </div>
        </div>
      )}

      {tab === "Timeline" && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold mb-5">Employee Timeline</h3>
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-800" />
            <div className="space-y-6">
              {TIMELINE_MOCK(emp).map((event, i) => (
                <div key={i} className="relative flex items-start gap-4 pl-12">
                  <div className={`absolute left-0 flex h-8 w-8 items-center justify-center rounded-full ${event.color} text-white text-sm shadow-sm`}>
                    {event.icon}
                  </div>
                  <div className="flex-1 card p-3">
                    <p className="font-medium text-sm">{event.event}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{event.desc}</p>
                    <p className="text-xs text-slate-400 mt-1">{new Date(event.date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, icon, mono }: { label: string; value: string; icon?: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
      <p className={`text-sm font-medium flex items-center gap-1 ${mono ? "font-mono text-xs text-slate-500" : ""}`}>
        {icon}{value}
      </p>
    </div>
  );
}

function EditableField({ label, value, editing, editEl }: { label: string; value: string; editing: boolean; editEl: React.ReactNode }) {
  if (editing) {
    return (
      <div>
        <p className="text-xs text-slate-400 mb-1">{label}</p>
        {editEl}
      </div>
    );
  }
  return <Field label={label} value={value} />;
}
