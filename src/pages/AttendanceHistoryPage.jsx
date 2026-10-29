import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import { useToast } from '../context/ToastContext';
import {
  IoSearchOutline, IoDownloadOutline, IoChevronBack, IoChevronForward,
  IoCalendarOutline, IoCreateOutline, IoCloseOutline, IoCheckmarkCircleOutline,
  IoPersonOutline, IoFilterOutline, IoRefreshOutline, IoWarningOutline
} from 'react-icons/io5';
import { apiService } from '../services/api';

// Helper to get today's date in YYYY-MM-DD format for input date filter
const getTodayDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper to format any YYYY-MM-DD or date string into exact Indian format DD/MM/YYYY (e.g., 07/05/2026)
const formatDateDDMMYYYY = (dateStr) => {
  if (!dateStr || dateStr === '---') return '---';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr;
  
  const parts = dateStr.split('T')[0].split(/[-/]/);
  if (parts.length === 3) {
    let year, month, day;
    if (parts[0].length === 4) {
      // YYYY-MM-DD (Standard stored MongoDB format)
      [year, month, day] = parts;
    } else if (parts[2].length === 4) {
      // DD-MM-YYYY or MM-DD-YYYY -> assume DD-MM-YYYY
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

// Helper to compute Day name corresponding to the attendance date
const getDayName = (dateStr, existingDay) => {
  if (existingDay && existingDay !== '---' && existingDay !== 'Unknown') return existingDay;
  if (!dateStr || dateStr === '---') return '';
  const parts = dateStr.split('T')[0].split(/[-/]/);
  if (parts.length === 3) {
    let year, month, day;
    if (parts[0].length === 4) {
      [year, month, day] = parts;
    } else if (parts[2].length === 4) {
      [day, month, year] = parts;
    } else {
      return '';
    }
    const d = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
    return d.toLocaleDateString('en-US', { weekday: 'long' });
  }
  return '';
};

// Helper to get allowed Class options per year according to project specification
const getClassOptionsForYear = (year) => {
  if (year === '1st Year' || year === '2nd Year') {
    return ['All Classes', 'CSE A', 'CSE B', 'CSE C', 'CSE D', 'CSE E'];
  } else if (year === '3rd Year') {
    return ['All Classes', 'CSE A', 'CSE B', 'CSE C', 'CSE D'];
  } else if (year === '4th Year') {
    return ['All Classes', 'CSE A', 'CSE B', 'CSE C'];
  }
  return ['All Classes', 'CSE A', 'CSE B', 'CSE C', 'CSE D', 'CSE E'];
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
  const hiddenDateInputRef = React.useRef(null);

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
    <div className="relative flex-1">
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
        className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/25 tracking-wide"
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

export default function AttendanceHistoryPage({ Layout = DashboardLayout }) {
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

  // Search & Filter State - dynamically defaults to actual current date
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sessionFilter, setSessionFilter] = useState('All');
  const [yearFilter, setYearFilter] = useState(() => (isClassTeacher && adminSession.year ? adminSession.year : 'All'));
  const [classFilter, setClassFilter] = useState(() => (isClassTeacher && (adminSession.class || adminSession.section) ? (adminSession.class || adminSession.section) : 'All Classes'));
  const [dateFilter, setDateFilter] = useState(getTodayDateString());
  const [logs, setLogs] = useState([]);
  const [studentsList, setStudentsList] = useState([]);

  // Attendance Correction Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  // Student selection modal state
  const [modalSearch, setModalSearch] = useState('');
  const [modalYearFilter, setModalYearFilter] = useState(() => (isClassTeacher && adminSession.year ? adminSession.year : 'All Years'));
  const [modalClassFilter, setModalClassFilter] = useState(() => (isClassTeacher && (adminSession.class || adminSession.section) ? (adminSession.class || adminSession.section) : 'All Classes'));
  const [selectedStudent, setSelectedStudent] = useState(null);

  const [correctionForm, setCorrectionForm] = useState({
    registerNo: '',
    date: getTodayDateString(),
    session: 'Morning',
    newStatus: 'PRESENT'
  });
  const [currentSessionStatus, setCurrentSessionStatus] = useState('Unknown');

  // Attendance Reset Modal State
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetStep, setResetStep] = useState('select'); // 'select' | 'confirm'
  const [resetScope, setResetScope] = useState(() => (isClassTeacher ? 'class' : 'department'));
  const [resetYear, setResetYear] = useState(() => (isClassTeacher && adminSession.year ? adminSession.year : '3rd Year'));
  const [resetSection, setResetSection] = useState(() => (isClassTeacher && (adminSession.class || adminSession.section) ? (adminSession.class || adminSession.section) : 'CSE A'));
  const [resetSearch, setResetSearch] = useState('');
  const [selectedResetStudent, setSelectedResetStudent] = useState(null);
  const [isResetSubmitting, setIsResetSubmitting] = useState(false);

  const openResetAttendanceModal = async () => {
    await fetchStudentsList();
    setResetStep('select');
    setResetScope(isClassTeacher ? 'class' : 'department');
    setResetYear(isClassTeacher && adminSession.year ? adminSession.year : '3rd Year');
    setResetSection(isClassTeacher && (adminSession.class || adminSession.section) ? (adminSession.class || adminSession.section) : 'CSE A');
    setResetSearch('');
    setSelectedResetStudent(null);
    setIsResetModalOpen(true);
  };

  const getResetTargetLabel = () => {
    if (resetScope === 'department') return 'Entire Department (All CSE Students)';
    if (resetScope === 'year') return `${resetYear}`;
    if (resetScope === 'class') {
      const cls = resetSection.startsWith('CSE') ? resetSection : `CSE ${resetSection}`;
      return `${resetYear} — ${cls}`;
    }
    if (resetScope === 'student' && selectedResetStudent) {
      const name = selectedResetStudent.name || selectedResetStudent.studentName || 'Student';
      const reg = selectedResetStudent.registerNo || selectedResetStudent.registerNumber || '';
      return `${name} (${reg})`;
    }
    return 'Selected Scope';
  };

  const handleResetSubmit = async () => {
    if (resetScope === 'student' && !selectedResetStudent) {
      showToast('Please select a student to reset attendance.', 'error');
      return;
    }

    if (resetStep === 'select') {
      setResetStep('confirm');
      return;
    }

    try {
      setIsResetSubmitting(true);
      const payload = {
        scope: resetScope,
        year: resetScope === 'department' ? null : resetYear,
        section: (resetScope === 'class' || resetScope === 'student') ? resetSection : null,
        registerNo: resetScope === 'student' ? (selectedResetStudent?.registerNo || selectedResetStudent?.registerNumber) : null
      };

      await apiService.resetAttendance(payload);
      showToast('Attendance reset successfully!', 'success');
      setIsResetModalOpen(false);
      setResetStep('select');
      await fetchResetHistory();
      await fetchLogs();
      await fetchStudentsList();
    } catch (err) {
      showToast(err.message || 'Failed to reset attendance', 'error');
    } finally {
      setIsResetSubmitting(false);
    }
  };

  // Main Tab State: 'logs' | 'history'
  const [activeMainTab, setActiveMainTab] = useState('logs');

  // Reset History & Undo State
  const [resetHistoryList, setResetHistoryList] = useState([]);
  const [loadingResetHistory, setLoadingResetHistory] = useState(false);
  const [isUndoModalOpen, setIsUndoModalOpen] = useState(false);
  const [selectedUndoReset, setSelectedUndoReset] = useState(null);
  const [isUndoSubmitting, setIsUndoSubmitting] = useState(false);

  const fetchResetHistory = async () => {
    setLoadingResetHistory(true);
    try {
      const data = await apiService.getResetHistory();
      if (Array.isArray(data)) {
        setResetHistoryList(data);
      }
    } catch (err) {
      console.error('Failed to fetch reset history:', err);
    } finally {
      setLoadingResetHistory(false);
    }
  };

  useEffect(() => {
    fetchResetHistory();
  }, []);

  const openUndoModal = (item) => {
    setSelectedUndoReset(item);
    setIsUndoModalOpen(true);
  };

  const handleConfirmUndoReset = async () => {
    if (!selectedUndoReset) return;
    try {
      setIsUndoSubmitting(true);
      await apiService.undoReset(selectedUndoReset.reset_id || selectedUndoReset.id);
      showToast('Attendance reset undone successfully!', 'success');
      setIsUndoModalOpen(false);
      setSelectedUndoReset(null);
      await fetchResetHistory();
      await fetchLogs();
      await fetchStudentsList();
    } catch (err) {
      showToast(err.message || 'Failed to undo attendance reset', 'error');
    } finally {
      setIsUndoSubmitting(false);
    }
  };

  const getResetTitle = (item) => {
    if (!item) return 'Reset Action';
    if (item.scope === 'department') return 'Entire Department (All CSE Students)';
    if (item.scope === 'year') return item.year || 'Specific Year';
    if (item.scope === 'class') {
      const sec = item.section ? (item.section.startsWith('CSE') ? item.section : `CSE ${item.section}`) : 'CSE';
      return `${item.year || '3rd Year'} — ${sec}`;
    }
    if (item.scope === 'student') {
      const name = item.student_name || 'Student';
      const reg = item.registerNo ? ` (${item.registerNo})` : '';
      return `${name}${reg}`;
    }
    return 'Reset Action';
  };


  // Process incoming navigation context from notifications
  useEffect(() => {
    if (location.state) {
      if (location.state.statusFilter !== undefined) {
        setStatusFilter(location.state.statusFilter);
      }
      if (location.state.deptFilter !== undefined) {
        setDeptFilter(location.state.deptFilter);
      }
      if (location.state.yearFilter !== undefined) {
        setYearFilter(location.state.yearFilter);
      }
      if (location.state.classFilter !== undefined) {
        setClassFilter(location.state.classFilter);
      } else if (location.state.section !== undefined) {
        setClassFilter(location.state.section);
      }
      if (location.state.dateFilter !== undefined) {
        setDateFilter(location.state.dateFilter);
      }
      if (location.state.search !== undefined) {
        setSearch(location.state.search);
      }
      if (location.state.filterLowAttendance) {
        setStatusFilter('Absent');
        setDateFilter(''); // Show all dates so absent/low attendance records appear immediately
      }
    }
  }, [location.state]);

  // Dynamic Dropdown Options State
  const [departments, setDepartments] = useState(['All']);
  const [years, setYears] = useState(['All']);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 6;

  // Load student list from backend MongoDB API
  const fetchStudentsList = async () => {
    try {
      const students = await apiService.getStudents('', 'All', 'All');
      setStudentsList(students || []);
      const depts = new Set();
      (students || []).forEach(s => {
        if (s.department) depts.add(s.department);
      });
      setDepartments(['All', ...Array.from(depts)]);
    } catch (err) {
      console.error("Failed to load students from MongoDB API:", err);
    }
  };

  useEffect(() => {
    fetchStudentsList();
  }, []);

  // Filtered student list for modal search & class selection
  const filteredModalStudents = useMemo(() => {
    return (studentsList || []).filter((s) => {
      // 1. Year filter (Robust matching)
      if (modalYearFilter && modalYearFilter !== 'All Years' && modalYearFilter !== 'All') {
        const sYear = String(s.year || s.academicYear || '').toLowerCase().trim();
        const selYear = String(modalYearFilter).toLowerCase().trim();
        const sNum = sYear.match(/\d+/)?.[0];
        const selNum = selYear.match(/\d+/)?.[0];
        
        let matchesYear = (sYear === selYear);
        if (sNum && selNum && sNum === selNum) matchesYear = true;

        if (!matchesYear && sYear !== '') return false;
      }

      // 2. Class filter (Robust section matching)
      if (modalClassFilter && modalClassFilter !== 'All Classes' && modalClassFilter !== 'All') {
        const clsLetter = modalClassFilter.replace('CSE ', '').trim().toUpperCase(); // e.g. "A"
        const studentSec = String(s.section || s.class || s.className || s.sectionName || '').trim().toUpperCase();
        
        let matchesSec = (studentSec === modalClassFilter.toUpperCase()) || 
                         (studentSec === clsLetter) || 
                         (studentSec.endsWith(clsLetter)) ||
                         (studentSec.includes(clsLetter));

        if (!matchesSec && studentSec !== '') return false;
      }

      // 3. Search query filter (Name, Register No, Roll No, Email)
      if (modalSearch.trim()) {
        const q = modalSearch.toLowerCase().trim();
        const sName = String(s.name || s.studentName || s.full_name || '').toLowerCase();
        const sReg = String(s.registerNo || s.registerNumber || s.register_no || s.regNo || '').toLowerCase();
        const sRoll = String(s.rollNo || s.roll_no || s.rollNumber || '').toLowerCase();
        const sEmail = String(s.email || '').toLowerCase();

        const matchName = sName.includes(q);
        const matchReg = sReg.includes(q);
        const matchRoll = sRoll.includes(q);
        const matchEmail = sEmail.includes(q);

        if (!matchName && !matchReg && !matchRoll && !matchEmail) return false;
      }

      return true;
    });
  }, [studentsList, modalYearFilter, modalClassFilter, modalSearch]);

  // Fetch logs on filter changes
  const fetchLogs = async () => {
    try {
      const data = await apiService.getAttendanceHistory(
        '', // registerNo
        dateFilter,
        statusFilter,
        deptFilter,
        yearFilter,
        sessionFilter,
        search,
        classFilter !== 'All Classes' ? classFilter : ''
      );
      setLogs(data);
    } catch (err) {
      showToast(err.message || 'Failed to fetch logs', 'error');
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [search, deptFilter, yearFilter, classFilter, statusFilter, sessionFilter, dateFilter]);

  // Handle open modal from specific table row
  const openEditModalForRow = async (record) => {
    await fetchStudentsList();
    const defaultSess = record.session || 'Morning';
    let initStatus = 'ABSENT';
    if (defaultSess === 'Morning') {
      initStatus = record.morningSession === 'Present' ? 'PRESENT' : 'ABSENT';
    } else if (defaultSess === 'Afternoon') {
      initStatus = record.afternoonSession === 'Present' ? 'PRESENT' : 'ABSENT';
    } else {
      initStatus = record.status === 'Present' ? 'PRESENT' : 'ABSENT';
    }

    const matchedStudent = studentsList.find(s => 
      (s.registerNo && String(s.registerNo) === String(record.registerNo)) ||
      (s.registerNumber && String(s.registerNumber) === String(record.registerNo))
    ) || {
      name: record.name,
      registerNo: record.registerNo,
      rollNo: record.rollNo || '---',
      department: record.department || 'CSE',
      year: record.year || '3rd Year',
      section: record.section || 'A'
    };

    setSelectedStudent(matchedStudent);
    setCorrectionForm({
      registerNo: record.registerNo,
      date: record.date || getTodayDateString(),
      session: defaultSess,
      newStatus: initStatus === 'PRESENT' ? 'ABSENT' : 'PRESENT'
    });
    setCurrentSessionStatus(initStatus);
    setIsConfirming(false);
    setIsModalOpen(true);
  };

  // Handle open general edit modal from header
  const openGeneralEditModal = async () => {
    await fetchStudentsList();
    setSelectedStudent(null);
    setModalSearch('');
    setModalYearFilter(isClassTeacher && adminSession.year ? adminSession.year : 'All Years');
    setModalClassFilter(isClassTeacher && (adminSession.class || adminSession.section) ? (adminSession.class || adminSession.section) : 'All Classes');
    setCorrectionForm({
      registerNo: '',
      date: dateFilter || getTodayDateString(),
      session: 'Morning',
      newStatus: 'PRESENT'
    });
    setCurrentSessionStatus('Unknown');
    setIsConfirming(false);
    setIsModalOpen(true);
  };

  // Update current session status dynamically when student, date, or session changes in modal
  useEffect(() => {
    if (!isModalOpen || !correctionForm.registerNo || !correctionForm.date) return;
    const existingLog = logs.find(
      l => String(l.registerNo) === String(correctionForm.registerNo) && l.date === correctionForm.date
    );
    if (existingLog) {
      if (correctionForm.session === 'Morning') {
        setCurrentSessionStatus(existingLog.morningSession === 'Present' ? 'PRESENT' : 'ABSENT');
      } else if (correctionForm.session === 'Afternoon') {
        setCurrentSessionStatus(existingLog.afternoonSession === 'Present' ? 'PRESENT' : 'ABSENT');
      } else {
        setCurrentSessionStatus(existingLog.status === 'Present' ? 'PRESENT' : 'ABSENT');
      }
    } else {
      setCurrentSessionStatus('ABSENT');
    }
  }, [isModalOpen, correctionForm.registerNo, correctionForm.date, correctionForm.session, logs]);

  const handleCorrectionSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    if (!selectedStudent || !correctionForm.registerNo) {
      showToast('Please select a student from the registered list.', 'error');
      return;
    }
    if (!correctionForm.date || !correctionForm.session || !correctionForm.newStatus) {
      showToast('Please fill in date, session, and new status.', 'error');
      return;
    }

    if (!isConfirming) {
      setIsConfirming(true);
      return;
    }

    try {
      await apiService.correctAttendance({
        registerNo: correctionForm.registerNo,
        date: correctionForm.date,
        session: correctionForm.session,
        newStatus: correctionForm.newStatus
      });
      showToast('Attendance updated successfully in MongoDB!', 'success');
      setIsModalOpen(false);
      setIsConfirming(false);
      await fetchLogs();
    } catch (err) {
      showToast(err.message || 'Failed to update attendance record', 'error');
      setIsConfirming(false);
    }
  };

  // Filtered history matches backend logs with robust year filter matching and exact attendance order sorting
  const filteredHistory = useMemo(() => {
    if (!logs) return [];
    const filtered = logs.filter((record) => {
      if (yearFilter && yearFilter !== 'All' && yearFilter !== 'All Years') {
        const rYear = String(record.year || record.student_info?.year || '').toLowerCase().trim();
        const selYear = String(yearFilter).toLowerCase().trim();
        const rNum = rYear.match(/\d+/)?.[0];
        const selNum = selYear.match(/\d+/)?.[0];

        let match = (rYear === selYear);
        if (rNum && selNum && rNum === selNum) match = true;
        if (!match && rYear !== '') return false;
      }
      if (classFilter && classFilter !== 'All' && classFilter !== 'All Classes') {
        const clsLetter = classFilter.replace(/^CSE\s*/i, '').replace(/^Class\s*/i, '').trim().toUpperCase();
        const rSec = String(record.section || record.student_info?.section || '').toUpperCase().trim();
        
        let secMatch = (rSec === classFilter.toUpperCase()) ||
                       (rSec === clsLetter) ||
                       (rSec === `CSE ${clsLetter}`) ||
                       (rSec.endsWith(clsLetter));

        if (!secMatch && rSec !== '') return false;
      }
      return true;
    });

    const parseYr = (yr) => {
      if (!yr) return 99;
      const num = String(yr).match(/\d+/)?.[0];
      return num ? parseInt(num, 10) : 99;
    };
    const parseCls = (sec) => {
      if (!sec) return 'ZZZ';
      return String(sec).toUpperCase().replace(/^(CSE|SECTION|SEC)\s*/, '').trim() || String(sec);
    };
    const parseRoll = (roll) => {
      if (!roll || roll === '---') return [999999, ''];
      const digits = String(roll).match(/\d+/)?.[0];
      return digits ? [parseInt(digits, 10), String(roll)] : [999999, String(roll)];
    };
    const parseSess = (sess) => {
      const s = String(sess || '').toLowerCase();
      if (s === 'morning') return 1;
      if (s === 'afternoon') return 2;
      return 3;
    };

    return [...filtered].sort((a, b) => {
      // 1. Date descending
      const dA = a.date || '';
      const dB = b.date || '';
      if (dA !== dB) return dA > dB ? -1 : 1;

      // 2. Session (Morning before Afternoon)
      const sA = parseSess(a.session);
      const sB = parseSess(b.session);
      if (sA !== sB) return sA - sB;

      // 3. Year (1st Year -> 2nd Year -> 3rd Year -> 4th Year)
      const yA = parseYr(a.year);
      const yB = parseYr(b.year);
      if (yA !== yB) return yA - yB;

      // 4. Class (CSE A -> CSE B...)
      const cA = parseCls(a.section);
      const cB = parseCls(b.section);
      if (cA !== cB) return cA.localeCompare(cB);

      // 5. Roll Number (1, 2, 3...)
      const [rNumA, rStrA] = parseRoll(a.rollNo);
      const [rNumB, rStrB] = parseRoll(b.rollNo);
      if (rNumA !== rNumB) return rNumA - rNumB;
      if (rStrA !== rStrB) return rStrA.localeCompare(rStrB);

      // 6. Name
      const nA = String(a.name || '').toLowerCase();
      const nB = String(b.name || '').toLowerCase();
      return nA.localeCompare(nB);
    });
  }, [logs, yearFilter, classFilter]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / recordsPerPage));
  const currentRecords = useMemo(() => {
    const start = (currentPage - 1) * recordsPerPage;
    return filteredHistory.slice(start, start + recordsPerPage);
  }, [filteredHistory, currentPage]);

  const handleExport = async (type) => {
    try {
      showToast(`Compiling and exporting history logs as ${type.toUpperCase()}...`, 'info');
      await apiService.downloadReport({
        type: type,
        reportName: 'Attendance Logs',
        date: dateFilter,
        department: deptFilter !== 'All' ? deptFilter : '',
        status: statusFilter !== 'All' ? statusFilter : '',
        year: yearFilter !== 'All' ? yearFilter : '',
        session: sessionFilter !== 'All' ? sessionFilter : '',
        search: search,
        section: classFilter !== 'All Classes' ? classFilter : ''
      });
      showToast(`Successfully exported history logs as ${type.toUpperCase()}`, 'success');
    } catch (err) {
      console.error('Export failed:', err);
      showToast(err.message || 'Failed to export report', 'error');
    }
  };

  return (
    <Layout>
      <div className="space-y-6 text-left">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white font-heading tracking-tight">Attendance Logs</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Review historical records, facial scans, and manual overrides.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={openResetAttendanceModal}
              className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-sm font-semibold shadow transition-colors"
              title="Reset Attendance Statistics"
            >
              <IoRefreshOutline className="text-lg" />
              <span>Reset Attendance</span>
            </button>
            <button
              onClick={openGeneralEditModal}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold shadow transition-colors"
            >
              <IoCreateOutline className="text-lg" />
              <span>Edit Attendance</span>
            </button>
            <button
              onClick={() => handleExport('csv')}
              className="flex items-center gap-1.5 px-4 py-2 border border-slate-205 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-xl text-sm font-semibold transition-colors"
            >
              <IoDownloadOutline />
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => handleExport('excel')}
              className="flex items-center gap-1.5 px-4 py-2 border border-slate-205 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-xl text-sm font-semibold transition-colors"
            >
              <IoDownloadOutline />
              <span>Export Excel</span>
            </button>
            <button
              onClick={() => handleExport('pdf')}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow transition-colors"
            >
              <IoDownloadOutline />
              <span>Export PDF</span>
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4 bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
          {/* Search bar */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <IoSearchOutline />
            </div>
            <input
              type="text"
              placeholder="Search Student..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-202 dark:border-slate-855 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
            />
          </div>

          {/* Department dropdown */}
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
          >
            {departments.map((d) => (
              <option key={d} value={d}>{d === 'All' ? 'All Departments' : d}</option>
            ))}
          </select>

          {/* Year Filter */}
          <select
            disabled={isClassTeacher}
            value={yearFilter}
            onChange={(e) => {
              const newYear = e.target.value;
              setYearFilter(newYear);
              const validClasses = getClassOptionsForYear(newYear);
              if (!validClasses.includes(classFilter)) {
                setClassFilter('All Classes');
              }
              setCurrentPage(1);
            }}
            className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/25 font-medium ${isClassTeacher ? 'opacity-70 cursor-not-allowed text-slate-500' : 'cursor-pointer text-slate-800 dark:text-slate-200'}`}
          >
            <option value="All">All Years</option>
            <option value="1st Year">1st Year</option>
            <option value="2nd Year">2nd Year</option>
            <option value="3rd Year">3rd Year</option>
            <option value="4th Year">4th Year</option>
          </select>

          {/* Class/Section Filter */}
          <select
            disabled={isClassTeacher}
            value={classFilter}
            onChange={(e) => {
              setClassFilter(e.target.value);
              setCurrentPage(1);
            }}
            className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/25 font-medium ${isClassTeacher ? 'opacity-70 cursor-not-allowed text-slate-500' : 'cursor-pointer text-slate-800 dark:text-slate-200'}`}
          >
            {getClassOptionsForYear(yearFilter).map((cls) => (
              <option key={cls} value={cls}>
                {cls}
              </option>
            ))}
          </select>

          {/* Status select */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
          >
            <option value="All">All Statuses</option>
            <option value="Present">Present</option>
            <option value="Absent">Absent</option>
          </select>

          {/* Session Filter */}
          <select
            value={sessionFilter}
            onChange={(e) => setSessionFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-855 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
          >
            <option value="All">All Sessions</option>
            <option value="Morning">Morning</option>
            <option value="Afternoon">Afternoon</option>
          </select>

          {/* Date Picker & All Dates Button */}
          <div className="flex items-center gap-2">
            <IndianDatePicker value={dateFilter} onChange={setDateFilter} />
            {dateFilter ? (
              <button
                onClick={() => setDateFilter('')}
                title="Show All Dates"
                className="px-2.5 py-2 text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors whitespace-nowrap border border-slate-200 dark:border-slate-800"
              >
                All Dates
              </button>
            ) : (
              <button
                onClick={() => setDateFilter(getTodayDateString())}
                title="Reset to Today"
                className="px-2.5 py-2 text-xs font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-xl transition-colors whitespace-nowrap border border-indigo-200 dark:border-indigo-800/50"
              >
                Today
              </button>
            )}
          </div>
        </div>

        {/* Main Tabs Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 font-semibold text-sm">
          <button
            onClick={() => setActiveMainTab('logs')}
            className={`px-5 py-3 border-b-2 transition-colors flex items-center gap-2 ${
              activeMainTab === 'logs'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <span>Attendance Logs</span>
          </button>
          <button
            onClick={() => setActiveMainTab('history')}
            className={`px-5 py-3 border-b-2 transition-colors flex items-center gap-2 ${
              activeMainTab === 'history'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <IoRefreshOutline className="text-base" />
            <span>Reset History</span>
            {resetHistoryList.length > 0 && (
              <span className="px-2 py-0.5 text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full font-bold">
                {resetHistoryList.length}
              </span>
            )}
          </button>
        </div>

        {activeMainTab === 'logs' ? (
          <>
            {/* Table List */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-xs font-bold uppercase text-slate-400 tracking-wider">
                      <th className="px-6 py-4">Date & Time</th>
                      <th className="px-6 py-4">Student</th>
                      <th className="px-6 py-4">Reg Number</th>
                      <th className="px-6 py-4">Department</th>
                      <th className="px-6 py-4">Section</th>
                      <th className="px-6 py-4">Detection Confidence</th>
                      <th className="px-6 py-4">Method</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 dark:divide-slate-800 text-sm">
                    {currentRecords.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-6 py-12 text-center text-slate-400">
                          No logs found matching selection parameters.
                        </td>
                      </tr>
                    ) : (
                      currentRecords.map((record) => (
                        <tr key={record.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                          <td className="px-6 py-4">
                            <p className="font-semibold text-slate-900 dark:text-white">{formatDateDDMMYYYY(record.date)}</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {getDayName(record.date, record.day) ? `${getDayName(record.date, record.day)} • ` : ''}
                              {record.session ? `${record.session}${record.time && record.time !== '---' ? ` (${record.time})` : ''}` : record.time}
                            </p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="font-bold text-slate-800 dark:text-slate-200">{record.name}</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {record.year || '---'}
                              {record.rollNo && record.rollNo !== '---' ? ` • Roll: ${record.rollNo}` : ''}
                            </p>
                          </td>
                          <td className="px-6 py-4 font-mono font-semibold text-slate-500 dark:text-slate-400">{record.registerNo}</td>
                          <td className="px-6 py-4 text-slate-650 dark:text-slate-450 truncate max-w-[12rem]">{record.department}</td>
                          <td className="px-6 py-4 text-slate-650 dark:text-slate-450 font-medium">{record.section}</td>
                          <td className="px-6 py-4">
                            {record.confidence > 0 ? (
                              <span className="font-bold text-emerald-600 dark:text-emerald-450">{record.confidence}%</span>
                            ) : (
                              <span className="text-slate-350 dark:text-slate-600">---</span>
                            )}
                          </td>
                          <td className="px-6 py-4 font-medium text-slate-500 dark:text-slate-450">{record.method}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                              record.status === 'Present'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                            }`}>
                              {record.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => openEditModalForRow(record)}
                              className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 dark:text-indigo-400 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1"
                              title="Change Student Attendance Status"
                            >
                              <IoCreateOutline className="text-sm" />
                              <span>Edit</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-semibold">
                    Page {currentPage} of {totalPages}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      className="p-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-xl text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <IoChevronBack className="text-sm" />
                    </button>
                    <button
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      className="p-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-xl text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <IoChevronForward className="text-sm" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          /* RESET HISTORY TAB VIEW */
          <div className="space-y-4 text-left">
            {loadingResetHistory ? (
              <div className="p-8 text-center text-slate-400 font-medium">Loading Reset History...</div>
            ) : resetHistoryList.length === 0 ? (
              <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
                <IoRefreshOutline className="text-4xl mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">No Attendance Resets Found</h3>
                <p className="text-xs text-slate-400 mt-1">No attendance resets have been performed for your authorized scope yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {resetHistoryList.map((item) => {
                  const isCurrentActive = item.status === 'active';
                  const targetTitle = getResetTitle(item);

                  return (
                    <div
                      key={item.reset_id || item.id}
                      className={`p-5 rounded-2xl border transition-all bg-white dark:bg-slate-900 shadow-sm ${
                        isCurrentActive
                          ? 'border-rose-200 dark:border-rose-900/40 ring-1 ring-rose-500/10'
                          : 'border-slate-200 dark:border-slate-800 opacity-75'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                              Attendance Reset
                            </span>
                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase ${
                              isCurrentActive
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                            }`}>
                              {isCurrentActive ? 'Active' : 'Undone'}
                            </span>
                          </div>
                          <h4 className="text-lg font-bold text-slate-900 dark:text-white font-heading mt-1">
                            {targetTitle}
                          </h4>
                        </div>
                      </div>

                      <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400 font-medium mb-4">
                        <p>
                          <strong>Reset on:</strong> {item.reset_date} at {item.reset_time}
                        </p>
                        <p>
                          <strong>Reset by:</strong> {item.performed_by || 'Admin'}
                        </p>
                        {item.undone_at && (
                          <p className="text-slate-400">
                            <strong>Undone by:</strong> {item.undone_by || 'Admin'}
                          </p>
                        )}
                      </div>

                      {isCurrentActive && (
                        <button
                          type="button"
                          onClick={() => openUndoModal(item)}
                          className="w-full py-2 px-3 bg-slate-100 hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:text-rose-700 font-bold text-xs rounded-xl border border-rose-200 dark:border-rose-800/40 transition-colors flex items-center justify-center gap-1.5"
                        >
                          <span>UNDO RESET</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* MODAL: MANUAL ATTENDANCE CORRECTION */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
              <button
                type="button"
                onClick={() => { setIsModalOpen(false); setIsConfirming(false); }}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <IoCloseOutline className="text-2xl" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xl font-bold">
                  <IoCreateOutline />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white font-heading">
                    Manual Attendance Correction
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Search student by Name, Register No, or Roll No / Filter class-wise.
                  </p>
                </div>
              </div>

              {!isConfirming ? (
                <form onSubmit={handleCorrectionSubmit} className="space-y-4 text-left">
                  {/* STUDENT SELECTION SECTION */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <IoPersonOutline className="text-sm" />
                        Select Registered Student *
                      </span>
                      {selectedStudent && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedStudent(null);
                            setCorrectionForm({ ...correctionForm, registerNo: '' });
                          }}
                          className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                        >
                          Change Student
                        </button>
                      )}
                    </div>

                    {!selectedStudent ? (
                      <>
                        {/* 1. Manual Search Bar */}
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <IoSearchOutline />
                          </div>
                          <input
                            type="text"
                            placeholder="Search by Student Name, Register No, or Roll No..."
                            value={modalSearch}
                            onChange={(e) => setModalSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
                          />
                        </div>

                        {/* 2. Class-Wise Filters (Year & Class) */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                              Year
                            </label>
                            <select
                              disabled={isClassTeacher}
                              value={modalYearFilter}
                              onChange={(e) => {
                                setModalYearFilter(e.target.value);
                                setModalClassFilter('All Classes');
                              }}
                              className={`w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none ${isClassTeacher ? 'opacity-70 cursor-not-allowed text-slate-500' : ''}`}
                            >
                              <option value="All Years">All Years</option>
                              <option value="1st Year">1st Year</option>
                              <option value="2nd Year">2nd Year</option>
                              <option value="3rd Year">3rd Year</option>
                              <option value="4th Year">4th Year</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                              Class
                            </label>
                            <select
                              disabled={isClassTeacher}
                              value={modalClassFilter}
                              onChange={(e) => setModalClassFilter(e.target.value)}
                              className={`w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none ${isClassTeacher ? 'opacity-70 cursor-not-allowed text-slate-500' : ''}`}
                            >
                              {getClassOptionsForYear(modalYearFilter).map((cls) => (
                                <option key={cls} value={cls}>{cls}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* 3. Matching Student Results Box */}
                        <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-850 bg-white dark:bg-slate-900">
                          {filteredModalStudents.length === 0 ? (
                            <div className="p-4 text-center text-xs text-slate-400">
                              No students match current search / class criteria.
                            </div>
                          ) : (
                            filteredModalStudents.map((st) => {
                              const sName = st.name || st.studentName || st.full_name || 'Unnamed Student';
                              const sReg = st.registerNo || st.registerNumber || st.register_no || st.regNo || '---';
                              const sRoll = st.rollNo || st.roll_no || st.rollNumber || '---';
                              const sDept = st.department || st.dept || 'CSE';
                              const sYear = st.year || st.academicYear || '3rd Year';
                              const sSec = st.section || st.class || st.className || 'A';
                              const secDisplay = sSec.startsWith('CSE') ? sSec : `CSE ${sSec}`;

                              return (
                                <button
                                  key={st.id || sReg}
                                  type="button"
                                  onClick={() => {
                                    setSelectedStudent(st);
                                    setCorrectionForm({ ...correctionForm, registerNo: sReg });
                                  }}
                                  className="w-full p-2.5 text-left hover:bg-indigo-50/50 dark:hover:bg-indigo-950/40 transition-colors flex items-center justify-between"
                                >
                                  <div>
                                    <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">{sName}</p>
                                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                                      Reg: <span className="font-semibold text-slate-600 dark:text-slate-300">{sReg}</span> | Roll: <span className="font-semibold text-indigo-600 dark:text-indigo-400">{sRoll}</span>
                                    </p>
                                  </div>
                                  <div className="text-right text-xs text-slate-400 font-medium">
                                    <p>{sDept}</p>
                                    <p className="text-[11px] text-slate-500">{sYear} • {secDisplay}</p>
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </>
                    ) : (
                      /* Selected Student Confirmation Card */
                      <div className="p-3 bg-white dark:bg-slate-900 border border-emerald-500/30 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white text-base">
                            {selectedStudent.name || selectedStudent.studentName || selectedStudent.full_name}
                          </p>
                          <div className="flex flex-wrap gap-x-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                            <span>Reg: <strong className="font-mono text-slate-700 dark:text-slate-300">{selectedStudent.registerNo || selectedStudent.registerNumber || selectedStudent.register_no}</strong></span>
                            <span>Roll: <strong className="font-mono text-indigo-600 dark:text-indigo-400">{selectedStudent.rollNo || selectedStudent.roll_no || '---'}</strong></span>
                            <span>{selectedStudent.department || selectedStudent.dept || 'CSE'}</span>
                            <span>{selectedStudent.year || selectedStudent.academicYear || '3rd Year'}</span>
                            <span>{selectedStudent.section ? (selectedStudent.section.startsWith('CSE') ? selectedStudent.section : `CSE ${selectedStudent.section}`) : 'CSE A'}</span>
                          </div>
                        </div>
                        <span className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-lg font-bold">
                          ✓
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Select Date */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Date (DD/MM/YYYY) *
                    </label>
                    <IndianDatePicker
                      value={correctionForm.date}
                      onChange={(newDate) => setCorrectionForm({ ...correctionForm, date: newDate })}
                    />
                  </div>

                  {/* Select Session */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Session *
                    </label>
                    <select
                      value={correctionForm.session}
                      onChange={(e) => setCorrectionForm({ ...correctionForm, session: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-sm font-semibold focus:outline-none"
                    >
                      <option value="Morning">Morning</option>
                      <option value="Afternoon">Afternoon</option>
                    </select>
                  </div>

                  {/* Current Status Display */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-bold uppercase tracking-wider">Current Session Status:</span>
                    <span className={`font-extrabold px-2.5 py-0.5 rounded-full ${
                      currentSessionStatus === 'PRESENT'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                    }`}>
                      {currentSessionStatus}
                    </span>
                  </div>

                  {/* New Status Options */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      New Status *
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setCorrectionForm({ ...correctionForm, newStatus: 'PRESENT' })}
                        className={`py-3 rounded-xl font-extrabold text-sm border transition-all ${
                          correctionForm.newStatus === 'PRESENT'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-500/30'
                            : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                        }`}
                      >
                        PRESENT
                      </button>
                      <button
                        type="button"
                        onClick={() => setCorrectionForm({ ...correctionForm, newStatus: 'ABSENT' })}
                        className={`py-3 rounded-xl font-extrabold text-sm border transition-all ${
                          correctionForm.newStatus === 'ABSENT'
                            ? 'bg-rose-600 text-white border-rose-600 shadow-md ring-2 ring-rose-500/30'
                            : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                        }`}
                      >
                        ABSENT
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-sm transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!selectedStudent}
                      className="w-1/2 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm shadow-md transition-all"
                    >
                      Save Changes
                    </button>
                  </div>
                </form>
              ) : (
                /* Confirmation Screen (Safety Requirement #17) */
                <div className="space-y-4 text-left">
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl">
                    <h4 className="font-bold text-amber-800 dark:text-amber-300 text-sm flex items-center gap-1.5 mb-2">
                      <IoCheckmarkCircleOutline className="text-lg" />
                      Confirm Attendance Status Change
                    </h4>
                    <div className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300 font-medium">
                      <p><strong className="text-slate-900 dark:text-white">Student:</strong> {selectedStudent?.name || selectedStudent?.studentName || correctionForm.registerNo}</p>
                      <p><strong className="text-slate-900 dark:text-white">Reg No:</strong> {selectedStudent?.registerNo || selectedStudent?.registerNumber || correctionForm.registerNo}</p>
                      <p><strong className="text-slate-900 dark:text-white">Roll No:</strong> {selectedStudent?.rollNo || selectedStudent?.roll_no || '---'}</p>
                      <p><strong className="text-slate-900 dark:text-white">Class:</strong> {selectedStudent?.department || selectedStudent?.dept || 'CSE'} • {selectedStudent?.year || selectedStudent?.academicYear || '3rd Year'} • {selectedStudent?.section ? (selectedStudent.section.startsWith('CSE') ? selectedStudent.section : `CSE ${selectedStudent.section}`) : 'CSE A'}</p>
                      <p><strong className="text-slate-900 dark:text-white">Date:</strong> {formatDateDDMMYYYY(correctionForm.date)}</p>
                      <p><strong className="text-slate-900 dark:text-white">Session:</strong> {correctionForm.session}</p>
                      <p><strong className="text-slate-900 dark:text-white">Current Status:</strong> {currentSessionStatus}</p>
                      <p><strong className="text-slate-900 dark:text-white">New Status:</strong> <span className="font-bold text-indigo-600 dark:text-indigo-400">{correctionForm.newStatus}</span></p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                    This will update MongoDB and automatically recalculate statistics for Attendance History, Reports, and Student Portal.
                  </p>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsConfirming(false)}
                      className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-sm transition-colors"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleCorrectionSubmit}
                      className="w-1/2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm shadow-md transition-all"
                    >
                      Confirm & Save
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* MODAL: ATTENDANCE RESET */}
        {isResetModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
              <button
                type="button"
                onClick={() => { setIsResetModalOpen(false); setResetStep('select'); }}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <IoCloseOutline className="text-2xl" />
              </button>

              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center text-xl font-bold">
                  <IoRefreshOutline />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white font-heading">
                    Reset Attendance
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {isClassTeacher
                      ? 'Reset attendance for your assigned class or individual student.'
                      : 'Reset attendance for department, year, class, or individual student.'}
                  </p>
                </div>
              </div>

              {resetStep === 'select' ? (
                <div className="space-y-4 text-left">
                  {/* Scope Selector */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                      Reset Scope *
                    </label>
                    <select
                      value={resetScope}
                      onChange={(e) => {
                        const newScope = e.target.value;
                        setResetScope(newScope);
                        if (newScope !== 'student') setSelectedResetStudent(null);
                      }}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500/25 text-slate-800 dark:text-slate-200"
                    >
                      {!isClassTeacher && <option value="department">Entire Department (All CSE Students)</option>}
                      {!isClassTeacher && <option value="year">Entire Year (Specific Year)</option>}
                      <option value="class">{isClassTeacher ? 'My Assigned Class' : 'Specific Class (Year + Class)'}</option>
                      <option value="student">Individual Student</option>
                    </select>
                  </div>

                  {/* Year Dropdown (if scope is 'year' or ('class' and HOD)) */}
                  {((resetScope === 'year') || (resetScope === 'class' && !isClassTeacher)) && (
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                        Select Year *
                      </label>
                      <select
                        value={resetYear}
                        onChange={(e) => {
                          setResetYear(e.target.value);
                          setResetSection('CSE A');
                        }}
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold focus:outline-none text-slate-800 dark:text-slate-200"
                      >
                        <option value="1st Year">1st Year</option>
                        <option value="2nd Year">2nd Year</option>
                        <option value="3rd Year">3rd Year</option>
                        <option value="4th Year">4th Year</option>
                      </select>
                    </div>
                  )}

                  {/* Section Dropdown (if scope is 'class' and HOD) */}
                  {(resetScope === 'class' && !isClassTeacher) && (
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                        Select Class / Section *
                      </label>
                      <select
                        value={resetSection}
                        onChange={(e) => setResetSection(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold focus:outline-none text-slate-800 dark:text-slate-200"
                      >
                        {getClassOptionsForYear(resetYear).filter(c => c !== 'All Classes').map((cls) => (
                          <option key={cls} value={cls}>{cls}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Assigned Class Info for Class Advisor */}
                  {(resetScope === 'class' && isClassTeacher) && (
                    <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400">
                      Target Class: <strong className="text-indigo-600 dark:text-indigo-400 font-bold">{resetYear} — {resetSection.startsWith('CSE') ? resetSection : `CSE ${resetSection}`}</strong>
                    </div>
                  )}

                  {/* Student Search & Select (if scope is 'student') */}
                  {resetScope === 'student' && (
                    <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <IoPersonOutline className="text-sm" />
                          Select Student *
                        </span>
                        {selectedResetStudent && (
                          <button
                            type="button"
                            onClick={() => setSelectedResetStudent(null)}
                            className="text-xs text-rose-600 dark:text-rose-400 font-bold hover:underline"
                          >
                            Change Student
                          </button>
                        )}
                      </div>

                      {!selectedResetStudent ? (
                        <>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                              <IoSearchOutline />
                            </div>
                            <input
                              type="text"
                              placeholder="Search student by Name, Register No, or Roll No..."
                              value={resetSearch}
                              onChange={(e) => setResetSearch(e.target.value)}
                              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none"
                            />
                          </div>

                          <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-850 bg-white dark:bg-slate-900">
                            {filteredModalStudents.filter(s => {
                              if (!resetSearch.trim()) return true;
                              const q = resetSearch.toLowerCase().trim();
                              const name = (s.name || s.studentName || '').toLowerCase();
                              const reg = (s.registerNo || s.registerNumber || '').toLowerCase();
                              const roll = (s.rollNo || s.roll_no || '').toLowerCase();
                              return name.includes(q) || reg.includes(q) || roll.includes(q);
                            }).length === 0 ? (
                              <div className="p-4 text-center text-xs text-slate-400">
                                No matching students found.
                              </div>
                            ) : (
                              filteredModalStudents.filter(s => {
                                if (!resetSearch.trim()) return true;
                                const q = resetSearch.toLowerCase().trim();
                                const name = (s.name || s.studentName || '').toLowerCase();
                                const reg = (s.registerNo || s.registerNumber || '').toLowerCase();
                                const roll = (s.rollNo || s.roll_no || '').toLowerCase();
                                return name.includes(q) || reg.includes(q) || roll.includes(q);
                              }).map((st) => (
                                <button
                                  key={st.id || st.registerNo}
                                  type="button"
                                  onClick={() => setSelectedResetStudent(st)}
                                  className="w-full p-2.5 text-left hover:bg-rose-50/50 dark:hover:bg-rose-950/40 transition-colors flex items-center justify-between"
                                >
                                  <div>
                                    <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">{st.name || st.studentName}</p>
                                    <p className="text-xs text-slate-400 font-mono mt-0.5">Reg: {st.registerNo || st.registerNumber} | Roll: {st.rollNo || '---'}</p>
                                  </div>
                                  <div className="text-right text-xs text-slate-400">
                                    <p>{st.year || '3rd Year'} • {st.section ? (st.section.startsWith('CSE') ? st.section : `CSE ${st.section}`) : 'CSE A'}</p>
                                  </div>
                                </button>
                              ))
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="p-3 bg-white dark:bg-slate-900 border border-rose-500/30 rounded-xl flex items-center justify-between">
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white text-base">
                              {selectedResetStudent.name || selectedResetStudent.studentName}
                            </p>
                            <div className="flex flex-wrap gap-x-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                              <span>Reg: <strong className="font-mono text-slate-700 dark:text-slate-300">{selectedResetStudent.registerNo || selectedResetStudent.registerNumber}</strong></span>
                              <span>Roll: <strong className="font-mono text-indigo-600 dark:text-indigo-400">{selectedResetStudent.rollNo || '---'}</strong></span>
                              <span>{selectedResetStudent.year || '3rd Year'} • {selectedResetStudent.section ? (selectedResetStudent.section.startsWith('CSE') ? selectedResetStudent.section : `CSE ${selectedResetStudent.section}`) : 'CSE A'}</span>
                            </div>
                          </div>
                          <span className="w-8 h-8 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center text-lg font-bold">
                            ✓
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-3 pt-3">
                    <button
                      type="button"
                      onClick={() => setIsResetModalOpen(false)}
                      className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-sm transition-colors"
                    >
                      CANCEL
                    </button>
                    <button
                      type="button"
                      disabled={resetScope === 'student' && !selectedResetStudent}
                      onClick={handleResetSubmit}
                      className="w-1/2 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm shadow-md transition-all"
                    >
                      Proceed to Reset
                    </button>
                  </div>
                </div>
              ) : (
                /* STEP 2: CONFIRMATION VIEW */
                <div className="space-y-4 text-left">
                  <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl space-y-2">
                    <h4 className="font-bold text-rose-800 dark:text-rose-300 text-base flex items-center gap-2">
                      <IoWarningOutline className="text-xl text-rose-600" />
                      Reset attendance for {getResetTargetLabel()}?
                    </h4>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Attendance before this reset will no longer be included in the current calculation.
                    </p>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                    Note: Student profiles, register numbers, face encodings, and historical logs remain stored safely in MongoDB.
                  </p>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      disabled={isResetSubmitting}
                      onClick={() => setResetStep('select')}
                      className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-sm transition-colors"
                    >
                      CANCEL
                    </button>
                    <button
                      type="button"
                      disabled={isResetSubmitting}
                      onClick={handleResetSubmit}
                      className="w-1/2 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-extrabold rounded-xl text-sm shadow-md transition-all flex items-center justify-center gap-2"
                    >
                      {isResetSubmitting ? 'Resetting...' : 'RESET ATTENDANCE'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* MODAL: UNDO RESET CONFIRMATION */}
        {isUndoModalOpen && selectedUndoReset && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm text-left">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 relative">
              <button
                type="button"
                onClick={() => { setIsUndoModalOpen(false); setSelectedUndoReset(null); }}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <IoCloseOutline className="text-2xl" />
              </button>

              <div className="space-y-4">
                <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl space-y-2">
                  <h4 className="font-bold text-amber-800 dark:text-amber-300 text-base flex items-center gap-2">
                    <IoWarningOutline className="text-xl text-amber-600" />
                    Undo this attendance reset?
                  </h4>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Target: {getResetTitle(selectedUndoReset)}
                  </p>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Previous attendance will be included in the current attendance calculation again.
                  </p>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    disabled={isUndoSubmitting}
                    onClick={() => { setIsUndoModalOpen(false); setSelectedUndoReset(null); }}
                    className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-sm transition-colors"
                  >
                    CANCEL
                  </button>
                  <button
                    type="button"
                    disabled={isUndoSubmitting}
                    onClick={handleConfirmUndoReset}
                    className="w-1/2 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-extrabold rounded-xl text-sm shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    {isUndoSubmitting ? 'Undoing...' : 'UNDO RESET'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
