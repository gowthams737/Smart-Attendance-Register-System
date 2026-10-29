import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { IoSunny, IoMoon, IoFingerPrint } from 'react-icons/io5';
import { Link } from 'react-router-dom';

export default function AuthLayout({ children, title, subtitle }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-300">
      {/* Visual panel (Desktop Only) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-indigo-600 dark:bg-indigo-950 overflow-hidden flex-col justify-between p-12">
        {/* Background shapes */}
        <div className="absolute top-0 left-0 w-full h-full opacity-10">
          <div className="absolute -top-10 -left-10 w-96 h-96 rounded-full bg-white blur-3xl"></div>
          <div className="absolute bottom-10 right-10 w-96 h-96 rounded-full bg-white blur-3xl"></div>
        </div>

        <Link to="/" className="flex items-center gap-2 text-white text-2xl font-bold tracking-tight self-start font-heading relative z-10">
          <IoFingerPrint className="text-3xl text-indigo-200" />
          <span>SmartAttend</span>
        </Link>

        <div className="relative z-10 my-auto text-left max-w-md">
          <h1 className="text-4xl xl:text-5xl font-extrabold text-white font-heading leading-tight mb-4">
            AI-Powered Attendance Management
          </h1>
          <p className="text-indigo-100 text-lg leading-relaxed">
            Eliminate manual tracking. Our state-of-the-art computer vision algorithms register attendance seamlessly in real time.
          </p>
        </div>

        <div className="text-indigo-200/80 text-sm relative z-10">
          Powered by Advanced Deep Learning & Computer Vision.
        </div>
      </div>

      {/* Auth Content */}
      <div className="w-full lg:w-1/2 flex flex-col justify-between p-6 sm:p-12 relative">
        <div className="flex justify-end">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
          >
            {theme === 'dark' ? <IoSunny className="text-xl" /> : <IoMoon className="text-xl" />}
          </button>
        </div>

        <div className="w-full max-w-md mx-auto my-auto py-10">
          <div className="text-center lg:text-left mb-8">
            {/* Logo on mobile only */}
            <div className="lg:hidden flex items-center justify-center gap-2 text-indigo-600 dark:text-indigo-400 text-2xl font-bold font-heading mb-4">
              <IoFingerPrint className="text-3xl" />
              <span>SmartAttend</span>
            </div>
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white font-heading tracking-tight">
              {title}
            </h2>
            {subtitle && (
              <p className="text-slate-500 dark:text-slate-400 mt-2">
                {subtitle}
              </p>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl dark:shadow-slate-950/20">
            {children}
          </div>
        </div>

        <div className="text-center text-xs text-slate-400 dark:text-slate-500">
          &copy; {new Date().getFullYear()} SmartAttend Register. All rights reserved.
        </div>
      </div>
    </div>
  );
}
