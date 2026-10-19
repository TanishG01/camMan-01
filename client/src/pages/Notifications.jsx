import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../contexts/NotificationContext';
import { Bell, ArrowLeft, CheckCheck, Clock, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function Notifications() {
  const navigate = useNavigate();
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-xs font-semibold text-slate-500 hover:text-slate-800 mb-4 inline-flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
        </button>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Notification Center</h1>
            <p className="text-slate-500 text-sm mt-1">
              Operational updates • Event reminders • Overdue gear alerts • Mentorship flags
            </p>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-sm"
            >
              <CheckCheck className="w-4 h-4 text-emerald-600" />
              Mark all read
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
            <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">Inbox Zero</h3>
            <p className="text-xs text-slate-500 mt-1">You have no active alerts or reminders right now.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map(n => (
              <div
                key={n._id}
                onClick={() => !n.isRead && markRead(n._id)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                  n.isRead ? 'bg-white border-slate-200 opacity-80' : 'bg-indigo-50/40 border-indigo-200 shadow-sm'
                }`}
              >
                <div className={`p-2 rounded-xl shrink-0 ${
                  n.isRead ? 'bg-slate-100 text-slate-400' : 'bg-indigo-600 text-white'
                }`}>
                  <Bell className="w-4 h-4" />
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="text-sm font-bold text-slate-900">{n.title}</h3>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 font-medium">{n.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
