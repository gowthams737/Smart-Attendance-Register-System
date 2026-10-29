import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { NOTIFICATIONS } from '../data/dummyData';
import { apiService } from '../services/api';
import {
  IoGridOutline, IoGrid,
  IoVideocamOutline, IoVideocam,
  IoPeopleOutline, IoPeople,
  IoPersonAddOutline, IoPersonAdd,
  IoCalendarOutline, IoCalendar,
  IoBarChartOutline, IoBarChart,
  IoSettingsOutline, IoSettings,
  IoDocumentTextOutline, IoDocumentText,
  IoLogOutOutline, IoSunny, IoMoon,
  IoNotificationsOutline, IoClose, IoMenu,
  IoChevronForward, IoFingerPrint, IoPersonCircleOutline
} from 'react-icons/io5';

export default function DashboardLayout({ children }) {
  const { theme, toggleTheme } = useTheme();
  const { showToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifs, setNotifs] = useState(() => {
    try {
      const stored = localStorage.getItem('smartattend_notifications');
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error('Failed to parse notifications', e);
    }
    return NOTIFICATIONS;
  });

  useEffect(() => {
    const fetchAdminNotifs = async () => {
      try {
        const liveNotifs = await apiService.getAdminNotifications();
        if (liveNotifs && Array.isArray(liveNotifs)) {
          setNotifs(liveNotifs);
        }
      } catch (err) {
        console.error('Failed to load admin notifications:', err);
      }
    };
    fetchAdminNotifs();
    const interval = setInterval(fetchAdminNotifs, 15000);
    return () => clearInterval(interval);
  }, []);

  const [isMainAdmin, setIsMainAdmin] = useState(() => {
    try {
      const session = localStorage.getItem('adminSession');
      if (session) {
        const parsed = JSON.parse(session);
        return parsed.is_hod === true || parsed.role === 'admin';
      }
    } catch (e) {
      console.error(e);
    }
    return false;
  });

  const [adminInfo, setAdminInfo] = useState(() => {
    try {
      const session = localStorage.getItem('adminSession');
      if (session) {
        const parsed = JSON.parse(session);
        return {
          name: parsed.name || 'Administrator',
          email: parsed.email || 'admin@smartattend.edu',
          avatar: parsed.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100'
        };
      }
    } catch (e) {
      console.error(e);
    }
    return { 
      name: 'Administrator', 
      email: 'admin@smartattend.edu',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100'
    };
  });

  useEffect(() => {
    const session = localStorage.getItem('adminSession');
    if (!session) {
      navigate('/login');
    }
  }, [navigate]);

  useEffect(() => {
    if (isMainAdmin && location.pathname.startsWith('/admin/leaves')) {
      navigate('/admin', { replace: true });
    }
  }, [isMainAdmin, location.pathname, navigate]);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const prof = await apiService.getProfile();
        if (prof && prof.email) {
          const mainAdminFlag = prof.is_hod === true || prof.role === 'admin';
          setIsMainAdmin(mainAdminFlag);
          setAdminInfo({
            name: prof.name || 'Administrator',
            email: prof.email || 'admin@smartattend.edu',
            avatar: prof.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100'
          });
          const sessionString = localStorage.getItem('adminSession');
          if (sessionString) {
            const session = JSON.parse(sessionString);
            session.name = prof.name;
            session.email = prof.email;
            session.avatar = prof.avatar;
            session.is_hod = prof.is_hod;
            session.role = prof.role;
            localStorage.setItem('adminSession', JSON.stringify(session));
          }
        }
      } catch (err) {
        console.error('Failed to load profile for layout:', err);
      }
    };
    loadProfile();
  }, []);

  useEffect(() => {
    const syncNotifsWithData = async () => {
      try {
        const stats = await apiService.getDashboardData();
        const lowCount = stats.lowAttendanceCount !== undefined ? stats.lowAttendanceCount : 0;
        setNotifs(prev => {
          const updated = prev.map(n => {
            if (n.type === 'low_attendance' || (n.title && n.title.toLowerCase().includes('low attendance'))) {
              return {
                ...n,
                message: `${lowCount} student${lowCount === 1 ? '' : 's'} currently have attendance below 75% threshold.`
              };
            }
            return n;
          });
          localStorage.setItem('smartattend_notifications', JSON.stringify(updated));
          return updated;
        });
      } catch (e) {
        console.error("Failed to sync notifications with dashboard stats:", e);
      }
    };
    syncNotifsWithData();
  }, []);

  useEffect(() => {
    const handleProfileUpdate = (e) => {
      if (e.detail) {
        setAdminInfo({
          name: e.detail.name || 'Administrator',
          email: e.detail.email || 'admin@smartattend.edu',
          avatar: e.detail.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100'
        });
      }
    };
    window.addEventListener('admin-profile-updated', handleProfileUpdate);
    return () => {
      window.removeEventListener('admin-profile-updated', handleProfileUpdate);
    };
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
      console.error('Failed to mark admin notifications read:', err);
    }
    setNotifs(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      localStorage.setItem('smartattend_notifications', JSON.stringify(updated));
      return updated;
    });
    showToast('All notifications marked as read', 'info');
  };

  const handleNotificationClick = (notif) => {
    setNotifs(prev => {
      const updated = prev.map(n => n.id === notif.id ? { ...n, read: true } : n);
      localStorage.setItem('smartattend_notifications', JSON.stringify(updated));
      return updated;
    });

    setNotificationsOpen(false);

    const titleLower = (notif.title || '').toLowerCase();
    const typeLower = (notif.type || '').toLowerCase();

    if (typeLower.includes('leave') || titleLower.includes('leave')) {
      if (!isMainAdmin) {
        navigate('/admin/leaves');
      }
    } else if (typeLower === 'low_attendance' || titleLower.includes('low attendance')) {
      navigate('/admin/history', { 
        state: { 
          filterLowAttendance: true, 
          statusFilter: 'Absent', 
          dateFilter: '',
          search: notif.department ? notif.department : ''
        } 
      });
    } else if (typeLower === 'scanner' || titleLower.includes('scanner') || titleLower.includes('standby')) {
      navigate('/admin/live');
    } else if (typeLower === 'report' || titleLower.includes('report')) {
      navigate('/admin/reports', { state: { highlightReport: notif.reportName || true } });
    } else if (typeLower === 'student' || titleLower.includes('student') || titleLower.includes('enrolled')) {
      navigate('/admin/students');
    } else if (typeLower === 'settings' || titleLower.includes('setting') || titleLower.includes('backup')) {
      navigate('/admin/settings', { state: { activeTab: 'notifications' } });
    } else {
      navigate('/admin');
    }
  };

  const rawNavigationItems = [
    { name: 'Dashboard', path: '/admin', icon: IoGridOutline, activeIcon: IoGrid },
    { name: 'Live Attendance', path: '/admin/live', icon: IoVideocamOutline, activeIcon: IoVideocam },
    { name: 'Student Directory', path: '/admin/students', icon: IoPeopleOutline, activeIcon: IoPeople },
    { name: 'Register Student', path: '/admin/register-student', icon: IoPersonAddOutline, activeIcon: IoPersonAdd },
    { name: 'Leave Requests', path: '/admin/leaves', icon: IoDocumentTextOutline, activeIcon: IoDocumentText },
    { name: 'Attendance History', path: '/admin/history', icon: IoCalendarOutline, activeIcon: IoCalendar },
    { name: 'Reports & Analytics', path: '/admin/reports', icon: IoBarChartOutline, activeIcon: IoBarChart },
    { name: 'Settings', path: '/admin/settings', icon: IoSettingsOutline, activeIcon: IoSettings },
  ];

  const navigationItems = isMainAdmin
    ? rawNavigationItems.filter(item => item.path !== '/admin/leaves')
    : rawNavigationItems;


  // Helper to build breadcrumbs from route path
  const getBreadcrumbs = () => {
    const parts = location.pathname.split('/').filter(Boolean);
    return parts.map((part, index) => {
      const path = '/' + parts.slice(0, index + 1).join('/');
      const isLast = index === parts.length - 1;
      const formattedName = part.charAt(0).toUpperCase() + part.slice(1).replace('-', ' ');
      return { name: formattedName, path, isLast };
    });
  };

  const breadcrumbs = getBreadcrumbs();

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-slate-900 text-slate-300">
      {/* Brand logo */}
      <div className="h-16 flex items-center gap-2 px-6 border-b border-slate-800">
        <IoFingerPrint className="text-3xl text-indigo-400 shrink-0" />
        <span className={`text-xl font-bold tracking-tight text-white font-heading transition-opacity duration-200 ${!sidebarOpen ? 'lg:opacity-0 lg:w-0 overflow-hidden' : ''}`}>
          SmartAttend
        </span>
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
            src={apiService.getAssetUrl(adminInfo.avatar)}
            alt="Admin Profile"
            className="w-9 h-9 rounded-full border border-slate-700 shrink-0 object-cover"
          />
          <div className={`text-left transition-opacity duration-200 ${!sidebarOpen ? 'lg:opacity-0 lg:w-0 overflow-hidden' : ''}`}>
            <p className="text-sm font-semibold text-white truncate">{adminInfo.name}</p>
            <p className="text-xs text-slate-500 truncate">{adminInfo.email}</p>
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
            {/* Sidebar toggle and mobile menu buttons */}
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
              <Link to="/" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                Home
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
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 overflow-hidden">
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
                            onClick={() => handleNotificationClick(notif)}
                            className={`p-4 text-left transition-colors cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/60 ${notif.read ? 'bg-transparent' : 'bg-slate-50/70 dark:bg-slate-800/40'}`}
                          >
                            <p className="text-sm font-semibold text-slate-900 dark:text-white flex items-center justify-between">
                              {notif.title}
                              {!notif.read && <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-normal">{notif.message}</p>
                            <p className="text-[10px] text-slate-400 mt-2 font-medium">{notif.time}</p>
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
                onClick={() => { setUserMenuOpen(!userMenuOpen); setNotificationsOpen(false); }}
                className="flex items-center gap-2 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                <img
                  src={apiService.getAssetUrl(adminInfo.avatar)}
                  alt="Admin Avatar"
                  className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                />
              </button>

              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                    <div className="p-4 text-left">
                      <p className="text-sm font-semibold text-slate-955 dark:text-white">{adminInfo.name}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{adminInfo.email}</p>
                    </div>
                    <div className="py-1">
                      <Link
                        to="/admin/profile"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        <IoPersonCircleOutline className="text-lg" />
                        <span>My Profile</span>
                      </Link>
                      <Link
                        to="/admin/settings"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        <IoSettingsOutline className="text-lg" />
                        <span>Account Settings</span>
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
