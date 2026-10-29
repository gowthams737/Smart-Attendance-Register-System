import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import AuthLayout from '../layouts/AuthLayout';
import { IoLockClosedOutline, IoEyeOutline, IoEyeOffOutline, IoArrowBackOutline } from 'react-icons/io5';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const temp = {};
    if (!password) {
      temp.password = 'Password is required';
    } else if (password.length < 6) {
      temp.password = 'Password must be at least 6 characters';
    }
    if (!confirmPassword) {
      temp.confirmPassword = 'Confirmation is required';
    } else if (password !== confirmPassword) {
      temp.confirmPassword = 'Passwords do not match';
    }
    setErrors(temp);
    return Object.keys(temp).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      showToast('Password updated successfully. You can now login.', 'success');
      navigate('/login');
    }, 1500);
  };

  return (
    <AuthLayout title="Reset Password" subtitle="Choose a strong password for your account protection">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* New Password */}
        <div>
          <label className="block text-xs font-bold text-slate-450 uppercase mb-1.5 tracking-wider">New Password</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <IoLockClosedOutline className="text-lg" />
            </div>
            <input
              type={showPwd ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full pl-10 pr-10 py-2.5 rounded-xl border bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 transition-all text-sm ${
                errors.password ? 'border-rose-500 ring-2 ring-rose-500/10' : 'border-slate-200 dark:border-slate-800'
              }`}
              placeholder=""
            />
            <button
              type="button"
              onClick={() => setShowPwd(!showPwd)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-650"
            >
              {showPwd ? <IoEyeOffOutline className="text-lg" /> : <IoEyeOutline className="text-lg" />}
            </button>
          </div>
          {errors.password && <p className="text-xs text-rose-500 mt-1 font-semibold">{errors.password}</p>}
        </div>

        {/* Confirm Password */}
        <div>
          <label className="block text-xs font-bold text-slate-450 uppercase mb-1.5 tracking-wider">Confirm New Password</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <IoLockClosedOutline className="text-lg" />
            </div>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`w-full pl-10 pr-4 py-2.5 rounded-xl border bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 transition-all text-sm ${
                errors.confirmPassword ? 'border-rose-500 ring-2 ring-rose-500/10' : 'border-slate-200 dark:border-slate-800'
              }`}
              placeholder=""
            />
          </div>
          {errors.confirmPassword && <p className="text-xs text-rose-500 mt-1 font-semibold">{errors.confirmPassword}</p>}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-650/50 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Updating Password...</span>
            </>
          ) : (
            <span>Update Password</span>
          )}
        </button>

        <div className="text-center mt-4">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-250 transition-colors"
          >
            <IoArrowBackOutline />
            <span>Cancel and Go Back</span>
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}
