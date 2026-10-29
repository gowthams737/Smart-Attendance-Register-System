import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  IoVideocamOutline, IoStatsChartOutline, IoShieldCheckmarkOutline,
  IoChevronDownOutline, IoChevronUpOutline, IoMailOutline, IoCallOutline,
  IoLocationOutline, IoCheckmarkCircleSharp, IoFingerPrint
} from 'react-icons/io5';
import { LANDING_FAQ, TESTIMONIALS } from '../data/dummyData';
import LandingLayout from '../layouts/LandingLayout';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100 } }
};

export default function LandingPage() {
  const [openFaqIndex, setOpenFaqIndex] = useState(null);

  const toggleFaq = (index) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  return (
    <LandingLayout>
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-28 md:pt-32 md:pb-40 bg-gradient-to-b from-indigo-50/50 via-white to-transparent dark:from-slate-900/30 dark:via-slate-950 dark:to-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 text-xs font-semibold tracking-wide uppercase mb-6"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-450 animate-pulse"></span>
            Automated Attendance v2.0
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white font-heading leading-[1.1] mb-6"
          >
            AI Face Recognition <br />
            <span className="text-indigo-600 dark:text-indigo-400">Attendance System</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="max-w-2xl mx-auto text-lg text-slate-650 dark:text-slate-350 leading-relaxed mb-10"
          >
            Modernize your institution with automated attendance. Recognize students instantly, export real-time reports, and eliminate attendance fraud.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="flex flex-col sm:flex-row justify-center items-center gap-4"
          >
            <Link
              to="/login"
              className="w-full sm:w-auto px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/35 hover:-translate-y-0.5 transition-all duration-200"
            >
              Sign In to Dashboard
            </Link>
            <Link
              to="/about"
              className="w-full sm:w-auto px-8 py-3.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold rounded-xl border border-slate-200 dark:border-slate-800 transition-all"
            >
              Learn More
            </Link>
          </motion.div>
        </div>

        {/* Backdrop graphics */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-400/10 dark:bg-indigo-550/5 rounded-full blur-3xl pointer-events-none -z-10"></div>
      </section>

      {/* Core Features */}
      <section className="py-20 bg-white dark:bg-slate-900 border-y border-slate-200 dark:border-slate-800 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-heading">
              Why SmartAttend?
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mt-3 max-w-xl mx-auto">
              Our system is built to provide maximum convenience, accuracy, and detailed analytical power.
            </p>
          </div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {/* Feature 1 */}
            <motion.div variants={itemVariants} className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-left hover:shadow-xl transition-all duration-300">
              <div className="w-12 h-12 bg-indigo-150 dark:bg-indigo-900/50 rounded-xl flex items-center justify-center text-indigo-650 dark:text-indigo-300 mb-6 text-2xl">
                <IoVideocamOutline />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Live AI Detection</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                Plug-and-play webcam monitoring detects and logs students automatically in less than a second.
              </p>
            </motion.div>

            {/* Feature 2 */}
            <motion.div variants={itemVariants} className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-left hover:shadow-xl transition-all duration-300">
              <div className="w-12 h-12 bg-indigo-150 dark:bg-indigo-900/50 rounded-xl flex items-center justify-center text-indigo-650 dark:text-indigo-300 mb-6 text-2xl">
                <IoStatsChartOutline />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Rich Analytics Reports</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                Generate department comparisons, monthly statistics, and download excel reports instantly.
              </p>
            </motion.div>

            {/* Feature 3 */}
            <motion.div variants={itemVariants} className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-left hover:shadow-xl transition-all duration-300">
              <div className="w-12 h-12 bg-indigo-150 dark:bg-indigo-900/50 rounded-xl flex items-center justify-center text-indigo-650 dark:text-indigo-300 mb-6 text-2xl">
                <IoShieldCheckmarkOutline />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Secure Embeddings</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                We generate mathematical facial coordinate mappings instead of storing high-res files, ensuring student privacy.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Screen Mockup section */}
      <section className="py-20 bg-slate-50 dark:bg-slate-950">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="mb-12">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-heading">
              Sleek Admin Dashboard
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mt-2">
              Intuitive controls, real-time statistics logs, and responsive layout built for all screens.
            </p>
          </div>
          {/* Animated SVG/CSS mock dashboard */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="border border-slate-200 dark:border-slate-850 rounded-2xl overflow-hidden shadow-2xl bg-white dark:bg-slate-900 aspect-video p-2 flex flex-col"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 px-3">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-rose-500"></span>
                <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
              </div>
              <div className="text-xs text-slate-400 font-mono">dashboard-preview.smartattend.edu</div>
              <div className="w-6"></div>
            </div>
            <div className="flex-1 grid grid-cols-4 gap-3 p-3 bg-slate-50 dark:bg-slate-950/60">
              <div className="col-span-1 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 p-3 hidden sm:flex flex-col gap-2">
                <div className="h-6 w-3/4 bg-slate-100 dark:bg-slate-800 rounded"></div>
                <div className="h-4 w-1/2 bg-slate-100 dark:bg-slate-800 rounded mt-2"></div>
                <div className="h-8 w-full bg-slate-100 dark:bg-slate-800 rounded"></div>
                <div className="h-8 w-full bg-slate-100 dark:bg-slate-800 rounded"></div>
              </div>
              <div className="col-span-4 sm:col-span-3 flex flex-col gap-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="h-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-col justify-between">
                    <div className="h-3 w-1/2 bg-slate-100 dark:bg-slate-800 rounded"></div>
                    <div className="h-6 w-2/3 bg-slate-200 dark:bg-slate-750 rounded"></div>
                  </div>
                  <div className="h-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-col justify-between">
                    <div className="h-3 w-1/2 bg-slate-100 dark:bg-slate-800 rounded"></div>
                    <div className="h-6 w-2/3 bg-slate-200 dark:bg-slate-750 rounded"></div>
                  </div>
                  <div className="h-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-col justify-between">
                    <div className="h-3 w-1/2 bg-slate-100 dark:bg-slate-800 rounded"></div>
                    <div className="h-6 w-2/3 bg-slate-200 dark:bg-slate-750 rounded"></div>
                  </div>
                </div>
                <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden">
                  <div className="h-4 w-1/3 bg-slate-100 dark:bg-slate-800 rounded"></div>
                  {/* Mock graph lines */}
                  <div className="flex items-end justify-between h-28 pt-4">
                    <div className="w-[12%] h-[60%] bg-indigo-200 dark:bg-indigo-900/60 rounded"></div>
                    <div className="w-[12%] h-[75%] bg-indigo-300 dark:bg-indigo-850 rounded"></div>
                    <div className="w-[12%] h-[55%] bg-indigo-200 dark:bg-indigo-900/60 rounded"></div>
                    <div className="w-[12%] h-[85%] bg-indigo-600 dark:bg-indigo-600 rounded animate-pulse"></div>
                    <div className="w-[12%] h-[90%] bg-indigo-600 dark:bg-indigo-500 rounded"></div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-white dark:bg-slate-900 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-heading mb-16">
            Trusted by Educators
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {TESTIMONIALS.map((t, idx) => (
              <div key={idx} className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-left flex flex-col justify-between shadow-sm">
                <p className="text-slate-600 dark:text-slate-350 italic text-base leading-relaxed mb-6">
                  "{t.quote}"
                </p>
                <div className="flex items-center gap-3">
                  <img src={t.avatar} alt={t.author} className="w-11 h-11 rounded-full object-cover border border-slate-200 dark:border-slate-850" />
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">{t.author}</h4>
                    <p className="text-xs text-slate-400">{t.title}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="py-20 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-850">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center tracking-tight text-slate-900 dark:text-white font-heading mb-12">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {LANDING_FAQ.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div key={idx} className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 overflow-hidden">
                  <button
                    onClick={() => toggleFaq(idx)}
                    className="w-full flex items-center justify-between p-5 text-left font-semibold text-slate-900 dark:text-white transition-colors hover:bg-slate-50 dark:hover:bg-slate-850"
                  >
                    <span>{faq.question}</span>
                    {isOpen ? <IoChevronUpOutline className="text-lg shrink-0" /> : <IoChevronDownOutline className="text-lg shrink-0" />}
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 text-sm text-slate-550 dark:text-slate-400 border-t border-slate-100 dark:border-slate-850/50 leading-relaxed">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-20 bg-white dark:bg-slate-900 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="flex flex-col justify-center">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-heading mb-4">
                Get In Touch
              </h2>
              <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-md">
                Have questions about rolling out SmartAttend at your school or university campus? Drop us a message.
              </p>
              <div className="space-y-4 font-medium">
                <div className="flex items-center gap-3 text-slate-650 dark:text-slate-350">
                  <IoMailOutline className="text-xl text-indigo-600 dark:text-indigo-400" />
                  <span>support@smartattend.edu</span>
                </div>
                <div className="flex items-center gap-3 text-slate-650 dark:text-slate-350">
                  <IoCallOutline className="text-xl text-indigo-600 dark:text-indigo-400" />
                  <span>+1 (555) 019-2834</span>
                </div>
                <div className="flex items-center gap-3 text-slate-650 dark:text-slate-350">
                  <IoLocationOutline className="text-xl text-indigo-600 dark:text-indigo-400" />
                  <span>100 AI Boulevard, Suite 500, Tech City</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md">
              <form onSubmit={(e) => { e.preventDefault(); alert('Message sent!'); }} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-450 uppercase mb-1.5">Your Name</label>
                  <input required type="text" className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-450 uppercase mb-1.5">Email Address</label>
                  <input required type="email" className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-450 uppercase mb-1.5">Message</label>
                  <textarea required rows={4} className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"></textarea>
                </div>
                <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg shadow transition-colors">
                  Send Message
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>
    </LandingLayout>
  );
}
