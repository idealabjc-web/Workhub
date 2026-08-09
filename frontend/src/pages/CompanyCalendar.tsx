import { useEffect, useState } from "react";
import { Calendar as CalendarIcon, PartyPopper, CalendarHeart, ChevronLeft, ChevronRight } from "lucide-react";
import api from "../api/client";

interface Holiday {
  id: string;
  name: string;
  date: string;
  type: string;
  branch?: string;
}

interface CompanyEvent {
  id: string;
  name: string;
  date: string;
  time?: string;
  location?: string;
  organizer?: string;
  branch?: string;
}

export default function CompanyCalendar() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [events, setEvents] = useState<CompanyEvent[]>([]);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));

  useEffect(() => {
    const year = new Date(month + "-01").getFullYear();
    api.get("/api/holidays", { params: { year } }).then((r) => setHolidays(r.data)).catch(() => {});
    api.get("/api/events").then((r) => setEvents(r.data)).catch(() => {});
  }, [month]);

  const prevMonth = () => {
    const d = new Date(month + "-01");
    d.setMonth(d.getMonth() - 1);
    setMonth(d.toISOString().slice(0, 7));
  };

  const nextMonth = () => {
    const d = new Date(month + "-01");
    d.setMonth(d.getMonth() + 1);
    setMonth(d.toISOString().slice(0, 7));
  };

  // Filter items by selected month
  const monthHolidays = holidays.filter((h) => h.date.startsWith(month));
  const monthEvents = events.filter((e) => e.date.startsWith(month));

  const monthName = new Date(month + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <CalendarHeart size={22} className="text-brand-500" /> Company Calendar
          </h1>
          <p className="text-sm text-slate-400">Holidays and official company events</p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="btn-secondary !px-2.5 !py-2"><ChevronLeft size={16} /></button>
          <span className="font-bold text-sm min-w-32 text-center">{monthName}</span>
          <button onClick={nextMonth} className="btn-secondary !px-2.5 !py-2"><ChevronRight size={16} /></button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Holidays */}
        <div className="card p-5 space-y-4">
          <h2 className="text-base font-bold flex items-center gap-2">
            <PartyPopper size={18} className="text-amber-500" /> Holidays ({monthHolidays.length})
          </h2>
          <div className="space-y-3">
            {monthHolidays.map((h) => (
              <div key={h.id} className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">{h.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{new Date(h.date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}</p>
                </div>
                <span className="badge bg-amber-100 text-amber-800 dark:bg-amber-950/40">{h.type}</span>
              </div>
            ))}
            {monthHolidays.length === 0 && (
              <p className="py-8 text-center text-xs text-slate-400">No holidays scheduled for this month</p>
            )}
          </div>
        </div>

        {/* Company Events */}
        <div className="card p-5 space-y-4">
          <h2 className="text-base font-bold flex items-center gap-2">
            <CalendarIcon size={18} className="text-brand-500" /> Company Events ({monthEvents.length})
          </h2>
          <div className="space-y-3">
            {monthEvents.map((e) => (
              <div key={e.id} className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">{e.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{new Date(e.date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })} {e.time ? `at ${e.time}` : ""}</p>
                  {e.location && <p className="text-[11px] text-slate-500 mt-1">📍 {e.location}</p>}
                </div>
                <span className="badge bg-brand-100 text-brand-700 dark:bg-brand-950/40">{e.branch || "All Branches"}</span>
              </div>
            ))}
            {monthEvents.length === 0 && (
              <p className="py-8 text-center text-xs text-slate-400">No events scheduled for this month</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
