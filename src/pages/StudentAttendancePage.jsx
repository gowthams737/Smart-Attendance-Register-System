import React, { useState, useEffect } from 'react';
import StudentLayout from '../layouts/StudentLayout';
import { apiService } from '../services/api';
import { useToast } from '../context/ToastContext';
import StudentDatePicker from '../components/StudentDatePicker';
import { formatStudentDate, getISTTodayString } from '../utils/dateUtils';
import {
  IoCalendarOutline, IoFilterOutline, IoRefreshOutline,
  IoCheckmarkCircleOutline, IoCloseCircleOutline, IoDocumentTextOutline, IoPieChartOutline
} from 'react-icons/io5';

export default function StudentAttendancePage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [dateFilter, setDateFilter] = useState(() => getISTTodayString());
  const [statusFilter, setStatusFilter] = useState('All');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sumRes, attRes] = await Promise.all([
        apiService.getStudentSummary(),
        apiService.getStudentAttendance(dateFilter, statusFilter === 'All' ? '' : statusFilter)
      ]);
      setSummary(sumRes);
      setAttendance(attRes || []);
    } catch (err) {
      console.error('Failed to fetch attendance history:', err);
      showToast('Error loading attendance history', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateFilter, statusFilter]);

  const handleResetFilters = () => {
    setDateFilter(getISTTodayString());
    setStatusFilter('All');
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Present':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">Present</span>;
      case 'Absent':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">Absent</span>;
      case 'P/A':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">Morning Present</span>;
      case 'A/P':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">Afternoon Present</span>;
      case 'Leave':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">Leave</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">{status || '---'}</span>;
    }
  };

  const overallRate = summary?.overallPercentage || 0;

  return (
    <StudentLayout>
      <div className="space-y-6">
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-heading text-slate-900 dark:text-white">
              My Attendance History
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Comprehensive record of session attendance and holiday exclusions
            </p>
          </div>
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm self-start sm:self-auto"
          >
            <IoRefreshOutline className="text-base" />
            <span>Refresh Data</span>
          </button>
        </div>

        {/* Summary Mini Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Attendance %</span>
              <IoPieChartOutline className="text-lg text-indigo-500" />
            </div>
            <p className={`text-2xl font-extrabold mt-2 ${overallRate >= 75 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {overallRate.toFixed(2)}%
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Present</span>
              <IoCheckmarkCircleOutline className="text-lg text-emerald-500" />
            </div>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-2">
              {summary?.presentCount || 0}
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Absent</span>
              <IoCloseCircleOutline className="text-lg text-rose-500" />
            </div>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-2">
              {summary?.absentCount || 0}
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Working Days</span>
              <IoCalendarOutline className="text-lg text-blue-500" />
            </div>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-2">
              {summary?.workingDays || 0}
            </p>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-initial">
              <StudentDatePicker
                value={dateFilter}
                onChange={(newDate) => setDateFilter(newDate)}
                placeholder="DD/MM/YYYY"
              />
            </div>

            <div className="flex-1 sm:flex-initial">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="All">All Statuses</option>
                <option value="Present">Present</option>
                <option value="P/A">Morning Present</option>
                <option value="A/P">Afternoon Present</option>
                <option value="Absent">Absent</option>
                <option value="Leave">Leave</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            {dateFilter && (
              <button
                onClick={() => setDateFilter('')}
                className="text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              >
                Show All Dates
              </button>
            )}
            {(dateFilter !== getISTTodayString() || statusFilter !== 'All') && (
              <button
                onClick={handleResetFilters}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Reset to Today
              </button>
            )}
          </div>
        </div>

        {/* Detailed History Table */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[11px] font-bold text-slate-450 uppercase tracking-wider">
                  <th className="py-3.5 px-5">Date</th>
                  <th className="py-3.5 px-5">Day</th>
                  <th className="py-3.5 px-5">Morning Session</th>
                  <th className="py-3.5 px-5">Afternoon Session</th>
                  <th className="py-3.5 px-5">Status</th>
                  <th className="py-3.5 px-5">Recorded Time</th>
                  <th className="py-3.5 px-5">Detection Method</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm font-medium">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-slate-400">
                      Loading attendance records...
                    </td>
                  </tr>
                ) : attendance.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-slate-400">
                      No attendance records match your filter criteria.
                    </td>
                  </tr>
                ) : (
                  attendance.map((row) => (
                    <tr key={row.id || row.date} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-4 px-5 font-mono text-slate-900 dark:text-white font-semibold">
                        {formatStudentDate(row.date)}
                      </td>
                      <td className="py-4 px-5 text-slate-600 dark:text-slate-350">
                        {row.day}
                      </td>
                      <td className="py-4 px-5">
                        <span className={`font-semibold ${row.morningSession === 'Present' ? 'text-emerald-600 dark:text-emerald-400' : row.morningSession === 'Absent' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>
                          {row.morningSession}
                        </span>
                      </td>
                      <td className="py-4 px-5">
                        <span className={`font-semibold ${row.afternoonSession === 'Present' ? 'text-emerald-600 dark:text-emerald-400' : row.afternoonSession === 'Absent' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>
                          {row.afternoonSession}
                        </span>
                      </td>
                      <td className="py-4 px-5">
                        {getStatusBadge(row.status)}
                      </td>
                      <td className="py-4 px-5 text-xs font-mono text-slate-500 dark:text-slate-400">
                        {row.time}
                      </td>
                      <td className="py-4 px-5 text-xs text-slate-500 dark:text-slate-400">
                        {row.method || 'Face Recognition'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </StudentLayout>
  );
}
