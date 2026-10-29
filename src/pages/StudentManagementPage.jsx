import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import { useToast } from '../context/ToastContext';
import { DEPARTMENTS, SECTIONS, YEARS, CSE_CLASSES_BY_YEAR } from '../data/dummyData';
import {
  IoSearchOutline, IoFilterOutline, IoAddOutline, IoTrashOutline,
  IoCreateOutline, IoCloseOutline, IoSwapVerticalOutline
} from 'react-icons/io5';
import { apiService } from '../services/api';

export default function StudentManagementPage({ Layout = DashboardLayout }) {
  const { showToast } = useToast();
  const location = useLocation();
  const adminSession = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('adminSession') || '{}');
    } catch {
      return {};
    }
  }, []);

  const isClassTeacher = adminSession?.role === 'class_teacher' || adminSession?.is_hod === false;

  const [students, setStudents] = useState([]);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [yearFilter, setYearFilter] = useState(() => (isClassTeacher && adminSession.year ? adminSession.year : 'All'));
  const [sectionFilter, setSectionFilter] = useState(() => (isClassTeacher && (adminSession.section || adminSession.class) ? (adminSession.section || adminSession.class) : 'All'));
  const [sortField, setSortField] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc'); // asc or desc

  // Dynamic sections available based on selected year & student data
  const availableSections = useMemo(() => {
    if (yearFilter && yearFilter !== 'All' && yearFilter !== 'All Years') {
      const setFromStudents = new Set();
      students.forEach(s => {
        const sYearDigits = (s.year || '').replace(/\D/g, '');
        const filterYearDigits = yearFilter.replace(/\D/g, '');
        if (s.year === yearFilter || (sYearDigits && sYearDigits === filterYearDigits)) {
          const sec = (s.section || s.class || '').replace(/^CSE\s*/i, '').trim();
          if (sec) setFromStudents.add(sec);
        }
      });

      const cseClasses = CSE_CLASSES_BY_YEAR[yearFilter] || [];
      cseClasses.forEach(c => {
        const sec = c.replace(/^CSE\s*/i, '').trim();
        if (sec) setFromStudents.add(sec);
      });

      const list = Array.from(setFromStudents).sort();
      return list.length > 0 ? list : ['A', 'B', 'C', 'D'];
    } else {
      const setAll = new Set();
      students.forEach(s => {
        const sec = (s.section || s.class || '').replace(/^CSE\s*/i, '').trim();
        if (sec) setAll.add(sec);
      });
      Object.values(CSE_CLASSES_BY_YEAR).flat().forEach(c => {
        const sec = c.replace(/^CSE\s*/i, '').trim();
        if (sec) setAll.add(sec);
      });
      const list = Array.from(setAll).sort();
      return list.length > 0 ? list : SECTIONS;
    }
  }, [yearFilter, students]);

  // When yearFilter changes, validate/reset sectionFilter if current selection is invalid for new year
  useEffect(() => {
    if (sectionFilter !== 'All' && sectionFilter !== 'All Sections') {
      const cleanFilter = sectionFilter.replace(/^CSE\s*/i, '').trim().toUpperCase();
      const isStillValid = availableSections.some(s => s.replace(/^CSE\s*/i, '').trim().toUpperCase() === cleanFilter);
      if (!isStillValid) {
        setSectionFilter('All');
      }
    }
  }, [yearFilter, availableSections]);

  // Process location state from notifications
  useEffect(() => {
    if (location.state) {
      if (location.state.search !== undefined) setSearch(location.state.search);
      if (location.state.deptFilter) setDeptFilter(location.state.deptFilter);
      if (location.state.yearFilter) setYearFilter(location.state.yearFilter);
      if (location.state.sectionFilter || location.state.section) {
        setSectionFilter(location.state.sectionFilter || location.state.section);
      }
      if (location.state.filterLowAttendance) {
        setSortField('attendanceRate');
        setSortOrder('asc'); // Places low attendance students at the top
      }
    }
  }, [location.state]);

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Form inputs
  const [currentStudent, setCurrentStudent] = useState({
    id: '', name: '', registerNo: '', rollNo: '', department: DEPARTMENTS[0],
    year: YEARS[0], section: SECTIONS[0], gender: '', email: '', phone: '',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
    attendanceRate: 100, totalClasses: 0, presentClasses: 0
  });

  // Fetch students from API
  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const data = await apiService.getStudents(search, deptFilter, yearFilter, sectionFilter);
        setStudents(data);
      } catch (err) {
        showToast(err.message || 'Failed to fetch students', 'error');
      }
    };
    fetchStudents();
  }, [search, deptFilter, yearFilter, sectionFilter]);

  // Handle Search & Filter (Sorting & safety section filtering)
  const filteredStudents = useMemo(() => {
    let result = [...students];
    if (sectionFilter && sectionFilter !== 'All' && sectionFilter !== 'All Sections') {
      const cleanSec = sectionFilter.replace(/^CSE\s*/i, '').trim().toUpperCase();
      result = result.filter(s => {
        const sSec = String(s.section || s.class || '').replace(/^CSE\s*/i, '').trim().toUpperCase();
        return sSec === cleanSec;
      });
    }
    return result.sort((a, b) => {
      const multiplier = sortOrder === 'asc' ? 1 : -1;
      if (sortField === 'attendanceRate') {
        return (a.attendanceRate - b.attendanceRate) * multiplier;
      }
      return (a[sortField] || '').localeCompare(b[sortField] || '') * multiplier;
    });
  }, [students, sectionFilter, sortField, sortOrder]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Create Student
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!currentStudent.name || !currentStudent.registerNo || !currentStudent.rollNo || !currentStudent.email) {
      showToast('Please fill in required fields (Name, Register No, Roll No, Email)', 'error');
      return;
    }
    try {
      const created = await apiService.createStudent({
        name: currentStudent.name,
        registerNo: currentStudent.registerNo,
        rollNo: currentStudent.rollNo,
        department: currentStudent.department,
        year: currentStudent.year,
        section: currentStudent.section,
        gender: currentStudent.gender,
        email: currentStudent.email,
        phone: currentStudent.phone,
        avatar: currentStudent.avatar
      });
      setStudents([created, ...students]);
      setIsAddOpen(false);
      showToast(`Registered ${created.name} successfully`, 'success');
    } catch (err) {
      showToast(err.message || 'Failed to add student', 'error');
    }
  };

  // Edit Student
  const openEditModal = (student) => {
    setCurrentStudent(student);
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const updated = await apiService.updateStudent(currentStudent.id, {
        name: currentStudent.name,
        rollNo: currentStudent.rollNo,
        department: currentStudent.department,
        year: currentStudent.year,
        section: currentStudent.section,
        gender: currentStudent.gender,
        email: currentStudent.email,
        phone: currentStudent.phone,
        avatar: currentStudent.avatar
      });
      setStudents(prev => prev.map(s => (s.id === updated.id ? updated : s)));
      setIsEditOpen(false);
      showToast(`Updated student profile: ${updated.name}`, 'success');
    } catch (err) {
      showToast(err.message || 'Failed to update student', 'error');
    }
  };

  // Delete Student
  const openDeleteModal = (student) => {
    setCurrentStudent(student);
    setIsDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      await apiService.deleteStudent(currentStudent.id);
      setStudents(prev => prev.filter(s => s.id !== currentStudent.id));
      setIsDeleteOpen(false);
      showToast(`Removed student: ${currentStudent.name}`, 'success');
    } catch (err) {
      showToast(err.message || 'Failed to remove student', 'error');
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white font-heading tracking-tight">Student Directory</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Manage student profiles, enrollment, and attendance metrics.</p>
          </div>
          <button
            onClick={() => {
              setCurrentStudent({
                id: '', name: '', registerNo: '', rollNo: '', department: DEPARTMENTS[0],
                year: YEARS[0], section: SECTIONS[0], email: '', phone: '',
                avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
                attendanceRate: 100, totalClasses: 0, presentClasses: 0
              });
              setIsAddOpen(true);
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-md hover:shadow-indigo-500/20 transition-all"
          >
            <IoAddOutline className="text-xl" />
            <span>Add Student</span>
          </button>
        </div>

        {/* Filters and Search Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
          {/* Search */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <IoSearchOutline />
            </div>
            <input
              type="text"
              placeholder="Search Name, Reg No, Roll No..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
            />
          </div>

          {/* Department Filter */}
          <div className="relative">
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
            >
              <option value="All">All Departments</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Year Filter */}
          <div className="relative">
            <select
              disabled={isClassTeacher}
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/25 ${isClassTeacher ? 'opacity-70 cursor-not-allowed text-slate-500' : ''}`}
            >
              <option value="All">All Years</option>
              {YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Section Filter */}
          <div className="relative">
            <select
              disabled={isClassTeacher}
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/25 ${isClassTeacher ? 'opacity-70 cursor-not-allowed text-slate-500' : ''}`}
            >
              <option value="All">All Sections</option>
              {availableSections.map((s) => (
                <option key={s} value={s}>
                  {s.startsWith('CSE') ? s : `Section ${s}`}
                </option>
              ))}
            </select>
          </div>

          {/* Records Counter */}
          <div className="flex items-center justify-end pr-2 text-xs font-bold text-slate-450 uppercase tracking-wider">
            {filteredStudents.length} records found
          </div>
        </div>

        {/* Table View */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                  <th className="px-6 py-4 text-xs font-bold uppercase text-slate-400 tracking-wider">Student</th>
                  <th onClick={() => handleSort('registerNo')} className="px-6 py-4 text-xs font-bold uppercase text-slate-400 tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <span className="flex items-center gap-1.5">Reg Number <IoSwapVerticalOutline /></span>
                  </th>
                  <th onClick={() => handleSort('rollNo')} className="px-6 py-4 text-xs font-bold uppercase text-slate-400 tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <span className="flex items-center gap-1.5">Roll No <IoSwapVerticalOutline /></span>
                  </th>
                  <th className="px-6 py-4 text-xs font-bold uppercase text-slate-400 tracking-wider">Department</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase text-slate-400 tracking-wider">Class / Sec</th>
                  <th onClick={() => handleSort('attendanceRate')} className="px-6 py-4 text-xs font-bold uppercase text-slate-400 tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <span className="flex items-center gap-1.5">Attendance Rate <IoSwapVerticalOutline /></span>
                  </th>
                  <th className="px-6 py-4 text-xs font-bold uppercase text-slate-400 tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 dark:divide-slate-800">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-400">
                      No student records match the filters.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((student) => (
                    <tr key={student.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="px-6 py-4 flex items-center gap-3">
                        <img src={apiService.getAssetUrl(student.avatar)} onError={(e) => apiService.handleImageError(e, student.name)} alt={student.name} className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-800" />
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white text-sm">{student.name}</p>
                          <p className="text-xs text-slate-400 font-medium mt-0.5">{student.email}{student.gender && student.gender !== 'Not Specified' ? ` • ${student.gender}` : ''}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-700 dark:text-slate-300 font-mono">{student.registerNo}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-indigo-600 dark:text-indigo-400 font-mono">{student.rollNo || '---'}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-450 truncate max-w-[12rem]">{student.department}</td>
                      <td className="px-6 py-4 text-sm text-slate-550 dark:text-slate-400 font-medium">
                        {student.year} - Sec {student.section}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden shrink-0">
                            <div
                              style={{ width: `${student.attendanceRate}%` }}
                              className={`h-full rounded-full ${
                                student.attendanceRate >= 85
                                  ? 'bg-emerald-500'
                                  : student.attendanceRate >= 75
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500'
                              }`}
                            />
                          </div>
                          <span className={`text-xs font-bold ${
                            student.attendanceRate >= 85
                              ? 'text-emerald-600'
                              : student.attendanceRate >= 75
                              ? 'text-amber-600'
                              : 'text-rose-600'
                          }`}>
                            {student.attendanceRate}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right space-x-1.5">
                        <button
                          onClick={() => openEditModal(student)}
                          className="p-1.5 bg-slate-100 hover:bg-indigo-100 hover:text-indigo-600 dark:bg-slate-800 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-400 rounded-lg transition-colors text-slate-500"
                          title="Edit Profile"
                        >
                          <IoCreateOutline className="text-lg" />
                        </button>
                        <button
                          onClick={() => openDeleteModal(student)}
                          className="p-1.5 bg-slate-100 hover:bg-rose-100 hover:text-rose-600 dark:bg-slate-800 dark:hover:bg-rose-950/40 dark:hover:text-rose-450 rounded-lg transition-colors text-slate-500"
                          title="Remove Student"
                        >
                          <IoTrashOutline className="text-lg" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* MODAL: ADD STUDENT */}
        {isAddOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 relative">
              <button onClick={() => setIsAddOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <IoCloseOutline className="text-2xl" />
              </button>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white font-heading mb-4">Enroll New Student</h3>
              <form onSubmit={handleAddSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Full Name *</label>
                    <input
                      required
                      type="text"
                      value={currentStudent.name}
                      onChange={(e) => setCurrentStudent({ ...currentStudent, name: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Register Number *</label>
                    <input
                      required
                      type="text"
                      value={currentStudent.registerNo}
                      onChange={(e) => setCurrentStudent({ ...currentStudent, registerNo: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder=""
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Roll No *</label>
                    <input
                      required
                      type="text"
                      value={currentStudent.rollNo}
                      onChange={(e) => setCurrentStudent({ ...currentStudent, rollNo: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder=""
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Gender *</label>
                    <select
                      value={currentStudent.gender || ''}
                      onChange={(e) => setCurrentStudent({ ...currentStudent, gender: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Department</label>
                    <select
                      value={currentStudent.department}
                      onChange={(e) => setCurrentStudent({ ...currentStudent, department: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {DEPARTMENTS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Academic Year</label>
                    <select
                      disabled={isClassTeacher}
                      value={currentStudent.year}
                      onChange={(e) => setCurrentStudent({ ...currentStudent, year: e.target.value })}
                      className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isClassTeacher ? 'opacity-70 cursor-not-allowed text-slate-500' : ''}`}
                    >
                      {YEARS.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Section</label>
                    <select
                      disabled={isClassTeacher}
                      value={currentStudent.section}
                      onChange={(e) => setCurrentStudent({ ...currentStudent, section: e.target.value })}
                      className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isClassTeacher ? 'opacity-70 cursor-not-allowed text-slate-500' : ''}`}
                    >
                      {SECTIONS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Email Address *</label>
                    <input
                      required
                      type="email"
                      value={currentStudent.email}
                      onChange={(e) => setCurrentStudent({ ...currentStudent, email: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Phone Number</label>
                    <input
                      type="text"
                      value={currentStudent.phone}
                      onChange={(e) => setCurrentStudent({ ...currentStudent, phone: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder=""
                    />
                  </div>
                </div>
                <button type="submit" className="w-full mt-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-md">
                  Confirm Enrollment
                </button>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: EDIT STUDENT */}
        {isEditOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 relative">
              <button onClick={() => setIsEditOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-650">
                <IoCloseOutline className="text-2xl" />
              </button>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white font-heading mb-4">Edit Student Details</h3>
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Full Name</label>
                    <input
                      required
                      type="text"
                      value={currentStudent.name}
                      onChange={(e) => setCurrentStudent({ ...currentStudent, name: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-sm focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Register Number</label>
                    <input
                      disabled
                      type="text"
                      value={currentStudent.registerNo}
                      className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-400 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Roll No</label>
                    <input
                      type="text"
                      value={currentStudent.rollNo || ''}
                      onChange={(e) => setCurrentStudent({ ...currentStudent, rollNo: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-sm focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Gender</label>
                    <select
                      value={currentStudent.gender || ''}
                      onChange={(e) => setCurrentStudent({ ...currentStudent, gender: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-sm focus:outline-none"
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Department</label>
                    <select
                      value={currentStudent.department}
                      onChange={(e) => setCurrentStudent({ ...currentStudent, department: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-sm focus:outline-none"
                    >
                      {DEPARTMENTS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Academic Year</label>
                    <select
                      disabled={isClassTeacher}
                      value={currentStudent.year}
                      onChange={(e) => setCurrentStudent({ ...currentStudent, year: e.target.value })}
                      className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-sm focus:outline-none ${isClassTeacher ? 'opacity-70 cursor-not-allowed text-slate-500' : ''}`}
                    >
                      {YEARS.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Section</label>
                    <select
                      disabled={isClassTeacher}
                      value={currentStudent.section}
                      onChange={(e) => setCurrentStudent({ ...currentStudent, section: e.target.value })}
                      className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-sm focus:outline-none ${isClassTeacher ? 'opacity-70 cursor-not-allowed text-slate-500' : ''}`}
                    >
                      {SECTIONS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Email Address</label>
                    <input
                      required
                      type="email"
                      value={currentStudent.email}
                      onChange={(e) => setCurrentStudent({ ...currentStudent, email: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-sm focus:outline-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Phone Number</label>
                    <input
                      type="text"
                      value={currentStudent.phone}
                      onChange={(e) => setCurrentStudent({ ...currentStudent, phone: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-sm focus:outline-none"
                    />
                  </div>
                  
                  {/* Biometric Images Gallery */}
                  <div className="col-span-2 border-t border-slate-100 dark:border-slate-800 pt-4">
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Biometric Dataset ({currentStudent.uploadedImages?.length || 0} Images)</label>
                    {currentStudent.uploadedImages && currentStudent.uploadedImages.length > 0 ? (
                      <div className="grid grid-cols-4 gap-2 mb-3">
                        {currentStudent.uploadedImages.map((img, idx) => (
                          <div key={idx} className="relative group aspect-square bg-slate-100 dark:bg-slate-950 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800">
                            <img src={apiService.getAssetUrl(img)} onError={(e) => apiService.handleImageError(e, currentStudent.name)} className="w-full h-full object-cover" alt="biometric" />
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await apiService.deleteStudentImage(currentStudent.registerNo, img);
                                  const updatedImages = currentStudent.uploadedImages.filter(i => i !== img);
                                  setCurrentStudent({ ...currentStudent, uploadedImages: updatedImages });
                                  setStudents(prev => prev.map(s => s.id === currentStudent.id ? { ...s, uploadedImages: updatedImages } : s));
                                  showToast("Image removed successfully", "success");
                                } catch (err) {
                                  showToast(err.message || "Failed to remove image", "error");
                                }
                              }}
                              className="absolute inset-0 bg-rose-600/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold"
                            >
                              Delete
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 mb-3">No biometric images registered. Upload some images below.</p>
                    )}
                    <div className="mt-2">
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={async (e) => {
                          const files = Array.from(e.target.files);
                          if (files.length > 0) {
                            try {
                              showToast("Uploading biometric images...", "info");
                              const res = await apiService.uploadStudentImages(currentStudent.registerNo, files);
                              const updatedImages = [...(currentStudent.uploadedImages || []), ...res.images];
                              setCurrentStudent({ ...currentStudent, uploadedImages: updatedImages });
                              setStudents(prev => prev.map(s => s.id === currentStudent.id ? { ...s, uploadedImages: updatedImages } : s));
                              showToast(`Uploaded ${files.length} images successfully`, "success");
                            } catch (err) {
                              showToast(err.message || "Upload failed", "error");
                            }
                          }
                        }}
                        className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 dark:file:bg-indigo-950/60 file:text-indigo-700 dark:file:text-indigo-400 hover:file:bg-indigo-100 dark:hover:file:bg-indigo-950"
                      />
                    </div>
                  </div>
                </div>
                <button type="submit" className="w-full mt-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-md">
                  Update Changes
                </button>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: DELETE STUDENT */}
        {isDeleteOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 text-center">
              <div className="w-14 h-14 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                <IoTrashOutline />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white font-heading">Delete Student Record?</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                Are you sure you want to remove <strong className="text-slate-900 dark:text-white">{currentStudent.name}</strong> ({currentStudent.registerNo})? This action cannot be undone.
              </p>
              <div className="grid grid-cols-2 gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsDeleteOpen(false)}
                  className="py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-250 font-semibold rounded-xl text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  className="py-2.5 bg-rose-600 hover:bg-rose-550 text-white font-semibold rounded-xl text-sm transition-all shadow-md"
                >
                  Yes, Remove
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
