export const DEPARTMENTS = [
  'Computer Science & Engineering'
];

export const CSE_CLASSES_BY_YEAR = {
  '1st Year': ['CSE A', 'CSE B', 'CSE C', 'CSE D', 'CSE E'],
  '2nd Year': ['CSE A', 'CSE B', 'CSE C', 'CSE D', 'CSE E'],
  '3rd Year': ['CSE A', 'CSE B', 'CSE C', 'CSE D'],
  '4th Year': ['CSE A', 'CSE B', 'CSE C']
};

export const SECTIONS = ['A', 'B', 'C', 'D', 'E'];
export const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];

export const INITIAL_STUDENTS = [
  {
    id: '1',
    name: 'Aarav Sharma',
    registerNo: 'CS2023001',
    department: 'Computer Science & Engineering',
    year: '3rd Year',
    section: 'A',
    email: 'aarav.sharma@example.edu',
    phone: '+91 98765 43210',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150',
    attendanceRate: 94.5,
    totalClasses: 120,
    presentClasses: 113,
  },
  {
    id: '2',
    name: 'Ananya Iyer',
    registerNo: 'CS2023014',
    department: 'Computer Science & Engineering',
    year: '3rd Year',
    section: 'A',
    email: 'ananya.iyer@example.edu',
    phone: '+91 98765 43211',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    attendanceRate: 88.2,
    totalClasses: 120,
    presentClasses: 106,
  },
  {
    id: '3',
    name: 'Aditya Verma',
    registerNo: 'EC2022045',
    department: 'Electronics & Communication Engineering',
    year: '4th Year',
    section: 'B',
    email: 'aditya.verma@example.edu',
    phone: '+91 98765 43212',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    attendanceRate: 72.8,
    totalClasses: 110,
    presentClasses: 80,
  },
  {
    id: '4',
    name: 'Diya Patel',
    registerNo: 'IT2024089',
    department: 'Information Technology',
    year: '2nd Year',
    section: 'C',
    email: 'diya.patel@example.edu',
    phone: '+91 98765 43213',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150',
    attendanceRate: 98.1,
    totalClasses: 80,
    presentClasses: 78,
  },
  {
    id: '5',
    name: 'Kabir Mehta',
    registerNo: 'ME2021012',
    department: 'Mechanical Engineering',
    year: '4th Year',
    section: 'A',
    email: 'kabir.mehta@example.edu',
    phone: '+91 98765 43214',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    attendanceRate: 64.5,
    totalClasses: 115,
    presentClasses: 74,
  },
  {
    id: '6',
    name: 'Meera Nair',
    registerNo: 'EE2023023',
    department: 'Electrical & Electronics Engineering',
    year: '3rd Year',
    section: 'B',
    email: 'meera.nair@example.edu',
    phone: '+91 98765 43215',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
    attendanceRate: 91.0,
    totalClasses: 100,
    presentClasses: 91,
  },
  {
    id: '7',
    name: 'Rohan Gupta',
    registerNo: 'CS2023055',
    department: 'Computer Science & Engineering',
    year: '3rd Year',
    section: 'B',
    email: 'rohan.gupta@example.edu',
    phone: '+91 98765 43216',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150',
    attendanceRate: 85.8,
    totalClasses: 120,
    presentClasses: 103,
  },
  {
    id: '8',
    name: 'Sanya Malhotra',
    registerNo: 'CI2024010',
    department: 'Civil Engineering',
    year: '2nd Year',
    section: 'A',
    email: 'sanya.malhotra@example.edu',
    phone: '+91 98765 43217',
    avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150',
    attendanceRate: 79.2,
    totalClasses: 90,
    presentClasses: 71,
  }
];

export const ATTENDANCE_HISTORY = [
  { id: 101, name: 'Aarav Sharma', registerNo: 'CS2023001', department: 'Computer Science & Engineering', section: 'A', date: '2026-07-05', time: '09:02 AM', status: 'Present', confidence: 99.2, method: 'Face Recognition' },
  { id: 102, name: 'Ananya Iyer', registerNo: 'CS2023014', department: 'Computer Science & Engineering', section: 'A', date: '2026-07-05', time: '09:03 AM', status: 'Present', confidence: 98.7, method: 'Face Recognition' },
  { id: 103, name: 'Meera Nair', registerNo: 'EE2023023', department: 'Electrical & Electronics Engineering', section: 'B', date: '2026-07-05', time: '09:05 AM', status: 'Present', confidence: 97.4, method: 'Face Recognition' },
  { id: 104, name: 'Diya Patel', registerNo: 'IT2024089', department: 'Information Technology', section: 'C', date: '2026-07-05', time: '09:07 AM', status: 'Present', confidence: 96.8, method: 'Face Recognition' },
  { id: 105, name: 'Rohan Gupta', registerNo: 'CS2023055', department: 'Computer Science & Engineering', section: 'B', date: '2026-07-05', time: '09:12 AM', status: 'Present', confidence: 95.1, method: 'Face Recognition' },
  { id: 106, name: 'Kabir Mehta', registerNo: 'ME2021012', department: 'Mechanical Engineering', section: 'A', date: '2026-07-05', time: '09:15 AM', status: 'Present', confidence: 91.3, method: 'Manual Entry' },
  { id: 107, name: 'Sanya Malhotra', registerNo: 'CI2024010', department: 'Civil Engineering', section: 'A', date: '2026-07-05', time: '09:20 AM', status: 'Present', confidence: 94.2, method: 'Face Recognition' },
  { id: 108, name: 'Aditya Verma', registerNo: 'EC2022045', department: 'Electronics & Communication Engineering', section: 'B', date: '2026-07-05', time: '---', status: 'Absent', confidence: 0, method: '---' },
];

