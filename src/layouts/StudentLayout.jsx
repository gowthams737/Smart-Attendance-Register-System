import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { apiService } from '../services/api';
import {
  IoGridOutline, IoGrid,
  IoCalendarOutline, IoCalendar,
  IoDocumentTextOutline, IoDocumentText,
  IoPersonOutline, IoPerson,
  IoLogOutOutline, IoSunny, IoMoon,
  IoMenu, IoChevronForward, IoFingerPrint, IoPersonCircleOutline,
  IoNotificationsOutline
} from 'react-icons/io5';

export default function StudentLayout({ children }) {
  const { theme, toggleTheme } = useTheme();
  const { showToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);

  const [studentInfo, setStudentInfo] = useState(() => {
    try {
      const session = localStorage.getItem('studentSession');
      if (session) {
        const parsed = JSON.parse(session);
        return {
          name: parsed.name || 'Student',
          email: parsed.email || 'student@smartattend.edu',
          registerNo: parsed.registerNo || '',
          department: parsed.department || '',
          year: parsed.year || '',
          section: parsed.section || '',
          avatar: parsed.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'
        };
      }
    } catch (e) {
      console.error(e);
    }
    return {
      name: 'Student',
      email: 'student@smartattend.edu',
      registerNo: '',
      department: '',
      year: '',
      section: '',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'
    };
  });

  useEffect(() => {
    const session = localStorage.getItem('studentSession');
    if (!session) {
      navigate('/login');
    }
  }, [navigate]);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const prof = await apiService.getStudentMe();
        if (prof && prof.registerNo) {
          setStudentInfo({
            name: prof.name || 'Student',
            email: prof.email || 'student@smartattend.edu',
            registerNo: prof.registerNo || '',
            department: prof.department || '',
            year: prof.year || '',
            section: prof.section || '',
            avatar: prof.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'
          });
          const sessionString = localStorage.getItem('studentSession');
          if (sessionString) {
            const session = JSON.parse(sessionString);
            session.name = prof.name;
            session.email = prof.email;
            session.registerNo = prof.registerNo;
            session.avatar = prof.avatar;
            localStorage.setItem('studentSession', JSON.stringify(session));
          }
        }
      } catch (err) {
        console.error('Failed to load student profile for layout:', err);
      }
    };
    loadProfile();
  }, []);

  useEffect(() => {
    const fetchNotifs = async () => {
      try {
        const list = await apiService.getStudentNotifications();
        setNotifs(list || []);
      } catch (err) {
        console.error('Failed to load student notifications:', err);
      }
    };
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 15000);
    return () => clearInterval(interval);
  }, []);

  const activeNotifCount = notifs.filter(n => !n.read).length;

  const markAllRead = async () => {
    try {
      await apiService.markStudentNotificationsRead();
      setNotifs(prev => prev.map(n => ({ ...n, read: true })));
      showToast('All notifications marked as read', 'info');
    } catch (err) {
      console.error('Failed to mark notifications read:', err);
    }
  };


  const handleSignOut = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    try {
      await apiService.logout();
    } catch (err) {
      console.error('Logout error:', err);
    }
    localStorage.removeItem('studentSession');
    showToast('Signed out successfully', 'success');
    navigate('/login');
  };

  const navigationItems = [
    { name: 'Student Dashboard', path: '/student', icon: IoGridOutline, activeIcon: IoGrid },
    { name: 'My Attendance', path: '/student/attendance', icon: IoCalendarOutline, activeIcon: IoCalendar },
    { name: 'My Leave History', path: '/student/leave', icon: IoDocumentTextOutline, activeIcon: IoDocumentText },
    { name: 'My Profile', path: '/student/profile', icon: IoPersonOutline, activeIcon: IoPerson },
  ];

  const getBreadcrumbs = () => {
    const parts = location.pathname.split('/').filter(Boolean);
    return parts.map((part, index) => {
      const path = '/' + parts.slice(0, index + 1).join('/');
      const isLast = index === parts.length - 1;
      const formattedName = part === 'student' ? 'Student Portal' : part.charAt(0).toUpperCase() + part.slice(1).replace('-', ' ');
      return { name: formattedName, path, isLast };
    });
  };

  const breadcrumbs = getBreadcrumbs();

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-slate-900 text-slate-300">
      {/* Brand logo */}
      <div className="h-16 flex items-center gap-2 px-6 border-b border-slate-800">
        <IoFingerPrint className="text-3xl text-indigo-400 shrink-0" />
        <div className={`transition-opacity duration-200 ${!sidebarOpen ? 'lg:opacity-0 lg:w-0 overflow-hidden' : ''}`}>
          <span className="text-xl font-bold tracking-tight text-white font-heading block leading-none">
            SmartAttend
          </span>
          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block mt-0.5">
            Student Portal
          </span>
        </div>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        {navigationItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = isActive ? item.activeIcon : item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className="text-xl shrink-0" />
              <span className={`transition-opacity duration-200 ${!sidebarOpen ? 'lg:opacity-0 lg:w-0 overflow-hidden' : ''}`}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* User profile segment in sidebar footer */}
      <div className="p-4 border-t border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3 overflow-hidden">
          <img
            src={apiService.getAssetUrl(studentInfo.avatar)}
            onError={(e) => apiService.handleImageError(e, studentInfo.name)}
            alt="Student Profile"
            className="w-9 h-9 rounded-full border border-slate-700 shrink-0 object-cover"
          />
          <div className={`text-left transition-opacity duration-200 ${!sidebarOpen ? 'lg:opacity-0 lg:w-0 overflow-hidden' : ''}`}>
            <p className="text-sm font-semibold text-white truncate">{studentInfo.name}</p>
            <p className="text-xs text-slate-500 truncate">{studentInfo.registerNo}</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className={`p-2 hover:bg-slate-850 rounded-lg text-slate-400 hover:text-rose-400 transition-colors ${!sidebarOpen ? 'lg:hidden' : ''}`}
          title="Sign Out"
        >
          <IoLogOutOutline className="text-xl" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-300">
      {/* Desktop Sidebar */}
      <aside className={`hidden lg:block shrink-0 transition-all duration-300 border-r border-slate-200 dark:border-slate-800 ${sidebarOpen ? 'w-64' : 'w-20'}`}>
        <div className="sticky top-0 h-screen">
          <SidebarContent />
        </div>
      </aside>

      {/* Mobile Drawer Backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Mobile Drawer Content */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-800 lg:hidden transform transition-transform duration-300 ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <SidebarContent />
      </aside>

      {/* Dashboard Right Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-30 h-16 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 lg:hidden"
            >
              <IoMenu className="text-2xl" />
            </button>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="hidden lg:block p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <IoMenu className="text-2xl" />
            </button>

            {/* Breadcrumbs */}
            <nav className="hidden sm:flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 font-medium">
              <Link to="/student" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                Student Portal
              </Link>
              {breadcrumbs.map((crumb) => (
                <React.Fragment key={crumb.path}>
                  <IoChevronForward className="text-slate-350 text-xs" />
                  {crumb.isLast ? (
                    <span className="text-slate-800 dark:text-white font-semibold">{crumb.name}</span>
                  ) : (
                    <Link to={crumb.path} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                      {crumb.name}
                    </Link>
                  )}
                </React.Fragment>
              ))}
            </nav>
          </div>

          {/* User actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
            >
              {theme === 'dark' ? <IoSunny className="text-xl" /> : <IoMoon className="text-xl" />}
            </button>

            {/* Notifications Bell */}
            <div className="relative">
              <button
                onClick={() => { setNotificationsOpen(!notificationsOpen); setUserMenuOpen(false); }}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors relative"
              >
                <IoNotificationsOutline className="text-xl" />
                {activeNotifCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-rose-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold">
                    {activeNotifCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setNotificationsOpen(false)} />
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 overflow-hidden text-left">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <h3 className="font-semibold text-slate-900 dark:text-white">Notifications</h3>
                      {activeNotifCount > 0 && (
                        <button onClick={markAllRead} className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                      {notifs.length === 0 ? (
                        <div className="p-6 text-center text-sm text-slate-400">No notifications</div>
                      ) : (
                        notifs.map(notif => (
                          <div
                            key={notif.id}
                            onClick={() => { setNotificationsOpen(false); navigate('/student/leave'); }}
                            className={`p-4 text-left transition-colors cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/60 ${notif.read ? 'bg-transparent' : 'bg-slate-50/70 dark:bg-slate-800/40'}`}
                          >
                            <p className="text-sm font-semibold text-slate-900 dark:text-white flex items-center justify-between">
                              {notif.title}
                              {!notif.read && <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-normal">{notif.message}</p>
                            <p className="text-[10px] text-slate-400 mt-2 font-medium">{notif.created_at || notif.time}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                <img
                  src={apiService.getAssetUrl(studentInfo.avatar)}
                  onError={(e) => apiService.handleImageError(e, studentInfo.name)}
                  alt="Student Avatar"
                  className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                />
              </button>

              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                    <div className="p-4 text-left">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{studentInfo.name}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{studentInfo.registerNo}</p>
                    </div>
                    <div className="py-1">
                      <Link
                        to="/student/profile"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        <IoPersonCircleOutline className="text-lg" />
                        <span>My Profile</span>
                      </Link>
                    </div>
                    <div className="py-1">
                      <button
                        onClick={handleSignOut}
                        className="flex items-center gap-2.5 w-full px-4 py-2.5 text-left text-sm text-rose-600 dark:text-rose-450 hover:bg-rose-500/10 transition-colors"
                      >
                        <IoLogOutOutline className="text-lg" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
