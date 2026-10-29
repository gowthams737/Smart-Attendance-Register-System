import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AdvisorLayout from '../../layouts/AdvisorLayout';
import {
  IoPeopleOutline, IoTimeOutline, IoDocumentTextOutline,
  IoAlertCircleOutline, IoPlayOutline, IoPulse, IoClose, IoSchoolOutline, IoVideocamOutline
} from 'react-icons/io5';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, BarChart, Bar, Cell
} from 'recharts';
import { apiService } from '../../services/api';

export default function AdvisorDashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState({
    totalStudents: 0,
    todayAttendanceRate: 0,
    todayPresent: 0,
    todayTotal: 0,
    lowAttendanceCount: 0,
    weeklyTrends: [],
    recentActivities: []
  });
  const [pendingLeaveCount, setPendingLeaveCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lowAttendanceModalOpen, setLowAttendanceModalOpen] = useState(false);
  const [lowAttendanceStudents, setLowAttendanceStudents] = useState([]);
  const [loadingLowAttendance, setLoadingLowAttendance] = useState(false);

  const [advisorInfo, setAdvisorInfo] = useState(() => {
    try {
      const session = localStorage.getItem('adminSession');
      if (session) {
        const parsed = JSON.parse(session);
        return {
          year: parsed.year || '3rd Year',
          section: parsed.section || parsed.class || 'CSE B'
        };
      }
    } catch (e) {
      console.error(e);
    }
    return { year: '3rd Year', section: 'CSE B' };
  });

  const handleOpenLowAttendanceModal = async () => {
    setLowAttendanceModalOpen(true);
    setLoadingLowAttendance(true);
    try {
      const students = await apiService.getStudents();
      const lowAtt = students.filter(s => s.attendanceRate < 75.0);
      setLowAttendanceStudents(lowAtt);
    } catch (err) {
      console.error("Failed to load low attendance students:", err);
    } finally {
      setLoadingLowAttendance(false);
    }
  };

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const [res, letters, apps] = await Promise.all([
          apiService.getDashboardData(),
          apiService.getAdminLeaveLetters().catch(() => []),
          apiService.getAdminAllLeaves().catch(() => [])
        ]);
        setData(res);

        const pendingLetters = (letters || []).filter(l => String(l.status).toUpperCase() === 'PENDING').length;
        const pendingApps = (apps || []).filter(a => String(a.status).toUpperCase() === 'PENDING').length;
        setPendingLeaveCount(pendingLetters + pendingApps);
      } catch (err) {
        console.error('Failed to load class advisor dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  return (
    <AdvisorLayout>
      <div className="space-y-6">
        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 p-6 rounded-3xl text-white shadow-xl relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs uppercase tracking-wider mb-1">
              <IoSchoolOutline className="text-lg" />
              <span>Assigned Class Advisor Portal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {advisorInfo.year} — {(advisorInfo.section || '').replace(/^Section\s*/i, '')} Overview
            </h1>
            <p className="text-indigo-200 text-xs sm:text-sm mt-1 max-w-xl">
              Manage attendance, review leave applications, and track student performance for your assigned class.
            </p>
          </div>

          <div className="relative z-10 flex items-center gap-3">
            <Link
              to="/advisor/live"
              className="py-3 px-5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-2xl shadow-lg transition-all flex items-center gap-2"
            >
              <IoVideocamOutline className="text-base" />
              <span>Start Live Scanner</span>
            </Link>
            <Link
              to="/advisor/leaves"
              className="py-3 px-5 bg-white text-indigo-950 font-bold text-xs rounded-2xl shadow-lg hover:bg-indigo-50 transition-all flex items-center gap-2"
            >
              <IoDocumentTextOutline className="text-base text-indigo-600" />
              <span>View Leave Requests ({pendingLeaveCount})</span>
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Stat 1: Class Students */}
          <div 
            onClick={() => navigate('/advisor/students')}
            className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-700 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Class Students</span>
              <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
                <IoPeopleOutline className="text-xl" />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                {loading ? '...' : data.totalStudents}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">Enrolled in {advisorInfo.year} {advisorInfo.section}</p>
            </div>
          </div>

          {/* Stat 2: Average Class Attendance */}
          <div 
            onClick={() => navigate('/advisor/history')}
            className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-emerald-300 dark:hover:border-emerald-700 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Average Class Attendance</span>
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                <IoPulse className="text-xl" />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                {loading ? '...' : `${data.todayAttendanceRate}%`}
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
                {data.todayPresent} of {data.todayTotal || data.totalStudents} present today
              </p>
            </div>
          </div>

          {/* Stat 3: Pending Leave Requests */}
          <div 
            onClick={() => navigate('/advisor/leaves')}
            className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-amber-300 dark:hover:border-amber-700 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Leave Requests</span>
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
                <IoDocumentTextOutline className="text-xl" />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                {loading ? '...' : pendingLeaveCount}
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 font-medium">
                {pendingLeaveCount === 0 ? 'No pending requests' : 'Requires your approval'}
              </p>
            </div>
          </div>

          {/* Stat 4: Low Attendance Warning */}
          <div 
            onClick={handleOpenLowAttendanceModal}
            className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-rose-300 dark:hover:border-rose-700 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Low Attendance</span>
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform">
                <IoAlertCircleOutline className="text-xl" />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                {loading ? '...' : data.lowAttendanceCount}
              </p>
              <p className="text-xs text-rose-500 mt-1 font-medium">Below 75% threshold</p>
            </div>
          </div>
        </div>

        {/* Weekly Trend Chart for Class */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold">Weekly Attendance Trend</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">7-day attendance percentage for {advisorInfo.year} {advisorInfo.section}</p>
            </div>
          </div>

          <div className="h-72 w-full">
            {loading ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">Loading chart...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.weeklyTrends || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                    formatter={(val) => [val !== null && val !== undefined ? `${val}%` : 'No Data', 'Attendance']}
                  />
                  <Area type="monotone" dataKey="rate" connectNulls={true} stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorTrend)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Low Attendance Modal */}
        {lowAttendanceModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-base">
                  <IoAlertCircleOutline className="text-xl" />
                  <h3>Low Attendance Students (&lt; 75%)</h3>
                </div>
                <button 
                  onClick={() => setLowAttendanceModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <IoClose className="text-xl" />
                </button>
              </div>

              <div className="py-4 max-h-96 overflow-y-auto space-y-2">
                {loadingLowAttendance ? (
                  <p className="text-center text-xs text-slate-500 py-6">Loading students...</p>
                ) : lowAttendanceStudents.length === 0 ? (
                  <p className="text-center text-xs text-slate-500 py-6">No students in your class are below 75% attendance.</p>
                ) : (
                  lowAttendanceStudents.map(student => (
                    <div key={student.id} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">{student.name}</p>
                        <p className="text-[11px] text-slate-500">Reg: {student.registerNo} | {student.department}</p>
                      </div>
                      <div className="px-3 py-1 bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 font-extrabold text-xs rounded-full">
                        {student.attendanceRate}%
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-right">
                <button
                  onClick={() => setLowAttendanceModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-xs font-bold rounded-xl text-slate-700 dark:text-slate-300"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdvisorLayout>
  );
}
