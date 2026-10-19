import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { equipmentApi } from '../services/endpoints/equipment';
import { authApi } from '../services/endpoints/auth';
import { festsApi } from '../services/endpoints/fests';
import { eventsApi } from '../services/endpoints/events';
import { useAuth } from '../contexts/AuthContext';
import {
  Camera,
  Plus,
  ArrowLeft,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  User,
  UserCheck,
  Clock,
  Calendar,
  ShieldCheck,
  Tag,
  Phone,
  Info,
  Search,
  Filter,
  ShieldAlert,
  Sparkles,
  CheckSquare,
  LogOut,
  ChevronRight
} from 'lucide-react';

export default function EquipmentInventory() {
  const navigate = useNavigate();
  const { user, isAdmin, isSenior } = useAuth();

  const [equipment, setEquipment] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [fests, setFests] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyMine, setOnlyMine] = useState(false);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [takeItem, setTakeItem] = useState(null);
  const [returnItem, setReturnItem] = useState(null);

  // Add Asset Form
  const [formData, setFormData] = useState({
    equipmentId: '',
    category: 'camera',
    brandModel: '',
    serialNumber: '',
    condition: 'good'
  });

  // Take / Check Out Form
  const [takeHolderId, setTakeHolderId] = useState('');
  const [takeFestId, setTakeFestId] = useState('');
  const [takeEventId, setTakeEventId] = useState('');
  const [takeReturnHours, setTakeReturnHours] = useState(4);
  const [takeChecklist, setTakeChecklist] = useState([]);
  const [takeNotes, setTakeNotes] = useState('');

  // Return Form
  const [conditionAtReturn, setConditionAtReturn] = useState('good');
  const [returnNotes, setReturnNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {};
      if (filterCategory) params.category = filterCategory;
      if (filterStatus) params.status = filterStatus;
      if (searchQuery) params.search = searchQuery;

      const [eqRes, usersRes, festsRes] = await Promise.all([
        equipmentApi.getEquipment(params),
        authApi.getUsers().catch(() => ({ data: { users: [] } })),
        festsApi.getFests().catch(() => ({ data: { fests: [] } }))
      ]);

      setEquipment(eqRes.data.equipment || []);
      setTeamMembers(usersRes.data.users || []);
      const festList = festsRes.data.fests || [];
      setFests(festList);

      if (festList.length > 0 && !takeFestId) {
        setTakeFestId(festList[0]._id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filterCategory, filterStatus]);

  // Load events when fest changes in checkout modal
  useEffect(() => {
    if (takeFestId) {
      eventsApi.getEvents(takeFestId)
        .then(res => setEvents(res.data.events || []))
        .catch(() => setEvents([]));
    }
  }, [takeFestId]);

  // Open Take Modal
  const openTakeModal = (item) => {
    setTakeItem(item);
    setTakeHolderId(user?._id || '');
    setTakeNotes('');
    setTakeReturnHours(4);

    // Initialize checklist template
    const template = item.preUseChecklistTemplate?.length
      ? item.preUseChecklistTemplate
      : [
          'Battery charged above 80%',
          'Lens clean and scratch-free',
          'Memory card formatted & tested',
          'Neck strap / mount secured'
        ];
    setTakeChecklist(template.map(itemText => ({ checkItem: itemText, isPassed: true })));
  };

  // Open Return Modal
  const openReturnModal = (item) => {
    setReturnItem(item);
    setConditionAtReturn(item.condition || 'good');
    setReturnNotes('');
  };

  // Handle Add New Asset
  const handleAdd = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await equipmentApi.createEquipment(formData);
      setShowAddModal(false);
      setFormData({ equipmentId: '', category: 'camera', brandModel: '', serialNumber: '', condition: 'good' });
      setSuccessMsg('New asset successfully registered!');
      setTimeout(() => setSuccessMsg(null), 3500);
      loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Take / Check Out Camera
  const handleTakeConfirm = async (e) => {
    e.preventDefault();
    if (!takeItem) return;

    setSubmitting(true);
    setError(null);
    try {
      const expectedReturnTime = new Date(Date.now() + takeReturnHours * 3600000).toISOString();

      await equipmentApi.takeEquipment(takeItem._id, {
        holderId: takeHolderId || user._id,
        festId: takeFestId || undefined,
        eventId: takeEventId || undefined,
        expectedReturnTime,
        preUseChecklistSnapshot: takeChecklist,
        checkoutNotes: takeNotes,
        conditionAtCheckout: takeItem.condition || 'good'
      });

      const holderName = teamMembers.find(m => String(m._id) === String(takeHolderId))?.name || user?.name;
      setSuccessMsg(`Successfully checked out ${takeItem.equipmentId} (${takeItem.brandModel}) to ${holderName}!`);
      setTimeout(() => setSuccessMsg(null), 4000);
      setTakeItem(null);
      loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Return Camera
  const handleReturnConfirm = async (e) => {
    e.preventDefault();
    if (!returnItem) return;

    setSubmitting(true);
    setError(null);
    try {
      await equipmentApi.returnEquipment(returnItem._id, {
        conditionAtReturn,
        returnNotes
      });
      setSuccessMsg(`Successfully checked in ${returnItem.equipmentId} back into the locker!`);
      setTimeout(() => setSuccessMsg(null), 3500);
      setReturnItem(null);
      loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered Equipment List
  const displayedEquipment = equipment.filter(item => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchId = item.equipmentId?.toLowerCase().includes(q);
      const matchModel = item.brandModel?.toLowerCase().includes(q);
      const matchHolder = item.currentCustodianId?.name?.toLowerCase().includes(q);
      if (!matchId && !matchModel && !matchHolder) return false;
    }
    if (onlyMine) {
      return String(item.currentCustodianId?._id) === String(user?._id);
    }
    return true;
  });

  // Summary Metrics
  const totalCount = equipment.length;
  const availableCount = equipment.filter(e => e.status === 'available').length;
  const checkedOutCount = equipment.filter(e => e.status === 'checked_out').length;
  const myCheckedOutCount = equipment.filter(e => String(e.currentCustodianId?._id) === String(user?._id)).length;
  const maintenanceCount = equipment.filter(e => e.status === 'maintenance').length;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-xs font-semibold text-slate-500 hover:text-slate-800 mb-4 inline-flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
        </button>

        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Equipment Inventory & Custody</h1>
            <p className="text-slate-500 text-sm mt-1">
              Live tracking of cameras, lenses, and accessories • Assign equipment, manage custody handovers & returns
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/equipment/checkout')}
              className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm shadow-sm inline-flex items-center gap-1.5"
            >
              <RotateCcw className="w-4 h-4 text-emerald-600" />
              Checkout / Return Desk
            </button>
            {isAdmin && (
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 shadow-sm"
              >
                <Plus className="w-4 h-4" /> Add Asset
              </button>
            )}
          </div>
        </div>

        {/* Success Banner */}
        {successMsg && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-sm flex items-center gap-2 shadow-sm animate-fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span className="font-medium">{successMsg}</span>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-700 border border-red-200 text-sm flex items-center gap-2 shadow-sm">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Metrics Counter Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Assets</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{totalCount}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Across all categories</p>
          </div>

          <div
            onClick={() => { setFilterStatus('available'); setOnlyMine(false); }}
            className={`bg-white p-4 rounded-2xl border shadow-sm cursor-pointer transition-all ${
              filterStatus === 'available' ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-slate-200 hover:border-emerald-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Available in Locker</p>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            </div>
            <p className="text-2xl font-extrabold text-emerald-700 mt-0.5">{availableCount}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Ready for immediate pickup</p>
          </div>

          <div
            onClick={() => { setFilterStatus('checked_out'); setOnlyMine(false); }}
            className={`bg-white p-4 rounded-2xl border shadow-sm cursor-pointer transition-all ${
              filterStatus === 'checked_out' ? 'border-amber-500 ring-2 ring-amber-100' : 'border-slate-200 hover:border-amber-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">In Field (Active)</p>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            </div>
            <p className="text-2xl font-extrabold text-amber-700 mt-0.5">{checkedOutCount}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Assigned to crew members</p>
          </div>

          <div
            onClick={() => { setOnlyMine(!onlyMine); }}
            className={`bg-white p-4 rounded-2xl border shadow-sm cursor-pointer transition-all ${
              onlyMine ? 'border-indigo-500 ring-2 ring-indigo-100 bg-indigo-50/30' : 'border-slate-200 hover:border-indigo-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">My Gear</p>
              <User className="w-3.5 h-3.5 text-indigo-600" />
            </div>
            <p className="text-2xl font-extrabold text-indigo-700 mt-0.5">{myCheckedOutCount}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Checked out to you</p>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search by ID (CAM-01), Brand, or Holder..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 border rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Category Dropdown */}
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              className="px-3 py-1.5 border rounded-xl text-xs bg-white text-slate-700 font-medium"
            >
              <option value="">All Categories</option>
              <option value="camera">Cameras</option>
              <option value="lens">Lenses</option>
              <option value="sd_card">SD Cards</option>
              <option value="battery">Batteries</option>
              <option value="tripod">Tripods</option>
              <option value="gimbal">Gimbals</option>
            </select>

            {/* Status Dropdown */}
            <select
              value={filterStatus}
              onChange={e => { setFilterStatus(e.target.value); setOnlyMine(false); }}
              className="px-3 py-1.5 border rounded-xl text-xs bg-white text-slate-700 font-medium"
            >
              <option value="">All Statuses</option>
              <option value="available">Available (In Locker)</option>
              <option value="checked_out">Checked Out (In Field)</option>
              <option value="allocated">Allocated (Reserved)</option>
              <option value="maintenance">Maintenance</option>
              <option value="lost">Lost</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setFilterCategory('');
                setFilterStatus('');
                setSearchQuery('');
                setOnlyMine(false);
              }}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold"
            >
              Reset Filters
            </button>
          </div>
        </div>

        {/* Equipment Grid */}
        {loading ? (
          <div className="flex justify-center p-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          </div>
        ) : displayedEquipment.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-16 text-center shadow-sm">
            <Camera className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">No Equipment Matches Your Filter</h3>
            <p className="text-xs text-slate-500 mt-1">Try resetting search or status filters to view the full inventory.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {displayedEquipment.map(item => {
              const isCheckedOut = item.status === 'checked_out';
              const isAvailable = item.status === 'available';
              const isAllocated = item.status === 'allocated';
              const isMaintenance = item.status === 'maintenance';

              const activeAssign = item.activeAssignment;
              const holder = item.currentCustodianId || activeAssign?.assignedHolderId;
              const manager = item.addedBy;
              const issuer = activeAssign?.issuedById;

              // Check if return is overdue
              const isOverdue = activeAssign?.expectedReturnTime && new Date(activeAssign.expectedReturnTime) < new Date();
              const isMyItem = String(holder?._id) === String(user?._id);

              return (
                <div
                  key={item._id}
                  className={`bg-white rounded-2xl border p-5 shadow-sm flex flex-col justify-between transition-all hover:shadow-md ${
                    isCheckedOut
                      ? isOverdue
                        ? 'border-rose-300 bg-rose-50/10'
                        : 'border-amber-200'
                      : isAvailable
                      ? 'border-emerald-200'
                      : 'border-slate-200'
                  }`}
                >
                  {/* Top Header of Card */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-extrabold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 border border-slate-200">
                          {item.equipmentId}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-slate-100 text-slate-600">
                          {item.category.replace('_', ' ')}
                        </span>
                      </div>

                      {/* Status Badge */}
                      <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold uppercase flex items-center gap-1 ${
                        isAvailable
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : isCheckedOut
                          ? isOverdue
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                          : isAllocated
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          isAvailable ? 'bg-emerald-600' : isCheckedOut ? (isOverdue ? 'bg-rose-600 animate-ping' : 'bg-amber-600') : 'bg-slate-500'
                        }`}></span>
                        {isCheckedOut ? (isOverdue ? 'Overdue' : 'In Field') : item.status.replace('_', ' ')}
                      </span>
                    </div>

                    <h3 className="text-base font-extrabold text-slate-900 leading-snug">{item.brandModel}</h3>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1">
                      <span>Condition: <strong className="capitalize text-slate-700">{item.condition}</strong></span>
                      {item.serialNumber && (
                        <span>• SN: <code className="text-[10px] bg-slate-100 px-1 py-0.5 rounded text-slate-600">{item.serialNumber}</code></span>
                      )}
                    </div>

                    {/* Custody & Assigned Member Info Block */}
                    <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-2 text-xs">
                      {isCheckedOut ? (
                        <>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1">
                                <User className="w-3 h-3 text-amber-600" />
                                Assigned Holder
                              </p>
                              <p className="font-bold text-slate-900 mt-0.5">
                                {holder?.name || 'Assigned Crew Member'}
                                {holder?.seniority && (
                                  <span className="text-[10px] font-semibold text-indigo-600 ml-1.5 px-1.5 py-0.2 bg-indigo-50 border border-indigo-200 rounded">
                                    {holder.seniority.replace('_', ' ')}
                                  </span>
                                )}
                              </p>
                              {holder?.phone && (
                                <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                  <Phone className="w-3 h-3 text-slate-400" /> {holder.phone}
                                </p>
                              )}
                            </div>
                            {isMyItem && (
                              <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800">
                                Yours
                              </span>
                            )}
                          </div>

                          {/* Event Covered */}
                          {activeAssign?.eventId && (
                            <div className="pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                              <span className="text-slate-500">Event:</span>
                              <strong className="text-slate-800 truncate max-w-[170px]">{activeAssign.eventId.name}</strong>
                            </div>
                          )}

                          {/* Return Due Time */}
                          {activeAssign?.expectedReturnTime && (
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-500 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-400" /> Due Back:
                              </span>
                              <span className={`font-bold ${isOverdue ? 'text-rose-600' : 'text-slate-700'}`}>
                                {new Date(activeAssign.expectedReturnTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                {isOverdue && ' (Overdue!)'}
                              </span>
                            </div>
                          )}
                        </>
                      ) : isAllocated ? (
                        <div>
                          <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1">
                            <Clock className="w-3 h-3 text-blue-600" />
                            Allocated / Reserved
                          </p>
                          <p className="font-bold text-slate-900 mt-0.5">
                            Reserved for: {holder?.name || 'Awaiting Pickup'}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">Ready for checkout confirmation at desk.</p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Locker Status
                          </p>
                          <p className="font-bold text-emerald-800 mt-0.5">In Locker • Ready for Coverage</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">Available to take for any scheduled event.</p>
                        </div>
                      )}

                      {/* Who Manages this Camera */}
                      <div className="pt-2 border-t border-slate-200/60 text-[11px] text-slate-500 space-y-0.5">
                        {issuer && (
                          <div className="flex items-center justify-between">
                            <span>Checkout Issued By:</span>
                            <span className="font-semibold text-slate-700">{issuer.name}</span>
                          </div>
                        )}
                        {manager && (
                          <div className="flex items-center justify-between">
                            <span>Asset Manager:</span>
                            <span className="font-semibold text-slate-700">{manager.name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    {isAvailable && (
                      <button
                        onClick={() => openTakeModal(item)}
                        className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm inline-flex items-center justify-center gap-1.5 transition-all"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        Take / Check Out Camera
                      </button>
                    )}

                    {isCheckedOut && (
                      <div className="w-full flex items-center gap-2">
                        {(isMyItem || isSenior || isAdmin) && (
                          <button
                            onClick={() => openReturnModal(item)}
                            className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm inline-flex items-center justify-center gap-1.5 transition-all"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Return Camera
                          </button>
                        )}
                        <button
                          onClick={() => navigate('/equipment/checkout')}
                          className="px-2.5 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold"
                          title="Open Checkout Desk"
                        >
                          Desk
                        </button>
                      </div>
                    )}

                    {isAllocated && (
                      <button
                        onClick={() => openTakeModal(item)}
                        className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm inline-flex items-center justify-center gap-1.5 transition-all"
                      >
                        <CheckSquare className="w-3.5 h-3.5" />
                        Confirm Physical Pickup
                      </button>
                    )}

                    {isMaintenance && (
                      <div className="w-full text-center py-1 text-xs text-rose-700 font-semibold italic">
                        Under Maintenance / Service
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ======================================================== */}
        {/* MODAL 1: TAKE / CHECK OUT CAMERA MODAL                   */}
        {/* ======================================================== */}
        {takeItem && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <div>
                  <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Equipment Checkout</span>
                  <h2 className="text-xl font-extrabold text-slate-900">
                    Take {takeItem.equipmentId} ({takeItem.brandModel})
                  </h2>
                </div>
                <button
                  onClick={() => setTakeItem(null)}
                  className="text-slate-400 hover:text-slate-600 text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleTakeConfirm} className="space-y-4">
                {/* Holder Selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Who Is Taking This Camera?
                  </label>
                  {isSenior || isAdmin ? (
                    <select
                      value={takeHolderId}
                      onChange={e => setTakeHolderId(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl text-xs bg-white font-medium"
                      required
                    >
                      <option value={user?._id}>Myself ({user?.name} • {user?.seniority?.replace('_', ' ')})</option>
                      <optgroup label="Assign to Team Member">
                        {teamMembers
                          .filter(m => String(m._id) !== String(user?._id))
                          .map(m => (
                            <option key={m._id} value={m._id}>
                              {m.name} ({m.seniority?.replace('_', ' ')} • {m.skills?.join(', ') || 'No skills'})
                            </option>
                          ))}
                      </optgroup>
                    </select>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-slate-100 text-xs font-semibold text-slate-800 flex items-center justify-between">
                      <span>{user?.name} ({user?.seniority?.replace('_', ' ')})</span>
                      <span className="text-[10px] uppercase font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                        Self Checkout
                      </span>
                    </div>
                  )}
                </div>

                {/* Fest & Event Association */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                      Fest Edition
                    </label>
                    <select
                      value={takeFestId}
                      onChange={e => setTakeFestId(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl text-xs bg-white font-medium"
                    >
                      {fests.map(f => (
                        <option key={f._id} value={f._id}>{f.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                      Event Coverage (Optional)
                    </label>
                    <select
                      value={takeEventId}
                      onChange={e => setTakeEventId(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl text-xs bg-white font-medium"
                    >
                      <option value="">-- General / Unscheduled Coverage --</option>
                      {events.map(ev => (
                        <option key={ev._id} value={ev._id}>
                          {ev.name} ({new Date(ev.date).toLocaleDateString()})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Expected Return Duration */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Expected Return Duration
                  </label>
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    {[2, 4, 6, 8].map(hrs => (
                      <button
                        key={hrs}
                        type="button"
                        onClick={() => setTakeReturnHours(hrs)}
                        className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                          takeReturnHours === hrs
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        +{hrs} Hours
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Return due by: <strong>{new Date(Date.now() + takeReturnHours * 3600000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
                  </p>
                </div>

                {/* Pre-Use Inspection Checklist */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700 uppercase">
                      Pre-Use Inspection Checklist
                    </label>
                    <button
                      type="button"
                      onClick={() => setTakeChecklist(takeChecklist.map(c => ({ ...c, isPassed: true })))}
                      className="text-[11px] text-indigo-600 font-semibold hover:underline"
                    >
                      Check All
                    </button>
                  </div>

                  <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                    {takeChecklist.map((item, idx) => (
                      <label key={idx} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={item.isPassed}
                          onChange={e => {
                            const updated = [...takeChecklist];
                            updated[idx].isPassed = e.target.checked;
                            setTakeChecklist(updated);
                          }}
                          className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                        />
                        <span>{item.checkItem}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Checkout Notes */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Handover Notes (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Taking with 24-70mm lens and 2 batteries..."
                    value={takeNotes}
                    onChange={e => setTakeNotes(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-xs"
                  />
                </div>

                {/* Submit Actions */}
                <div className="flex justify-end gap-2 pt-3 border-t">
                  <button
                    type="button"
                    onClick={() => setTakeItem(null)}
                    className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 text-xs font-bold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    {submitting ? 'Checking Out...' : 'Confirm & Take Camera'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* MODAL 2: RETURN CAMERA MODAL                             */}
        {/* ======================================================== */}
        {returnItem && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-scale-in">
              <h2 className="text-lg font-extrabold text-slate-900 mb-1">Confirm Equipment Return</h2>
              <p className="text-xs text-slate-500 mb-4">
                Returning <strong>{returnItem.equipmentId}</strong> ({returnItem.brandModel}) to the equipment locker.
              </p>

              <form onSubmit={handleReturnConfirm} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Inspection Condition
                  </label>
                  <select
                    value={conditionAtReturn}
                    onChange={e => setConditionAtReturn(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-xs bg-white font-medium"
                  >
                    <option value="excellent">Excellent (Clean & Ready)</option>
                    <option value="good">Good (Normal wear)</option>
                    <option value="fair">Fair (Needs cleaning)</option>
                    <option value="damaged">Damaged (Sends directly to Maintenance)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Return Notes / Locker Slot
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Returned to Locker A-3, battery at 60%, sensor clean..."
                    value={returnNotes}
                    onChange={e => setReturnNotes(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-xs"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t">
                  <button
                    type="button"
                    onClick={() => setReturnItem(null)}
                    className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    {submitting ? 'Checking In...' : 'Confirm Return'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* MODAL 3: REGISTER NEW ASSET (ADMIN ONLY)                 */}
        {/* ======================================================== */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-scale-in">
              <h2 className="text-lg font-extrabold text-slate-900 mb-4">Register New Equipment Asset</h2>
              <form onSubmit={handleAdd} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Asset ID (Barcode / Label)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CAM-03, LENS-85, SD-04"
                    value={formData.equipmentId}
                    onChange={e => setFormData({ ...formData, equipmentId: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-xs uppercase"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Category</label>
                    <select
                      value={formData.category}
                      onChange={e => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl text-xs bg-white"
                    >
                      <option value="camera">Camera</option>
                      <option value="lens">Lens</option>
                      <option value="sd_card">SD Card</option>
                      <option value="battery">Battery</option>
                      <option value="tripod">Tripod</option>
                      <option value="gimbal">Gimbal</option>
                      <option value="flash">Flash</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Initial Condition</label>
                    <select
                      value={formData.condition}
                      onChange={e => setFormData({ ...formData, condition: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl text-xs bg-white"
                    >
                      <option value="excellent">Excellent</option>
                      <option value="good">Good</option>
                      <option value="fair">Fair</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Brand & Model</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sony A7 IV, Canon RF 24-70mm f/2.8"
                    value={formData.brandModel}
                    onChange={e => setFormData({ ...formData, brandModel: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Serial Number (Optional)</label>
                  <input
                    type="text"
                    placeholder="Manufacturer serial number..."
                    value={formData.serialNumber}
                    onChange={e => setFormData({ ...formData, serialNumber: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-xs"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 text-xs font-bold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm disabled:opacity-50"
                  >
                    {submitting ? 'Adding...' : 'Register Asset'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
