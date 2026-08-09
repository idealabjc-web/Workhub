import { useEffect, useState } from "react";
import { BarChart3, Download, Users, CalendarCheck, Wallet, DollarSign, TrendingUp } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import * as XLSX from "xlsx";

interface Stats {
  total_employees: number;
  active_employees: number;
  attendance_percentage: number;
  monthly_payroll: number;
  total_revenue_this_month: number;
}

export default function Reports() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [payrollRows, setPayrollRows] = useState<any[]>([]);
  const [expenseRows, setExpenseRows] = useState<any[]>([]);
  const [revenueRows, setRevenueRows] = useState<any[]>([]);

  useEffect(() => {
    api.get("/api/dashboard/stats").then((r) => setStats(r.data)).catch(() => {});
    api.get("/api/employees").then((r) => setEmployees(r.data)).catch(() => {});
    api.get("/api/payroll").then((r) => setPayrollRows(r.data)).catch(() => {});
    api.get("/api/expenses").then((r) => setExpenseRows(r.data)).catch(() => {});
    api.get("/api/revenue").then((r) => setRevenueRows(r.data)).catch(() => {});
  }, []);

  const exportEmployees = () => {
    const ws = XLSX.utils.json_to_sheet(employees);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Employees");
    XLSX.writeFile(wb, "report_employees.xlsx");
  };

  const exportPayroll = () => {
    const ws = XLSX.utils.json_to_sheet(payrollRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Payroll");
    XLSX.writeFile(wb, "report_payroll.xlsx");
  };

  const exportExpenses = () => {
    const ws = XLSX.utils.json_to_sheet(expenseRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Expenses");
    XLSX.writeFile(wb, "report_expenses.xlsx");
  };

  const exportRevenue = () => {
    const ws = XLSX.utils.json_to_sheet(revenueRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Revenue");
    XLSX.writeFile(wb, "report_revenue.xlsx");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <BarChart3 size={22} className="text-brand-500" /> Reports & Analytics
        </h1>
        <p className="text-sm text-slate-400">Generate and export HR, payroll, expense, and revenue reports</p>
      </div>

      {/* Summary KPI Cards */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="card p-4">
            <p className="text-xs text-slate-400">Total Employees</p>
            <p className="text-2xl font-bold">{stats.total_employees}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-slate-400">Avg Attendance</p>
            <p className="text-2xl font-bold text-emerald-600">{stats.attendance_percentage}%</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-slate-400">Monthly Payroll</p>
            <p className="text-2xl font-bold text-blue-600">₹{(stats.monthly_payroll / 100000).toFixed(1)}L</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-slate-400">Revenue (Current Month)</p>
            <p className="text-2xl font-bold text-purple-600">₹{(stats.total_revenue_this_month / 100000).toFixed(1)}L</p>
          </div>
        </div>
      )}

      {/* Report Export Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300">
              <Users size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Employee Master</h3>
              <p className="text-xs text-slate-400">{employees.length} records</p>
            </div>
          </div>
          <p className="text-xs text-slate-500">Full directory of active and inactive staff, contact details, branch assignments, and salaries.</p>
          <button onClick={exportEmployees} className="btn-secondary gap-2 w-full text-xs">
            <Download size={14} /> Export Excel
          </button>
        </div>

        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
              <Wallet size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Payroll Report</h3>
              <p className="text-xs text-slate-400">{payrollRows.length} records</p>
            </div>
          </div>
          <p className="text-xs text-slate-500">Breakdown of gross salaries, PF, ESI, TDS deductions, and net payout per employee.</p>
          <button onClick={exportPayroll} className="btn-secondary gap-2 w-full text-xs">
            <Download size={14} /> Export Excel
          </button>
        </div>

        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
              <DollarSign size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Expense Claims</h3>
              <p className="text-xs text-slate-400">{expenseRows.length} records</p>
            </div>
          </div>
          <p className="text-xs text-slate-500">Reimbursement logs by category (travel, food, office supplies) and approval statuses.</p>
          <button onClick={exportExpenses} className="btn-secondary gap-2 w-full text-xs">
            <Download size={14} /> Export Excel
          </button>
        </div>

        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
              <TrendingUp size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Revenue Targets</h3>
              <p className="text-xs text-slate-400">{revenueRows.length} records</p>
            </div>
          </div>
          <p className="text-xs text-slate-500">Team performance against targets, achievement ratios, and incentive payouts.</p>
          <button onClick={exportRevenue} className="btn-secondary gap-2 w-full text-xs">
            <Download size={14} /> Export Excel
          </button>
        </div>
      </div>
    </div>
  );
}
