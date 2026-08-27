import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, User, Briefcase, FileText, Clock, Edit2, Check, X,
  Phone, Mail, MapPin, Heart, Calendar, Building2, Users, Upload, Trash2, Eye, Download
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
  is_wfh_allowed?: boolean;
  profile_photo_url?: string;
  user_id?: string;
}

interface Department { id: string; name: string; branch: string; }
interface Document { id: string; doc_type: string; file_name?: string; file_url?: string; uploaded_at?: string; }
interface LeaveBalance { id: string; leave_type: string; total: number; used: number; }

const TABS = ["Personal", "Employment", "Documents", "Timeline"] as const;
type Tab = typeof TABS[number];

const branchColors: Record<string, string> = {
  IDEALAB: "bg-brand-100 text-brand-700",
  UGC: "bg-violet-100 text-violet-700",
  VIZAG: "bg-emerald-100 text-emerald-700",
};

const DOC_TYPES = ["Resume", "Certificates"];

const TIMELINE_MOCK = (emp: Employee) => {
  const today = new Date();
  const allEvents = [
    { date: emp.date_of_joining, event: "Joined Company", desc: `Joined as ${emp.designation || "Team Member"} at ${emp.branch}`, icon: "🎉", color: "bg-emerald-500" },
    { date: new Date(new Date(emp.date_of_joining).getTime() + 90 * 86400000).toISOString().slice(0, 10), event: "Probation Completed", desc: "Successfully completed probation period", icon: "✅", color: "bg-brand-500" },
    { date: new Date(new Date(emp.date_of_joining).getTime() + 365 * 86400000).toISOString().slice(0, 10), event: "Work Anniversary", desc: "Completed 1 year with the company", icon: "🏆", color: "bg-amber-500" },
  ];

  // Only return events that have already occurred up to today
  return allEvents.filter((ev) => new Date(ev.date) <= today);
};

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

  // Full-Screen Preview Modal State
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [saving, setSaving] = useState(false);
  const [newDocType, setNewDocType] = useState("Resume");
  const [newDocName, setNewDocName] = useState("");
  const [addingDoc, setAddingDoc] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canEdit = Boolean(user && (canManage || (emp && (emp.id === user.employee_id || emp.email === user.email)) || id === "me"));

  useEffect(() => {
    if (!id) return;
    const targetId = id === "me" ? "me" : id;
    api.get(`/api/employees/${targetId}`).then((r) => { setEmp(r.data); setEditForm(r.data); }).catch(() => navigate("/employees"));
    api.get("/api/departments").then((r) => setDepartments(r.data)).catch(() => {});
    api.get(`/api/employees/${targetId}/documents`).then((r) => setDocuments(r.data)).catch(() => {});
    api.get(`/api/employees/${targetId}/leave-balances`).then((r) => setLeaveBalances(r.data)).catch(() => {});
  }, [id]);

  const [saveError, setSaveError] = useState("");

  const handleSave = async () => {
    if (!emp) return;
    setSaving(true);
    setSaveError("");
    try {
      const targetId = id === "me" ? "me" : emp.id;
      const r = await api.patch(`/api/employees/${targetId}`, editForm);
      setEmp(r.data);
      setEditForm(r.data);
      setEditing(false);
    } catch (err: any) {
      setSaveError(err.response?.data?.detail || "Failed to save profile changes");
    } finally {
      setSaving(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      if (!newDocName) {
        setNewDocName(file.name);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (!newDocName) {
        setNewDocName(file.name);
      }
    }
  };

  const handleAddDoc = async () => {
    if (!emp) return;
    const fileName = newDocName || selectedFile?.name || `${newDocType}_Document.pdf`;

    const saveDoc = async (url?: string) => {
      const r = await api.post(`/api/employees/${emp.id}/documents`, {
        employee_id: emp.id,
        doc_type: newDocType,
        file_name: fileName,
        file_url: url,
      }).catch(() => null);
      if (r) {
        setDocuments((prev) => [...prev, r.data]);
        setNewDocName("");
        setSelectedFile(null);
        setAddingDoc(false);
      }
    };

    if (selectedFile) {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const fileUrl = evt.target?.result as string;
        await saveDoc(fileUrl);
      };
      reader.readAsDataURL(selectedFile);
    } else {
      await saveDoc();
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
          <p className="text-sm text-slate-400">{emp.designation || "Staff Member"}</p>
        </div>
        {canEdit && !editing && (
          <button onClick={() => setEditing(true)} className="btn-secondary gap-2">
            <Edit2 size={14} /> Edit Profile
          </button>
        )}
        {editing && (
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="btn-primary gap-2">
              <Check size={14} /> {saving ? "Saving..." : "Save"}
            </button>
            <button onClick={() => { setEditing(false); setEditForm(emp); setSaveError(""); }} className="btn-secondary gap-2">
              <X size={14} /> Cancel
            </button>
          </div>
        )}
      </div>

      {saveError && (
        <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800">
          {saveError}
        </div>
      )}

      {/* Profile Card */}
      <div className="card p-5 flex flex-wrap items-center gap-5">
        <div className="relative group shrink-0">
          {emp.profile_photo_url ? (
            <img src={emp.profile_photo_url} alt={`${emp.first_name} ${emp.last_name}`} className="h-20 w-20 rounded-2xl object-cover border-2 border-slate-200 dark:border-slate-700 shadow-sm" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-100 text-2xl font-bold text-brand-700 dark:bg-brand-900 dark:text-brand-300 shrink-0">
              {emp.first_name?.[0]}{emp.last_name?.[0]}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <h2 className="text-lg font-bold">{emp.first_name} {emp.last_name}</h2>
          <div className="flex flex-wrap gap-2 text-sm text-slate-500">
            <span className="flex items-center gap-1"><Mail size={13} /> {emp.email}</span>
            {emp.phone && <span className="flex items-center gap-1"><Phone size={13} /> {emp.phone}</span>}
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className={`badge ${branchColors[emp.branch] || ""}`}>{emp.branch}</span>
            {(emp as any).team_name && <span className="badge bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300">{(emp as any).team_name}</span>}
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
            <EditableField label="First Name" value={emp.first_name} editing={editing}
              editEl={<input className="input text-sm" value={editForm.first_name || ""} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} />} />
            <EditableField label="Last Name" value={emp.last_name} editing={editing}
              editEl={<input className="input text-sm" value={editForm.last_name || ""} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} />} />
            <EditableField label="Email" value={emp.email} icon={<Mail size={13} />} editing={editing}
              editEl={<input type="email" className="input text-sm" value={editForm.email || ""} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />} />
            <EditableField label="Phone" value={emp.phone || ""} editing={editing}
              editEl={<input className="input text-sm" value={editForm.phone || ""} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />} />
            <EditableField
              label="Profile Photo"
              value={
                emp.profile_photo_url
                  ? emp.profile_photo_url.startsWith("data:image/")
                    ? "Uploaded Photo (Image File)"
                    : emp.profile_photo_url
                  : "—"
              }
              editing={editing}
              editEl={
                <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-3">
                    {editForm.profile_photo_url ? (
                      <img src={editForm.profile_photo_url} alt="Preview" className="h-12 w-12 rounded-xl object-cover border shrink-0" />
                    ) : (
                      <div className="h-12 w-12 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0">
                        No Photo
                      </div>
                    )}
                    <div className="flex-1 min-w-0 space-y-1">
                      <label className="btn-secondary !py-1 !px-2.5 text-xs gap-1.5 cursor-pointer inline-flex items-center">
                        <Upload size={13} /> Choose Image File
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (evt) => {
                                if (evt.target?.result) {
                                  setEditForm((prev) => ({ ...prev, profile_photo_url: evt.target!.result as string }));
                                }
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                      {editForm.profile_photo_url && (
                        <button
                          type="button"
                          onClick={() => setEditForm((prev) => ({ ...prev, profile_photo_url: "" }))}
                          className="text-[11px] text-red-500 hover:underline block"
                        >
                          Remove Photo
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    placeholder="Or paste image URL (https://...)"
                    className="input text-xs w-full"
                    value={editForm.profile_photo_url?.startsWith("data:image/") ? "" : editForm.profile_photo_url || ""}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, profile_photo_url: e.target.value }))}
                  />
                </div>
              }
            />
            <EditableField label="Date of Birth" value={emp.date_of_birth ? new Date(emp.date_of_birth).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"} editing={editing}
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
                  {leaveBalances.slice(0, 2).map((lb) => (
                    <div key={lb.id} className="rounded-lg border border-slate-100 dark:border-slate-800 p-2">
                      <p className="text-xs text-slate-400">Annual Quota</p>
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
            <EditableField label="Date of Joining" value={emp.date_of_joining ? new Date(emp.date_of_joining).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "—"} editing={editing}
              editEl={<input type="date" className="input text-sm" value={editForm.date_of_joining?.toString().slice(0, 10) || ""} onChange={(e) => setEditForm({ ...editForm, date_of_joining: e.target.value })} />} />
            <EditableField label="Team / Brand" value={(emp as any).team_name || deptName || "—"} editing={editing}
              editEl={
                <select className="input text-sm" value={(editForm as any).team_name || ""} onChange={(e) => setEditForm({ ...editForm, team_name: e.target.value } as any)}>
                  <option value="">Select Team / Brand</option>
                  {["TECH TEAM", "IDIAS", "VOICE", "WYN", "WYNX", "NEXT", "PROSUMMITS", "ICON", "VIZAG", "SIGNATURE", "IDEALAB", "TECH"].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              } />
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
            {canManage && (
              <EditableField
                label="Work From Home / Remote Check-In"
                value={emp.is_wfh_allowed ? "ENABLED (Remote Allowed)" : "DISABLED (Office Only)"}
                editing={editing}
                editEl={
                  <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(editForm.is_wfh_allowed)}
                      onChange={(e) => setEditForm({ ...editForm, is_wfh_allowed: e.target.checked })}
                      className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 h-4 w-4"
                    />
                    Allow Remote Check-In (Bypass Geofence)
                  </label>
                }
              />
            )}
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
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
                <div>
                  <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-200">Upload Employee Document</h4>
                  <p className="text-[11px] text-slate-400">Select document type and drag & drop your file</p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500 font-medium shrink-0">Document Type:</label>
                  <select
                    className="input text-xs py-1 px-2.5 rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                    value={newDocType}
                    onChange={(e) => setNewDocType(e.target.value)}
                  >
                    {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              {/* Drag and Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                  isDragging
                    ? "border-brand-500 bg-brand-50/50 dark:bg-brand-900/20 scale-[1.01]"
                    : selectedFile
                    ? "border-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/10"
                    : "border-slate-300 hover:border-brand-400 dark:border-slate-700 hover:bg-slate-100/50 dark:hover:bg-slate-800/80"
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                  className="hidden"
                />

                {selectedFile ? (
                  <div className="flex items-center justify-between max-w-sm mx-auto p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-emerald-200 dark:border-emerald-800 shadow-sm" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40">
                        <FileText size={18} />
                      </div>
                      <div className="text-left min-w-0">
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{selectedFile.name}</p>
                        <p className="text-[10px] text-slate-400">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB · {newDocType}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedFile(null)}
                      className="p-1 text-slate-400 hover:text-red-500 transition rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                      title="Remove file"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5 pointer-events-none">
                    <div className="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-600 flex items-center justify-center mx-auto">
                      <Upload size={18} />
                    </div>
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
                      <span className="text-brand-600 font-semibold underline underline-offset-2">Click to upload</span> or drag & drop file
                    </p>
                    <p className="text-[11px] text-slate-400">PDF, DOCX, PNG, JPG (Max 10MB)</p>
                  </div>
                )}
              </div>

              {/* File Name & Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-end justify-between">
                <div className="flex-1">
                  <label className="text-[11px] text-slate-400 mb-1 block">File Name</label>
                  <input
                    className="input text-xs py-1.5 w-full"
                    placeholder={`e.g. ${newDocType === "Resume" ? "Praveen_Resume_2026.pdf" : "Degree_Certificate.pdf"}`}
                    value={newDocName}
                    onChange={(e) => setNewDocName(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2 justify-end">
                  <button
                    onClick={handleAddDoc}
                    disabled={!selectedFile && !newDocName}
                    className="btn-primary text-xs py-1.5 px-3.5 gap-1 disabled:opacity-50"
                  >
                    <Check size={13} /> Add
                  </button>
                  <button
                    onClick={() => { setAddingDoc(false); setSelectedFile(null); setNewDocName(""); }}
                    className="btn-secondary text-xs py-1.5 px-3"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                onClick={() => setPreviewDoc(doc)}
                className="group flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3 hover:border-brand-500 dark:hover:border-brand-400 hover:bg-brand-50/30 dark:hover:bg-brand-950/20 cursor-pointer transition shadow-sm hover:shadow"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-900/30 text-brand-600 group-hover:scale-105 transition">
                  <FileText size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition">{doc.doc_type}</p>
                  <p className="text-xs text-slate-400 truncate">{doc.file_name || "Document"}</p>
                  {doc.uploaded_at && (
                    <p className="text-xs text-slate-400">{new Date(doc.uploaded_at).toLocaleDateString()}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); setPreviewDoc(doc); }}
                    className="p-1.5 rounded-lg text-brand-600 hover:bg-brand-100 dark:hover:bg-brand-900/50 transition"
                    title="View Document Full Screen"
                  >
                    <Eye size={15} />
                  </button>
                  {canManage && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteDoc(doc.id); }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                      title="Delete document"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
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

      {/* Full-Screen Document / Certificate Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/90 backdrop-blur-md p-4 sm:p-6 overflow-hidden">
          {/* Header Bar */}
          <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-2xl px-5 py-3.5 mb-4 text-white shadow-2xl shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/20 text-brand-400 border border-brand-500/30">
                <FileText size={20} />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-white truncate">{previewDoc.doc_type} - {previewDoc.file_name || "Document"}</h3>
                <p className="text-xs text-slate-400">Employee: <span className="text-brand-300 font-semibold">{emp.first_name} {emp.last_name}</span> ({emp.employee_number})</p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {previewDoc.file_url && (
                <a
                  href={previewDoc.file_url}
                  download={previewDoc.file_name || `${previewDoc.doc_type}.pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-1.5 rounded-xl bg-brand-500 text-white font-semibold text-xs hover:bg-brand-600 transition flex items-center gap-1.5 shadow-md"
                >
                  <Download size={14} /> Download
                </a>
              )}
              <button
                onClick={() => setPreviewDoc(null)}
                className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition"
                title="Close Full Screen View"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Document Content View */}
          <div className="flex-1 w-full max-w-5xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col items-center justify-center relative">
            {previewDoc.file_url && previewDoc.file_url.startsWith("data:image/") ? (
              <img
                src={previewDoc.file_url}
                alt={previewDoc.file_name || previewDoc.doc_type}
                className="max-h-full max-w-full object-contain p-4 rounded-xl"
              />
            ) : previewDoc.file_url && (previewDoc.file_url.startsWith("data:application/pdf") || previewDoc.file_url.endsWith(".pdf")) ? (
              <iframe
                src={previewDoc.file_url}
                title={previewDoc.file_name || previewDoc.doc_type}
                className="w-full h-full border-0 bg-white"
              />
            ) : (
              /* Verified Digital Certificate Sheet for Uploaded/Seeded Documents */
              <div className="w-full h-full p-6 sm:p-12 overflow-y-auto flex items-center justify-center">
                <div className="w-full max-w-3xl bg-white text-slate-900 rounded-2xl p-8 sm:p-12 shadow-2xl border-8 border-brand-600/20 relative space-y-8 font-serif text-center">
                  <div className="absolute top-4 left-4 right-4 flex justify-between text-[10px] font-sans font-bold text-slate-400 uppercase tracking-widest">
                    <span>Lotus Idealab HR Records</span>
                    <span>Verified Official Document</span>
                  </div>

                  <div className="pt-4 space-y-2">
                    <div className="w-16 h-16 rounded-full bg-brand-50 text-brand-600 mx-auto flex items-center justify-center border-2 border-brand-200">
                      <FileText size={32} />
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{previewDoc.doc_type}</h2>
                    <p className="text-xs font-sans text-brand-600 font-semibold tracking-wider uppercase">Official Employee Certificate</p>
                  </div>

                  <div className="py-4 border-y border-slate-200 space-y-3 font-sans">
                    <p className="text-xs text-slate-500 uppercase tracking-wide">This certifies that the document</p>
                    <p className="text-lg font-bold text-slate-800 font-mono bg-slate-50 p-2.5 rounded-xl border border-slate-200 inline-block">{previewDoc.file_name || `${previewDoc.doc_type}_Record.pdf`}</p>
                    <p className="text-sm text-slate-600">
                      is registered under staff member <b className="text-slate-900">{emp.first_name} {emp.last_name}</b> ({emp.employee_number})
                    </p>
                    <p className="text-xs text-slate-500">
                      Department / Team: <b>{(emp as any).team_name || emp.branch}</b> · Date of Joining: <b>{emp.date_of_joining}</b>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4 font-sans text-xs pt-4">
                    <div className="text-left">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Upload Date</p>
                      <p className="font-semibold text-slate-700">{previewDoc.uploaded_at ? new Date(previewDoc.uploaded_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : new Date().toLocaleDateString()}</p>
                    </div>

                    <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full border border-emerald-200 font-bold text-[11px]">
                      <Check size={14} /> HR Digitally Verified Record
                    </div>

                    <div className="text-right">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Document ID</p>
                      <p className="font-mono text-slate-600 text-[11px]">{previewDoc.id.slice(0, 12)}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, icon, mono }: { label: string; value: string; icon?: React.ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
      <p className={`text-sm font-medium flex items-center gap-1 truncate max-w-full overflow-hidden text-ellipsis ${mono ? "font-mono text-xs text-slate-500" : ""}`} title={value}>
        {icon}{value}
      </p>
    </div>
  );
}

function EditableField({ label, value, editing, editEl, icon }: { label: string; value: string; editing: boolean; editEl: React.ReactNode; icon?: React.ReactNode }) {
  if (editing) {
    return (
      <div>
        <p className="text-xs text-slate-400 mb-1">{label}</p>
        {editEl}
      </div>
    );
  }
  return <Field label={label} value={value} icon={icon} />;
}
