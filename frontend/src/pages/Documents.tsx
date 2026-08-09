import { useEffect, useState } from "react";
import { Plus, Trash2, FolderOpen, Lock, Unlock, Search, Upload, FileText } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

interface HRDocument {
  id: string;
  name: string;
  category: string;
  employee_id?: string;
  file_url?: string;
  description?: string;
  is_confidential: boolean;
  uploaded_by?: string;
  created_at?: string;
}

const CATEGORIES = ["Policy", "Template", "Form", "Compliance", "Contract", "Training", "Other"];
const EMPTY_FORM = { name: "", category: "Policy", description: "", is_confidential: false };

export default function Documents() {
  const [docs, setDocs] = useState<HRDocument[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const { user } = useAuth();
  const canManage = user && ["SUPER_ADMIN", "HR"].includes(user.role);

  const load = () => {
    const params: any = {};
    if (search) params.search = search;
    if (categoryFilter) params.category = categoryFilter;
    api.get("/api/documents", { params }).then((r) => setDocs(r.data)).catch(() => {});
  };

  useEffect(() => { load(); }, [search, categoryFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post("/api/documents", form).catch(() => {});
    setShowForm(false);
    setForm(EMPTY_FORM);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this document?")) return;
    await api.delete(`/api/documents/${id}`).catch(() => {});
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <FolderOpen size={22} className="text-brand-500" /> HR Documents
          </h1>
          <p className="text-sm text-slate-400">Company policies, handbooks, forms, and compliance files</p>
        </div>
        {canManage && (
          <button className="btn-primary gap-2" onClick={() => setShowForm((s) => !s)}>
            <Plus size={16} /> Add Document
          </button>
        )}
      </div>

      {/* Search & Category Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9 text-sm"
            placeholder="Search document name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input w-40 text-sm" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Add Document Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="card p-5 space-y-4">
          <h3 className="font-semibold text-sm">Upload New Document</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <input required placeholder="Document Name *" className="input text-sm sm:col-span-2" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <select className="input text-sm" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input className="input text-sm sm:col-span-2" placeholder="Description / Purpose" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer pt-2">
              <input type="checkbox" checked={form.is_confidential} onChange={(e) => setForm({ ...form, is_confidential: e.target.checked })} className="rounded border-slate-300 text-brand-500" />
              <span>Mark as Confidential (HR/Admin only)</span>
            </label>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">Add Document</button>
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      {/* Documents Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {docs.map((doc) => (
          <div key={doc.id} className="card p-5 flex flex-col justify-between space-y-3 hover:shadow-md transition">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-900/30 text-brand-600">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white leading-tight">{doc.name}</h3>
                  <span className="badge bg-slate-100 text-slate-600 dark:bg-slate-800 mt-1">{doc.category}</span>
                </div>
              </div>

              {canManage && (
                <button onClick={() => handleDelete(doc.id)} className="text-slate-400 hover:text-red-500 transition p-1">
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            {doc.description && <p className="text-xs text-slate-500 line-clamp-2">{doc.description}</p>}

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400">
              <div className="flex items-center gap-1">
                {doc.is_confidential ? (
                  <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                    <Lock size={12} /> Confidential
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-slate-400">
                    <Unlock size={12} /> Public
                  </span>
                )}
              </div>
              {doc.created_at && (
                <span>{new Date(doc.created_at).toLocaleDateString()}</span>
              )}
            </div>
          </div>
        ))}

        {docs.length === 0 && (
          <p className="col-span-3 py-12 text-center text-slate-400">No documents found</p>
        )}
      </div>
    </div>
  );
}
