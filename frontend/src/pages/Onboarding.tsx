import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, Mail, Phone, Calendar, Briefcase, MapPin, Camera, Sparkles, CheckCircle2, ArrowRight, ShieldCheck } from "lucide-react";
import api from "../api/client";

export default function Onboarding() {
  const navigate = useNavigate();
  const storedUser = JSON.parse(localStorage.getItem("hr_user") || "{}");

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    first_name: storedUser.full_name ? storedUser.full_name.split(" ")[0] : "",
    last_name: storedUser.full_name ? storedUser.full_name.split(" ").slice(1).join(" ") : "",
    email: storedUser.email || "",
    phone: "",
    profile_photo_url: "",
    branch: "IDEALAB",
    employment_type: "Full-Time",
    designation: "",
    date_of_joining: new Date().toISOString().split("T")[0],
    date_of_birth: "",
  });

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.post("/api/onboarding/complete", form);
      // Update stored user
      const updatedUser = {
        ...storedUser,
        profile_complete: true,
        full_name: res.data.full_name,
        employee_id: res.data.employee_id,
      };
      localStorage.setItem("hr_user", JSON.stringify(updatedUser));
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to submit onboarding details. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 sm:p-6 text-slate-100 relative overflow-hidden font-sans">
      {/* Dynamic Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brand-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[300px] h-[300px] bg-purple-600/15 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-2xl bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-500/10 text-brand-400 text-xs font-semibold mb-3 border border-brand-500/20">
            <Sparkles size={14} /> Employee Setup Portal
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Complete Your Workhub Profile</h1>
          <p className="text-sm text-slate-400 mt-2">Enter your employee details to activate your portal access.</p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-8 px-4 sm:px-12 relative">
          <div className="absolute left-16 right-16 top-1/2 -translate-y-1/2 h-0.5 bg-slate-800 -z-10" />
          <div className="absolute left-16 top-1/2 -translate-y-1/2 h-0.5 bg-brand-500 -z-10 transition-all duration-300" style={{ width: step === 1 ? "0%" : step === 2 ? "50%" : "100%" }} />

          <div className={`flex flex-col items-center gap-1 ${step >= 1 ? "text-brand-400" : "text-slate-500"}`}>
            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${step >= 1 ? "bg-brand-600 text-white shadow-lg shadow-brand-500/30" : "bg-slate-800 text-slate-400"}`}>1</div>
            <span className="text-[11px] font-medium hidden sm:inline">Personal</span>
          </div>

          <div className={`flex flex-col items-center gap-1 ${step >= 2 ? "text-brand-400" : "text-slate-500"}`}>
            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${step >= 2 ? "bg-brand-600 text-white shadow-lg shadow-brand-500/30" : "bg-slate-800 text-slate-400"}`}>2</div>
            <span className="text-[11px] font-medium hidden sm:inline">Work & Role</span>
          </div>

          <div className={`flex flex-col items-center gap-1 ${step >= 3 ? "text-brand-400" : "text-slate-500"}`}>
            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${step >= 3 ? "bg-brand-600 text-white shadow-lg shadow-brand-500/30" : "bg-slate-800 text-slate-400"}`}>3</div>
            <span className="text-[11px] font-medium hidden sm:inline">Photo & Review</span>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs sm:text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* STEP 1: Personal Details */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                <User size={18} className="text-brand-400" /> Personal Information
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">First Name *</label>
                  <div className="relative">
                    <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      required
                      type="text"
                      placeholder="John"
                      value={form.first_name}
                      onChange={(e) => handleChange("first_name", e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Last Name *</label>
                  <div className="relative">
                    <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      required
                      type="text"
                      placeholder="Doe"
                      value={form.last_name}
                      onChange={(e) => handleChange("last_name", e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500 transition"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Mail ID *</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    required
                    type="email"
                    placeholder="employee@workhub.com"
                    value={form.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Phone No *</label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      required
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={form.phone}
                      onChange={(e) => handleChange("phone", e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Birthday *</label>
                  <div className="relative">
                    <Calendar size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      required
                      type="date"
                      value={form.date_of_birth}
                      onChange={(e) => handleChange("date_of_birth", e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500 transition"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    if (!form.first_name || !form.last_name || !form.email || !form.phone || !form.date_of_birth) {
                      setError("Please fill in all required personal details.");
                      return;
                    }
                    setError("");
                    setStep(2);
                  }}
                  className="px-6 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl text-sm flex items-center gap-2 transition active:scale-95 shadow-lg shadow-brand-500/20"
                >
                  Next: Work Details <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Work Details */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                <Briefcase size={18} className="text-brand-400" /> Work & Role Details
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Branch *</label>
                  <div className="relative">
                    <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <select
                      value={form.branch}
                      onChange={(e) => handleChange("branch", e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500 transition appearance-none cursor-pointer"
                    >
                      <option value="IDEALAB">IDEALAB</option>
                      <option value="UGC">UGC</option>
                      <option value="VIZAG">VIZAG</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Work Mode *</label>
                  <div className="relative">
                    <Briefcase size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <select
                      value={form.employment_type}
                      onChange={(e) => handleChange("employment_type", e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500 transition appearance-none cursor-pointer"
                    >
                      <option value="Full-Time">Full-time</option>
                      <option value="WFH">WFH (Work From Home)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Role / Designation *</label>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    required
                    type="text"
                    placeholder="e.g. Software Engineer, Sales Executive"
                    value={form.designation}
                    onChange={(e) => handleChange("designation", e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Date of Joining *</label>
                <div className="relative">
                  <Calendar size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    required
                    type="date"
                    value={form.date_of_joining}
                    onChange={(e) => handleChange("date_of_joining", e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500 transition"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-sm transition"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!form.designation || !form.date_of_joining) {
                      setError("Please enter your role and date of joining.");
                      return;
                    }
                    setError("");
                    setStep(3);
                  }}
                  className="px-6 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl text-sm flex items-center gap-2 transition active:scale-95 shadow-lg shadow-brand-500/20"
                >
                  Next: Photo & Review <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Photo & Final Review */}
          {step === 3 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                <Camera size={18} className="text-brand-400" /> Profile Picture & Review
              </h2>

              <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
                <div className="w-20 h-20 rounded-full bg-slate-800 border-2 border-brand-500/50 flex items-center justify-center overflow-hidden shrink-0">
                  {form.profile_photo_url ? (
                    <img src={form.profile_photo_url} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User size={36} className="text-slate-500" />
                  )}
                </div>
                <div className="flex-1 w-full">
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Profile Photo URL (Optional)</label>
                  <div className="relative">
                    <Camera size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="url"
                      placeholder="https://example.com/avatar.jpg"
                      value={form.profile_photo_url}
                      onChange={(e) => handleChange("profile_photo_url", e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500 transition"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">Paste an image link or leave empty to use default avatar.</p>
                </div>
              </div>

              {/* Summary Box */}
              <div className="p-4 rounded-2xl bg-brand-950/30 border border-brand-800/40 space-y-2 text-xs">
                <h3 className="font-semibold text-brand-300 flex items-center gap-1.5 text-sm">
                  <ShieldCheck size={16} /> Summary of Your Profile
                </h3>
                <div className="grid grid-cols-2 gap-2 text-slate-300 pt-1">
                  <div><span className="text-slate-500">Name:</span> {form.first_name} {form.last_name}</div>
                  <div><span className="text-slate-500">Email:</span> {form.email}</div>
                  <div><span className="text-slate-500">Phone:</span> {form.phone}</div>
                  <div><span className="text-slate-500">Branch:</span> {form.branch}</div>
                  <div><span className="text-slate-500">Work Mode:</span> {form.employment_type}</div>
                  <div><span className="text-slate-500">Role:</span> {form.designation}</div>
                  <div><span className="text-slate-500">DOJ:</span> {form.date_of_joining}</div>
                  <div><span className="text-slate-500">Birthday:</span> {form.date_of_birth}</div>
                </div>
              </div>

              <div className="pt-4 flex justify-between">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-sm transition"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-8 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-sm flex items-center gap-2 transition active:scale-95 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                >
                  {loading ? (
                    "Saving Profile..."
                  ) : (
                    <>
                      Complete Setup & Launch <CheckCircle2 size={16} />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
