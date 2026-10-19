import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import {
  Camera, Calendar, HardDrive, Bell, Shield, LogOut, CheckCircle2,
  AlertTriangle, Clock, MapPin, Users, Film, ArrowRight, Database,
  FileSpreadsheet, ShieldAlert, Sparkles, RefreshCw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { festsApi } from '../services/endpoints/fests';
import { equipmentApi } from '../services/endpoints/equipment';
import { eventsApi } from '../services/endpoints/events';

export default function Dashboard() {
  const { user, logout, isAdmin, isSenior } = useAuth();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();

  const [fests, setFests] = useState([]);
  const [activeFest, setActiveFest] = useState(null);
  const [events, setEvents] = useState([]);
  const [equipmentList, setEquipmentList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dbConnected, setDbConnected] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [festsRes, equipRes] = await Promise.all([
        festsApi.getFests(),
        equipmentApi.getEquipment()
      ]);

      const festData = festsRes.data.fests || [];
      const equipData = equipRes.data.equipment || [];

      setFests(festData);
      setEquipmentList(equipData);
      setDbConnected(true);

      const current = festData.find(f => f.status === 'active') || festData[0];
      if (current) {
        setActiveFest(current);
        try {
          const eventsRes = await eventsApi.getEvents(current._id);
          setEvents(eventsRes.data.events || []);
        } catch (_) {
          setEvents([]);
        }
      }
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setDbConnected(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Compute live metrics
  const totalScheduledEvents = fests.reduce((sum, f) => sum + (f.eventCount || 0), 0);
  const totalCameras = equipmentList.filter(e => e.category === 'camera').length;
  const activeCameras = equipmentList.filter(e => e.category === 'camera' && e.status === 'checked_out').length;
  const totalSDCards = equipmentList.filter(e => e.category === 'sd_card').length;
  const activeSDCards = equipmentList.filter(e => e.category === 'sd_card' && e.status === 'checked_out').length;
  const overdueReturns = equipmentList.filter(e => e.status === 'return_pending' || e.condition === 'damaged' || e.condition === 'lost').length;

  const handleImportClick = () => {
    if (activeFest?._id) {
      navigate(`/fests/${activeFest._id}/import`);
    } else {
      navigate('/fests');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-sm shadow-indigo-500/20">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-slate-900 tracking-tight text-lg">FestOps</span>
              <span className="ml-2 text-xs px-2 py-0.5 rounded-full font-semibold uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
                {user?.role}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Database indicator badge */}
            <div className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>DB Connected</span>
            </div>

            {/* Notification Bell */}
            <button
              onClick={() => navigate('/notifications')}
              className="relative p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            <span className="text-sm font-medium text-slate-700 hidden sm:inline">
              {user?.name} ({user?.seniority?.replace('_', ' ')})
            </span>

            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-red-600 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-red-200 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Dashboard Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {/* Header Greeting & DB Banner */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Welcome back, {user?.name}!
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Media Team Management Console • Role: <strong className="capitalize text-slate-800">{user?.role}</strong> ({user?.seniority?.replace('_', ' ')})
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadDashboardData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-sm transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Metric Cards - Live From Database */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div
            onClick={() => navigate('/fests')}
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all"
          >
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Scheduled Events</p>
              <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{totalScheduledEvents}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Across {fests.length} fest edition{fests.length !== 1 ? 's' : ''}</p>
            </div>
          </div>

          <div
            onClick={() => navigate('/equipment')}
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 cursor-pointer hover:border-emerald-300 hover:shadow-md transition-all"
          >
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <Camera className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Cameras</p>
              <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{activeCameras}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{totalCameras} camera bodies ready</p>
            </div>
          </div>

          <div
            onClick={() => navigate('/equipment')}
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 cursor-pointer hover:border-amber-300 hover:shadow-md transition-all"
          >
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <HardDrive className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">SD Cards In Field</p>
              <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{activeSDCards}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{totalSDCards} total cards registered</p>
            </div>
          </div>

          <div
            onClick={() => navigate('/equipment/checkout')}
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 cursor-pointer hover:border-rose-300 hover:shadow-md transition-all"
          >
            <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Overdue Returns</p>
              <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{overdueReturns}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Asset returns requiring action</p>
            </div>
          </div>
        </div>

        {/* Application Modules Grid (Direct Navigation Hub) */}
        <div className="mb-8">
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">
            Operations Navigation
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <button
              onClick={() => navigate('/fests')}
              className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-indigo-300 hover:shadow transition-all text-left flex flex-col justify-between"
            >
              <Calendar className="w-5 h-5 text-indigo-600 mb-2" />
              <div>
                <p className="text-sm font-bold text-slate-900">Fests & Ed.</p>
                <p className="text-[11px] text-slate-400">Events & Venues</p>
              </div>
            </button>

            <button
              onClick={() => navigate('/team')}
              className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-indigo-300 hover:shadow transition-all text-left flex flex-col justify-between"
            >
              <Users className="w-5 h-5 text-emerald-600 mb-2" />
              <div>
                <p className="text-sm font-bold text-slate-900">Team Roster</p>
                <p className="text-[11px] text-slate-400">Members & Roles</p>
              </div>
            </button>

            <button
              onClick={() => navigate('/equipment')}
              className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-indigo-300 hover:shadow transition-all text-left flex flex-col justify-between"
            >
              <Camera className="w-5 h-5 text-amber-600 mb-2" />
              <div>
                <p className="text-sm font-bold text-slate-900">Equipment</p>
                <p className="text-[11px] text-slate-400">Assets & Desk</p>
              </div>
            </button>

            <button
              onClick={() => navigate('/assignments/mentorship')}
              className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-indigo-300 hover:shadow transition-all text-left flex flex-col justify-between"
            >
              <ShieldAlert className="w-5 h-5 text-rose-600 mb-2" />
              <div>
                <p className="text-sm font-bold text-slate-900">Mentorship</p>
                <p className="text-[11px] text-slate-400">Junior-Senior</p>
              </div>
            </button>

            <button
              onClick={() => navigate('/coverage')}
              className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-indigo-300 hover:shadow transition-all text-left flex flex-col justify-between"
            >
              <MapPin className="w-5 h-5 text-sky-600 mb-2" />
              <div>
                <p className="text-sm font-bold text-slate-900">Coverage Hub</p>
                <p className="text-[11px] text-slate-400">Live Reports</p>
              </div>
            </button>

            <button
              onClick={() => navigate('/footage')}
              className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-indigo-300 hover:shadow transition-all text-left flex flex-col justify-between"
            >
              <Film className="w-5 h-5 text-purple-600 mb-2" />
              <div>
                <p className="text-sm font-bold text-slate-900">Footage Pipe</p>
                <p className="text-[11px] text-slate-400">Handovers & QC</p>
              </div>
            </button>
          </div>
        </div>

        {/* Live Operations Agenda & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-600" />
                Live Operations Agenda {activeFest && <span className="text-xs font-normal text-slate-500">• {activeFest.name}</span>}
              </h2>
              {activeFest && (
                <button
                  onClick={() => navigate(`/fests/${activeFest._id}/events`)}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1"
                >
                  View full schedule <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {loading ? (
              <div className="flex justify-center p-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
              </div>
            ) : events.length === 0 ? (
              <div className="p-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
                <p className="text-sm font-medium">No events currently registered for {activeFest?.name || 'fest'}.</p>
                <p className="text-xs mt-1 text-slate-400">Events will appear here as schedules are created or imported.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {events.slice(0, 5).map(event => (
                  <div
                    key={event._id}
                    onClick={() => navigate(`/fests/${activeFest?._id || event.festId}/events`)}
                    className="p-3.5 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-slate-50/70 transition-all cursor-pointer flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0">
                        {new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">{event.name}</h4>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            {event.venueId?.name || 'Auditorium'}
                          </span>
                          <span>•</span>
                          <span className="capitalize">{event.category || 'General'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        event.priority === 'critical' ? 'bg-red-50 text-red-700 border border-red-200' :
                        event.priority === 'high' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {event.priority || 'Normal'}
                      </span>
                      <span className="text-xs text-indigo-600 font-semibold hidden sm:inline">Details →</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-600" />
              Role Actions ({user?.role})
            </h2>
            <div className="space-y-2.5">
              {isAdmin && (
                <>
                  <button
                    onClick={() => navigate('/fests')}
                    className="w-full text-left px-4 py-3 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 font-semibold text-sm text-slate-800 transition-all flex items-center justify-between"
                  >
                    <span>Create / Manage Fests</span>
                    <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-bold">Admin</span>
                  </button>
                  <button
                    onClick={handleImportClick}
                    className="w-full text-left px-4 py-3 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 font-semibold text-sm text-slate-800 transition-all flex items-center justify-between"
                  >
                    <span>Import Excel Schedule (.xlsx)</span>
                    <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-bold">Admin</span>
                  </button>
                  <button
                    onClick={() => navigate('/audit')}
                    className="w-full text-left px-4 py-3 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 font-semibold text-sm text-slate-800 transition-all flex items-center justify-between"
                  >
                    <span>Audit Trail & CSV Export</span>
                    <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-bold">Admin</span>
                  </button>
                </>
              )}
              {isSenior && (
                <button
                  onClick={() => navigate('/equipment/checkout')}
                  className="w-full text-left px-4 py-3 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 font-semibold text-sm text-slate-800 transition-all flex items-center justify-between"
                >
                  <span>Equipment Checkout / Return Desk</span>
                  <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold">Lead</span>
                </button>
              )}
              <button
                onClick={() => navigate('/coverage')}
                className="w-full text-left px-4 py-3 rounded-xl border border-slate-200 hover:border-amber-300 hover:bg-amber-50/50 font-semibold text-sm text-slate-800 transition-all flex items-center justify-between"
              >
                <span>Report Unplanned Coverage</span>
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-bold">All</span>
              </button>
              <button
                onClick={() => navigate('/team')}
                className="w-full text-left px-4 py-3 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 font-semibold text-sm text-slate-800 transition-all flex items-center justify-between"
              >
                <span>View Full Team Roster</span>
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold">All</span>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
