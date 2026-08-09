import { useEffect, useState } from "react";
import { Download, Eye, Receipt, Send } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

interface Payslip {
  id: string;
  payroll_id: string;
  month: string;
  sent_to_email?: string;
  sent_at?: string;
  created_at?: string;
}

export default function Payslips() {
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7));
  const { user } = useAuth();

  useEffect(() => {
    api.get("/api/payroll", { params: { month: monthFilter } })
      .then((r) => {
        // Map payroll records to payslips
        const slips = r.data.map((p: any) => ({
          id: p.id,
          payroll_id: p.id,
          month: p.month,
          basic_salary: p.basic_salary,
          net_salary: p.net_salary,
          status: p.status,
          generated_at: p.generated_at,
        }));
        setPayslips(slips);
      })
      .catch(() => {});
  }, [monthFilter]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Receipt size={22} className="text-brand-500" /> Payslips
          </h1>
          <p className="text-sm text-slate-400">View and download official monthly payslips</p>
        </div>
        <input
          type="month"
          className="input w-40 text-sm"
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
        />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase text-slate-400 dark:border-slate-800">
            <tr>
              <th className="px-4 py-3">Month</th>
              <th className="px-4 py-3">Basic Salary</th>
              <th className="px-4 py-3">Net Pay</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {payslips.map((p: any) => (
              <tr key={p.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                <td className="px-4 py-3 font-medium">{p.month}</td>
                <td className="px-4 py-3">₹{p.basic_salary?.toLocaleString()}</td>
                <td className="px-4 py-3 font-bold text-emerald-600">₹{p.net_salary?.toLocaleString()}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${p.status === "Paid" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-1 text-xs text-brand-600 hover:underline"
                  >
                    <Download size={13} /> Print / Save PDF
                  </button>
                </td>
              </tr>
            ))}
            {payslips.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                  No payslips available for this month
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
