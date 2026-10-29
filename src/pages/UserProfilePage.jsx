import React, { useState, useEffect } from 'react';
import DashboardLayout from '../layouts/DashboardLayout';
import { IoMailOutline, IoCallOutline, IoShieldOutline, IoLockClosedOutline, IoPersonOutline, IoCloseOutline } from 'react-icons/io5';
import { apiService } from '../services/api';

export default function UserProfilePage() {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [profile, setProfile] = useState({
    name: 'Prof. Anand Narayanan',
    email: 'admin@smartattend.edu',
    phone: '+91 99999 99999',
    title: 'Dean of Technology',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=180'
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const prof = await apiService.getProfile();
        if (prof && prof.email) {
          setProfile({
            ...prof,
            avatar: prof.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=180'
          });
        }
      } catch (err) {
        console.error('Failed to fetch profile', err);
      }
    };
    fetchProfile();
  }, []);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (uploadEvent) => {
      const base64Data = uploadEvent.target.result;
      const updatedProfile = { ...profile, avatar: base64Data };
      setProfile(updatedProfile);

      try {
        await apiService.updateProfile(updatedProfile);
        const sessionString = localStorage.getItem('adminSession');
        if (sessionString) {
          const session = JSON.parse(sessionString);
          session.avatar = base64Data;
          localStorage.setItem('adminSession', JSON.stringify(session));
        }
        window.dispatchEvent(new CustomEvent('admin-profile-updated', { detail: updatedProfile }));
      } catch (err) {
        console.error('Failed to save profile picture:', err);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 text-left">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white font-heading tracking-tight">Admin Profile</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage official credentials and profile credentials metadata.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main User Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm text-center flex flex-col items-center justify-center">
            <div className="relative group cursor-pointer" onClick={() => setIsPreviewOpen(true)}>
              <img
                src={apiService.getAssetUrl(profile.avatar)}
                onError={(e) => apiService.handleImageError(e, profile.name)}
                alt="Administrator Avatar"
                className="w-24 h-24 rounded-full object-cover border-4 border-slate-50 dark:border-slate-850 shadow-md transition-opacity hover:opacity-90"
              />
            </div>
            <label className="mt-3 cursor-pointer text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-350 transition-colors">
              Change Photo
              <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
            </label>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-4 font-heading">{profile.name}</h3>
            <p className="text-xs font-semibold text-indigo-655 dark:text-indigo-400 mt-0.5 uppercase tracking-wide">{profile.title}</p>
          </div>

          {/* Lightbox Preview Modal */}
          {isPreviewOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" onClick={() => setIsPreviewOpen(false)}>
              <div className="relative max-w-4xl max-h-[90vh] bg-transparent p-2 flex flex-col items-center justify-center animate-fade-in" onClick={(e) => e.stopPropagation()}>
                <button 
                  onClick={() => setIsPreviewOpen(false)} 
                  className="absolute -top-12 right-0 text-white hover:text-slate-250 bg-slate-900/60 p-2 rounded-full transition-colors text-2xl"
                >
                  <IoCloseOutline />
                </button>
                <img
                  src={apiService.getAssetUrl(profile.avatar)}
                  onError={(e) => apiService.handleImageError(e, profile.name)}
                  alt="Full Size Administrator Avatar"
                  className="max-h-[80vh] max-w-[85vw] object-contain rounded-xl border border-slate-800 shadow-2xl bg-slate-900"
                />
              </div>
            </div>
          )}

          {/* User Details */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 rounded-2xl shadow-sm space-y-6">
            <h4 className="text-base font-bold text-slate-900 dark:text-white font-heading">Account Specifications</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 text-lg">
                  <IoPersonOutline />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Official Name</span>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{profile.name}</span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 text-lg">
                  <IoMailOutline />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Email Address</span>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{profile.email}</span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 text-lg">
                  <IoCallOutline />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Campus Extension</span>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{profile.phone}</span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 text-lg">
                  <IoShieldOutline />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Role Authorization</span>
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full inline-block mt-0.5">Super Admin</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
