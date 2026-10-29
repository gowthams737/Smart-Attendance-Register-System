import React, { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '../layouts/DashboardLayout';
import { useToast } from '../context/ToastContext';
import { apiService } from '../services/api';
import {
  IoDocumentTextOutline, IoCheckmarkCircleOutline, IoCloseCircleOutline,
  IoTimeOutline, IoBanOutline, IoSearchOutline, IoFilterOutline,
  IoCalendarOutline, IoPersonOutline, IoSendOutline, IoAlertCircleOutline
} from 'react-icons/io5';

// Helper to format date string to DD/MM/YYYY (4-digit year)
const formatDDMMYYYY = (dateStr) => {
  if (!dateStr || dateStr === '---') return '---';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr;
  
  const clean = String(dateStr).split('T')[0].split(' ')[0];
  const parts = clean.split(/[-/]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
    } else if (parts[2].length === 4) {
      // DD/MM/YYYY or MM/DD/YYYY -> assume DD/MM/YYYY
      return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
    }
  }
  return dateStr;
};

export default function AdminLeavesPage({ Layout = DashboardLayout }) {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('letters'); // 'letters' | 'applications'
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Data
  const [leaveLetters, setLeaveLetters] = useState([]);
  const [leaveApplications, setLeaveApplications] = useState([]);

  // Rejection modal state
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);

  const fetchAllLeaves = async () => {
    setLoading(true);
    try {
      const [lettersRes, appsRes] = await Promise.allSettled([
        apiService.getAdminLeaveLetters(),
        apiService.getAdminAllLeaves()
      ]);
      if (lettersRes.status === 'fulfilled') {
        setLeaveLetters(lettersRes.value || []);
      } else {
        console.error('Failed to load leave letters:', lettersRes.reason);
      }
      if (appsRes.status === 'fulfilled') {
        setLeaveApplications(appsRes.value || []);
      } else {
        console.error('Failed to load leave applications:', appsRes.reason);
      }
      if (lettersRes.status === 'rejected' && appsRes.status === 'rejected') {
        showToast('Error loading leave requests.', 'error');
      }
    } catch (err) {
      console.error('Failed to load leave records for admin:', err);
      showToast('Error loading leave requests.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllLeaves();
  }, []);

  const handleApprove = async (item, type) => {
    setProcessing(true);
    try {
      if (type === 'letter') {
        await apiService.updateLeaveLetterStatus(item.id, 'APPROVED', '');
        showToast(`Leave Letter for ${item.name} approved successfully.`, 'success');
      } else {
        await apiService.updateAdminLeaveStatus(item.id, 'APPROVED', '');
        showToast(`Leave application for ${item.name} approved.`, 'success');
      }
      fetchAllLeaves();
    } catch (err) {
      console.error('Failed to approve:', err);
      showToast(err.message || 'Failed to approve request.', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const openRejectModal = (item, type) => {
    setSelectedItem({ ...item, itemType: type });
    setRejectionReason('');
    setRejectModalOpen(true);
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!selectedItem) return;
    if (!rejectionReason.trim()) {
      showToast('Please provide a rejection reason.', 'error');
      return;
    }
    setProcessing(true);
    try {
      if (selectedItem.itemType === 'letter') {
        await apiService.updateLeaveLetterStatus(selectedItem.id, 'REJECTED', rejectionReason.trim());
        showToast(`Leave Letter for ${selectedItem.name} rejected.`, 'info');
      } else {
        await apiService.updateAdminLeaveStatus(selectedItem.id, 'REJECTED', rejectionReason.trim());
        showToast(`Leave application for ${selectedItem.name} rejected.`, 'info');
      }
      setRejectModalOpen(false);
      setSelectedItem(null);
      setRejectionReason('');
      fetchAllLeaves();
    } catch (err) {
      console.error('Failed to reject:', err);
      showToast(err.message || 'Failed to reject request.', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (statusStr) => {
    const s = String(statusStr || '').toUpperCase();
    if (s === 'APPROVED') {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          <IoCheckmarkCircleOutline className="text-sm" /> APPROVED
        </span>
      );
    }
    if (s === 'PENDING') {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          <IoTimeOutline className="text-sm" /> PENDING
        </span>
      );
    }
    if (s === 'REJECTED') {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
          <IoCloseCircleOutline className="text-sm" /> REJECTED
        </span>
      );
    }
    if (s === 'CANCELLED') {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/20">
          <IoBanOutline className="text-sm" /> CANCELLED
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
        {statusStr}
      </span>
    );
  };

  // Filtered Leave Letters
  const filteredLetters = useMemo(() => {
    return leaveLetters.filter((item) => {
      const statusMatch = statusFilter === 'ALL' || String(item.status).toUpperCase() === statusFilter;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return statusMatch;

      const nameMatch = String(item.name || '').toLowerCase().includes(q);
      const regMatch = String(item.registerNo || '').toLowerCase().includes(q);
      const deptMatch = String(item.department || '').toLowerCase().includes(q);
      const reasonMatch = String(item.reason || '').toLowerCase().includes(q);

      return statusMatch && (nameMatch || regMatch || deptMatch || reasonMatch);
    });
  }, [leaveLetters, statusFilter, searchQuery]);

  // Filtered Leave Applications
  const filteredApplications = useMemo(() => {
    return leaveApplications.filter((item) => {
      const statusMatch = statusFilter === 'ALL' || String(item.status).toUpperCase() === statusFilter;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return statusMatch;

      const nameMatch = String(item.name || '').toLowerCase().includes(q);
      const regMatch = String(item.registerNo || '').toLowerCase().includes(q);
      const deptMatch = String(item.department || '').toLowerCase().includes(q);
      const reasonMatch = String(item.reason || '').toLowerCase().includes(q);

      return statusMatch && (nameMatch || regMatch || deptMatch || reasonMatch);
    });
  }, [leaveApplications, statusFilter, searchQuery]);

  return (
    <Layout>
      <div className="space-y-6 text-left">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white font-heading tracking-tight">
              Student Leave Management
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
              Review formal Leave Letters, approve or reject leave applications, and view student cancellation logs.
            </p>
          </div>
        </div>

        {/* Top Controls: Search and Status Filters */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
          {/* Search Box */}
          <div className="relative w-full sm:w-80">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <IoSearchOutline />
            </div>
            <input
              type="text"
              placeholder="Search Student, Reg No, Reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
            />
          </div>

          {/* Status Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
            {['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  statusFilter === st
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-6">
          <button
            onClick={() => setActiveTab('letters')}
            className={`pb-3 text-sm font-bold transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === 'letters'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <IoDocumentTextOutline className="text-lg" />
            <span>Formal Leave Letters ({filteredLetters.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('applications')}
            className={`pb-3 text-sm font-bold transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === 'applications'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <IoCalendarOutline className="text-lg" />
            <span>Apply for Leave Requests ({filteredApplications.length})</span>
          </button>
        </div>

        {/* TAB 1: FORMAL LEAVE LETTERS */}
        {activeTab === 'letters' && (
          <div className="space-y-4">
            {loading ? (
              <div className="p-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                Loading Leave Letters...
              </div>
            ) : filteredLetters.length === 0 ? (
              <div className="p-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                No leave letters found matching filter.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {filteredLetters.map((letter) => {
                  const isPending = String(letter.status).toUpperCase() === 'PENDING';
                  return (
                    <div
                      key={letter.id}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4"
                    >
                      {/* Top Header Row */}
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                        <div>
                          <div className="flex items-center gap-3 flex-wrap">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white font-heading">
                              {letter.name}
                            </h3>
                            <span className="font-mono text-xs font-semibold px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              {letter.registerNo}
                            </span>
                            {getStatusBadge(letter.status)}
                            {(letter.isLowAttendance || (letter.attendancePercentage !== undefined && letter.attendancePercentage !== null && Number(letter.attendancePercentage) < 75)) && (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shadow-sm">
                                <IoAlertCircleOutline className="text-sm text-rose-500" /> LOW ATTENDANCE — {Number(letter.attendancePercentage).toFixed(2)}%
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            Roll No: <span className="font-semibold text-slate-700 dark:text-slate-300">{letter.rollNo || '---'}</span> • Dept: <span className="font-semibold text-slate-700 dark:text-slate-300">{letter.department || 'CSE'}</span> • Year: <span className="font-semibold text-slate-700 dark:text-slate-300">{letter.year || '3rd Year'}</span> • Class: <span className="font-semibold text-slate-700 dark:text-slate-300">{letter.section || 'A'}</span>
                          </p>
                        </div>

                        {/* Date details */}
                        <div className="text-right flex flex-col md:items-end">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Leave Date</span>
                          <span className="text-sm font-bold font-mono text-indigo-600 dark:text-indigo-400">
                            {formatDDMMYYYY(letter.leaveDate || letter.fromDate)}
                          </span>
                          <span className="text-[11px] text-slate-400 mt-0.5">Submitted: {letter.created_at || 'Just now'}</span>
                        </div>
                      </div>

                      {/* Reason & Content */}
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Subject / Reason</p>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{letter.reason}</p>
                      </div>

                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Leave Letter Content</p>
                        <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800/60 rounded-xl text-sm text-slate-700 dark:text-slate-300 font-serif leading-relaxed whitespace-pre-wrap">
                          {letter.letterContent}
                        </div>
                      </div>

                      {/* Admin Response if present */}
                      {letter.adminResponse && (
                        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 rounded-xl text-xs text-amber-800 dark:text-amber-300 font-medium">
                          <span className="font-bold">Admin Remark:</span> {letter.adminResponse}
                        </div>
                      )}

                      {/* Action Buttons for Pending */}
                      {isPending && (
                        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                          <button
                            onClick={() => openRejectModal(letter, 'letter')}
                            disabled={processing}
                            className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50 transition-all disabled:opacity-50"
                          >
                            REJECT
                          </button>
                          <button
                            onClick={() => handleApprove(letter, 'letter')}
                            disabled={processing}
                            className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50 inline-flex items-center gap-1.5"
                          >
                            <IoCheckmarkCircleOutline className="text-base" />
                            <span>APPROVE</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: APPLY FOR LEAVE REQUESTS & CANCELLATIONS */}
        {activeTab === 'applications' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between">
              <h2 className="font-bold text-sm text-slate-800 dark:text-white">Apply for Leave Applications & Cancellation Logs</h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">All dates in DD/MM/YYYY format</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[11px] font-bold text-slate-450 uppercase tracking-wider">
                    <th className="py-3.5 px-5">Student</th>
                    <th className="py-3.5 px-5">Reg Number</th>
                    <th className="py-3.5 px-5">Department & Class</th>
                    <th className="py-3.5 px-5">Leave Date</th>
                    <th className="py-3.5 px-5">Reason</th>
                    <th className="py-3.5 px-5">Status</th>
                    <th className="py-3.5 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm font-medium">
                  {loading ? (
                    <tr>
                      <td colSpan="7" className="py-12 text-center text-slate-400">
                        Loading requests...
                      </td>
                    </tr>
                  ) : filteredApplications.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-12 text-center text-slate-400">
                        No leave applications found matching filter.
                      </td>
                    </tr>
                  ) : (
                    filteredApplications.map((app) => {
                      const isPending = String(app.status).toUpperCase() === 'PENDING';
                      return (
                        <tr key={app.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-4 px-5">
                            <div className="font-bold text-slate-900 dark:text-white">{app.name}</div>
                            {(app.isLowAttendance || (app.attendancePercentage !== undefined && app.attendancePercentage !== null && Number(app.attendancePercentage) < 75)) && (
                              <div className="inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shadow-sm">
                                <IoAlertCircleOutline className="text-xs text-rose-500" /> LOW ATTENDANCE — {Number(app.attendancePercentage).toFixed(2)}%
                              </div>
                            )}
                          </td>
                          <td className="py-4 px-5 font-mono text-xs font-semibold text-slate-600 dark:text-slate-400">
                            {app.registerNo}
                          </td>
                          <td className="py-4 px-5 text-xs text-slate-600 dark:text-slate-400">
                            {app.department || 'CSE'} ({app.year || '3rd Year'} - {app.section || 'A'})
                          </td>
                          <td className="py-4 px-5 font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                            {formatDDMMYYYY(app.date || app.fromDate)}
                          </td>
                          <td className="py-4 px-5 text-slate-700 dark:text-slate-300 max-w-xs truncate">
                            {app.reason}
                          </td>
                          <td className="py-4 px-5">
                            {getStatusBadge(app.status)}
                          </td>
                          <td className="py-4 px-5 text-right">
                            {isPending ? (
                              <div className="inline-flex items-center gap-2">
                                <button
                                  onClick={() => openRejectModal(app, 'app')}
                                  disabled={processing}
                                  className="px-3 py-1 rounded-lg text-xs font-bold bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40 transition-all disabled:opacity-50"
                                >
                                  REJECT
                                </button>
                                <button
                                  onClick={() => handleApprove(app, 'app')}
                                  disabled={processing}
                                  className="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow transition-all disabled:opacity-50"
                                >
                                  APPROVE
                                </button>
                              </div>
                            ) : String(app.status || '').toUpperCase() === 'CANCELLED' ? (
                              <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold italic">Cancelled by Student</span>
                            ) : (
                              <span className="text-xs text-slate-400 italic">Processed</span>
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

        {/* MODAL: REJECTION REASON */}
        {rejectModalOpen && selectedItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Reject Leave Request</h3>
                <button
                  onClick={() => setRejectModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleRejectSubmit} className="space-y-4 mt-4 text-left">
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Rejecting request for <span className="font-bold text-slate-800 dark:text-white">{selectedItem.name}</span> ({selectedItem.registerNo})
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-2">
                    Rejection Reason
                  </label>
                  <textarea
                    required
                    rows="3"
                    placeholder="Enter explicit reason for rejecting this leave request..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setRejectModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={processing}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/30 transition-all disabled:opacity-50"
                  >
                    {processing ? 'Processing...' : 'Confirm Rejection'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
