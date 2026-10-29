import React from 'react';
import LandingLayout from '../layouts/LandingLayout';
import { IoHardwareChipOutline, IoShieldCheckmarkOutline, IoCodeSlashOutline } from 'react-icons/io5';

export default function AboutPage() {
  return (
    <LandingLayout>
      <div className="py-16 md:py-24 text-left">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-909 dark:text-white font-heading mb-4">
              About the System
            </h1>
            <p className="text-slate-500 dark:text-slate-450 max-w-xl mx-auto text-sm leading-relaxed">
              SmartAttend Register is a next-generation academic utility leveraging deep learning computer vision to digitize attendance taking.
            </p>
          </div>

          {/* Description */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-2xl shadow-sm space-y-6">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white font-heading">Project Goals</h3>
            <p className="text-slate-600 dark:text-slate-350 text-sm leading-relaxed">
              Traditional roll-calls digest up to 15% of actual classroom lecture hours and are prone to proxy errors. SmartAttend maps 128-dimensional facial coordinates instantly as students walk through doorways or seat themselves. The result is zero classroom friction, automated database sync, and beautiful, downloadable analytics reports.
            </p>
          </div>

          {/* Core Specs Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
              <div>
                <div className="text-3xl text-indigo-600 dark:text-indigo-400 mb-3"><IoHardwareChipOutline /></div>
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">Computer Vision Core</h4>
                <p className="text-xs text-slate-450 dark:text-slate-500 mt-2 leading-relaxed">Runs face alignment and extraction leveraging lightweight CNNs (Convolutional Neural Networks) for fast edge processing.</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
              <div>
                <div className="text-3xl text-emerald-600 dark:text-emerald-450 mb-3"><IoShieldCheckmarkOutline /></div>
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">Security & Privacy</h4>
                <p className="text-xs text-slate-450 dark:text-slate-500 mt-2 leading-relaxed">Instead of saving photos, we serialize images into secure, non-reversible vector arrays (embeddings), ensuring student anonymity.</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
              <div>
                <div className="text-3xl text-amber-600 dark:text-amber-400 mb-3"><IoCodeSlashOutline /></div>
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">React Technology Stack</h4>
                <p className="text-xs text-slate-450 dark:text-slate-500 mt-2 leading-relaxed">Built with React, Vite, Tailwind CSS v4, Framer Motion, and Recharts, providing a production-grade user experience.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </LandingLayout>
  );
}
