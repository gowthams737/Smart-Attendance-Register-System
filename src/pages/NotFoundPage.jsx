import React from 'react';
import { Link } from 'react-router-dom';
import { IoFingerPrint, IoArrowBackOutline } from 'react-icons/io5';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col items-center justify-center p-6 text-center transition-colors">
      <div className="max-w-md space-y-6">
        {/* Animated Icon */}
        <div className="relative">
          <div className="w-24 h-24 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto text-5xl animate-bounce">
            <IoFingerPrint />
          </div>
          {/* Border scans simulation */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border-2 border-dashed border-rose-500/40 rounded-full animate-spin"></div>
        </div>

        <div className="space-y-2">
          <h1 className="text-6xl font-extrabold font-heading text-slate-900 dark:text-white">404</h1>
          <h2 className="text-xl font-bold text-slate-700 dark:text-slate-300">Biometrics Match Failed</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
            The page coordinate index you are scanning doesn't exist in our routing directory weights.
          </p>
        </div>

        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-md transition-all"
        >
          <IoArrowBackOutline />
          <span>Return Home</span>
        </Link>
      </div>
    </div>
  );
}
