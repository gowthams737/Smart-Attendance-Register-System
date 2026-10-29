const API_BASE_URL = '/api';

async function handleResponse(response) {
  const isLoginRequest = response.url && response.url.includes('/auth/login');
  if (response.status === 401 && !isLoginRequest) {
    localStorage.removeItem('adminSession');
    localStorage.removeItem('studentSession');
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    throw new Error("Session expired. Please sign in again.");
  }
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.detail || `HTTP error! status: ${response.status}`;
    throw new Error(errorMessage);
  }
  return response.json();
}

async function authFetch(url, options = {}) {
  const headers = { ...options.headers };
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  let sessionString = null;
  
  if (pathname.startsWith('/admin') || pathname.startsWith('/advisor') || url.includes('/reports/') || url.includes('/students') || url.includes('/auth/admins')) {
    sessionString = localStorage.getItem('adminSession') || localStorage.getItem('studentSession');
  } else if (pathname.startsWith('/student') || url.includes('/student/')) {
    sessionString = localStorage.getItem('studentSession') || localStorage.getItem('adminSession');
  } else {
    sessionString = localStorage.getItem('adminSession') || localStorage.getItem('studentSession');
  }

  if (sessionString) {
    try {
      const session = JSON.parse(sessionString);
      if (session && session.token) {
        headers['Authorization'] = `Bearer ${session.token}`;
      }
    } catch (e) {
      console.error('Error parsing session', e);
    }
  }
  return fetch(url, {
    ...options,
    headers
  });
}


