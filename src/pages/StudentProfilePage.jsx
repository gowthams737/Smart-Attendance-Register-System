import React, { useState, useEffect } from 'react';
import StudentLayout from '../layouts/StudentLayout';
import { apiService } from '../services/api';
import { useToast } from '../context/ToastContext';
import { formatStudentDate } from '../utils/dateUtils';
import {
  IoPersonOutline, IoSchoolOutline, IoKeyOutline,
  IoEyeOutline, IoEyeOffOutline, IoCheckmarkCircleOutline
} from 'react-icons/io5';

export default function StudentProfilePage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  // Change Password state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const data = await apiService.getStudentMe();
        setProfile(data);
      } catch (err) {
        console.error('Failed to load profile:', err);
        showToast('Error loading profile details', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [showToast]);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!oldPassword) {
      showToast('Please enter your current password.', 'error');
      return;
    }
    if (!newPassword) {
      showToast('Please enter your new password.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('New password and confirm password do not match.', 'error');
      return;
    }
    if (newPassword.length < 3) {
      showToast('New password must be at least 3 characters long.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiService.changeStudentPassword(oldPassword, newPassword, confirmPassword);
      showToast(res.message || 'Password changed successfully!', 'success');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      console.error('Password change error:', err);
      showToast(err.message || 'Failed to change password. Please check your current password.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <StudentLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400 font-medium">Loading Profile Details...</p>
        </div>
      </StudentLayout>
    );
  }

  return (
    <StudentLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-heading text-slate-900 dark:text-white">
            My Profile & Security
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            View registered student details and manage your portal password
          </p>
        </div>

        {/* Profile Card Header */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 sm:p-8 flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <img
            src={apiService.getAssetUrl(profile?.avatar) || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150"}
            alt={profile?.name}
            className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl object-cover border-4 border-indigo-500/20 shadow-md"
          />

          <div className="flex-1 text-center sm:text-left space-y-3">
            <div>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {profile?.name}
                </h2>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  Registered Student
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 mt-1.5 font-mono text-sm">
                <p className="text-slate-500 dark:text-slate-400">
                  Register No: <span className="font-bold text-indigo-600 dark:text-indigo-400">{profile?.registerNo}</span>
                </p>
                <p className="text-slate-500 dark:text-slate-400">
                  Roll No: <span className="font-bold text-indigo-600 dark:text-indigo-400">{profile?.rollNo || '23'}</span>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <span className="bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                {profile?.department}
              </span>
              <span className="bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                {profile?.year}
              </span>
              <span className="bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                Class / Section: {profile?.section}
              </span>
            </div>
          </div>
        </div>

        {/* Detailed Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Academic Details Card */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
              <IoSchoolOutline className="text-xl text-indigo-500" />
              <span>Academic Details</span>
            </h3>

            <div className="space-y-3.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Department</span>
                <span className="font-semibold text-slate-900 dark:text-white">{profile?.department}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Year of Study</span>
                <span className="font-semibold text-slate-900 dark:text-white">{profile?.year}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Section</span>
                <span className="font-semibold text-slate-900 dark:text-white">Section {profile?.section}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Register Number</span>
                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{profile?.registerNo}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Roll No</span>
                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{profile?.rollNo || '23'}</span>
              </div>
            </div>
          </div>

          {/* Contact Details Card */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
              <IoPersonOutline className="text-xl text-indigo-500" />
              <span>Personal & Contact Info</span>
            </h3>

            <div className="space-y-3.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Email Address</span>
                <span className="font-semibold text-slate-900 dark:text-white">{profile?.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Phone Number</span>
                <span className="font-semibold text-slate-900 dark:text-white">{profile?.phone}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Gender</span>
                <span className="font-semibold text-slate-900 dark:text-white">{profile?.gender || 'Not Specified'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Registration Date</span>
                <span className="font-semibold text-slate-900 dark:text-white">{formatStudentDate(profile?.createdDate)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Change Password Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 sm:p-8 space-y-5">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <IoKeyOutline className="text-xl text-indigo-500" />
              <span>Change Password</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Update your account password. Default password is your registered <strong>Roll No</strong>.
            </p>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4 max-w-xl">
            {/* Current Password */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1.5 tracking-wider">
                Current Password
              </label>
              <div className="relative">
                <input
                  type={showOld ? 'text' : 'password'}
                  required
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter current password (Roll No by default)"
                />
                <button
                  type="button"
                  onClick={() => setShowOld(!showOld)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showOld ? <IoEyeOffOutline /> : <IoEyeOutline />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1.5 tracking-wider">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter new password"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showNew ? <IoEyeOffOutline /> : <IoEyeOutline />}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1.5 tracking-wider">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Confirm new password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showConfirm ? <IoEyeOffOutline /> : <IoEyeOutline />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white shadow-lg shadow-indigo-600/25 transition-all flex items-center gap-2"
              >
                {submitting ? 'Updating Password...' : 'Change Password'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </StudentLayout>
  );
}
