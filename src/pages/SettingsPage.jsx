import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import {
  IoPersonCircleOutline, IoKeyOutline, IoNotificationsOutline,
  IoSettingsOutline, IoLockClosedOutline, IoSunny, IoMoon,
  IoShieldCheckmarkOutline, IoPersonAddOutline, IoTrashOutline,
  IoAlertCircleOutline, IoCheckmarkCircleOutline, IoIdCardOutline
} from 'react-icons/io5';
import { apiService } from '../services/api';

const YEAR_CLASS_MAP = {
  '1st Year': ['CSE A', 'CSE B', 'CSE C', 'CSE D', 'CSE E'],
  '2nd Year': ['CSE A', 'CSE B', 'CSE C', 'CSE D', 'CSE E'],
  '3rd Year': ['CSE A', 'CSE B', 'CSE C', 'CSE D'],
  '4th Year': ['CSE A', 'CSE B', 'CSE C']
};

export default function SettingsPage() {
  const { showToast } = useToast();
  const { theme, setTheme } = useTheme();
  const location = useLocation();

  // Active Settings Tab
  const [activeTab, setActiveTab] = useState('admin_management');

  useEffect(() => {
    if (location.state && location.state.activeTab) {
      setActiveTab(location.state.activeTab);
    }
  }, [location.state]);

  // Profile Form state
  const [profile, setProfile] = useState({
    name: 'Admin User',
    email: 'admin@example.com',
    phone: '+91 99999 99999',
    title: 'Administrator',
    avatar: ''
  });

  // Password state
  const [pwd, setPwd] = useState({ old: '', new: '', confirm: '' });

  // Notifications state
  const [notifOpts, setNotifOpts] = useState({
    emailSummary: true,
    lowAttendanceAlerts: true,
    cameraDisconnects: true,
    studentEnrollments: false
  });

  // System state
  const [sysOpts, setSysOpts] = useState({
    autoBackup: true,
    backupInterval: 'weekly',
    faceDetectionThreshold: '0.85',
    storageMaxDays: '90'
  });

  // Admin Management State
  const [adminsList, setAdminsList] = useState([]);
  const [isCallerHod, setIsCallerHod] = useState(true);
  const [loadingAdmins, setLoadingAdmins] = useState(false);

  // Add Admin Form State
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newAdminRole, setNewAdminRole] = useState('Class Advisor');
  const [newAdminYear, setNewAdminYear] = useState('1st Year');
  const [newAdminSection, setNewAdminSection] = useState('CSE A');
  const [newAdminRoll, setNewAdminRoll] = useState('Class Advisor - 1st Year CSE A');
  const [adminFormError, setAdminFormError] = useState('');
  const [adminFormSuccess, setAdminFormSuccess] = useState('');
  const [submittingAdmin, setSubmittingAdmin] = useState(false);

  const fetchAdmins = async () => {
    setLoadingAdmins(true);
    try {
      const res = await apiService.getAdmins();
      if (res && res.admins) {
        setAdminsList(res.admins);
        setIsCallerHod(res.isCallerHod !== false);
      }
    } catch (err) {
      console.error('Failed to fetch admin list:', err);
    } finally {
      setLoadingAdmins(false);
    }
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await apiService.getSettings();
        if (res) {
          setSysOpts(prev => ({
            ...prev,
            backupInterval: res.backupInterval ? res.backupInterval.toLowerCase() : 'weekly',
            autoBackup: res.backupInterval !== 'None'
          }));
          setNotifOpts(prev => ({
            ...prev,
            lowAttendanceAlerts: res.enableNotifications
          }));
        }

        const prof = await apiService.getProfile();
        if (prof && prof.email) {
          setProfile(prof);
        }
      } catch (err) {
        console.error('Failed to fetch settings', err);
      }
    };
    fetchSettings();
    fetchAdmins();
  }, []);

  const handleYearChange = (year) => {
    setNewAdminYear(year);
    const availableClasses = YEAR_CLASS_MAP[year] || ['CSE A'];
    const defaultSec = availableClasses[0];
    setNewAdminSection(defaultSec);
    if (newAdminRole === 'Class Advisor' || newAdminRole === 'Class Teacher') {
      setNewAdminRoll(`Class Advisor - ${year} ${defaultSec}`);
    }
  };

  const handleSectionChange = (sec) => {
    setNewAdminSection(sec);
    if (newAdminRole === 'Class Advisor' || newAdminRole === 'Class Teacher') {
      setNewAdminRoll(`Class Advisor - ${newAdminYear} ${sec}`);
    }
  };

  const handleRoleChange = (role) => {
    setNewAdminRole(role);
    if (role === 'Class Advisor' || role === 'Class Teacher') {
      setNewAdminRoll(`Class Advisor - ${newAdminYear} ${newAdminSection}`);
    } else {
      setNewAdminRoll('Head of Department (HOD)');
    }
  };

  const handleAddAdminSubmit = async (e) => {
    e.preventDefault();
    setAdminFormError('');
    setAdminFormSuccess('');

    if (!newAdminEmail.trim()) {
      setAdminFormError('Admin Email is required.');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(newAdminEmail.trim())) {
      setAdminFormError('Please enter a valid email address.');
      return;
    }
    if (!newAdminPassword) {
      setAdminFormError('Password is required.');
      return;
    }
    if (newAdminPassword.length < 4) {
      setAdminFormError('Password must be at least 4 characters long.');
      return;
    }

    const isAdvisor = newAdminRole === 'Class Advisor' || newAdminRole === 'Class Teacher';
    if (isAdvisor) {
      if (!newAdminYear) {
        setAdminFormError('Year is required for Class Advisor.');
        return;
      }
      if (!newAdminSection) {
        setAdminFormError('Class / Section is required for Class Advisor.');
        return;
      }
      const allowed = YEAR_CLASS_MAP[newAdminYear] || [];
      if (!allowed.includes(newAdminSection)) {
        setAdminFormError(`Invalid Class selection for ${newAdminYear}. Valid options: ${allowed.join(', ')}.`);
        return;
      }
    }

    setSubmittingAdmin(true);
    try {
      const payload = {
        email: newAdminEmail.trim(),
        password: newAdminPassword,
        role: isAdvisor ? 'Class Teacher' : newAdminRole,
        year: isAdvisor ? newAdminYear : null,
        section: isAdvisor ? newAdminSection : null,
        roll: newAdminRoll,
        name: isAdvisor ? `Class Advisor (${newAdminYear} - ${newAdminSection})` : 'Main Admin / HOD'
      };

      const res = await apiService.addAdmin(payload);
      showToast(res.message || 'New Admin account created successfully!', 'success');
      setAdminFormSuccess(res.message || 'Admin account created successfully!');
      
      // Reset Form
      setNewAdminEmail('');
      setNewAdminPassword('');
      setNewAdminRole('Class Advisor');
      setNewAdminYear('1st Year');
      setNewAdminSection('CSE A');
      setNewAdminRoll('Class Advisor - 1st Year CSE A');

      // Refresh admin list
      await fetchAdmins();
    } catch (err) {
      const msg = err.message || 'Failed to create admin account.';
      setAdminFormError(msg);
      showToast(msg, 'error');
    } finally {
      setSubmittingAdmin(false);
    }
  };

  const handleDeleteAdmin = async (adminId, email) => {
    if (!window.confirm(`Are you sure you want to remove Class Advisor admin account '${email}'?`)) {
      return;
    }
    try {
      const res = await apiService.deleteAdmin(adminId);
      showToast(res.message || 'Admin account deleted.', 'success');
      await fetchAdmins();
    } catch (err) {
      showToast(err.message || 'Failed to delete admin account', 'error');
    }
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();
    try {
      await apiService.updateProfile(profile);
      showToast('Admin profile details updated successfully.', 'success');
      const sessionString = localStorage.getItem('adminSession');
      if (sessionString) {
        const session = JSON.parse(sessionString);
        session.name = profile.name;
        session.email = profile.email;
        session.avatar = profile.avatar;
        localStorage.setItem('adminSession', JSON.stringify(session));
      }
      window.dispatchEvent(new CustomEvent('admin-profile-updated', { detail: profile }));
    } catch (err) {
      showToast(err.message || 'Failed to update admin profile', 'error');
    }
  };

  const handlePwdSave = async (e) => {
    e.preventDefault();
    if (!pwd.old || !pwd.new || !pwd.confirm) {
      showToast('All password fields are required.', 'error');
      return;
    }
    if (pwd.new !== pwd.confirm) {
      showToast('New passwords do not match.', 'error');
      return;
    }
    if (pwd.new.length < 6) {
      showToast('Password must be at least 6 characters.', 'error');
      return;
    }
    try {
      await apiService.changePassword({ oldPassword: pwd.old, newPassword: pwd.new });
      showToast('Admin password changed successfully.', 'success');
      setPwd({ old: '', new: '', confirm: '' });
    } catch (err) {
      showToast(err.message || 'Failed to change password', 'error');
    }
  };

  const handleNotifSave = () => {
    showToast('Notification preferences updated.', 'success');
  };

  const handleSysSave = async () => {
    try {
      await apiService.updateSettings({
        systemName: "Smart Attendance Register",
        academicYear: "2026-2027",
        attendanceThreshold: 75.0,
        backupInterval: sysOpts.backupInterval.charAt(0).toUpperCase() + sysOpts.backupInterval.slice(1),
        enableNotifications: notifOpts.lowAttendanceAlerts,
        cameraResolution: "1080p"
      });
      showToast('System preferences configuration saved.', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to save settings', 'error');
    }
  };

  const tabItems = [
    { id: 'admin_management', name: 'Admin Management', icon: IoShieldCheckmarkOutline },
    { id: 'profile', name: 'Profile Settings', icon: IoPersonCircleOutline },
    { id: 'password', name: 'Security & Password', icon: IoKeyOutline },
    { id: 'notifications', name: 'Notification Preferences', icon: IoNotificationsOutline },
    { id: 'system', name: 'System Configuration', icon: IoSettingsOutline },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 text-left">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white font-heading tracking-tight">System Settings & Management</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage Class Advisor accounts, system configurations, and security credentials.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* Tab Selection Sidebar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm flex flex-col gap-1">
            {tabItems.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                    activeTab === tab.id
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                      : 'text-slate-600 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-850'
                  }`}
                >
                  <Icon className="text-lg shrink-0" />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </div>

          {/* Settings Panel Content */}
          <div className="lg:col-span-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 rounded-2xl shadow-sm">
            {/* ADMIN MANAGEMENT TAB */}
            {activeTab === 'admin_management' && (
              <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white font-heading flex items-center gap-2">
                    <IoShieldCheckmarkOutline className="text-indigo-600 text-xl" />
                    <span>Admin Management & Class Advisor Assignments</span>
                  </h3>
                  <p className="text-slate-400 text-xs mt-1">
                    Main Admin (HOD) can add and manage multiple Class Advisor administrator accounts with specific Year & Class assignments.
                  </p>
                </div>

                {/* ADD ADMIN FORM */}
                <form onSubmit={handleAddAdminSubmit} className="p-6 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                      <IoPersonAddOutline className="text-indigo-500 text-base" />
                      <span>Add New Admin / Class Advisor</span>
                    </h4>
                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950 px-2.5 py-1 rounded-full uppercase tracking-wider">
                      HOD Access Only
                    </span>
                  </div>

                  {adminFormError && (
                    <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-start gap-2.5">
                      <IoAlertCircleOutline className="text-base text-rose-500 shrink-0 mt-0.5" />
                      <span>{adminFormError}</span>
                    </div>
                  )}

                  {adminFormSuccess && (
                    <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-start gap-2.5">
                      <IoCheckmarkCircleOutline className="text-base text-emerald-500 shrink-0 mt-0.5" />
                      <span>{adminFormSuccess}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* 1. Admin Email */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1.5">
                        Admin Email <span className="text-rose-500">*</span>
                      </label>
                      <input
                        required
                        type="email"
                        value={newAdminEmail}
                        onChange={(e) => { setNewAdminEmail(e.target.value); setAdminFormError(''); }}
                        className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>

                    {/* 2. Password */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1.5">
                        Password <span className="text-rose-500">*</span>
                      </label>
                      <input
                        required
                        type="password"
                        value={newAdminPassword}
                        onChange={(e) => { setNewAdminPassword(e.target.value); setAdminFormError(''); }}
                        className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>

                    {/* 3. Role */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1.5">
                        Admin Role <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={newAdminRole}
                        onChange={(e) => handleRoleChange(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
                      >
                        <option value="Class Advisor">Class Advisor</option>
                        <option value="Main Admin / HOD">Main Admin / HOD</option>
                      </select>
                    </div>

                    {/* 4. Year (Shown when Role = Class Advisor) */}
                    {(newAdminRole === 'Class Advisor' || newAdminRole === 'Class Teacher') && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1.5">
                          Year Assignment <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={newAdminYear}
                          onChange={(e) => handleYearChange(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
                        >
                          <option value="1st Year">1st Year</option>
                          <option value="2nd Year">2nd Year</option>
                          <option value="3rd Year">3rd Year</option>
                          <option value="4th Year">4th Year</option>
                        </select>
                      </div>
                    )}

                    {/* 5. Class / Section (Shown when Role = Class Advisor) */}
                    {(newAdminRole === 'Class Advisor' || newAdminRole === 'Class Teacher') && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1.5">
                          Class / Section <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={newAdminSection}
                          onChange={(e) => handleSectionChange(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
                        >
                          {(YEAR_CLASS_MAP[newAdminYear] || []).map((cls) => (
                            <option key={cls} value={cls}>{cls}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* 6. Roll / Responsibility Title */}
                    <div className={(newAdminRole === 'Class Advisor' || newAdminRole === 'Class Teacher') ? 'sm:col-span-2' : ''}>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1.5">
                        Roll / Responsibility Assignment
                      </label>
                      <input
                        type="text"
                        value={newAdminRoll}
                        onChange={(e) => setNewAdminRoll(e.target.value)}
                        placeholder="Class Advisor - 3rd Year CSE B"
                        className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submittingAdmin}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors shadow-md shadow-indigo-600/20 flex items-center gap-2"
                  >
                    <IoPersonAddOutline className="text-lg" />
                    <span>{submittingAdmin ? 'Creating Admin...' : 'Save & Assign Admin'}</span>
                  </button>
                </form>

                {/* REGISTERED ADMINS LIST TABLE */}
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center justify-between">
                    <span>Registered Administrator Accounts ({adminsList.length})</span>
                    <button
                      onClick={fetchAdmins}
                      className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      Refresh List
                    </button>
                  </h4>

                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            <th className="py-3.5 px-4">Admin Credentials</th>
                            <th className="py-3.5 px-4">Role</th>
                            <th className="py-3.5 px-4">Assigned Year</th>
                            <th className="py-3.5 px-4">Class / Section</th>
                            <th className="py-3.5 px-4">Responsibility Roll</th>
                            <th className="py-3.5 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                          {loadingAdmins ? (
                            <tr>
                              <td colSpan={6} className="py-8 text-center text-slate-400">
                                Loading admin list...
                              </td>
                            </tr>
                          ) : adminsList.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-8 text-center text-slate-400">
                                No admin accounts found.
                              </td>
                            </tr>
                          ) : (
                            adminsList.map((adm) => (
                              <tr key={adm.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50 transition-colors">
                                <td className="py-3.5 px-4">
                                  <div className="font-bold text-slate-800 dark:text-slate-200">{adm.email}</div>
                                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">{adm.name}</div>
                                </td>
                                <td className="py-3.5 px-4">
                                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide inline-block ${
                                    adm.isMainAdmin
                                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                                      : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                                  }`}>
                                    {adm.roleDisplay === 'Class Teacher' ? 'Class Advisor' : (adm.roleDisplay || (adm.isMainAdmin ? 'Main Admin / HOD' : 'Class Advisor'))}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 font-semibold text-slate-700 dark:text-slate-300">
                                  {adm.year || 'N/A'}
                                </td>
                                <td className="py-3.5 px-4 font-semibold text-slate-700 dark:text-slate-300">
                                  {adm.section || adm.class || 'N/A'}
                                </td>
                                <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 font-medium">
                                  {adm.roll || 'N/A'}
                                </td>
                                <td className="py-3.5 px-4 text-right">
                                  {adm.isMainAdmin ? (
                                    <span className="text-[10px] font-bold text-slate-400 italic">Primary HOD</span>
                                  ) : (
                                    <button
                                      onClick={() => handleDeleteAdmin(adm.id, adm.email)}
                                      className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors"
                                      title="Remove Admin"
                                    >
                                      <IoTrashOutline className="text-base" />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* PROFILE TAB */}
            {activeTab === 'profile' && (
              <form onSubmit={handleProfileSave} className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white font-heading">Personal Information</h3>
                  <p className="text-slate-400 text-xs mt-1">Update your name, email ID, and title display configurations.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Full Name</label>
                    <input
                      required
                      type="text"
                      value={profile.name}
                      onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-sm focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Official Title</label>
                    <input
                      type="text"
                      value={profile.title}
                      onChange={(e) => setProfile({ ...profile, title: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-sm focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Email Address</label>
                    <input
                      required
                      type="email"
                      value={profile.email}
                      onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-sm focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Phone Number</label>
                    <input
                      type="text"
                      value={profile.phone}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-sm focus:outline-none"
                    />
                  </div>
                </div>
                <button type="submit" className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-colors">
                  Save Changes
                </button>
              </form>
            )}

            {/* PASSWORD TAB */}
            {activeTab === 'password' && (
              <form onSubmit={handlePwdSave} className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white font-heading">Security Credentials</h3>
                  <p className="text-slate-400 text-xs mt-1">Alter current login password parameters. Ensure passwords contain alphanumeric values.</p>
                </div>
                <div className="space-y-4 max-w-md">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Current Password</label>
                    <input
                      required
                      type="password"
                      value={pwd.old}
                      onChange={(e) => setPwd({ ...pwd, old: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-855 rounded-xl text-sm focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">New Password</label>
                    <input
                      required
                      type="password"
                      value={pwd.new}
                      onChange={(e) => setPwd({ ...pwd, new: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-855 rounded-xl text-sm focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Confirm New Password</label>
                    <input
                      required
                      type="password"
                      value={pwd.confirm}
                      onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-855 rounded-xl text-sm focus:outline-none"
                    />
                  </div>
                </div>
                <button type="submit" className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-colors">
                  Change Password
                </button>
              </form>
            )}

            {/* NOTIFICATION TAB */}
            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white font-heading">Notification Scripts</h3>
                  <p className="text-slate-400 text-xs mt-1">Control automated notification triggers sent to admin panels and registered emails.</p>
                </div>
                <div className="space-y-4 max-w-lg">
                  <div className="flex items-center justify-between p-3.5 border border-slate-100 dark:border-slate-850 rounded-xl hover:bg-slate-50/50 dark:hover:bg-slate-850/10">
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-white">Email Attendance Summary</p>
                      <p className="text-xs text-slate-450 dark:text-slate-500 mt-0.5">Receive daily status logs in admin mailbox.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifOpts.emailSummary}
                      onChange={(e) => setNotifOpts({ ...notifOpts, emailSummary: e.target.checked })}
                      className="w-4.5 h-4.5 rounded text-indigo-650"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3.5 border border-slate-100 dark:border-slate-850 rounded-xl hover:bg-slate-50/50 dark:hover:bg-slate-850/10">
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-white">Low Attendance Alerts</p>
                      <p className="text-xs text-slate-455 dark:text-slate-500 mt-0.5">Notify instantly when students dip below 75% rate threshold.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifOpts.lowAttendanceAlerts}
                      onChange={(e) => setNotifOpts({ ...notifOpts, lowAttendanceAlerts: e.target.checked })}
                      className="w-4.5 h-4.5 rounded text-indigo-650"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3.5 border border-slate-100 dark:border-slate-850 rounded-xl hover:bg-slate-50/50 dark:hover:bg-slate-850/10">
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-white">Scanner Connection Alerts</p>
                      <p className="text-xs text-slate-450 dark:text-slate-500 mt-0.5">Alert admins when live scanner connection drops.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifOpts.cameraDisconnects}
                      onChange={(e) => setNotifOpts({ ...notifOpts, cameraDisconnects: e.target.checked })}
                      className="w-4.5 h-4.5 rounded text-indigo-650"
                    />
                  </div>
                </div>
                <button onClick={handleNotifSave} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-colors">
                  Save Preferences
                </button>
              </div>
            )}

            {/* SYSTEM CONFIG TAB */}
            {activeTab === 'system' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white font-heading">Model Configuration</h3>
                  <p className="text-slate-450 text-xs mt-1">Calibrate computer vision hardware detection thresholds and retention details.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Face Confidence Threshold</label>
                    <select
                      value={sysOpts.faceDetectionThreshold}
                      onChange={(e) => setSysOpts({ ...sysOpts, faceDetectionThreshold: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-202 dark:border-slate-850 rounded-xl text-sm focus:outline-none"
                    >
                      <option value="0.95">0.95 - Strict (Fewer false positives)</option>
                      <option value="0.85">0.85 - Recommended</option>
                      <option value="0.75">0.75 - Relaxed (Low lighting optimization)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Database Automated Backups</label>
                    <select
                      value={sysOpts.backupInterval}
                      onChange={(e) => setSysOpts({ ...sysOpts, backupInterval: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-202 dark:border-slate-850 rounded-xl text-sm focus:outline-none"
                    >
                      <option value="daily">Every Day</option>
                      <option value="weekly">Every Week</option>
                      <option value="monthly">Every Month</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Log Retention Span</label>
                    <select
                      value={sysOpts.storageMaxDays}
                      onChange={(e) => setSysOpts({ ...sysOpts, storageMaxDays: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-202 dark:border-slate-850 rounded-xl text-sm focus:outline-none"
                    >
                      <option value="30">30 Days</option>
                      <option value="90">90 Days (Recommended)</option>
                      <option value="365">365 Days (Full term logs)</option>
                    </select>
                  </div>
                </div>
                <button onClick={handleSysSave} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-colors">
                  Apply Configurations
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
