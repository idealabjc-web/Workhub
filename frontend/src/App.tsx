import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import ProtectedRoute from "./routes/ProtectedRoute";
import Layout from "./components/Layout";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import EmployeeProfile from "./pages/EmployeeProfile";
import Attendance from "./pages/Attendance";
import Leaves from "./pages/Leaves";
import Payroll from "./pages/Payroll";
import Payslips from "./pages/Payslips";
import Holidays from "./pages/Holidays";
import Revenue from "./pages/Revenue";
import Moments from "./pages/Moments";
import Expenses from "./pages/Expenses";
import Events from "./pages/Events";
import Announcements from "./pages/Announcements";
import Documents from "./pages/Documents";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import CompanyCalendar from "./pages/CompanyCalendar";

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />

            {/* Authenticated routes available to ALL logged-in roles (Employee & HR) */}
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/attendance" element={<Attendance />} />
                <Route path="/leaves" element={<Leaves />} />
                <Route path="/calendar" element={<CompanyCalendar />} />
                <Route path="/announcements" element={<Announcements />} />
                <Route path="/moments" element={<Moments />} />
                <Route path="/employees/:id" element={<EmployeeProfile />} />
              </Route>
            </Route>

            {/* Strictly Restricted routes for HR, Admin, Manager, Finance ONLY */}
            <Route element={<ProtectedRoute allowedRoles={["SUPER_ADMIN", "HR", "MANAGER", "FINANCE"]} />}>
              <Route element={<Layout />}>
                <Route path="/employees" element={<Employees />} />
                <Route path="/payroll" element={<Payroll />} />
                <Route path="/payslips" element={<Payslips />} />
                <Route path="/revenue" element={<Revenue />} />
                <Route path="/expenses" element={<Expenses />} />
                <Route path="/events" element={<Events />} />
                <Route path="/holidays" element={<Holidays />} />
                <Route path="/documents" element={<Documents />} />
                <Route path="/reports" element={<Reports />} />
              </Route>
            </Route>

            {/* Admin/HR Only Routes */}
            <Route element={<ProtectedRoute allowedRoles={["SUPER_ADMIN", "HR"]} />}>
              <Route element={<Layout />}>
                <Route path="/settings" element={<Settings />} />
              </Route>
            </Route>

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
