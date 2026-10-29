import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import {
  IoPeopleOutline, IoTimeOutline, IoVideocamOutline,
  IoAlertCircleOutline, IoPlayOutline, IoPersonAddOutline,
  IoDocumentTextOutline, IoSettingsOutline, IoPulse, IoClose
} from 'react-icons/io5';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, BarChart, Bar, Cell
} from 'recharts';
import { apiService } from '../services/api';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState({
    totalStudents: 0,
    todayAttendanceRate: 0,
    todayPresent: 0,
    todayTotal: 0,
    lowAttendanceCount: 0,
    lowAttendanceByClass: [],
    hasAttendanceData: false,
    departmentStats: [],
    weeklyTrends: [],
    recentActivities: []
  });
  const [loading, setLoading] = useState(true);
  const [lowAttendanceModalOpen, setLowAttendanceModalOpen] = useState(false);
  const [lowAttendanceStudents, setLowAttendanceStudents] = useState([]);
  const [loadingLowAttendance, setLoadingLowAttendance] = useState(false);

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
        const res = await apiService.getDashboardData();
        setData(res || {});
      } catch (err) {
        console.error('Failed to fetch dashboard data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  const isMainAdmin = (() => {
    try {
      const session = localStorage.getItem('adminSession');
      if (session) {
        const parsed = JSON.parse(session);
        return parsed.is_hod === true || parsed.role === 'admin';
      }
    } catch (e) {
      console.error(e);
    }
    return false;
  })();

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white font-heading tracking-tight">
              Dashboard Overview
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Real-time campus occupancy and face recognition attendance records.
            </p>
          </div>
          <Link
            to="/admin/live"
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-md shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all duration-200"
          >
            <IoPlayOutline className="text-lg" />
            <span>Launch Live Scanner</span>
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 0: Total Students */}
          <div 
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm flex items-center justify-between hover:shadow-md transition-shadow"
            id="stat-card-0"
          >
            <div className="text-left">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Students</span>
              <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white mt-2 font-heading tracking-tight">{data.totalStudents}</h3>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 block">Enrolled in database</span>
            </div>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl border bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400">
              <IoPeopleOutline />
            </div>
          </div>

          {/* Card 1: Today's Attendance */}
          <div 
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm flex items-center justify-between hover:shadow-md transition-shadow"
            id="stat-card-1"
          >
            <div className="text-left">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Today's Attendance</span>
              <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white mt-2 font-heading tracking-tight">{data.todayAttendanceRate}%</h3>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 block">{data.todayPresent}/{data.todayTotal} present</span>
            </div>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl border bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <IoTimeOutline />
            </div>
          </div>

          {/* Card 2: LOW ATTENDANCE BY CLASS (Replaces Leave Requests) */}
          <div 
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow cursor-pointer hover:border-amber-500/40"
            onClick={handleOpenLowAttendanceModal}
            id="stat-card-2"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Low Attendance by Class</span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg border bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
                <IoAlertCircleOutline />
              </div>
            </div>

            <div className="text-left space-y-1.5 max-h-24 overflow-y-auto pr-1">
              {!data.hasAttendanceData ? (
                <p className="text-xs font-medium text-slate-400 dark:text-slate-500 py-2">No attendance data available</p>
              ) : !data.lowAttendanceByClass || data.lowAttendanceByClass.length === 0 ? (
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 py-2">No students below 75%</p>
              ) : (
                data.lowAttendanceByClass.map((cls, idx) => (
                  <div key={idx} className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex justify-between items-center py-0.5 border-b border-slate-100 dark:border-slate-800/60 last:border-b-0">
                    <span className="font-bold text-slate-900 dark:text-white truncate max-w-[130px]">{cls.displayName}</span>
                    <span className="text-rose-600 dark:text-rose-400 font-bold shrink-0">{cls.count} {cls.count === 1 ? 'student' : 'students'} below 75%</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Card 3: Low Attendance Alerts */}
          <div 
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm flex items-center justify-between hover:shadow-md transition-shadow cursor-pointer hover:border-indigo-500/40"
            onClick={handleOpenLowAttendanceModal}
            id="stat-card-3"
          >
            <div className="text-left">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Low Attendance Alerts</span>
              <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white mt-2 font-heading tracking-tight">{data.lowAttendanceCount}</h3>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 block">Below 75% limit</span>
            </div>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl border bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400">
              <IoAlertCircleOutline />
            </div>
          </div>
        </div>


        {/* Charts & Graphs Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Attendance Trend (Line/Area Chart) */}
          <div className="xl:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm text-left">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white font-heading mb-4">Weekly Attendance Trend</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.weeklyTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-slate-800" />
                  <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.9)',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                  />
                  <Area type="monotone" dataKey="Present" stroke="#4f46e5" strokeWidth={2.5} fillOpacity={1} fill="url(#colorPresent)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Department Wise average (Bar chart) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm text-left flex flex-col justify-between">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white font-heading mb-4">Department Averages</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.departmentStats.slice(0, 4)} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-slate-800" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.9)',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                  />
                  <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                    {data.departmentStats.slice(0, 4).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <span className="text-xs text-slate-450 dark:text-slate-500 font-semibold block text-center mt-2">Rates based on 2026 academic term logs</span>
          </div>
        </div>

        {/* Quick Actions & Recent Activities */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Quick Actions */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm text-left">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white font-heading mb-4">Quick Operations</h3>
            <div className="grid grid-cols-2 gap-4">
              <Link to="/admin/register-student" className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500/40 hover:bg-indigo-500/5 dark:hover:bg-indigo-500/5 transition-all text-left flex flex-col justify-between h-28">
                <IoPersonAddOutline className="text-2xl text-indigo-650 dark:text-indigo-400" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">Register Student</span>
              </Link>
              <Link to="/admin/reports" className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500/40 hover:bg-emerald-500/5 dark:hover:bg-emerald-500/5 transition-all text-left flex flex-col justify-between h-28">
                <IoDocumentTextOutline className="text-2xl text-emerald-650 dark:text-emerald-455" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">Export Reports</span>
              </Link>
              <Link to="/admin/settings" className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-amber-500/40 hover:bg-amber-500/5 dark:hover:bg-amber-500/5 transition-all text-left flex flex-col justify-between h-28">
                <IoSettingsOutline className="text-2xl text-amber-650 dark:text-amber-400" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">Configure System</span>
              </Link>
              <Link to="/admin/live" className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 hover:bg-indigo-500/10 transition-all text-left flex flex-col justify-between h-28">
                <IoPulse className="text-2xl text-indigo-600 dark:text-indigo-400 animate-pulse" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">Live Attendance</span>
              </Link>
            </div>
          </div>

          {/* Recent Activities */}
          <div className="xl:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm text-left flex flex-col">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white font-heading mb-4">Recent System Activities</h3>
            <div className="space-y-4 flex-1 max-h-[17.5rem] overflow-y-auto pr-2">
              {data.recentActivities.map((act) => (
                <div key={act.id} className="flex items-start gap-3 text-sm pb-3.5 border-b border-slate-100 dark:border-slate-800 last:border-b-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 dark:bg-indigo-400 mt-1.5 shrink-0 animate-pulse"></div>
                  <div className="flex-1">
                    <p className="text-slate-800 dark:text-slate-250 font-medium leading-snug">{act.text}</p>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1 font-semibold">
                      <IoTimeOutline />
                      <span>{act.time}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Low Attendance Alert Modal */}
      {lowAttendanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-2xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden text-left animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-805 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-600 flex items-center justify-center text-lg">
                  <IoAlertCircleOutline />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-lg font-heading">Low Attendance Details</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Students with attendance rate below the 75% limit.</p>
                </div>
              </div>
              <button 
                onClick={() => setLowAttendanceModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-205 transition-colors"
              >
                <IoClose className="text-xl" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1">
              {loadingLowAttendance ? (
                <div className="py-12 text-center text-slate-400 text-sm">
                  Loading low attendance list...
                </div>
              ) : lowAttendanceStudents.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm">
                  No students currently below the 75% attendance threshold.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-bold uppercase text-slate-400 tracking-wider">
                        <th className="pb-3">Student Name</th>
                        <th className="pb-3">Reg Number</th>
                        <th className="pb-3">Department</th>
                        <th className="pb-3">Year</th>
                        <th className="pb-3 text-center px-2">Total Sessions</th>
                        <th className="pb-3 text-center font-medium px-4">Present</th>
                        <th className="pb-3 text-center font-medium px-4">Absent</th>
                        <th className="pb-3 text-right">Attendance %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {lowAttendanceStudents.map((student) => (
                        <tr key={student.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/20 transition-colors">
                          <td className="py-3 font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                            {student.avatar && (
                              <img src={apiService.getAssetUrl(student.avatar)} onError={(e) => apiService.handleImageError(e, student.name)} alt={student.name} className="w-6 h-6 rounded-full object-cover" />
                            )}
                            <span>{student.name}</span>
                          </td>
                          <td className="py-3 font-mono font-bold text-slate-500">{student.registerNo}</td>
                          <td className="py-3 text-slate-500">{student.department}</td>
                          <td className="py-3 text-slate-500">{student.year}</td>
                          <td className="py-3 text-center text-slate-650 dark:text-slate-400 px-2">{student.totalClasses}</td>
                          <td className="py-3 text-center text-emerald-600 font-semibold px-4">{student.presentClasses}</td>
                          <td className="py-3 text-center text-rose-605 font-semibold px-4">{student.totalClasses - student.presentClasses}</td>
                          <td className="py-3 text-right">
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600">
                              {student.attendanceRate}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-205 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setLowAttendanceModalOpen(false)}
                className="px-4 py-2 bg-indigo-650 text-white text-xs font-bold rounded-lg hover:opacity-90 transition-opacity"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
