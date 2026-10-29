import React, { useState, useRef, useEffect } from 'react';
import { IoCalendarOutline, IoChevronBack, IoChevronForward, IoClose } from 'react-icons/io5';
import { formatStudentDate, getISTTodayString } from '../utils/dateUtils';

export default function StudentDatePicker({
  value,
  onChange,
  placeholder = 'DD/MM/YYYY',
  className = '',
  required = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Parse internal value YYYY-MM-DD or default to IST today
  const getInitialYearMonth = () => {
    let dateStr = value || getISTTodayString();
    if (dateStr && dateStr.includes('-')) {
      const [y, m] = dateStr.split('-');
      return { year: parseInt(y, 10), month: parseInt(m, 10) - 1 };
    }
    const today = getISTTodayString().split('-');
    return { year: parseInt(today[0], 10), month: parseInt(today[1], 10) - 1 };
  };

  const [viewState, setViewState] = useState(getInitialYearMonth);

  useEffect(() => {
    if (value && value.includes('-')) {
      const [y, m] = value.split('-');
      setViewState({ year: parseInt(y, 10), month: parseInt(m, 10) - 1 });
    }
  }, [value]);

  // Close calendar popup on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePrevMonth = (e) => {
    e.preventDefault();
    setViewState(prev => {
      if (prev.month === 0) {
        return { year: prev.year - 1, month: 11 };
      }
      return { year: prev.year, month: prev.month - 1 };
    });
  };

  const handleNextMonth = (e) => {
    e.preventDefault();
    setViewState(prev => {
      if (prev.month === 11) {
        return { year: prev.year + 1, month: 0 };
      }
      return { year: prev.year, month: prev.month + 1 };
    });
  };

  const handleSelectDay = (dayNum) => {
    const yStr = String(viewState.year);
    const mStr = String(viewState.month + 1).padStart(2, '0');
    const dStr = String(dayNum).padStart(2, '0');
    const isoString = `${yStr}-${mStr}-${dStr}`;
    onChange(isoString);
    setIsOpen(false);
  };

  const handleSelectToday = (e) => {
    e.preventDefault();
    const todayIso = getISTTodayString();
    const [y, m] = todayIso.split('-');
    setViewState({ year: parseInt(y, 10), month: parseInt(m, 10) - 1 });
    onChange(todayIso);
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
  };

  // Render Calendar Grid
  const renderCalendarGrid = () => {
    const { year, month } = viewState;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sun

    // Convert Sunday=0 to Monday=0
    const startDay = (firstDayIndex + 6) % 7;

    const days = [];
    for (let i = 0; i < startDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-8" />);
    }

    const todayIso = getISTTodayString();
    const selectedIso = value;

    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = String(d).padStart(2, '0');
      const mStr = String(month + 1).padStart(2, '0');
      const currentIso = `${year}-${mStr}-${dStr}`;

      const isToday = currentIso === todayIso;
      const isSelected = currentIso === selectedIso;

      days.push(
        <button
          key={`day-${d}`}
          type="button"
          onClick={() => handleSelectDay(d)}
          className={`h-8 w-8 rounded-lg text-xs font-semibold flex items-center justify-center transition-all ${
            isSelected
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-bold scale-105'
              : isToday
              ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-200 dark:border-indigo-800'
              : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          {d}
        </button>
      );
    }
    return days;
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const visibleText = value ? formatStudentDate(value) : '';

  const handleYearChange = (newYear) => {
    setViewState(prev => ({ ...prev, year: newYear }));
  };

  const currentISTYear = parseInt(getISTTodayString().split('-')[0], 10);
  const minYear = Math.min(1970, viewState.year - 20);
  const maxYear = Math.max(2100, viewState.year + 20);
  const yearsList = [];
  for (let y = minYear; y <= maxYear; y++) {
    yearsList.push(y);
  }

  return (
    <div className={`relative inline-block ${className}`} ref={containerRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium cursor-pointer focus-within:ring-2 focus-within:ring-indigo-500 shadow-sm transition-all"
      >
        <div className="flex items-center gap-2 flex-1 min-w-[120px]">
          <IoCalendarOutline className="text-indigo-500 text-sm shrink-0" />
          <span className={visibleText ? 'font-semibold tracking-wide text-slate-900 dark:text-white' : 'text-slate-400'}>
            {visibleText || placeholder}
          </span>
        </div>

        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
            title="Clear date"
          >
            <IoClose className="text-sm" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute left-0 mt-2 z-50 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-4 animate-in fade-in zoom-in-95 duration-150">
          {/* Header Month / Year controls */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
            >
              <IoChevronBack className="text-sm" />
            </button>

            <div className="flex items-center gap-1">
              <span className="text-xs font-bold text-slate-900 dark:text-white font-heading">
                {monthNames[viewState.month]}
              </span>
              <select
                value={viewState.year}
                onChange={(e) => handleYearChange(parseInt(e.target.value, 10))}
                className="bg-transparent text-xs font-bold text-indigo-600 dark:text-indigo-400 font-heading cursor-pointer focus:outline-none hover:underline border-none p-0"
              >
                {yearsList.map((y) => (
                  <option key={y} value={y} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-sans">
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
            >
              <IoChevronForward className="text-sm" />
            </button>
          </div>

          {/* Weekday Labels */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((wd) => (
              <span key={wd} className="text-[10px] font-bold text-slate-400 uppercase">
                {wd}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 justify-items-center">
            {renderCalendarGrid()}
          </div>

          {/* Footer Actions */}
          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={handleSelectToday}
              className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Today
            </button>
            <span className="text-[10px] text-slate-400 font-mono">
              IST (Asia/Kolkata)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