export const apiService = {
  // Auth
  async login(email, password) {
    const response = await authFetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return handleResponse(response);
  },

  async logout() {
    const response = await authFetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST'
    });
    return handleResponse(response);
  },

  async getProfile() {
    const response = await authFetch(`${API_BASE_URL}/auth/profile`);
    return handleResponse(response);
  },

  async updateProfile(profileData) {
    const response = await authFetch(`${API_BASE_URL}/auth/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profileData),
    });
    return handleResponse(response);
  },

  async changePassword(passwordData) {
    const response = await authFetch(`${API_BASE_URL}/auth/change-password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(passwordData),
    });
    return handleResponse(response);
  },

  // Students
  async getStudents(search = '', department = 'All', year = 'All', section = 'All') {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (department && department !== 'All') params.append('department', department);
    if (year && year !== 'All') params.append('year', year);
    if (section && section !== 'All' && section !== 'All Sections' && section !== 'All Classes') params.append('section', section);

    const response = await authFetch(`${API_BASE_URL}/students?${params.toString()}`);
    return handleResponse(response);
  },

  async getStudent(id) {
    const response = await authFetch(`${API_BASE_URL}/students/${id}`);
    return handleResponse(response);
  },

  async createStudent(studentData) {
    const response = await authFetch(`${API_BASE_URL}/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(studentData),
    });
    return handleResponse(response);
  },

  async updateStudent(id, studentData) {
    const response = await authFetch(`${API_BASE_URL}/students/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(studentData),
    });
    return handleResponse(response);
  },

  async deleteStudent(id) {
    const response = await authFetch(`${API_BASE_URL}/students/${id}`, {
      method: 'DELETE',
    });
    return handleResponse(response);
  },

  async uploadStudentImages(registerNo, files) {
    const formData = new FormData();
    formData.append('registerNo', registerNo);
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    const response = await authFetch(`${API_BASE_URL}/students/upload`, {
      method: 'POST',
      body: formData,
    });
    return handleResponse(response);
  },

  async deleteStudentImage(registerNo, imagePath) {
    const response = await authFetch(`${API_BASE_URL}/students/${registerNo}/images?imagePath=${encodeURIComponent(imagePath)}`, {
      method: 'DELETE',
    });
    return handleResponse(response);
  },

  // Attendance
  async getAttendanceHistory(registerNo = '', date = '', status = '', department = '', year = '', session = '', search = '', section = '') {
    const params = new URLSearchParams();
    if (registerNo) params.append('registerNo', registerNo);
    if (date) params.append('date', date);
    if (status) params.append('status', status);
    if (department) params.append('department', department);
    if (year) params.append('year', year);
    if (session) params.append('session', session);
    if (search) params.append('search', search);
    if (section) params.append('section', section);

    const response = await authFetch(`${API_BASE_URL}/attendance?${params.toString()}`);
    return handleResponse(response);
  },

  async recordAttendance(attendanceData) {
    const response = await authFetch(`${API_BASE_URL}/attendance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(attendanceData),
    });
    return handleResponse(response);
  },

  async correctAttendance(correctionData) {
    const response = await authFetch(`${API_BASE_URL}/attendance/correct`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(correctionData),
    });
    return handleResponse(response);
  },

  async resetAttendance(resetData) {
    const response = await authFetch(`${API_BASE_URL}/attendance/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(resetData),
    });
    return handleResponse(response);
  },

  async getResetHistory() {
    const response = await authFetch(`${API_BASE_URL}/attendance/resets`);
    return handleResponse(response);
  },

  async undoReset(resetId) {
    const response = await authFetch(`${API_BASE_URL}/attendance/reset/${resetId}/undo`, {
      method: 'POST',
    });
    return handleResponse(response);
  },

  // Dashboard
  async getDashboardData() {
    const response = await authFetch(`${API_BASE_URL}/dashboard`);
    return handleResponse(response);
  },

  // Settings
  async getSettings() {
    const response = await authFetch(`${API_BASE_URL}/settings`);
    return handleResponse(response);
  },

  async updateSettings(settingsData) {
    const response = await authFetch(`${API_BASE_URL}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settingsData),
    });
    return handleResponse(response);
  },

  // Live Scanner
  async scanFace(imageBlob) {
    const formData = new FormData();
    formData.append('file', imageBlob, 'webcam.jpg');
    const response = await authFetch(`${API_BASE_URL}/scanner/recognize`, {
      method: 'POST',
      body: formData
    });
    return handleResponse(response);
  },

  // Reports & Analytics Stats
  async getReportsStats(year = 'All', section = 'All', date = '', session = '', status = '') {
    const params = new URLSearchParams();
    if (year) params.append('year', year);
    if (section && section !== 'All' && section !== 'All Classes') params.append('section', section);
    if (date) params.append('date', date);
    if (session) params.append('session', session);
    if (status) params.append('status', status);
    const response = await authFetch(`${API_BASE_URL}/reports/stats?${params.toString()}`);
    return handleResponse(response);
  },

  // Download Reports (Authenticated Binary Blob Download)
  async downloadReport(params = {}) {
    const searchParams = new URLSearchParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
        searchParams.append(key, params[key]);
      }
    });

    const response = await authFetch(`${API_BASE_URL}/reports/download?${searchParams.toString()}`);
    
    if (response.status === 401) {
      localStorage.removeItem('adminSession');
      window.location.href = '/login';
      throw new Error("Session expired. Please sign in again.");
    }

    if (!response.ok) {
      const contentType = response.headers.get('content-type') || response.headers.get('Content-Type');
      let errorMessage = `Download failed (Status: ${response.status})`;
      if (contentType && contentType.includes('application/json')) {
        const errorData = await response.json().catch(() => ({}));
        errorMessage = errorData.detail || errorMessage;
      }
      throw new Error(errorMessage);
    }

    // Check if server returned a JSON error response despite 200 status
    const responseContentType = response.headers.get('content-type') || response.headers.get('Content-Type') || '';
    if (responseContentType.includes('application/json')) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || "Server returned JSON instead of binary report file.");
    }

    // Determine clean extension based on requested type
    const requestedType = (params.type || 'excel').toLowerCase();
    const ext = requestedType === 'pdf' ? 'pdf' : (requestedType === 'csv' ? 'csv' : 'xlsx');

    // Extract filename from Content-Disposition header if available
    const disposition = response.headers.get('Content-Disposition') || response.headers.get('content-disposition');
    let targetFilename = '';
    if (disposition) {
      const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
      if (utf8Match && utf8Match[1]) {
        targetFilename = decodeURIComponent(utf8Match[1].trim());
      } else {
        const filenameMatch = disposition.match(/filename=["']?([^"';]+)["']?/i);
        if (filenameMatch && filenameMatch[1]) {
          targetFilename = filenameMatch[1].trim();
        }
      }
    }

    if (targetFilename) {
      targetFilename = targetFilename.replace(/["'\r\n]/g, '').trim();
    }

    // Check if filename is missing or looks like a UUID or generic temp string
    const isUuidOrTemp = (name) => {
      if (!name) return true;
      const clean = name.replace(/\.[^/.]+$/, '').trim();
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean)) return true;
      if (/^(download|export|blob|temp|tmp|file)/i.test(clean)) return true;
      return false;
    };

    if (isUuidOrTemp(targetFilename)) {
      const sanitizePart = (text) => {
        if (!text) return '';
        return String(text).trim().replace(/[\\/*?:"<>|\s]+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
      };

      const toDDMMYYYYDash = (dStr) => {
        if (!dStr) return '';
        const s = String(dStr).trim();
        const isoDate = s.split('T')[0];
        if (isoDate.includes('-')) {
          const p = isoDate.split('-');
          if (p.length === 3) {
            if (p[0].length === 4) return `${p[2].padStart(2, '0')}-${p[1].padStart(2, '0')}-${p[0]}`;
            if (p[2].length === 4) return `${p[0].padStart(2, '0')}-${p[1].padStart(2, '0')}-${p[2]}`;
          }
        } else if (isoDate.includes('/')) {
          const p = isoDate.split('/');
          if (p.length === 3) {
            if (p[2].length === 4) return `${p[0].padStart(2, '0')}-${p[1].padStart(2, '0')}-${p[2]}`;
            if (p[0].length === 4) return `${p[2].padStart(2, '0')}-${p[1].padStart(2, '0')}-${p[0]}`;
          }
        }
        return s.replace(/\//g, '-');
      };

      const parts = ['Attendance', 'Report'];

      const studentName = params.studentName || params.student_name || params.student || params.search;
      if (studentName && String(studentName).trim()) {
        const sClean = sanitizePart(studentName);
        if (sClean) parts.push(sClean);
      }

      const year = params.year;
      if (year && !['All', 'all', 'All Years', 'None', ''].includes(String(year).trim())) {
        const yClean = sanitizePart(year);
        if (yClean) parts.push(yClean);
      } else if (!studentName) {
        parts.push('All_Years');
      }

      const section = params.section || params.class;
      if (section && !['All', 'all', 'All Classes', 'None', ''].includes(String(section).trim())) {
        let secClean = sanitizePart(section);
        if (/^[A-E]$/i.test(secClean)) {
          secClean = `CSE_${secClean.toUpperCase()}`;
        }
        if (secClean) parts.push(secClean);
      }

      const fromDate = params.fromDate || params.startDate;
      const toDate = params.toDate || params.endDate;
      const fdFormatted = toDDMMYYYYDash(fromDate);
      const tdFormatted = toDDMMYYYYDash(toDate);

      if (fdFormatted && tdFormatted && fdFormatted !== tdFormatted) {
        parts.push(`${fdFormatted}_to_${tdFormatted}`);
      } else if (params.date && !['All', 'all', 'All Dates', 'None', ''].includes(String(params.date).trim())) {
        const dVal = String(params.date).trim();
        if (dVal.includes('_to_') || dVal.includes(' to ')) {
          const rawParts = dVal.replace(' to ', '_to_').split('_to_');
          const p1 = toDDMMYYYYDash(rawParts[0]);
          const p2 = rawParts[1] ? toDDMMYYYYDash(rawParts[1]) : '';
          if (p1 && p2) parts.push(`${p1}_to_${p2}`);
          else if (p1) parts.push(p1);
        } else {
          const singleD = toDDMMYYYYDash(dVal);
          if (singleD) parts.push(singleD);
          else {
            const now = new Date();
            parts.push(`${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`);
          }
        }
      } else {
        const now = new Date();
        parts.push(`${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`);
      }

      targetFilename = `${parts.join('_')}.${ext}`;
    }

    // Ensure correct file extension
    if (!targetFilename.toLowerCase().endsWith(`.${ext}`)) {
      targetFilename = `${targetFilename.replace(/\.[^/.]+$/, '')}.${ext}`;
    }

    // Read response as ArrayBuffer to handle raw binary data reliably
    const arrayBuffer = await response.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      throw new Error("The server returned an empty file (0 bytes).");
    }

    const mimeType = ext === 'pdf' 
      ? 'application/pdf' 
      : (ext === 'csv' 
          ? 'text/csv' 
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    const fileBlob = new Blob([arrayBuffer], { type: mimeType });
    const url = window.URL.createObjectURL(fileBlob);
    
    const link = document.createElement('a');
    link.style.display = 'none';
    link.download = targetFilename;
    link.setAttribute('download', targetFilename);
    link.href = url;
    
    document.body.appendChild(link);
    link.click();
    
    setTimeout(() => {
      if (link.parentNode) {
        link.parentNode.removeChild(link);
      }
      window.URL.revokeObjectURL(url);
    }, 1000);
  },

  // Student Portal APIs
  async getStudentMe() {
    const response = await authFetch(`${API_BASE_URL}/student/me`);
    return handleResponse(response);
  },

  async getStudentSummary() {
    const response = await authFetch(`${API_BASE_URL}/student/summary`);
    return handleResponse(response);
  },

  async getStudentAttendance(date = '', status = '') {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (status) params.append('status', status);

    const response = await authFetch(`${API_BASE_URL}/student/attendance?${params.toString()}`);
    return handleResponse(response);
  },

  async getStudentLeave() {
    const response = await authFetch(`${API_BASE_URL}/student/leave`);
    return handleResponse(response);
  },

  async applyStudentLeave(leaveData) {
    const response = await authFetch(`${API_BASE_URL}/student/leave`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(leaveData),
    });
    return handleResponse(response);
  },

  async changeStudentPassword(oldPassword, newPassword, confirmPassword) {
    const response = await authFetch(`${API_BASE_URL}/student/change-password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPassword, newPassword, confirmPassword }),
    });
    return handleResponse(response);
  },

  async cancelStudentLeave(leaveId) {
    const response = await authFetch(`${API_BASE_URL}/student/leave/${leaveId}/cancel`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
    });
    return handleResponse(response);
  },

  async applyStudentLeaveLetter(letterData) {
    const response = await authFetch(`${API_BASE_URL}/student/leave-letter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(letterData),
    });
    return handleResponse(response);
  },

  async getStudentLeaveLetters() {
    const response = await authFetch(`${API_BASE_URL}/student/leave-letter`);
    return handleResponse(response);
  },

  async getStudentNotifications() {
    const response = await authFetch(`${API_BASE_URL}/student/notifications`);
    return handleResponse(response);
  },

  async markStudentNotificationsRead() {
    const response = await authFetch(`${API_BASE_URL}/student/notifications/read-all`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
    });
    return handleResponse(response);
  },

  // Admin Leave & Notification APIs
  async getAdminLeaveLetters() {
    const response = await authFetch(`${API_BASE_URL}/reports/leave-letters`);
    return handleResponse(response);
  },

  async updateLeaveLetterStatus(letterId, status, adminResponse = '') {
    const response = await authFetch(`${API_BASE_URL}/reports/leave-letters/${letterId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, adminResponse }),
    });
    return handleResponse(response);
  },

  async getAdminAllLeaves() {
    const response = await authFetch(`${API_BASE_URL}/reports/all-leaves`);
    return handleResponse(response);
  },

  async updateAdminLeaveStatus(leaveId, status, adminResponse = '') {
    const response = await authFetch(`${API_BASE_URL}/reports/leaves/${leaveId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, adminResponse }),
    });
    return handleResponse(response);
  },

  async getAdminNotifications() {
    const response = await authFetch(`${API_BASE_URL}/reports/admin-notifications`);
    return handleResponse(response);
  },

  async markAdminNotificationsRead() {
    const response = await authFetch(`${API_BASE_URL}/reports/admin-notifications/read-all`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
    });
    return handleResponse(response);
  },

  // Admin Management APIs
  async getAdmins() {
    const response = await authFetch(`${API_BASE_URL}/auth/admins`);
    return handleResponse(response);
  },

  async addAdmin(adminData) {
    const response = await authFetch(`${API_BASE_URL}/auth/admins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adminData),
    });
    return handleResponse(response);
  },

  async deleteAdmin(adminId) {
    const response = await authFetch(`${API_BASE_URL}/auth/admins/${adminId}`, {
      method: 'DELETE',
    });
    return handleResponse(response);
  }
};



