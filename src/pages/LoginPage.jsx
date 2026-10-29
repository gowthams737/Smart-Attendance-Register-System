import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import AuthLayout from '../layouts/AuthLayout';
import { IoMailOutline, IoLockClosedOutline, IoEyeOutline, IoEyeOffOutline, IoIdCardOutline, IoShieldCheckmarkOutline, IoAlertCircleOutline, IoSchoolOutline, IoPersonOutline } from 'react-icons/io5';
import { apiService } from '../services/api';

export default function LoginPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  // Role Tab State: 'student' or 'admin'
  const [activeTab, setActiveTab] = useState('student');
  // Admin Role Sub-State: 'main_admin' or 'class_advisor'
  const [adminRole, setAdminRole] = useState('main_admin');

  // Form Fields
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const [registerNo, setRegisterNo] = useState('');
  const [studentPassword, setStudentPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [authError, setAuthError] = useState('');

  const validate = () => {
    const tempErrors = {};
    if (activeTab === 'admin') {
      if (!adminEmail.trim()) {
        tempErrors.adminEmail = 'Email is required';
      } else if (!/\S+@\S+\.\S+/.test(adminEmail.trim())) {
        tempErrors.adminEmail = 'Valid email is required';
      }
      if (!adminPassword) {
        tempErrors.adminPassword = 'Password is required';
      }
    } else {
      if (!registerNo.trim()) {
        tempErrors.registerNo = 'Reg No is required';
      }
      if (!studentPassword) {
        tempErrors.studentPassword = 'Password is required';
      }
    }
    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    if (!validate()) return;

    setLoading(true);
    setAuthError('');

    try {
      if (activeTab === 'admin') {
        const res = await apiService.login(adminEmail.trim(), adminPassword);
        const isHod = res.user.is_hod === true || res.user.role === 'admin';

        if (adminRole === 'main_admin') {
          if (!isHod) {
            throw new Error('This account is registered as a Class Advisor. Please select "Class Advisor" to log in.');
          }
          localStorage.removeItem('studentSession');
          localStorage.setItem('adminSession', JSON.stringify({
            email: res.user.email,
            name: res.user.name,
            role: res.user.role,
            is_hod: true,
            avatar: res.user.avatar,
            year: res.user.year,
            class: res.user.class,
            section: res.user.section,
            token: res.user.token
          }));
          showToast(`Welcome back, ${res.user.name} (HOD)!`, 'success');
          navigate('/admin');
        } else {
          if (isHod) {
            throw new Error('This account is registered as HOD. Please select "HOD" to log in.');
          }
          localStorage.removeItem('studentSession');
          localStorage.setItem('adminSession', JSON.stringify({
            email: res.user.email,
            name: res.user.name,
            role: 'class_teacher',
            is_hod: false,
            avatar: res.user.avatar,
            year: res.user.year,
            class: res.user.class,
            section: res.user.section,
            token: res.user.token
          }));
          showToast(`Welcome back, ${res.user.name} (Class Advisor)!`, 'success');
          navigate('/advisor');
        }
      } else {
        const res = await apiService.login(registerNo.trim(), studentPassword);
        if (res.user.role !== 'student') {
          throw new Error('Access denied. Only registered student accounts can log in here.');
        }
        localStorage.removeItem('adminSession');
        localStorage.setItem('studentSession', JSON.stringify({
          registerNo: res.user.registerNo,
          name: res.user.name,
          role: res.user.role,
          avatar: res.user.avatar,
          department: res.user.department,
          year: res.user.year,
          section: res.user.section,
          token: res.user.token
        }));
        showToast(`Welcome back, ${res.user.name}!`, 'success');
        navigate('/student');
      }
    } catch (err) {
      console.error('Login submit error:', err);
      setAuthError(err.message || 'Authentication failed. Please verify your credentials.');
      showToast(err.message || 'Login failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getSubtitle = () => {
    if (activeTab === 'student') return 'Sign in to your student portal';
    return adminRole === 'main_admin' 
      ? 'Sign in to HOD Portal' 
      : 'Sign in to Class Advisor Portal';
  };

  return (
    <AuthLayout
      title="Smart Attendance System"
      subtitle={getSubtitle()}
    >
      {/* Primary Role Tabs */}
      <div className="flex bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl mb-4 border border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => { setActiveTab('student'); setErrors({}); setAuthError(''); }}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'student'
              ? 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <IoIdCardOutline className="text-base" />
          <span>Student Portal</span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('admin'); setErrors({}); setAuthError(''); }}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'admin'
              ? 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <IoShieldCheckmarkOutline className="text-base" />
          <span>Admin Portal</span>
        </button>
      </div>

      {/* Admin Role Selection Screen when Admin Portal active */}
      {activeTab === 'admin' && (
        <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/40 rounded-2xl mb-5 border border-indigo-100 dark:border-indigo-900/50">
          <p className="text-[11px] font-bold text-indigo-900 dark:text-indigo-200 uppercase tracking-wider mb-2 text-center">
            Select Admin Role
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => { setAdminRole('main_admin'); setAuthError(''); }}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border ${
                adminRole === 'main_admin'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
              }`}
            >
              <IoShieldCheckmarkOutline className="text-sm" />
              <span>HOD</span>
            </button>

            <button
              type="button"
              onClick={() => { setAdminRole('class_advisor'); setAuthError(''); }}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border ${
                adminRole === 'class_advisor'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
              }`}
            >
              <IoSchoolOutline className="text-sm" />
              <span>Class Advisor</span>
            </button>
          </div>
        </div>
      )}

      {authError && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-start gap-2.5 animate-in fade-in duration-150 mb-5" id="login-error-message">
          <IoAlertCircleOutline className="text-base text-rose-500 shrink-0 mt-0.5" />
          <span>{authError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {activeTab === 'admin' ? (
          /* ==================== ADMIN / STAFF LOGIN FIELDS ==================== */
          <>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5 tracking-wider">
                {adminRole === 'main_admin' ? 'HOD Email' : 'Class Advisor Email'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <IoMailOutline className="text-lg" />
                </div>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => { setAdminEmail(e.target.value); if (authError) setAuthError(''); }}
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl border bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/25 transition-all text-sm ${
                    errors.adminEmail ? 'border-rose-500 ring-2 ring-rose-500/10' : 'border-slate-200 dark:border-slate-800'
                  }`}
                  placeholder=""
                />
              </div>
              {errors.adminEmail && <p className="text-xs text-rose-500 mt-1">{errors.adminEmail}</p>}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5 tracking-wider">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <IoLockClosedOutline className="text-lg" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={adminPassword}
                  onChange={(e) => { setAdminPassword(e.target.value); if (authError) setAuthError(''); }}
                  className={`w-full pl-10 pr-10 py-2.5 rounded-xl border bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/25 transition-all text-sm ${
                    errors.adminPassword ? 'border-rose-500 ring-2 ring-rose-500/10' : 'border-slate-200 dark:border-slate-800'
                  }`}
                  placeholder=""
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPassword ? <IoEyeOffOutline className="text-lg" /> : <IoEyeOutline className="text-lg" />}
                </button>
              </div>
              {errors.adminPassword && <p className="text-xs text-rose-500 mt-1">{errors.adminPassword}</p>}
            </div>
          </>
        ) : (
          /* ==================== STUDENT LOGIN FIELDS ==================== */
          <>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5 tracking-wider">
                Register Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <IoIdCardOutline className="text-lg" />
                </div>
                <input
                  type="text"
                  value={registerNo}
                  onChange={(e) => { setRegisterNo(e.target.value); if (authError) setAuthError(''); }}
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl border bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/25 transition-all text-sm uppercase ${
                    errors.registerNo ? 'border-rose-500 ring-2 ring-rose-500/10' : 'border-slate-200 dark:border-slate-800'
                  }`}
                  placeholder=""
                />
              </div>
              {errors.registerNo && <p className="text-xs text-rose-500 mt-1">{errors.registerNo}</p>}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5 tracking-wider">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <IoLockClosedOutline className="text-lg" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={studentPassword}
                  onChange={(e) => { setStudentPassword(e.target.value); if (authError) setAuthError(''); }}
                  className={`w-full pl-10 pr-10 py-2.5 rounded-xl border bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/25 transition-all text-sm ${
                    errors.studentPassword ? 'border-rose-500 ring-2 ring-rose-500/10' : 'border-slate-200 dark:border-slate-800'
                  }`}
                  placeholder=""
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPassword ? <IoEyeOffOutline className="text-lg" /> : <IoEyeOutline className="text-lg" />}
                </button>
              </div>
              {errors.studentPassword && <p className="text-xs text-rose-500 mt-1">{errors.studentPassword}</p>}
            </div>
          </>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Verifying Credentials...</span>
            </>
          ) : (
            <span>
              {activeTab === 'student'
                ? 'Sign In to Student Portal'
                : adminRole === 'main_admin'
                ? 'Sign In as HOD'
                : 'Sign In as Class Advisor'}
            </span>
          )}
        </button>
      </form>
    </AuthLayout>
  );
}