export const ATTENDANCE_TRENDS = [
  { day: 'Mon', Present: 92, Absent: 8 },
  { day: 'Tue', Present: 95, Absent: 5 },
  { day: 'Wed', Present: 91, Absent: 9 },
  { day: 'Thu', Present: 88, Absent: 12 },
  { day: 'Fri', Present: 94, Absent: 6 },
];

export const DEPARTMENT_STATS = [
  { name: 'Computer Science', rate: 92.8, color: '#3b82f6' },
  { name: 'Information Tech', rate: 94.5, color: '#10b981' },
  { name: 'Electronics & Comm', rate: 84.2, color: '#f59e0b' },
  { name: 'Electrical & Elect', rate: 89.0, color: '#8b5cf6' },
  { name: 'Mechanical Eng', rate: 76.5, color: '#ef4444' },
  { name: 'Civil Engineering', rate: 81.0, color: '#06b6d4' }
];

export const MONTHLY_SUMMARY = [
  { name: 'Jan', Average: 84 },
  { name: 'Feb', Average: 86 },
  { name: 'Mar', Average: 89 },
  { name: 'Apr', Average: 91 },
  { name: 'May', Average: 88 },
  { name: 'Jun', Average: 92 },
  { name: 'Jul', Average: 94 }
];

export const SYSTEM_ACTIVITIES = [
  { id: 1, type: 'registration', text: 'New student registered: Aarav Sharma', time: '10 mins ago', date: '2026-07-05' },
  { id: 2, type: 'attendance', text: 'Live scanner recognized 14 students in CSE-A', time: '1 hour ago', date: '2026-07-05' },
  { id: 3, type: 'manual_edit', text: 'Manual attendance update for Aditya Verma by Admin', time: '3 hours ago', date: '2026-07-05' },
  { id: 4, type: 'settings', text: 'System backup schedule updated', time: '1 day ago', date: '2026-07-04' },
  { id: 5, type: 'report', text: 'Monthly attendance report exported to PDF', time: '2 days ago', date: '2026-07-03' },
];

export const NOTIFICATIONS = [
  { id: 1, type: 'low_attendance', title: 'Low Attendance Alert', message: 'Students currently have attendance below 75%.', time: '5 mins ago', read: false },
  { id: 2, type: 'scanner', title: 'Scanner Standby', message: 'Live Attendance Scanner is currently in standby mode.', time: '20 mins ago', read: false },
  { id: 3, type: 'report', title: 'Report Generated', message: 'Weekly summary report is ready for download.', time: '2 hours ago', read: true },
];

export const LANDING_FAQ = [
  {
    question: 'How accurate is the AI facial recognition?',
    answer: 'The system achieves over 99.2% accuracy under normal lighting conditions. It uses advanced deep learning model parameters and matches multiple features of the face to avoid false positives.'
  },
  {
    question: 'What camera does the Live Scanner use?',
    answer: 'The Live Scanner works seamlessly with any standard USB webcam or integrated device camera for instant face recognition.'
  },
  {
    question: 'Can attendance details be edited manually?',
    answer: 'Yes! Admins have full access permissions to override records, adjust entries, add manual logs, and upload medical excuse letters.'
  },
  {
    question: 'Is student data secure and private?',
    answer: 'Absolutely. Face embeddings (vectors) are encrypted, and raw images are discarded after processing unless configured otherwise by system administrators.'
  }
];

export const TESTIMONIALS = [
  {
    quote: 'Implementing this register system reduced attendance-taking overhead from 15 minutes per lecture to literally zero. Highly recommended!',
    author: 'Dr. Ramesh Kumar',
    title: 'Dean of Academics, NIT Tech',
    avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=120'
  },
  {
    quote: 'The automated alerts and report generator saved our administration hours of tracking and reporting. Beautiful dark mode dashboard!',
    author: 'Prof. Priya Mukherji',
    title: 'HOD, Computer Science Dept.',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120'
  }
];
