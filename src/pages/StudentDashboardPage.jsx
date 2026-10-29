import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import StudentLayout from '../layouts/StudentLayout';
import { apiService } from '../services/api';
import { useToast } from '../context/ToastContext';
import { formatStudentDate } from '../utils/dateUtils';
import {
  IoCheckmarkCircleOutline, IoCloseCircleOutline,
  IoCalendarOutline, IoDocumentTextOutline, IoArrowForward,
  IoPieChartOutline, IoAlertCircleOutline, IoSchoolOutline
} from 'react-icons/io5';

export default function StudentDashboardPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [recentAttendance, setRecentAttendance] = useState([]);
  const [recentLeaves, setRecentLeaves] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [sumRes, attRes, leaveRes] = await Promise.all([
          apiService.getStudentSummary(),
          apiService.getStudentAttendance(),
          apiService.getStudentLeave()
        ]);
        setSummary(sumRes);
        setRecentAttendance(attRes ? attRes.slice(0, 5) : []);
        setRecentLeaves(leaveRes ? leaveRes.slice(0, 5) : []);
      } catch (err) {
        console.error('Failed to fetch student dashboard data:', err);
        showToast('Error loading dashboard data', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [showToast]);

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

  const getLeaveStatusBadge = (status) => {
    switch (status) {
      case 'Approved':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">Approved</span>;
      case 'Pending':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">Pending</span>;
      case 'Rejected':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">Rejected</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">{status}</span>;
    }
  };

  if (loading) {
    return (
      <StudentLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400 font-medium">Loading Student Portal...</p>
        </div>
      </StudentLayout>
    );
  }

  const student = summary?.student || {};
  const overallRate = summary?.overallPercentage || 0;

  return (
    <StudentLayout>
      <div className="space-y-6">
        {/* Profile Banner */}
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-850 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none flex items-center pr-10">
            <IoSchoolOutline className="text-[200px]" />
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
            <div className="flex items-center gap-5">
              <img
                src={student.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150"}
                alt={student.name}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border-2 border-white/20 shadow-lg cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => navigate('/student/profile')}
                title="View My Profile"
              />
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold font-heading">
                  Welcome, {student.name || 'Student'}
                </h1>
                <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-indigo-200">
                  <span className="bg-indigo-800/60 px-3 py-1 rounded-lg border border-indigo-700/50 font-semibold">
                    {student.department || 'CSE'}
                  </span>
                  <span>•</span>
                  <span className="font-medium">{student.year || '3rd Year'}</span>
                  <span>•</span>
                  <span className="font-medium">Class: {student.section || 'A'}</span>
                  {student.gender && student.gender !== 'Not Specified' && (
                    <>
                      <span>•</span>
                      <span className="font-medium">Gender: {student.gender}</span>
                    </>
                  )}
                </div>
                <p className="text-xs text-indigo-300/80 mt-2 font-mono">
                  Register No: <span className="font-bold text-white tracking-wider">{student.registerNo}</span>
                </p>
              </div>
            </div>

            <div
              onClick={() => navigate('/student/attendance')}
              className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 text-center min-w-[140px] cursor-pointer hover:bg-white/20 transition-all"
              title="View My Attendance"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-200">Overall Attendance</p>
              <p className={`text-3xl font-extrabold mt-1 ${overallRate >= 75 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {overallRate.toFixed(2)}%
              </p>
              <p className="text-[10px] text-slate-300 mt-0.5">
                {overallRate >= 75 ? 'Eligible for Exams' : 'Below 75% Threshold'}
              </p>
            </div>
          </div>
        </div>

        {/* Attendance Summary Grid */}
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3">Overall Attendance Overview</h2>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Percentage Card */}
            <div
              onClick={() => navigate('/student/attendance')}
              className="col-span-2 lg:col-span-1 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between cursor-pointer hover:border-indigo-500/50 transition-all"
              title="View My Attendance"
            >
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span className="text-xs font-bold uppercase tracking-wider">Attendance %</span>
                <IoPieChartOutline className="text-xl text-indigo-500" />
              </div>
              <div className="mt-3">
                <span className={`text-3xl font-extrabold ${overallRate >= 75 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {overallRate.toFixed(2)}%
                </span>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mt-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${overallRate >= 75 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                    style={{ width: `${Math.min(100, Math.max(0, overallRate))}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Present Count Card */}
            <div
              onClick={() => navigate('/student/attendance')}
              className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm cursor-pointer hover:border-emerald-500/50 transition-all"
              title="View My Attendance"
            >
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span className="text-xs font-bold uppercase tracking-wider">Present</span>
                <IoCheckmarkCircleOutline className="text-xl text-emerald-500" />
              </div>
              <p className="text-3xl font-extrabold text-slate-900 dark:text-white mt-3">
                {summary?.presentCount || 0}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-medium">Days Present</p>
            </div>

            {/* Absent Count Card */}
            <div
              onClick={() => navigate('/student/attendance')}
              className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm cursor-pointer hover:border-rose-500/50 transition-all"
              title="View My Attendance"
            >
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span className="text-xs font-bold uppercase tracking-wider">Absent</span>
                <IoCloseCircleOutline className="text-xl text-rose-500" />
              </div>
              <p className="text-3xl font-extrabold text-slate-900 dark:text-white mt-3">
                {summary?.absentCount || 0}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-medium">Days Absent</p>
            </div>

            {/* Leave Count Card */}
            <div
              onClick={() => navigate('/student/leave')}
              className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm cursor-pointer hover:border-purple-500/50 transition-all"
              title="View Leave Requests"
            >
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span className="text-xs font-bold uppercase tracking-wider">Leave</span>
                <IoDocumentTextOutline className="text-xl text-purple-500" />
              </div>
              <p className="text-3xl font-extrabold text-slate-900 dark:text-white mt-3">
                {summary?.leaveCount || 0}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-medium">Leave Days</p>
            </div>

            {/* Working Days Card */}
            <div
              onClick={() => navigate('/student/attendance')}
              className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm cursor-pointer hover:border-blue-500/50 transition-all"
              title="View My Attendance"
            >
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span className="text-xs font-bold uppercase tracking-wider">Working Days</span>
                <IoCalendarOutline className="text-xl text-blue-500" />
              </div>
              <p className="text-3xl font-extrabold text-slate-900 dark:text-white mt-3">
                {summary?.workingDays || 0}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-medium">Completed Working Days</p>
            </div>
          </div>
        </div>

        {/* My Attendance Table Section */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">My Attendance History</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Showing recent session breakdown</p>
            </div>
            <Link
              to="/student/attendance"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
            >
              <span>View Full History</span>
              <IoArrowForward className="text-sm" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[11px] font-bold text-slate-450 uppercase tracking-wider">
                  <th className="py-3 px-5">Date</th>
                  <th className="py-3 px-5">Day</th>
                  <th className="py-3 px-5">Morning Session</th>
                  <th className="py-3 px-5">Afternoon Session</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5">Recorded Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm font-medium">
                {recentAttendance.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-8 text-center text-slate-400">
                      No attendance records found.
                    </td>
                  </tr>
                ) : (
                  recentAttendance.map((row) => (
                    <tr
                      key={row.id || row.date}
                      onClick={() => navigate('/student/attendance')}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                      title="View Full Attendance History"
                    >
                      <td className="py-3.5 px-5 font-mono text-slate-900 dark:text-white font-semibold">
                        {formatStudentDate(row.date)}
                      </td>
                      <td className="py-3.5 px-5 text-slate-600 dark:text-slate-350">
                        {row.day}
                      </td>
                      <td className="py-3.5 px-5">
                        <span className={`font-semibold ${row.morningSession === 'Present' ? 'text-emerald-600 dark:text-emerald-400' : row.morningSession === 'Absent' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>
                          {row.morningSession}
                        </span>
                      </td>
                      <td className="py-3.5 px-5">
                        <span className={`font-semibold ${row.afternoonSession === 'Present' ? 'text-emerald-600 dark:text-emerald-400' : row.afternoonSession === 'Absent' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>
                          {row.afternoonSession}
                        </span>
                      </td>
                      <td className="py-3.5 px-5">
                        {getStatusBadge(row.status)}
                      </td>
                      <td className="py-3.5 px-5 text-xs font-mono text-slate-500 dark:text-slate-400">
                        {row.time}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* My Leave History Section */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">My Leave History</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Applied leave requests and status</p>
            </div>
            <Link
              to="/student/leave"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
            >
              <span>Manage Leaves</span>
              <IoArrowForward className="text-sm" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[11px] font-bold text-slate-450 uppercase tracking-wider">
                  <th className="py-3 px-5">Date</th>
                  <th className="py-3 px-5">Reason</th>
                  <th className="py-3 px-5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm font-medium">
                {recentLeaves.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="py-8 text-center text-slate-400">
                      No leave history records found.
                    </td>
                  </tr>
                ) : (
                  recentLeaves.map((row) => (
                    <tr
                      key={row.id || `${row.date}-${row.reason}`}
                      onClick={() => navigate('/student/leave')}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                      title="View Leave Requests"
                    >
                      <td className="py-3.5 px-5 font-mono text-slate-900 dark:text-white font-semibold">
                        {formatStudentDate(row.date)}
                      </td>
                      <td className="py-3.5 px-5 text-slate-600 dark:text-slate-350">
                        {row.reason}
                      </td>
                      <td className="py-3.5 px-5">
                        {getLeaveStatusBadge(row.status)}
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
