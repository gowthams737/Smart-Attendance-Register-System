import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import AuthLayout from '../layouts/AuthLayout';
import { IoMailOutline, IoArrowBackOutline, IoCheckmarkCircleOutline } from 'react-icons/io5';

export default function ForgotPasswordPage() {
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError('Please enter your email address');
      return;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
      showToast('Reset link dispatched to ' + email, 'success');
    }, 1500);
  };

  if (submitted) {
    return (
      <AuthLayout title="Check Your Email" subtitle="We've sent a link to recover your account">
        <div className="text-center py-4">
          <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">
            <IoCheckmarkCircleOutline />
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-350 leading-relaxed mb-6">
            We have sent a password reset link to <strong className="text-slate-905 dark:text-white">{email}</strong>. Please check your inbox and follow instructions.
          </p>
          <div className="flex flex-col gap-3">
            {/* Quick Link to Reset Password Page for testing demo */}
            <Link
              to="/reset-password"
              className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-semibold rounded-lg text-sm"
            >
              Demo: Proceed to Reset Password Screen
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-1.5 text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              <IoArrowBackOutline />
              <span>Back to Login</span>
            </Link>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Forgot Password?" subtitle="No worries, we will send you recovery instructions">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-xs font-bold text-slate-450 uppercase mb-1.5 tracking-wider">Email Address</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <IoMailOutline className="text-lg" />
            </div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full pl-10 pr-4 py-2.5 rounded-xl border bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 transition-all text-sm ${
                error ? 'border-rose-500 ring-2 ring-rose-500/10' : 'border-slate-200 dark:border-slate-800'
              }`}
              placeholder=""
            />
          </div>
          {error && <p className="text-xs text-rose-500 mt-1 font-semibold">{error}</p>}
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
              <span>Sending Reset Link...</span>
            </>
          ) : (
            <span>Send Reset Instructions</span>
          )}
        </button>

        <div className="text-center mt-4">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
          >
            <IoArrowBackOutline />
            <span>Back to Sign In</span>
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}
