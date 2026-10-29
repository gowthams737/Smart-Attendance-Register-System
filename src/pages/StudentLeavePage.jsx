import React, { useState, useEffect } from 'react';
import StudentLayout from '../layouts/StudentLayout';
import { apiService } from '../services/api';
import { useToast } from '../context/ToastContext';
import StudentDatePicker from '../components/StudentDatePicker';
import { formatStudentDate, formatStudentDateTime } from '../utils/dateUtils';
import {
  IoDocumentTextOutline, IoAddCircleOutline, IoCalendarOutline,
  IoTimeOutline, IoCheckmarkCircleOutline, IoCloseCircleOutline,
  IoBanOutline, IoSendOutline, IoMailUnreadOutline, IoAlertCircleOutline
} from 'react-icons/io5';

export default function StudentLeavePage() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('applications'); // 'applications' | 'letters'
  const [loading, setLoading] = useState(true);
  const [leaves, setLeaves] = useState([]);
  const [leaveLetters, setLeaveLetters] = useState([]);
  
  // Modals
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [isLetterModalOpen, setIsLetterModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);
  const [confirmCancelId, setConfirmCancelId] = useState(null);
  const [lowAttendanceWarning, setLowAttendanceWarning] = useState(null);

  // Apply for Leave form state
  const [leaveDate, setLeaveDate] = useState('');
  const [applyReason, setApplyReason] = useState('');

  // Leave Letter form state
  const [letterLeaveDate, setLetterLeaveDate] = useState('');
  const [letterFromDate, setLetterFromDate] = useState('');
  const [letterToDate, setLetterToDate] = useState('');
  const [letterReason, setLetterReason] = useState('');
  const [letterContent, setLetterContent] = useState('');

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [leavesRes, lettersRes] = await Promise.all([
        apiService.getStudentLeave(),
        apiService.getStudentLeaveLetters()
      ]);
      setLeaves(leavesRes || []);
      setLeaveLetters(lettersRes || []);
    } catch (err) {
      console.error('Failed to fetch student leaves & letters:', err);
      showToast('Error loading leave data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const handleApplyLeaveSubmit = async (e, confirmLowAttendance = false) => {
    if (e) e.preventDefault();
    if (!leaveDate || !applyReason.trim()) {
      showToast('Please select a leave date and enter a reason.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiService.applyStudentLeave({
        date: leaveDate,
        reason: applyReason.trim(),
        confirmLowAttendance
      });

      if (res && res.requiresConfirmation) {
        setLowAttendanceWarning({
          type: 'application',
          attendancePercentage: res.attendancePercentage
        });
        setSubmitting(false);
        return;
      }

      showToast('Leave request submitted successfully!', 'success');
      setIsApplyModalOpen(false);
      setLowAttendanceWarning(null);
      setLeaveDate('');
      setApplyReason('');
      fetchAllData();
    } catch (err) {
      console.error('Failed to apply for leave:', err);
      showToast(err.message || 'Failed to submit leave request.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLeaveLetterSubmit = async (e, confirmLowAttendance = false) => {
    if (e) e.preventDefault();
    if (!letterLeaveDate && !letterFromDate) {
      showToast('Please select a leave date.', 'error');
      return;
    }
    if (!letterReason.trim() || !letterContent.trim()) {
      showToast('Please fill in reason and leave letter content.', 'error');
      return;
    }

    const targetLeaveDate = letterLeaveDate || letterFromDate;
    const targetFromDate = letterFromDate || targetLeaveDate;
    const targetToDate = letterToDate || targetFromDate;

    setSubmitting(true);
    try {
      const res = await apiService.applyStudentLeaveLetter({
        leaveDate: targetLeaveDate,
        fromDate: targetFromDate,
        toDate: targetToDate,
        reason: letterReason.trim(),
        letterContent: letterContent.trim(),
        confirmLowAttendance
      });

      if (res && res.requiresConfirmation) {
        setLowAttendanceWarning({
          type: 'letter',
          attendancePercentage: res.attendancePercentage
        });
        setSubmitting(false);
        return;
      }

      showToast('Leave letter submitted successfully!', 'success');
      setIsLetterModalOpen(false);
      setLowAttendanceWarning(null);
      setLetterLeaveDate('');
      setLetterFromDate('');
      setLetterToDate('');
      setLetterReason('');
      setLetterContent('');
      setActiveTab('letters');
      fetchAllData();
    } catch (err) {
      console.error('Failed to submit leave letter:', err);
      showToast(err.message || 'Failed to submit leave letter.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelLeave = (leaveId) => {
    if (!leaveId) return;
    setConfirmCancelId(leaveId);
  };

  const executeCancelLeave = async (leaveId) => {
    if (!leaveId) return;
    setCancellingId(leaveId);
    try {
      await apiService.cancelStudentLeave(leaveId);
      showToast('Leave request cancelled successfully', 'info');
      setConfirmCancelId(null);
      fetchAllData();
    } catch (err) {
      console.error('Failed to cancel leave:', err);
      showToast(err.message || 'Failed to cancel leave request.', 'error');
    } finally {
      setCancellingId(null);
    }
  };

  const getStatusBadge = (status) => {
    const s = String(status || '').toUpperCase();
    if (s === 'APPROVED') {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          <IoCheckmarkCircleOutline className="text-sm" /> Approved
        </span>
      );
    }
    if (s === 'PENDING') {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          <IoTimeOutline className="text-sm" /> Pending
        </span>
      );
    }
    if (s === 'REJECTED') {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
          <IoCloseCircleOutline className="text-sm" /> Rejected
        </span>
      );
    }
    if (s === 'CANCELLED') {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/20">
          <IoBanOutline className="text-sm" /> Cancelled
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
        {status}
      </span>
    );
  };

  return (
    <StudentLayout>
      <div className="space-y-6 text-left">
        {/* Page Header with Action Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-heading text-slate-900 dark:text-white">
              Student Leave Portal
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Submit leave applications, formal leave letters, and track approval status.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setIsApplyModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/25 transition-all"
              id="btn-apply-for-leave"
            >
              <IoAddCircleOutline className="text-lg" />
              <span>Apply for Leave</span>
            </button>
            <button
              onClick={() => setIsLetterModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/25 transition-all"
              id="btn-leave-letter"
            >
              <IoDocumentTextOutline className="text-lg" />
              <span>Leave Letter</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-6">
          <button
            onClick={() => setActiveTab('applications')}
            className={`pb-3 text-sm font-bold transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === 'applications'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <IoCalendarOutline className="text-lg" />
            <span>My Leave Applications ({leaves.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('letters')}
            className={`pb-3 text-sm font-bold transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === 'letters'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <IoDocumentTextOutline className="text-lg" />
            <span>My Leave Letters ({leaveLetters.length})</span>
          </button>
        </div>

        {/* TAB 1: APPLY FOR LEAVE APPLICATIONS LIST */}
        {activeTab === 'applications' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between">
              <h2 className="font-bold text-sm text-slate-800 dark:text-white">Leave History & Applications</h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">All dates in DD/MM/YYYY format</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[11px] font-bold text-slate-450 uppercase tracking-wider">
                    <th className="py-3.5 px-5">Leave Date</th>
                    <th className="py-3.5 px-5">Reason</th>
                    <th className="py-3.5 px-5">Status</th>
                    <th className="py-3.5 px-5">Applied On</th>
                    <th className="py-3.5 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm font-medium">
                  {loading ? (
                    <tr>
                      <td colSpan="5" className="py-12 text-center text-slate-400">
                        Loading leave records...
                      </td>
                    </tr>
                  ) : leaves.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="py-12 text-center text-slate-400">
                        No leave applications submitted yet. Click "Apply for Leave" to create one.
                      </td>
                    </tr>
                  ) : (
                    leaves.map((row) => {
                      const rowId = row.id || row._id;
                      const statusUpper = String(row.status || '').toUpperCase();
                      const isCancelled = statusUpper === 'CANCELLED';
                      const isRejected = statusUpper === 'REJECTED';
                      return (
                        <tr key={rowId} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-4 px-5 font-mono text-slate-900 dark:text-white font-semibold">
                            {formatStudentDate(row.date)}
                          </td>
                          <td className="py-4 px-5 text-slate-700 dark:text-slate-300 max-w-xs truncate">
                            {row.reason}
                          </td>
                          <td className="py-4 px-5">
                            {getStatusBadge(row.status)}
                          </td>
                          <td className="py-4 px-5 text-xs text-slate-500 dark:text-slate-400">
                            {formatStudentDateTime(row.created_at)}
                          </td>
                          <td className="py-4 px-5 text-right">
                            {isCancelled ? (
                              <span className="text-xs text-slate-400 italic font-semibold">Cancelled</span>
                            ) : isRejected ? (
                              <span className="text-xs text-slate-400 italic">Rejected</span>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleCancelLeave(rowId); }}
                                disabled={cancellingId === rowId}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40 transition-all disabled:opacity-50 cursor-pointer"
                              >
                                {cancellingId === rowId ? 'Cancelling...' : 'CANCEL LEAVE'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: LEAVE LETTERS LIST */}
        {activeTab === 'letters' && (
          <div className="space-y-4">
            {loading ? (
              <div className="p-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                Loading Leave Letters...
              </div>
            ) : leaveLetters.length === 0 ? (
              <div className="p-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <IoMailUnreadOutline className="text-4xl text-slate-300 mx-auto" />
                <p className="font-semibold text-slate-600 dark:text-slate-300">No formal Leave Letters submitted yet.</p>
                <button
                  onClick={() => setIsLetterModalOpen(true)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors"
                >
                  Write a Leave Letter
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {leaveLetters.map((letter) => (
                  <div
                    key={letter.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-white text-base">
                            Leave Date: {formatStudentDate(letter.leaveDate || letter.fromDate)}
                          </span>
                          {getStatusBadge(letter.status)}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          Submitted on {formatStudentDateTime(letter.created_at)}
                        </p>
                      </div>
                      <div className="text-xs text-slate-500 font-mono bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg self-start">
                        {letter.fromDate && letter.toDate && letter.fromDate !== letter.toDate ? (
                          <span>From: {formatStudentDate(letter.fromDate)} To: {formatStudentDate(letter.toDate)}</span>
                        ) : (
                          <span>Date: {formatStudentDate(letter.leaveDate)}</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Reason</p>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{letter.reason}</p>
                    </div>

                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Letter Content</p>
                      <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800/60 rounded-xl text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-serif leading-relaxed whitespace-pre-wrap">
                        {letter.letterContent}
                      </div>
                    </div>

                    {letter.adminResponse && (
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 rounded-xl text-xs text-amber-800 dark:text-amber-300 font-medium">
                        <span className="font-bold">Admin Response / Rejection Reason:</span> {letter.adminResponse}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MODAL 1: APPLY FOR LEAVE */}
        {isApplyModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Apply for Leave</h3>
                <button
                  onClick={() => setIsApplyModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleApplyLeaveSubmit} className="space-y-5 mt-5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-2">
                    Leave Date (DD/MM/YYYY)
                  </label>
                  <StudentDatePicker
                    value={leaveDate}
                    onChange={(newDate) => setLeaveDate(newDate)}
                    placeholder="DD/MM/YYYY"
                    className="w-full"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-2">
                    Reason for Leave
                  </label>
                  <textarea
                    required
                    rows="3"
                    placeholder="Provide detailed reason (e.g., Medical Leave, Urgent Personal Work)"
                    value={applyReason}
                    onChange={(e) => setApplyReason(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsApplyModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
                  >
                    {submitting ? 'Submitting...' : 'Submit Application'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: LEAVE LETTER SUBMISSION */}
        {isLetterModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                    <IoDocumentTextOutline className="text-xl" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Submit Leave Letter</h3>
                </div>
                <button
                  onClick={() => setIsLetterModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleLeaveLetterSubmit} className="space-y-4 mt-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                      From Date (DD/MM/YYYY)
                    </label>
                    <StudentDatePicker
                      value={letterFromDate}
                      onChange={(d) => { setLetterFromDate(d); if (!letterLeaveDate) setLetterLeaveDate(d); }}
                      placeholder="DD/MM/YYYY"
                      className="w-full"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                      To Date (DD/MM/YYYY)
                    </label>
                    <StudentDatePicker
                      value={letterToDate}
                      onChange={(d) => setLetterToDate(d)}
                      placeholder="DD/MM/YYYY"
                      className="w-full"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    Reason Title / Subject
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Request for Medical Leave due to fever"
                    value={letterReason}
                    onChange={(e) => setLetterReason(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    Leave Letter Content
                  </label>
                  <textarea
                    required
                    rows="6"
                    placeholder="Respected Admin / Principal,&#10;&#10;I am writing to formally request leave from class due to..."
                    value={letterContent}
                    onChange={(e) => setLetterContent(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 leading-relaxed"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsLetterModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50 inline-flex items-center gap-2"
                  >
                    <IoSendOutline />
                    <span>{submitting ? 'Submitting...' : 'Submit Leave Letter'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 3: CONFIRM CANCEL LEAVE */}
        {confirmCancelId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-sm w-full p-6 text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto text-2xl font-bold">
                <IoBanOutline />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Cancel Leave Request?</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Are you sure you want to cancel this leave request? This action will immediately notify the admin and update your request status to CANCELLED.
              </p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmCancelId(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  No, Keep It
                </button>
                <button
                  type="button"
                  onClick={() => executeCancelLeave(confirmCancelId)}
                  disabled={cancellingId === confirmCancelId}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/30 transition-all disabled:opacity-50 cursor-pointer"
                  id="btn-confirm-cancel-leave"
                >
                  {cancellingId === confirmCancelId ? 'Cancelling...' : 'Yes, Cancel Leave'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 4: LOW ATTENDANCE WARNING */}
        {lowAttendanceWarning && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full p-6 sm:p-8 text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto text-3xl font-bold border border-amber-500/20">
                <IoAlertCircleOutline />
              </div>
              <div className="space-y-3">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  Low Attendance Warning
                </h3>
                <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 rounded-2xl text-left text-xs sm:text-sm space-y-2 text-amber-900 dark:text-amber-200">
                  <p className="font-semibold">Your attendance percentage is below 75%.</p>
                  <p className="text-base font-bold font-mono text-amber-600 dark:text-amber-400">
                    Current Attendance: {Number(lowAttendanceWarning.attendancePercentage || 0).toFixed(2)}%
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-normal">
                    Do you still want to apply for leave?
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setLowAttendanceWarning(null);
                    setSubmitting(false);
                  }}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer"
                  id="btn-cancel-low-att-leave"
                >
                  Cancel Leave
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (lowAttendanceWarning.type === 'application') {
                      handleApplyLeaveSubmit(null, true);
                    } else if (lowAttendanceWarning.type === 'letter') {
                      handleLeaveLetterSubmit(null, true);
                    }
                  }}
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-600/30 transition-all disabled:opacity-50 cursor-pointer"
                  id="btn-confirm-low-att-leave"
                >
                  {submitting ? 'Submitting...' : 'Apply Leave'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </StudentLayout>
  );
}
