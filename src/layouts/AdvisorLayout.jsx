import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { NOTIFICATIONS } from '../data/dummyData';
import { apiService } from '../services/api';
import {
  IoGridOutline, IoGrid,
  IoPeopleOutline, IoPeople,
  IoCalendarOutline, IoCalendar,
  IoBarChartOutline, IoBarChart,
  IoDocumentTextOutline, IoDocumentText,
  IoVideocamOutline, IoVideocam,
  IoLogOutOutline, IoSunny, IoMoon,
  IoNotificationsOutline, IoClose, IoMenu,
  IoChevronForward, IoFingerPrint, IoSchoolOutline
} from 'react-icons/io5';

export default function AdvisorLayout({ children }) {
  const { theme, toggleTheme } = useTheme();
  const { showToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);

  const [advisorInfo, setAdvisorInfo] = useState(() => {
    try {
      const session = localStorage.getItem('adminSession');
      if (session) {
        const parsed = JSON.parse(session);
        return {
          name: parsed.name || 'Class Advisor',
          email: parsed.email || 'advisor@smartattend.edu',
          avatar: parsed.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
          year: parsed.year || '3rd Year',
          section: parsed.section || parsed.class || 'CSE B'
        };
      }
    } catch (e) {
      console.error(e);
    }
    return { 
      name: 'Class Advisor', 
      email: 'advisor@smartattend.edu',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
      year: '3rd Year',
      section: 'CSE B'
    };
  });

  useEffect(() => {
    const sessionString = localStorage.getItem('adminSession');
    if (!sessionString) {
      navigate('/login', { replace: true });
      return;
    }
    try {
      const session = JSON.parse(sessionString);
      if (session.is_hod === true || session.role === 'admin') {
        navigate('/admin', { replace: true });
      }
    } catch (e) {
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    const fetchAdvisorNotifs = async () => {
      try {
        const liveNotifs = await apiService.getAdminNotifications();
        if (liveNotifs && Array.isArray(liveNotifs)) {
          setNotifs(liveNotifs);
        }
      } catch (err) {
        console.error('Failed to load advisor notifications:', err);
      }
    };
    fetchAdvisorNotifs();
    const interval = setInterval(fetchAdvisorNotifs, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const prof = await apiService.getProfile();
        if (prof && prof.email) {
          setAdvisorInfo({
            name: prof.name || 'Class Advisor',
            email: prof.email || 'advisor@smartattend.edu',
            avatar: prof.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
            year: prof.year || advisorInfo.year,
            section: prof.section || prof.class || advisorInfo.section
          });
          const sessionString = localStorage.getItem('adminSession');
          if (sessionString) {
            const session = JSON.parse(sessionString);
            session.name = prof.name;
            session.email = prof.email;
            session.avatar = prof.avatar;
            session.year = prof.year || session.year;
            session.section = prof.section || prof.class || session.section;
            session.class = session.section;
            localStorage.setItem('adminSession', JSON.stringify(session));
          }
        }
      } catch (err) {
        console.error('Failed to load advisor profile:', err);
      }
    };
    loadProfile();
  }, []);

  const activeNotifCount = notifs.filter(n => !n.read).length;

  const handleSignOut = async (e) => {
    e.preventDefault();
    try {
      await apiService.logout();
    } catch (err) {
      console.error('Logout error:', err);
    }
    localStorage.removeItem('adminSession');
    showToast('Signed out successfully', 'success');
    navigate('/login');
  };

  const markAllRead = async () => {
    try {
      await apiService.markAdminNotificationsRead();
    } catch (err) {
      console.error('Failed to mark notifications read:', err);
    }
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
    showToast('All notifications marked as read', 'info');
  };

  const handleNotificationClick = (notif) => {
    setNotifs(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
    setNotificationsOpen(false);

    const titleLower = (notif.title || '').toLowerCase();
    const typeLower = (notif.type || '').toLowerCase();

    if (typeLower.includes('leave') || titleLower.includes('leave')) {
      navigate('/advisor/leaves');
    } else if (typeLower === 'low_attendance' || titleLower.includes('low attendance')) {
      navigate('/advisor/history');
    } else if (typeLower === 'report' || titleLower.includes('report')) {
      navigate('/advisor/reports');
    } else if (typeLower === 'student' || titleLower.includes('student')) {
      navigate('/advisor/students');
    } else {
      navigate('/advisor');
    }
  };

  const navigationItems = [
    { name: 'Class Dashboard', path: '/advisor', icon: IoGridOutline, activeIcon: IoGrid },
    { name: 'Live Scanner', path: '/advisor/live', icon: IoVideocamOutline, activeIcon: IoVideocam },
    { name: 'My Class Students', path: '/advisor/students', icon: IoPeopleOutline, activeIcon: IoPeople },
    { name: 'Leave Requests', path: '/advisor/leaves', icon: IoDocumentTextOutline, activeIcon: IoDocumentText },
    { name: 'Attendance History', path: '/advisor/history', icon: IoCalendarOutline, activeIcon: IoCalendar },
    { name: 'Reports & Analytics', path: '/advisor/reports', icon: IoBarChartOutline, activeIcon: IoBarChart },
  ];

  const getBreadcrumbs = () => {
    const parts = location.pathname.split('/').filter(Boolean);
    return parts.map((part, index) => {
      const path = '/' + parts.slice(0, index + 1).join('/');
      let name = part.charAt(0).toUpperCase() + part.slice(1);
      if (part === 'advisor') name = 'Class Advisor Portal';
      if (part === 'live') name = 'Live Attendance Scanner';
      if (part === 'leaves') name = 'Leave Requests & Letters';
      if (part === 'students') name = 'My Class Students';
      if (part === 'history') name = 'Attendance History';
      if (part === 'reports') name = 'Reports & Analytics';
      return { name, path };
    });
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      {/* Top Header */}
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 px-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden md:flex items-center justify-center w-9 h-9 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
            title="Toggle Sidebar"
          >
            <IoMenu className="text-xl" />
          </button>
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
          >
            <IoMenu className="text-xl" />
          </button>

          {/* Logo & Portal Identity */}
          <Link to="/advisor" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-indigo-600/20">
              <IoSchoolOutline className="text-xl" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-base font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent leading-none">
                SmartAttend
              </h1>
              <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 tracking-wider uppercase mt-0.5">
                Class Advisor Portal
              </p>
            </div>
          </Link>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2">
          {/* Assigned Scope Badge */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold">
            <IoSchoolOutline className="text-sm shrink-0" />
            <span>{advisorInfo.year} — {(advisorInfo.section || '').replace(/^Section\s*/i, '')}</span>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          >
            {theme === 'dark' ? <IoSunny className="text-xl text-amber-400" /> : <IoMoon className="text-xl" />}
          </button>

          {/* Notifications Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setNotificationsOpen(!notificationsOpen);
                setUserMenuOpen(false);
              }}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative"
            >
              <IoNotificationsOutline className="text-xl" />
              {activeNotifCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900 animate-pulse" />
              )}
            </button>

            {notificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm">Class Notifications</h3>
                    {activeNotifCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                        {activeNotifCount} new
                      </span>
                    )}
                  </div>
                  {activeNotifCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/50">
                  {notifs.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-sm">
                      No notifications for your class.
                    </div>
                  ) : (
                    notifs.map(n => (
                      <div
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={`p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer flex gap-3 ${
                          !n.read ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''
                        }`}
                      >
                        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${!n.read ? 'bg-indigo-600' : 'bg-transparent'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className={`text-xs font-semibold truncate ${!n.read ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>
                              {n.title}
                            </p>
                            <span className="text-[10px] text-slate-400 shrink-0">{n.time}</span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                            {n.message}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Profile Button */}
          <div className="relative">
            <button
              onClick={() => {
                setUserMenuOpen(!userMenuOpen);
                setNotificationsOpen(false);
              }}
              className="flex flex-col text-left px-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200/60 dark:border-slate-800/60"
            >
              <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight">Class Advisor</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">{advisorInfo.email}</p>
              <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold truncate">
                {advisorInfo.year} — {(advisorInfo.section || '').replace(/^Section\s*/i, '')}
              </p>
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-60 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 py-2 z-50">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 text-left">
                  <p className="font-bold text-sm text-slate-900 dark:text-white truncate">Class Advisor</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{advisorInfo.email}</p>
                  <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 truncate mt-1">
                    {advisorInfo.year} — {(advisorInfo.section || '').replace(/^Section\s*/i, '')}
                  </p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="w-full px-4 py-2.5 text-left text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors flex items-center gap-2"
                >
                  <IoLogOutOutline className="text-base" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar */}
        <aside
          className={`hidden md:flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 z-20 ${
            sidebarOpen ? 'w-64' : 'w-20'
          }`}
        >
          {/* Assigned Scope Banner */}
          {sidebarOpen && (
            <div className="p-4 m-3 bg-gradient-to-br from-indigo-500/10 to-indigo-600/5 rounded-2xl border border-indigo-200/50 dark:border-indigo-800/50">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs">
                <IoSchoolOutline className="text-lg shrink-0" />
                <span>Assigned Class</span>
              </div>
              <p className="text-sm font-extrabold text-slate-800 dark:text-slate-100 mt-1">
                {advisorInfo.year} — {advisorInfo.section}
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                Class Advisor Privileges
              </p>
            </div>
          )}

          <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
            {navigationItems.map(item => {
              const isActive = location.pathname === item.path || (item.path !== '/advisor' && location.pathname.startsWith(item.path));
              const Icon = isActive ? item.activeIcon : item.icon;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title={!sidebarOpen ? item.name : ''}
                >
                  <Icon className="text-lg shrink-0" />
                  {sidebarOpen && <span className="truncate">{item.name}</span>}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Mobile Sidebar Overlay */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs" onClick={() => setMobileSidebarOpen(false)} />
            <div className="relative flex-1 max-w-xs w-full bg-white dark:bg-slate-900 p-4 flex flex-col z-10">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                    <IoSchoolOutline className="text-lg" />
                  </div>
                  <div>
                    <h2 className="font-bold text-sm">Class Advisor</h2>
                    <p className="text-[10px] text-slate-400">{advisorInfo.year} - {advisorInfo.section}</p>
                  </div>
                </div>
                <button onClick={() => setMobileSidebarOpen(false)} className="p-2 text-slate-400">
                  <IoClose className="text-xl" />
                </button>
              </div>

              <nav className="flex-1 space-y-2">
                {navigationItems.map(item => {
                  const isActive = location.pathname === item.path;
                  const Icon = isActive ? item.activeIcon : item.icon;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileSidebarOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                        isActive ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Icon className="text-lg" />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        )}

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {/* Breadcrumbs */}
          <div className="mb-6 flex items-center gap-2 text-xs text-slate-400 font-medium">
            {breadcrumbs.map((crumb, i) => (
              <React.Fragment key={crumb.path}>
                {i > 0 && <IoChevronForward className="text-slate-300 dark:text-slate-600 text-xs" />}
                <span className={i === breadcrumbs.length - 1 ? 'font-bold text-slate-800 dark:text-slate-200' : ''}>
                  {crumb.name}
                </span>
              </React.Fragment>
            ))}
          </div>

          {children}
        </main>
      </div>
    </div>
  );
}
