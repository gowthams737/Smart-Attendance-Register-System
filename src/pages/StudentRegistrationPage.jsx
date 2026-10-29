import React, { useState } from 'react';
import DashboardLayout from '../layouts/DashboardLayout';
import { useToast } from '../context/ToastContext';
import { DEPARTMENTS, SECTIONS, YEARS } from '../data/dummyData';
import { IoImageOutline, IoCloudUploadOutline, IoPersonOutline, IoCloseCircle } from 'react-icons/io5';
import { apiService } from '../services/api';

export default function StudentRegistrationPage() {
  const { showToast } = useToast();

  const adminSession = React.useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('adminSession') || '{}');
    } catch {
      return {};
    }
  }, []);

  const isClassTeacher = adminSession?.role === 'class_teacher' || adminSession?.is_hod === false;

  const [name, setName] = useState('');
  const [registerNo, setRegisterNo] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [gender, setGender] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState(DEPARTMENTS[0]);
  const [year, setYear] = useState(() => (isClassTeacher && adminSession.year ? adminSession.year : YEARS[0]));
  const [section, setSection] = useState(() => {
    if (isClassTeacher && (adminSession.class || adminSession.section)) {
      const sec = (adminSession.class || adminSession.section).replace(/^CSE\s*/i, '').replace(/^SEC(TION)?\s*/i, '').trim().toUpperCase();
      return SECTIONS.includes(sec) ? sec : SECTIONS[0];
    }
    return SECTIONS[0];
  });

  // Image Upload States
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFiles, setImageFiles] = useState([]);
  const [errors, setErrors] = useState({});

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      for (const file of files) {
        if (file.size > 2 * 1024 * 1024) {
          showToast(`Image ${file.name} size should be less than 2MB`, 'error');
          return;
        }
      }
      setImageFiles(files);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(files[0]);
      showToast(`${files.length} images selected successfully`, 'success');
    }
  };

  const removeImage = () => {
    setImagePreview(null);
    setImageFiles([]);
  };

  const validate = () => {
    const err = {};
    if (!name.trim()) err.name = 'Full Name is required';
    if (!registerNo.trim()) err.registerNo = 'Register Number is required';
    if (!rollNo.trim()) err.rollNo = 'Roll No is required';
    if (!gender) err.gender = 'Gender is required';
    if (!email.trim()) {
      err.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email.trim())) {
      err.email = 'Email address is invalid';
    }
    if (!phone.trim()) {
      err.phone = 'Phone number is required';
    } else if (!/^\+?[0-9\s-]{8,15}$/.test(phone.trim())) {
      err.phone = 'Invalid phone number format';
    }
    if (!imagePreview) {
      err.image = 'Profile image is required for Face Biometrics enrollment';
    }
    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!validate()) {
      showToast('Please fix validation errors before submitting', 'error');
      return;
    }

    try {
      // 1. Create student record with Roll No & Gender
      const studentData = {
        name: name.trim(),
        registerNo: registerNo.trim(),
        rollNo: rollNo.trim(),
        department,
        year,
        section,
        gender,
        email: email.trim(),
        phone: phone.trim()
      };
      await apiService.createStudent(studentData);
      
      // 2. Upload multiple biometrics images
      if (imageFiles.length > 0) {
        await apiService.uploadStudentImages(registerNo.trim(), imageFiles);
      }

      showToast(`Registration Successful! ${name} has been enrolled in the database.`, 'success');

      // Reset Form
      setName('');
      setRegisterNo('');
      setRollNo('');
      setGender('');
      setEmail('');
      setPhone('');
      setImagePreview(null);
      setImageFiles([]);
      setErrors({});
    } catch (err) {
      showToast(err.message || 'Registration failed. Please try again.', 'error');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white font-heading tracking-tight">Student Registration</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Enroll a new student and generate training weights for the facial recognition database.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Registration Form (Left) */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 rounded-2xl shadow-sm text-left">
            <h3 className="text-lg font-bold text-slate-905 dark:text-white font-heading mb-6">Biometric Enrollment Form</h3>

            <form onSubmit={handleRegister} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-450 uppercase mb-1.5 tracking-wider">Full Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/25 ${
                      errors.name ? 'border-rose-500 ring-2 ring-rose-500/10' : 'border-slate-200 dark:border-slate-850'
                    }`}
                    placeholder=""
                  />
                  {errors.name && <p className="text-xs text-rose-500 mt-1 font-semibold">{errors.name}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-450 uppercase mb-1.5 tracking-wider">Register Number *</label>
                  <input
                    type="text"
                    value={registerNo}
                    onChange={(e) => setRegisterNo(e.target.value)}
                    className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border rounded-xl text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/25 ${
                      errors.registerNo ? 'border-rose-500 ring-2 ring-rose-500/10' : 'border-slate-200 dark:border-slate-850'
                    }`}
                    placeholder=""
                  />
                  {errors.registerNo && <p className="text-xs text-rose-500 mt-1 font-semibold">{errors.registerNo}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-450 uppercase mb-1.5 tracking-wider">Roll No *</label>
                  <input
                    type="text"
                    value={rollNo}
                    onChange={(e) => setRollNo(e.target.value)}
                    className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border rounded-xl text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/25 ${
                      errors.rollNo ? 'border-rose-500 ring-2 ring-rose-500/10' : 'border-slate-200 dark:border-slate-850'
                    }`}
                    placeholder=""
                  />
                  {errors.rollNo && <p className="text-xs text-rose-500 mt-1 font-semibold">{errors.rollNo}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-450 uppercase mb-1.5 tracking-wider">Department</label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-sm focus:outline-none"
                  >
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-450 uppercase mb-1.5 tracking-wider">Year</label>
                      <select
                        disabled={isClassTeacher}
                        value={year}
                        onChange={(e) => setYear(e.target.value)}
                        className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-sm focus:outline-none ${isClassTeacher ? 'opacity-70 cursor-not-allowed text-slate-500' : ''}`}
                      >
                        {YEARS.map((y) => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-450 uppercase mb-1.5 tracking-wider">Section</label>
                      <select
                        disabled={isClassTeacher}
                        value={section}
                        onChange={(e) => setSection(e.target.value)}
                        className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-sm focus:outline-none ${isClassTeacher ? 'opacity-70 cursor-not-allowed text-slate-500' : ''}`}
                      >
                        {SECTIONS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-450 uppercase mb-1.5 tracking-wider">Gender *</label>
                  <select
                    value={gender}
                    onChange={(e) => {
                      setGender(e.target.value);
                      if (errors.gender) {
                        setErrors(prev => ({ ...prev, gender: null }));
                      }
                    }}
                    className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/25 ${
                      errors.gender ? 'border-rose-500 ring-2 ring-rose-500/10' : 'border-slate-200 dark:border-slate-850'
                    }`}
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                  {errors.gender && <p className="text-xs text-rose-500 mt-1 font-semibold">{errors.gender}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-450 uppercase mb-1.5 tracking-wider">Email Address *</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/25 ${
                      errors.email ? 'border-rose-500 ring-2 ring-rose-500/10' : 'border-slate-200 dark:border-slate-850'
                    }`}
                    placeholder=""
                  />
                  {errors.email && <p className="text-xs text-rose-500 mt-1 font-semibold">{errors.email}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-450 uppercase mb-1.5 tracking-wider">Phone Number *</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/25 ${
                      errors.phone ? 'border-rose-500 ring-2 ring-rose-500/10' : 'border-slate-200 dark:border-slate-850'
                    }`}
                    placeholder=""
                  />
                  {errors.phone && <p className="text-xs text-rose-500 mt-1 font-semibold">{errors.phone}</p>}
                </div>
              </div>

              {/* Drag and Drop Image Upload */}
              <div>
                <label className="block text-xs font-bold text-slate-450 uppercase mb-1.5 tracking-wider">Biometric Face Image *</label>
                {!imagePreview ? (
                  <div className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
                    errors.image ? 'border-rose-500 bg-rose-500/5' : 'border-slate-200 dark:border-slate-800 hover:border-indigo-500/50'
                  }`}>
                    <IoCloudUploadOutline className="text-4xl text-slate-400 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-350">Drag & drop student profile photo</p>
                    <p className="text-xs text-slate-450 dark:text-slate-500 mt-1">Supports PNG, JPG up to 2MB. Clear passport size preferred.</p>
                    <label className="mt-4 inline-flex px-4 py-2 bg-indigo-50 dark:bg-indigo-950 text-indigo-650 dark:text-indigo-400 text-xs font-bold rounded-lg cursor-pointer hover:bg-indigo-100/80 transition-colors">
                      Browse Files
                      <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageChange} />
                    </label>
                  </div>
                ) : (
                  <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 aspect-video max-w-sm">
                    <img src={imagePreview} alt="Uploaded Face Preview" className="w-full h-full object-cover" />
                    <div className="absolute top-2 right-2">
                      <button type="button" onClick={removeImage} className="text-rose-500 hover:text-rose-700 bg-white dark:bg-slate-900 rounded-full p-0.5">
                        <IoCloseCircle className="text-2xl" />
                      </button>
                    </div>
                  </div>
                )}
                {errors.image && <p className="text-xs text-rose-500 mt-1.5 font-semibold">{errors.image}</p>}
              </div>

              <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg transition-colors">
                Enlist Student & Train Weights
              </button>
            </form>
          </div>

          {/* Live Preview (Right Side) */}
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl flex flex-col items-center justify-between text-center sticky top-24 h-[28rem]">
            <div className="w-full">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-6">Live Identity Card Preview</span>

              {/* Mock Student Card */}
              <div className="bg-white dark:bg-slate-950 rounded-2xl p-6 border border-slate-200 dark:border-slate-850 shadow-md flex flex-col items-center relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-700"></div>

                {imagePreview ? (
                  <img src={imagePreview} alt="Card Avatar" className="w-24 h-24 rounded-full object-cover border-4 border-slate-50 dark:border-slate-900 shadow-md" />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-4xl text-slate-400 border border-slate-200 dark:border-slate-700">
                    <IoPersonOutline />
                  </div>
                )}

                <h4 className="text-lg font-bold text-slate-900 dark:text-white mt-4 truncate max-w-full font-heading">
                  {name || 'Student Name'}
                </h4>
                <p className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                  {registerNo || 'REGNUMBER'} {rollNo ? `| Roll: ${rollNo}` : ''}
                </p>

                <div className="w-full border-t border-slate-100 dark:border-slate-850 my-4"></div>

                <div className="grid grid-cols-2 gap-y-2.5 gap-x-2 text-left w-full text-xs">
                  <div>
                    <span className="text-slate-400 block font-semibold uppercase tracking-wider">Dept</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300 truncate block">{department.split(' ')[0]}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold uppercase tracking-wider">Class</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300 block">{year.split(' ')[0]} - {section}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold uppercase tracking-wider">Gender</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300 block">{gender || '---'}</span>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-450 dark:text-slate-500 italic max-w-[15rem]">
              Fields update reactively. Verify spelling before clicking register button.
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
