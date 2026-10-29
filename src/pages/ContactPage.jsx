import React, { useState } from 'react';
import LandingLayout from '../layouts/LandingLayout';
import { useToast } from '../context/ToastContext';
import { IoMailOutline, IoCallOutline, IoLocationOutline, IoSendOutline } from 'react-icons/io5';

export default function ContactPage() {
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name || !email || !message) {
      showToast('Please fill in required fields', 'error');
      return;
    }

    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      showToast('Support ticket registered! We will respond shortly.', 'success');
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
    }, 1200);
  };

  return (
    <LandingLayout>
      <div className="py-16 md:py-24 text-left">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-909 dark:text-white font-heading">
              Support Center
            </h1>
            <p className="text-slate-550 dark:text-slate-450 mt-2 max-w-xl mx-auto text-sm leading-relaxed">
              Facing difficulties with live scanning, syncing records, or registering classes? Reach out to our campus tech team.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Contact details */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-2xl shadow-sm space-y-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white font-heading">Campus Operations</h3>
              <p className="text-slate-500 text-xs leading-relaxed">Our physical desk is open Mon-Fri from 9:00 AM to 5:00 PM for technical support.</p>

              <div className="space-y-4 font-semibold text-sm">
                <div className="flex items-center gap-3 text-slate-650 dark:text-slate-350">
                  <IoMailOutline className="text-xl text-indigo-600 dark:text-indigo-400" />
                  <span>techsupport@smartattend.edu</span>
                </div>
                <div className="flex items-center gap-3 text-slate-650 dark:text-slate-350">
                  <IoCallOutline className="text-xl text-indigo-600 dark:text-indigo-400" />
                  <span>+1 (555) 019-2834 (Ext: 112)</span>
                </div>
                <div className="flex items-center gap-3 text-slate-650 dark:text-slate-350">
                  <IoLocationOutline className="text-xl text-indigo-605 dark:text-indigo-400" />
                  <span>Main Admin Building, Room 102, MIT campus</span>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-2xl shadow-sm">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white font-heading mb-6">Submit Ticket</h3>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-450 uppercase mb-1.5 tracking-wider">Your Name *</label>
                    <input
                      required
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      placeholder=""
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-450 uppercase mb-1.5 tracking-wider">Email Address *</label>
                    <input
                      required
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      placeholder=""
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-450 uppercase mb-1.5 tracking-wider">Subject</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    placeholder=""
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-455 uppercase mb-1.5 tracking-wider">Message Description *</label>
                  <textarea
                    required
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-855 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    placeholder=""
                  ></textarea>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow transition-colors flex items-center gap-2"
                >
                  {loading ? (
                    <span>Registering Ticket...</span>
                  ) : (
                    <>
                      <IoSendOutline />
                      <span>Submit Inquiries</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </LandingLayout>
  );
}
