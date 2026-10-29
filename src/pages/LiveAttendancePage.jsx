import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import AdvisorLayout from '../layouts/AdvisorLayout';
import { useToast } from '../context/ToastContext';
import {
  IoVideocamOutline, IoPlay, IoPause, IoCheckmarkCircle,
  IoAlertCircleOutline, IoLocationOutline, IoTimeOutline, IoScan
} from 'react-icons/io5';
import { apiService } from '../services/api';

const CSE_CLASSES_BY_YEAR = {
  '1st Year': ['CSE A', 'CSE B', 'CSE C', 'CSE D', 'CSE E'],
  '2nd Year': ['CSE A', 'CSE B', 'CSE C', 'CSE D', 'CSE E'],
  '3rd Year': ['CSE A', 'CSE B', 'CSE C', 'CSE D'],
  '4th Year': ['CSE A', 'CSE B', 'CSE C']
};

export default function LiveAttendancePage() {
  const { showToast } = useToast();
  const location = useLocation();

  const adminSession = React.useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('adminSession') || '{}');
    } catch {
      return {};
    }
  }, []);

  const isClassTeacher = adminSession?.role === 'class_teacher' || adminSession?.is_hod === false;
  const isAdvisorRoute = location.pathname.startsWith('/advisor');
  const LayoutComponent = (isAdvisorRoute || isClassTeacher) ? AdvisorLayout : DashboardLayout;

  const [selectedYear, setSelectedYear] = useState(() => (isClassTeacher && adminSession.year ? adminSession.year : '3rd Year'));
  const [selectedClass, setSelectedClass] = useState(() => {
    if (isClassTeacher && (adminSession.class || adminSession.section)) {
      const sec = String(adminSession.class || adminSession.section).trim();
      return sec.startsWith('CSE') ? sec : `CSE ${sec.replace(/^SEC(TION)?\s*/i, '')}`;
    }
    return 'CSE A';
  });
  const [isScanning, setIsScanning] = useState(false);

  const availableClasses = CSE_CLASSES_BY_YEAR[selectedYear] || ['CSE A'];

  const handleYearChange = (newYear) => {
    setSelectedYear(newYear);
    const validClasses = CSE_CLASSES_BY_YEAR[newYear] || [];
    if (!validClasses.includes(selectedClass)) {
      setSelectedClass(validClasses[0] || 'CSE A');
    }
  };

  // Scanning state
  const [detectedStudent, setDetectedStudent] = useState(null);
  const [logs, setLogs] = useState([]);
  const [scanBox, setScanBox] = useState({ top: '30%', left: '35%', width: '30%', height: '40%' });

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const processingRef = useRef(false);
  const processedStudentsRef = useRef(new Set());
  const loggedStudentRegsRef = useRef(new Set());

  // Load already processed students for today
  useEffect(() => {
    const fetchTodayAttendance = async () => {
      try {
        const d = new Date();
        const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const data = await apiService.getAttendanceHistory('', todayStr);
        
        const now = new Date();
        const decimalTime = now.getHours() + now.getMinutes() / 60.0;
        const currentSession = decimalTime < 13.0 ? 'Morning' : 'Afternoon';
        
        const processed = new Set();
        data.forEach(record => {
          const isPresentInSession = currentSession === 'Morning'
            ? (record.morningSession === 'Present' || (record.session === 'Morning' && record.status === 'Present'))
            : (record.afternoonSession === 'Present' || (record.session === 'Afternoon' && record.status === 'Present'));
          if (isPresentInSession) {
            processed.add(String(record.registerNo));
          }
        });
        processedStudentsRef.current = processed;
      } catch (err) {
        console.error("Failed to fetch today's attendance for locking:", err);
      }
    };
    if (isScanning) {
      fetchTodayAttendance();
    }
  }, [isScanning]);

  // Animate the scan bounding box
  useEffect(() => {
    let boxInterval;
    if (isScanning) {
      boxInterval = setInterval(() => {
        const top = `${25 + Math.random() * 10}%`;
        const left = `${30 + Math.random() * 15}%`;
        const width = `${25 + Math.random() * 10}%`;
        const height = `${30 + Math.random() * 10}%`;
        setScanBox({ top, left, width, height });
      }, 1000);
    }
    return () => clearInterval(boxInterval);
  }, [isScanning]);

  // Handle webcam start and stop
  useEffect(() => {
    if (isScanning) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isScanning]);

  // Periodic capture and recognition loop
  useEffect(() => {
    let captureInterval;
    if (isScanning) {
      captureInterval = setInterval(() => {
        captureFrameAndRecognize();
      }, 1800); // scan frame every 1.8 seconds
    }
    return () => clearInterval(captureInterval);
  }, [isScanning]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Webcam startup failed:", err);
      showToast("Could not access camera device. Please verify permissions.", "error");
      setIsScanning(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const captureFrameAndRecognize = async () => {
    if (!videoRef.current || !canvasRef.current || processingRef.current) return;

    processingRef.current = true;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    // Ensure dimensions match
    if (video.videoWidth > 0 && video.videoHeight > 0) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(async (blob) => {
        if (!blob) {
          processingRef.current = false;
          return;
        }

        try {
          // 1. Send live frame to backend scanner API
          const result = await apiService.scanFace(blob);

          if (result.match && result.student) {
            const studentDetails = result.student;
            const regNoStr = String(studentDetails.registerNo);

            const newLog = {
              id: Date.now(),
              name: studentDetails.name,
              registerNo: regNoStr,
              rollNo: studentDetails.rollNo || '---',
              time: result.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              confidence: result.confidence ? `${result.confidence}%` : '---',
              status: result.status,
              session: result.session,
              avatar: studentDetails.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(studentDetails.name)}&background=6366f1&color=fff`,
              unrecognized: false
            };

            // Immediately display the existing student's details in "Last Detected Match"
            setDetectedStudent(newLog);

            // Add to Active Scanning Log table UI if not already present
            if (!loggedStudentRegsRef.current.has(regNoStr)) {
              loggedStudentRegsRef.current.add(regNoStr);
              setLogs(prev => {
                const exists = prev.some(l => String(l.registerNo) === regNoStr);
                if (exists) return prev;
                return [newLog, ...prev.slice(0, 19)];
              });
            }

            // Target Section Validation
            const studentYear = (studentDetails.year || '3rd Year').trim();
            const studentSec = (studentDetails.section || 'A').trim().toUpperCase();
            const targetSecLetter = selectedClass.replace('CSE ', '').trim().toUpperCase();
            const studentSecClean = studentSec.replace(/^CSE\s*/i, '').replace(/^SEC(TION)?\s*/i, '').trim();

            const matchesYear = studentYear.toLowerCase() === selectedYear.toLowerCase();
            const matchesSection = studentSecClean === targetSecLetter || studentSec === targetSecLetter || studentSec === selectedClass.toUpperCase();

            if (!matchesYear || !matchesSection) {
              if (!processedStudentsRef.current.has(regNoStr)) {
                showToast(`Recognized ${studentDetails.name} (${studentYear} - Sec ${studentSec}), target set to CSE ${selectedYear} - Sec ${targetSecLetter}.`, 'warning');
                processedStudentsRef.current.add(regNoStr);
              }
              return;
            }

            // Prevent duplicate save requests in current scanning session
            if (processedStudentsRef.current.has(regNoStr)) {
              return;
            }

            if (result.already_processed) {
              processedStudentsRef.current.add(regNoStr);
              showToast(`${studentDetails.name} already processed for this session.`, 'info');
              return;
            }

            if (!result.save_record) {
              processedStudentsRef.current.add(regNoStr);
              showToast(result.detail || `Recognized: ${studentDetails.name} but outside scanning window.`, 'warning');
              return;
            }

            // 2. Save the final attendance record in MongoDB
            const attendanceRecord = {
              name: studentDetails.name,
              registerNo: regNoStr,
              rollNo: studentDetails.rollNo,
              department: studentDetails.department || 'Computer Science & Engineering',
              section: studentDetails.section,
              year: studentDetails.year || selectedYear,
              date: result.date,
              day: result.day,
              session: result.session,
              morningSession: result.morningSession,
              afternoonSession: result.afternoonSession,
              time: result.time,
              status: result.status,
              confidence: result.confidence,
              method: "Face Recognition"
            };

            await apiService.recordAttendance(attendanceRecord);
            processedStudentsRef.current.add(regNoStr);
            showToast(`Recognized: ${studentDetails.name} (${result.confidence}%) -> ${result.status}`, 'success');
          } else if (result.out_of_scope) {
            showToast(result.detail || "Recognized student is outside your assigned class scope.", "warning");
          } else if (result.face_detected) {
            setDetectedStudent({
              id: Date.now(),
              name: "Unrecognized Face",
              registerNo: "Biometrics Not Registered",
              rollNo: "---",
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              confidence: "0%",
              status: "Not Recognized",
              session: "---",
              avatar: null,
              unrecognized: true
            });
          }
        } catch (err) {
          console.error("Face recognition matching or logging error:", err);
        } finally {
          processingRef.current = false;
        }
      }, 'image/jpeg', 0.85);
    } else {
      processingRef.current = false;
    }
  };

  const toggleScanner = () => {
    setIsScanning(!isScanning);
    if (!isScanning) {
      showToast('AI Face Scanner initialized', 'info');
    } else {
      showToast('AI Face Scanner suspended', 'warning');
      setDetectedStudent(null);
    }
  };

  return (
    <LayoutComponent>
      <div className="space-y-6 text-left">
        {/* Page title */}
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white font-heading tracking-tight">Live Attendance Scanner</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Real-time face recognition scanner for automated attendance.</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Webcam Simulator/Real View (Left) */}
          <div className="xl:col-span-2 bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl relative aspect-video flex flex-col justify-between p-4 group">
            {/* Real Webcam Stream */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`absolute inset-0 w-full h-full object-cover z-0 ${isScanning ? 'block' : 'hidden'}`}
            />
            {/* Hidden canvas for grabbing frames */}
            <canvas ref={canvasRef} className="hidden" />

            {isScanning ? (
              <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center overflow-hidden">
                {/* Scanning green line animation */}
                <div className="absolute inset-x-0 h-0.5 bg-indigo-500/80 shadow-[0_0_15px_#6366f1] top-0 animate-[bounce_4s_infinite_linear]"></div>

                {/* Simulated Grid overlay */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:30px_30px]" />

                {/* Animated Scanner Bounding Box */}
                <div
                  style={{
                    top: scanBox.top,
                    left: scanBox.left,
                    width: scanBox.width,
                    height: scanBox.height
                  }}
                  className="absolute border-2 border-indigo-500 rounded-xl transition-all duration-700 ease-out flex items-center justify-center"
                >
                  {/* Bounding box corners */}
                  <span className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-indigo-400 -mt-0.5 -ml-0.5 rounded-tl-md"></span>
                  <span className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-indigo-400 -mt-0.5 -mr-0.5 rounded-tr-md"></span>
                  <span className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-indigo-400 -mb-0.5 -ml-0.5 rounded-bl-md"></span>
                  <span className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-indigo-400 -mb-0.5 -mr-0.5 rounded-br-md"></span>

                  <span className="text-[10px] font-mono text-indigo-400 font-bold bg-slate-950/80 px-2 py-0.5 rounded-full backdrop-blur-sm flex items-center gap-1">
                    <IoScan className="animate-spin" /> SCANNING FACE
                  </span>
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 z-0 bg-slate-900 flex flex-col items-center justify-center text-center p-6">
                <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center text-slate-500 mb-4 text-3xl">
                  <IoVideocamOutline />
                </div>
                <p className="font-bold text-slate-300 text-lg">Face Recognition Standby</p>
                <p className="text-sm text-slate-500 mt-1 max-w-sm leading-relaxed">
                  Start the live scanner feed to begin checking student biometrics against registered datasets.
                </p>
              </div>
            )}

            {/* Camera Overlay Status */}
            <div className="relative z-10 flex items-center justify-between w-full">
              <span className="text-[10px] font-mono font-bold tracking-wider text-white bg-slate-900/80 border border-slate-855 px-3 py-1 rounded-full backdrop-blur-md uppercase">
                LIVE ATTENDANCE SCANNER
              </span>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isScanning ? 'bg-emerald-500 animate-ping' : 'bg-rose-500'}`}></span>
                <span className="text-[10px] font-mono font-bold text-slate-300 bg-slate-900/80 border border-slate-855 px-2.5 py-1 rounded-full backdrop-blur-md">
                  {isScanning ? 'AI LIVE' : 'STOPPED'}
                </span>
              </div>
            </div>

            {/* Control Panel inside webcam overlay */}
            <div className="relative z-10 flex items-center justify-between mt-auto">
              <div className="flex gap-3">
                <button
                  onClick={toggleScanner}
                  className={`px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all ${
                    isScanning
                      ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20'
                  }`}
                >
                  {isScanning ? (
                    <>
                      <IoPause /> <span>Pause Scanner</span>
                    </>
                  ) : (
                    <>
                      <IoPlay /> <span>Start Live Scanner</span>
                    </>
                  )}
                </button>
              </div>

              <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 font-mono bg-slate-900/80 border border-slate-855 px-3 py-1.5 rounded-xl backdrop-blur-md">
                <IoTimeOutline />
                <span>{new Date().toISOString().split('T')[0]} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          </div>

          {/* AI Recognition Panel & Controls (Right) */}
          <div className="space-y-6">
            {/* Control Selectors */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Target Section Settings</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Year</label>
                  <select
                    disabled={isClassTeacher}
                    value={selectedYear}
                    onChange={(e) => handleYearChange(e.target.value)}
                    className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium focus:outline-none ${isClassTeacher ? 'opacity-70 cursor-not-allowed text-slate-500' : 'text-slate-900 dark:text-white'}`}
                  >
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Class</label>
                  <select
                    disabled={isClassTeacher}
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium focus:outline-none ${isClassTeacher ? 'opacity-70 cursor-not-allowed text-slate-500' : 'text-slate-900 dark:text-white'}`}
                  >
                    {availableClasses.map((cls) => (
                      <option key={cls} value={cls}>{cls}</option>
                    ))}
                  </select>
                </div>

                <div className="pt-1">
                  <div className="p-2.5 bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 rounded-xl flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400 font-semibold">Target Lecture Section:</span>
                    <span className="font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">
                      CSE {selectedYear} - Sec {selectedClass.replace('CSE ', '')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Recognized Student Overlay Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm text-center">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 text-left">Last Detected Match</h3>
              {detectedStudent ? (
                detectedStudent.unrecognized ? (
                  <div className="bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 p-4 rounded-xl flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 flex items-center justify-center text-2xl font-bold border-2 border-rose-300">
                      <IoAlertCircleOutline className="text-3xl" />
                    </div>
                    <h4 className="text-base font-bold text-rose-700 dark:text-rose-300 mt-2 font-heading">Unrecognized Face</h4>
                    <p className="text-xs font-mono text-rose-500 mt-0.5">Biometrics Not Registered</p>
                    <div className="w-full border-t border-rose-200/50 dark:border-rose-900/50 pt-2.5 mt-3 text-xs text-rose-600 dark:text-rose-400 font-medium">
                      <span>No attendance recorded for unrecognized faces.</span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 p-4 rounded-xl flex flex-col items-center">
                    <img src={apiService.getAssetUrl(detectedStudent.avatar)} onError={(e) => apiService.handleImageError(e, detectedStudent.name)} alt={detectedStudent.name} className="w-16 h-16 rounded-full object-cover border-2 border-indigo-650 shadow-md" />
                    <h4 className="text-base font-bold text-slate-900 dark:text-white mt-2 font-heading">{detectedStudent.name}</h4>
                    <div className="flex items-center gap-2 mt-0.5 text-xs">
                      <span className="font-mono font-bold text-slate-500 dark:text-slate-400">{detectedStudent.registerNo}</span>
                      {detectedStudent.rollNo && detectedStudent.rollNo !== '---' && (
                        <span className="font-mono text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded">
                          Roll: {detectedStudent.rollNo}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2 w-full border-t border-slate-200/50 dark:border-slate-800 pt-3 mt-3 text-xs text-center">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Confidence</span>
                        <span className="font-bold text-emerald-600">{detectedStudent.confidence}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Session</span>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">{detectedStudent.session || 'Morning'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Status</span>
                        <span className={`font-bold ${detectedStudent.status === 'Present' ? 'text-emerald-600' : 'text-rose-500'}`}>
                          {detectedStudent.status}
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-2 font-mono">Recognized at {detectedStudent.time}</p>
                  </div>
                )
              ) : (
                <div className="py-8 text-center text-slate-400 text-sm flex flex-col items-center">
                  <IoAlertCircleOutline className="text-3xl mb-2 text-slate-350" />
                  <span>Waiting for biometrics data...</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Live Attendance Log Table (Full width below) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 text-left">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white font-heading mb-4">Active Scanning Log</h3>
          <div className="overflow-x-auto max-h-80">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-xs font-bold uppercase text-slate-400 tracking-wider">
                  <th className="pb-3">Student Name</th>
                  <th className="pb-3">Register Number</th>
                  <th className="pb-3">Time</th>
                  <th className="pb-3">Accuracy Match</th>
                  <th className="pb-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400">
                      No scans completed in this session. Start feed to register hits.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/20 transition-colors">
                      <td className="py-3 flex items-center gap-2.5">
                        <img src={apiService.getAssetUrl(log.avatar)} onError={(e) => apiService.handleImageError(e, log.name)} alt={log.name} className="w-7 h-7 rounded-full object-cover" />
                        <span className="font-semibold text-slate-900 dark:text-white">{log.name}</span>
                      </td>
                      <td className="py-3 font-mono font-bold text-slate-500 dark:text-slate-400">{log.registerNo}</td>
                      <td className="py-3 text-slate-450 font-medium">{log.time}</td>
                      <td className="py-3 text-emerald-600 font-bold">{log.confidence}</td>
                      <td className="py-3 text-right">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          log.status === 'Present'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-450'
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-455'
                        }`}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </LayoutComponent>
  );
}
