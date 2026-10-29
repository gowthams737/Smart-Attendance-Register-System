import React, { useState, useEffect, useCallback, useRef } from 'react';
import DashboardLayout from '../layouts/DashboardLayout';
import { useToast } from '../context/ToastContext';
import { apiService } from '../services/api';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, LineChart, Line, Cell
} from 'recharts';
import {
  IoBarChartOutline, IoTrendingUp, IoCloudDownloadOutline,
  IoCalendarOutline, IoShieldCheckmarkOutline, IoFilterOutline,
  IoRefreshOutline, IoWarningOutline, IoCheckmarkCircleOutline,
  IoDocumentTextOutline
} from 'react-icons/io5';

// Helper to format any YYYY-MM-DD or date string into exact Indian format DD/MM/YYYY (e.g., 04/10/2026)
const formatDateDDMMYYYY = (dateStr) => {
  if (!dateStr || dateStr === '---') return '---';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr;
  
  const parts = dateStr.split('T')[0].split(/[-/]/);
  if (parts.length === 3) {
    let year, month, day;
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      [year, month, day] = parts;
    } else if (parts[2].length === 4) {
      // DD-MM-YYYY
      [day, month, year] = parts;
    } else {
      return dateStr;
    }
    const yyyy = String(year);
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${dd}/${mm}/${yyyy}`;
  }
  return dateStr;
};

// Application-Controlled Date Picker component enforcing DD/MM/YYYY format
const IndianDatePicker = ({ value, onChange }) => {
  const isoToDisplay = (isoStr) => {
    if (!isoStr) return '';
    const parts = isoStr.split('T')[0].split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      const [y, m, d] = parts;
      return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
    }
    return isoStr;
  };

  const [displayText, setDisplayText] = useState(() => isoToDisplay(value));
  const hiddenDateInputRef = useRef(null);

  useEffect(() => {
    setDisplayText(isoToDisplay(value));
  }, [value]);

  const handleInputChange = (e) => {
    const inputVal = e.target.value;
    setDisplayText(inputVal);

    const digitsOnly = inputVal.replace(/\D/g, '');
    if (digitsOnly.length === 8) {
      const dd = digitsOnly.slice(0, 2);
      const mm = digitsOnly.slice(2, 4);
      const yyyy = digitsOnly.slice(4, 8);
      const dNum = parseInt(dd, 10);
      const mNum = parseInt(mm, 10);
      const yNum = parseInt(yyyy, 10);
      if (dNum >= 1 && dNum <= 31 && mNum >= 1 && mNum <= 12 && yNum >= 1900 && yNum <= 2100) {
        setDisplayText(`${dd}/${mm}/${yyyy}`);
        onChange(`${yyyy}-${mm}-${dd}`);
      }
    } else if (inputVal.includes('/')) {
      const parts = inputVal.split('/');
      if (parts.length === 3 && parts[0].length <= 2 && parts[1].length <= 2 && parts[2].length === 4) {
        const dd = parts[0].padStart(2, '0');
        const mm = parts[1].padStart(2, '0');
        const yyyy = parts[2];
        const dNum = parseInt(dd, 10);
        const mNum = parseInt(mm, 10);
        const yNum = parseInt(yyyy, 10);
        if (dNum >= 1 && dNum <= 31 && mNum >= 1 && mNum <= 12 && yNum >= 1900 && yNum <= 2100) {
          onChange(`${yyyy}-${mm}-${dd}`);
        }
      }
    } else if (inputVal.trim() === '') {
      onChange('');
    }
  };

  const handleHiddenPickerChange = (e) => {
    const newIso = e.target.value;
    if (newIso) {
      setDisplayText(isoToDisplay(newIso));
      onChange(newIso);
    }
  };

  const openCalendarPicker = () => {
    if (hiddenDateInputRef.current) {
      if (typeof hiddenDateInputRef.current.showPicker === 'function') {
        hiddenDateInputRef.current.showPicker();
      } else {
        hiddenDateInputRef.current.focus();
        hiddenDateInputRef.current.click();
      }
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={openCalendarPicker}
        className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-indigo-500 transition-colors z-10"
        title="Open Calendar Picker"
      >
        <IoCalendarOutline />
      </button>
      
      <input
        type="text"
        value={displayText}
        onChange={handleInputChange}
        placeholder="dd/mm/yyyy"
        className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />

      <input
        ref={hiddenDateInputRef}
        type="date"
        value={value || ''}
        onChange={handleHiddenPickerChange}
        className="sr-only absolute pointer-events-none opacity-0 w-0 h-0"
        tabIndex={-1}
      />
    </div>
  );
};

export default function ReportsPage({ Layout = DashboardLayout }) {
  const { showToast } = useToast();
  
  const adminSession = React.useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('adminSession') || '{}');
    } catch {
      return {};
    }
  }, []);

  const isClassTeacher = adminSession?.role === 'class_teacher' || adminSession?.is_hod === false;

  const assignedScope = React.useMemo(() => ({
    year: adminSession?.year || '',
    section: adminSession?.section || adminSession?.class || ''
  }), [adminSession]);

  const [selectedYear, setSelectedYear] = useState(() => (isClassTeacher && adminSession?.year ? adminSession.year : 'All'));
  const [selectedClass, setSelectedClass] = useState(() => (isClassTeacher && (adminSession?.section || adminSession?.class) ? (adminSession.section || adminSession.class) : 'All Classes'));
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSession, setSelectedSession] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');

  const classOptions = React.useMemo(() => {
    switch (selectedYear) {
      case '1st Year':
      case '2nd Year':
        return ['All Classes', 'CSE A', 'CSE B', 'CSE C', 'CSE D', 'CSE E'];
      case '3rd Year':
        return ['All Classes', 'CSE A', 'CSE B', 'CSE C', 'CSE D'];
      case '4th Year':
        return ['All Classes', 'CSE A', 'CSE B', 'CSE C'];
      default:
        return ['All Classes'];
    }
  }, [selectedYear]);

  const handleYearChange = (newYear) => {
    setSelectedYear(newYear);
    setSelectedClass('All Classes');
  };

  const [data, setData] = useState({
    overallRate: 0.0,
    hasData: false,
    totalStudents: 0,
    totalAttendance: 0,
    presentCount: 0,
    absentCount: 0,
    topDept: null,
    lowDept: null,
    monthlySummary: [],
    classStats: [],
    departmentStats: [],
    morningStats: { total: 0, present: 0, rate: 0.0 },
    afternoonStats: { total: 0, present: 0, rate: 0.0 }
  });

  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const stats = await apiService.getReportsStats(
        selectedYear,
        selectedClass,
        selectedDate,
        selectedSession,
        selectedStatus
      );
      setData({
        overallRate: stats?.overallRate ?? 0.0,
        hasData: stats?.hasAttendanceData ?? false,
        totalStudents: stats?.totalStudents ?? 0,
        totalAttendance: stats?.totalAttendanceScans ?? 0,
        presentCount: stats?.presentScans ?? 0,
        absentCount: stats?.absentScans ?? 0,
        topDept: stats?.topDepartment ?? null,
        lowDept: stats?.lowDepartment ?? null,
        monthlySummary: Array.isArray(stats?.monthlyAggregates) ? stats.monthlyAggregates.map(m => ({
          name: m?.month || '',
          Average: m?.rate ?? 0
        })) : [],
        classStats: Array.isArray(stats?.departmentComparison) ? stats.departmentComparison : [],
        morningStats: stats?.morningStats || { total: 0, present: 0, rate: 0.0 },
        afternoonStats: stats?.afternoonStats || { total: 0, present: 0, rate: 0.0 }
      });
    } catch (err) {
      console.error('Failed to fetch reports stats:', err);
      if (!isSilent) {
        showToast('Failed to load real-time analytics data.', 'error');
      }
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [selectedYear, selectedClass, selectedDate, selectedSession, selectedStatus, showToast]);

  useEffect(() => {
    fetchStats();

    // Auto refresh every 10 seconds to reflect real-time live scanner scans dynamically
    const interval = setInterval(() => {
      fetchStats(true);
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchStats]);

  const triggerDownload = async (reportName, format = null) => {
    try {
      showToast(`Compiling real-time MongoDB data for ${reportName}...`, 'info');
      let type = format || 'excel';
      if (!format) {
        if (reportName.toLowerCase().includes('pdf') || reportName.toLowerCase().includes('diagnostics')) {
          type = 'pdf';
        } else if (reportName.toLowerCase().includes('csv')) {
          type = 'csv';
        }
      }

      await apiService.downloadReport({
        type: type,
        reportName: reportName,
        year: selectedYear,
        section: selectedClass,
        date: selectedDate,
        session: selectedSession,
        status: selectedStatus
      });
      showToast(`Successfully downloaded ${reportName}`, 'success');
    } catch (err) {
      console.error('Download failed:', err);
      showToast(err.message || 'Failed to download report', 'error');
    }
  };

  const reportOptions = [
    { name: 'Monthly Average Aggregates', desc: isClassTeacher ? 'Detailed breakdown of average class attendance rate by month.' : 'Detailed breakdown of average campus occupancy rate by month.', icon: IoCalendarOutline, type: 'excel', buttonText: 'Download Excel' },
    { name: 'Department Comparison Excel', desc: 'Cross-class comparison list with top-performing metrics from MongoDB.', icon: IoBarChartOutline, type: 'excel', buttonText: 'Download Excel' },
    { name: 'Scanner Diagnostics Report', desc: 'Log of face recognition confidence scores and hardware recognition history.', icon: IoShieldCheckmarkOutline, type: 'pdf', buttonText: 'Download PDF Report' },
  ];

  const CustomBarTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-slate-900 border border-slate-700 text-white p-3 rounded-xl shadow-xl text-xs space-y-1">
          <p className="font-bold text-indigo-300 text-sm">{item.name}</p>
          {item.hasData ? (
            <>
              <p><span className="text-slate-400">Attendance Rate:</span> <strong className="text-emerald-400">{item.rate}%</strong></p>
              <p><span className="text-slate-400">Present / Total Scans:</span> {item.presentCount} / {item.totalScans}</p>
              <p><span className="text-slate-400">Absent Count:</span> {item.absentCount}</p>
              <p><span className="text-slate-400">Registered Students:</span> {item.studentCount}</p>
            </>
          ) : (
            <>
              <p className="text-amber-400 font-semibold">No Attendance Data Scanned Yet</p>
              <p><span className="text-slate-400">Registered Students:</span> {item.studentCount}</p>
              <p className="text-slate-400 italic">Rate will update dynamically when scans occur.</p>
            </>
          )}
        </div>
      );
    };
    return null;
  };

  return (
    <Layout>
      <div className="space-y-8 text-left">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white font-heading">Reports & Analytics</h1>
              <span className="text-xs font-bold px-2.5 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-full border border-indigo-100 dark:border-indigo-900/40">
                {isClassTeacher ? "Class Advisor View" : "HOD Overview"}
              </span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
              {isClassTeacher 
                ? `Viewing attendance reports & analytics scoped to your assigned class: ${assignedScope.year ? `${assignedScope.year} • ` : ''}${assignedScope.section}`
                : "Real-time analytics and dynamic reporting across all CSE classes and academic years."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => triggerDownload('Executive Attendance Report', 'pdf')}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <IoCloudDownloadOutline className="text-base" />
              <span>Export Full Report (PDF)</span>
            </button>

            <button
              onClick={() => triggerDownload('Class Master Log', 'excel')}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <IoDocumentTextOutline className="text-base" />
              <span>Export Master Log (Excel)</span>
            </button>
          </div>
        </div>

        {/* Global Filter Bar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">

            {/* Year Filter */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Academic Year</label>
              <select
                disabled={isClassTeacher}
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(e.target.value);
                  setSelectedClass('All Classes');
                }}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="All">All Years</option>
                <option value="1st Year">1st Year</option>
                <option value="2nd Year">2nd Year</option>
                <option value="3rd Year">3rd Year</option>
                <option value="4th Year">4th Year</option>
              </select>
            </div>

            {/* Class Filter */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Section / Class</label>
              <select
                disabled={isClassTeacher}
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {classOptions.map((cls, idx) => (
                  <option key={idx} value={cls}>{cls}</option>
                ))}
              </select>
            </div>

            {/* Session Filter */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Session</label>
              <select
                value={selectedSession}
                onChange={(e) => setSelectedSession(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="All Sessions">All Sessions</option>
                <option value="Morning">Morning Session (08:00 - 09:30 AM)</option>
                <option value="Afternoon">Afternoon Session (01:00 - 02:15 PM)</option>
              </select>
            </div>

            {/* Date Filter */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Date Filter</label>
              <IndianDatePicker
                value={selectedDate}
                onChange={setSelectedDate}
              />
            </div>
          </div>
        </div>

        {/* Summary Widgets */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Average Attendance
            </span>
            <div className="mt-3">
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white font-heading">
                {data.hasData && data.totalAttendance > 0 ? `${data.overallRate}%` : '0%'}
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Top Performing Class</span>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-3 font-heading truncate">
              {data.topDept && data.topDept.hasData ? data.topDept.name : 'No Data Yet'}
            </h3>
            <p className="text-xs text-slate-500 mt-2 font-semibold text-emerald-600">
              {data.topDept && data.topDept.hasData ? `${data.topDept.rate}% Attendance Rate` : 'No attendance data available'}
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Low Performance Warning</span>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-3 font-heading truncate">
              {data.lowDept && data.lowDept.hasData ? data.lowDept.name : 'No Data Yet'}
            </h3>
            <p className="text-xs text-slate-500 mt-2 font-semibold text-rose-600">
              {data.lowDept && data.lowDept.hasData ? `${data.lowDept.rate}% Attendance Rate` : 'No attendance data available'}
            </p>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly average Line Chart */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white font-heading mb-4">Monthly Attendance Average</h3>
            <div className="h-72">
              {data.monthlySummary && data.monthlySummary.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.monthlySummary} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-slate-800" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#fff'
                      }}
                      formatter={(val) => [`${val}%`, 'Average Rate']}
                    />
                    <Line type="monotone" dataKey="Average" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: '#6366f1' }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 space-y-2">
                  <IoCalendarOutline className="text-4xl text-slate-300 dark:text-slate-700" />
                  <p className="text-sm font-medium">No attendance data available.</p>
                  <p className="text-xs text-slate-400">Attendance trend lines appear automatically as attendance is scanned.</p>
                </div>
              )}
            </div>
          </div>

          {/* CSE Class Wise Bar Chart */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white font-heading">CSE Class Comparison</h3>
              <span className="text-xs font-bold px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
                {selectedYear === 'All' ? 'All Years' : selectedYear} {selectedClass !== 'All Classes' ? `• ${selectedClass}` : ''}
              </span>
            </div>
            <div className="h-72">
              {(data.classStats && data.classStats.length > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.classStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-slate-800" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} domain={[0, 100]} unit="%" />
                    <Tooltip content={<CustomBarTooltip />} />
                    <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                      {data.classStats.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.hasData ? (entry.color || '#6366f1') : '#94a3b8'}
                          fillOpacity={entry.hasData ? 1 : 0.3}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 space-y-2">
                  <IoBarChartOutline className="text-4xl text-slate-300 dark:text-slate-700" />
                  <p className="text-sm font-medium">No class statistics available for this selection.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Real-time Class Telemetry Breakdown Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white font-heading">Class Breakdown & Scanned Telemetry</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Real-time attendance status per class for {selectedYear === 'All' ? 'entire department' : selectedYear}
                {selectedDate ? ` (Date: ${formatDateDDMMYYYY(selectedDate)})` : ''}.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-wider">
                  <th className="pb-3 px-3">Class Name</th>
                  <th className="pb-3 px-3">Registered Students</th>
                  <th className="pb-3 px-3">Total Scans</th>
                  <th className="pb-3 px-3">Present</th>
                  <th className="pb-3 px-3">Absent</th>
                  <th className="pb-3 px-3">Attendance Rate</th>
                  <th className="pb-3 px-3 text-right">Data Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs font-medium text-slate-700 dark:text-slate-300">
                {data.classStats && data.classStats.length > 0 ? (
                  data.classStats.map((cls, i) => (
                    <tr key={i} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: cls.hasData ? (cls.color || '#6366f1') : '#cbd5e1' }}></span>
                        {cls.name}
                      </td>
                      <td className="py-3 px-3 font-semibold">{cls.studentCount}</td>
                      <td className="py-3 px-3 font-semibold">{cls.totalScans}</td>
                      <td className="py-3 px-3 font-semibold text-emerald-600 dark:text-emerald-400">{cls.presentCount}</td>
                      <td className="py-3 px-3 font-semibold text-rose-600 dark:text-rose-400">{cls.absentCount}</td>
                      <td className="py-3 px-3 font-extrabold text-slate-900 dark:text-white">
                        {cls.hasData ? `${cls.rate}%` : '---'}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {cls.hasData ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold rounded-full text-[11px]">
                            <IoCheckmarkCircleOutline /> Live Data
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold rounded-full text-[11px]">
                            <IoWarningOutline className="text-amber-500" /> No Scans Yet
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-slate-400">
                      No class breakdown available for the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Downloadable Reports Panel */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white font-heading mb-4">Available Download Reports</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {reportOptions.map((opt, i) => {
              const Icon = opt.icon;
              return (
                <div key={i} className="p-5 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-indigo-500/30 hover:bg-slate-50/50 dark:hover:bg-slate-850/20 transition-all flex flex-col justify-between h-48">
                  <div>
                    <div className="text-2xl text-indigo-600 dark:text-indigo-400 mb-3"><Icon /></div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">{opt.name}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-normal">{opt.desc}</p>
                  </div>
                  <button
                    onClick={() => triggerDownload(opt.name, opt.type)}
                    className="flex items-center justify-center gap-1.5 w-full mt-4 py-2 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-950 text-indigo-650 dark:text-indigo-400 text-xs font-bold rounded-lg transition-colors"
                  >
                    <IoCloudDownloadOutline />
                    <span>{opt.buttonText}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Layout>
  );
}
