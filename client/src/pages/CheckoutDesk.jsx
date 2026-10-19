import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { equipmentApi } from '../services/endpoints/equipment';
import { authApi } from '../services/endpoints/auth';
import { festsApi } from '../services/endpoints/fests';
import { eventsApi } from '../services/endpoints/events';
import { useAuth } from '../contexts/AuthContext';
import {
  ArrowLeft,
  CheckCircle2,
  RotateCcw,
  AlertTriangle,
  Camera,
  HardDrive,
  User,
  Clock,
  Phone,
  CheckSquare
} from 'lucide-react';

export default function CheckoutDesk() {
  const navigate = useNavigate();
  const { user, isAdmin, isSenior } = useAuth();

  const [activeItems, setActiveItems] = useState([]);
  const [availableItems, setAvailableItems] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [fests, setFests] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Return State
  const [returnItem, setReturnItem] = useState(null);
  const [conditionAtReturn, setConditionAtReturn] = useState('good');
  const [returnNotes, setReturnNotes] = useState('');
  const [returning, setReturning] = useState(false);

  // Take State
  const [takeItem, setTakeItem] = useState(null);
  const [takeHolderId, setTakeHolderId] = useState('');
  const [takeFestId, setTakeFestId] = useState('');
  const [takeEventId, setTakeEventId] = useState('');
  const [takeReturnHours, setTakeReturnHours] = useState(4);
  const [takeChecklist, setTakeChecklist] = useState([]);
  const [takeNotes, setTakeNotes] = useState('');
  const [taking, setTaking] = useState(false);

  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [checkedOutRes, availRes, usersRes, festsRes] = await Promise.all([
        equipmentApi.getEquipment({ status: 'checked_out' }),
        equipmentApi.getEquipment({ status: 'available' }),
        authApi.getUsers().catch(() => ({ data: { users: [] } })),
        festsApi.getFests().catch(() => ({ data: { fests: [] } }))
      ]);

      setActiveItems(checkedOutRes.data.equipment || []);
      setAvailableItems(availRes.data.equipment || []);
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
  }, []);

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

  const handleTakeConfirm = async (e) => {
    e.preventDefault();
    if (!takeItem) return;

    setTaking(true);
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
      setSuccessMsg(`Successfully checked out ${takeItem.equipmentId} to ${holderName}!`);
      setTimeout(() => setSuccessMsg(null), 3500);
      setTakeItem(null);
      loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setTaking(false);
    }
  };

  const handleReturnConfirm = async (e) => {
    e.preventDefault();
    if (!returnItem) return;

    setReturning(true);
    setError(null);
    try {
      await equipmentApi.returnEquipment(returnItem._id, {
        conditionAtReturn,
        returnNotes
      });
      setSuccessMsg(`Successfully returned ${returnItem.equipmentId} into locker!`);
      setReturnItem(null);
      setReturnNotes('');
      loadData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setReturning(false);
    }
  };

  const availableCameras = availableItems.filter(i => i.category === 'camera');
  const availableSdCards = availableItems.filter(i => i.category === 'sd_card');

  const cameras = activeItems.filter(i => i.category === 'camera');
  const sdCards = activeItems.filter(i => i.category === 'sd_card');

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        <button
          onClick={() => navigate('/equipment')}
          className="text-xs font-semibold text-slate-500 hover:text-slate-800 mb-4 inline-flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Inventory
        </button>

        <div className="mb-6">
          <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1">
            Physical Checkout & Return Desk (Case 5)
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Equipment Checkout & Handover Desk</h1>
          <p className="text-slate-500 text-sm mt-1">
            Take available cameras for coverage, track who is managing each asset, and process independent equipment returns.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-700 border border-red-200 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-sm flex items-center gap-2 shadow-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="font-medium">{successMsg}</span>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center p-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* SECTION 1: AVAILABLE GEAR TO TAKE */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Available in Locker (Ready to Take)</h2>
                  <p className="text-xs text-slate-500">Pick up a camera or SD card for an upcoming shift.</p>
                </div>
                <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {availableItems.length} Assets Available
                </span>
              </div>

              {availableItems.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center">
                  <p className="text-xs text-slate-400 italic">All equipment is currently checked out or in maintenance.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {availableItems.map(item => (
                    <div key={item._id} className="bg-white rounded-2xl border border-emerald-200 p-4 shadow-sm flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border">
                            {item.equipmentId}
                          </span>
                          <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Available
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-slate-900">{item.brandModel}</h3>
                        <p className="text-[11px] text-slate-500 capitalize">{item.category.replace('_', ' ')} • Condition: {item.condition}</p>
                        {item.addedBy && (
                          <p className="text-[10px] text-slate-400 mt-1">Managed by: {item.addedBy.name}</p>
                        )}
                      </div>

                      <button
                        onClick={() => openTakeModal(item)}
                        className="mt-3 w-full py-1.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm inline-flex items-center justify-center gap-1.5 transition-all"
                      >
                        <Camera className="w-3.5 h-3.5" /> Take / Check Out
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SECTION 2: ACTIVE CHECKOUTS & RETURNS */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Active Gear in the Field (Returns Desk)</h2>
                  <p className="text-xs text-slate-500">Track who currently holds each asset and process independent returns.</p>
                </div>
                <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                  {activeItems.length} In Field
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Cameras in Field */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3 border-b pb-2">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <Camera className="w-4 h-4 text-slate-700" />
                      Cameras in Field ({cameras.length})
                    </h3>
                    <span className="text-[11px] text-slate-400">Independent Return</span>
                  </div>

                  {cameras.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-4 text-center">No cameras currently checked out.</p>
                  ) : (
                    <div className="space-y-3">
                      {cameras.map(cam => {
                        const isOverdue = cam.activeAssignment?.expectedReturnTime && new Date(cam.activeAssignment.expectedReturnTime) < new Date();
                        const isMyCam = String(cam.currentCustodianId?._id) === String(user?._id);

                        return (
                          <div key={cam._id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-slate-800">{cam.equipmentId}</span>
                                {isOverdue && (
                                  <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 border border-rose-200">
                                    Overdue
                                  </span>
                                )}
                              </div>
                              <p className="text-xs font-bold text-slate-900 mt-0.5">{cam.brandModel}</p>
                              <p className="text-[11px] text-slate-600 font-medium">
                                Holder: <strong className="text-slate-900">{cam.currentCustodianId?.name || 'Assigned'}</strong>
                                {cam.currentCustodianId?.phone && ` (${cam.currentCustodianId.phone})`}
                              </p>
                              {cam.activeAssignment?.eventId && (
                                <p className="text-[10px] text-slate-500">Event: {cam.activeAssignment.eventId.name}</p>
                              )}
                              {cam.activeAssignment?.issuedById && (
                                <p className="text-[10px] text-slate-400">Issued by: {cam.activeAssignment.issuedById.name}</p>
                              )}
                            </div>

                            {(isMyCam || isSenior || isAdmin) && (
                              <button
                                onClick={() => setReturnItem(cam)}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 flex items-center gap-1 shadow-sm flex-shrink-0"
                              >
                                <RotateCcw className="w-3.5 h-3.5" /> Return
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* SD Cards in Field */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3 border-b pb-2">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <HardDrive className="w-4 h-4 text-slate-700" />
                      SD Cards in Field ({sdCards.length})
                    </h3>
                    <span className="text-[11px] text-slate-400">Independent SD Return</span>
                  </div>

                  {sdCards.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-4 text-center">No SD cards currently checked out.</p>
                  ) : (
                    <div className="space-y-3">
                      {sdCards.map(sd => {
                        const isMySd = String(sd.currentCustodianId?._id) === String(user?._id);

                        return (
                          <div key={sd._id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between gap-3">
                            <div>
                              <span className="font-mono text-xs font-bold text-slate-800">{sd.equipmentId}</span>
                              <p className="text-xs font-bold text-slate-900 mt-0.5">{sd.brandModel}</p>
                              <p className="text-[11px] text-slate-600 font-medium">
                                Holder: <strong className="text-slate-900">{sd.currentCustodianId?.name || 'Assigned'}</strong>
                              </p>
                              {sd.activeAssignment?.issuedById && (
                                <p className="text-[10px] text-slate-400">Issued by: {sd.activeAssignment.issuedById.name}</p>
                              )}
                            </div>

                            {(isMySd || isSenior || isAdmin) && (
                              <button
                                onClick={() => setReturnItem(sd)}
                                className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 flex items-center gap-1 shadow-sm flex-shrink-0"
                              >
                                <RotateCcw className="w-3.5 h-3.5" /> Return
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: TAKE / CHECK OUT GEAR */}
        {takeItem && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <div>
                  <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Checkout Desk</span>
                  <h2 className="text-xl font-extrabold text-slate-900">
                    Take {takeItem.equipmentId} ({takeItem.brandModel})
                  </h2>
                </div>
                <button onClick={() => setTakeItem(null)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
              </div>

              <form onSubmit={handleTakeConfirm} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Who Is Taking This Equipment?
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Fest</label>
                    <select
                      value={takeFestId}
                      onChange={e => setTakeFestId(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl text-xs bg-white"
                    >
                      {fests.map(f => (
                        <option key={f._id} value={f._id}>{f.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Event (Optional)</label>
                    <select
                      value={takeEventId}
                      onChange={e => setTakeEventId(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl text-xs bg-white"
                    >
                      <option value="">-- General Shift / Unscheduled --</option>
                      {events.map(ev => (
                        <option key={ev._id} value={ev._id}>{ev.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Return Duration</label>
                  <div className="grid grid-cols-4 gap-2 mb-1.5">
                    {[2, 4, 6, 8].map(hrs => (
                      <button
                        key={hrs}
                        type="button"
                        onClick={() => setTakeReturnHours(hrs)}
                        className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                          takeReturnHours === hrs
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        +{hrs}h
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Return due: <strong>{new Date(Date.now() + takeReturnHours * 3600000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Checkout Notes</label>
                  <input
                    type="text"
                    placeholder="e.g. Taking for rock show night shift..."
                    value={takeNotes}
                    onChange={e => setTakeNotes(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-xs"
                  />
                </div>

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
                    disabled={taking}
                    className="px-5 py-2 text-xs font-bold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    {taking ? 'Processing...' : 'Confirm & Take Gear'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: RETURN GEAR */}
        {returnItem && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
              <h2 className="text-lg font-bold text-slate-900 mb-1">Confirm Physical Return</h2>
              <p className="text-xs text-slate-500 mb-4">
                Returning <strong>{returnItem.equipmentId}</strong> ({returnItem.brandModel}) back to equipment locker.
              </p>

              <form onSubmit={handleReturnConfirm} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Return Inspection Condition</label>
                  <select
                    value={conditionAtReturn}
                    onChange={e => setConditionAtReturn(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-xs bg-white"
                  >
                    <option value="excellent">Excellent</option>
                    <option value="good">Good (Normal wear)</option>
                    <option value="fair">Fair (Scratches / needs cleaning)</option>
                    <option value="damaged">Damaged (Sends to Maintenance automatically)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Return Notes / Handover Details</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Returned to locker A3, battery at 40%..."
                    value={returnNotes}
                    onChange={e => setReturnNotes(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-xs"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button
                    type="button"
                    onClick={() => setReturnItem(null)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={returning}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    {returning ? 'Accepting...' : 'Accept Return'}
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
