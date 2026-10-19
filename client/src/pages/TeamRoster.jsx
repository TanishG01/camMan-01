import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../services/endpoints/auth';
import { useAuth } from '../contexts/AuthContext';
import { Users, ArrowLeft, Shield, UserPlus, Edit3, Phone, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';

const ALL_SKILLS = [
  { id: 'photography', label: 'Photography' },
  { id: 'videography', label: 'Videography' },
  { id: 'drone', label: 'Drone Pilot' },
  { id: 'editing', label: 'Editing & Post' },
  { id: 'reels', label: 'Reels & Shorts' }
];

export default function TeamRoster() {
  const navigate = useNavigate();
  const { user: currentUser, isAdmin, isSenior, updateProfile } = useAuth();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Edit role modal state (Admin only)
  const [roleChangeUser, setRoleChangeUser] = useState(null);
  const [newRole, setNewRole] = useState('');
  const [newSeniority, setNewSeniority] = useState('');
  const [updating, setUpdating] = useState(false);

  // Delete Member Confirmation State (Admin / Senior)
  const [deleteConfirmUser, setDeleteConfirmUser] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Add Member Modal (Admin/Coordinator)
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '',
    email: '',
    role: 'junior',
    seniority: '1st_year',
    skills: ['photography'],
    phone: ''
  });
  const [adding, setAdding] = useState(false);

  // Self Join Team / Edit Profile Modal (Any logged in member)
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: '',
    phone: '',
    seniority: '1st_year',
    skills: ['photography']
  });
  const [savingProfile, setSavingProfile] = useState(false);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const res = await authApi.getUsers({ isActive: true });
      setUsers(res.data.users || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const openProfileModal = () => {
    if (!currentUser) return;
    setProfileForm({
      name: currentUser.name || '',
      phone: currentUser.phone || '',
      seniority: currentUser.seniority || '1st_year',
      skills: currentUser.skills && currentUser.skills.length > 0 ? currentUser.skills : ['photography']
    });
    setShowProfileModal(true);
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setError(null);
    try {
      await updateProfile(profileForm);
      setSuccessMsg('Your profile and skills have been updated! You are ready for event allocation.');
      setShowProfileModal(false);
      loadUsers();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAddMemberSubmit = async (e) => {
    e.preventDefault();
    if (!addForm.name || !addForm.email) return;
    setAdding(true);
    setError(null);
    try {
      await authApi.createUser(addForm);
      setSuccessMsg(`Team member ${addForm.name} was added directly to the roster!`);
      setShowAddModal(false);
      setAddForm({
        name: '',
        email: '',
        role: 'junior',
        seniority: '1st_year',
        skills: ['photography'],
        phone: ''
      });
      loadUsers();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleRoleUpdate = async (e) => {
    e.preventDefault();
    if (!roleChangeUser) return;
    setUpdating(true);
    try {
      await authApi.updateUserRole(roleChangeUser._id, {
        role: newRole,
        seniority: newSeniority,
        reason: 'Updated in Team Roster management console'
      });
      setRoleChangeUser(null);
      loadUsers();
    } catch (err) {
      alert(`Update failed: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteConfirmUser) return;
    setDeleting(true);
    setError(null);
    try {
      await authApi.deleteUser(deleteConfirmUser._id);
      setSuccessMsg(`Team member "${deleteConfirmUser.name}" has been removed from the team roster.`);
      setDeleteConfirmUser(null);
      loadUsers();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleAddSkill = (skillId) => {
    setAddForm(prev => {
      const exists = prev.skills.includes(skillId);
      const skills = exists ? prev.skills.filter(s => s !== skillId) : [...prev.skills, skillId];
      return { ...prev, skills };
    });
  };

  const handleToggleProfileSkill = (skillId) => {
    setProfileForm(prev => {
      const exists = prev.skills.includes(skillId);
      const skills = exists ? prev.skills.filter(s => s !== skillId) : [...prev.skills, skillId];
      return { ...prev, skills };
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-xs font-semibold text-slate-500 hover:text-slate-800 mb-4 inline-flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
        </button>

        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Team Roster</h1>
            <p className="text-slate-500 text-sm mt-1">
              Media house members, years, seniority, skills, and coverage allocation availability
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Any logged in user can update their profile / join team */}
            <button
              onClick={openProfileModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold text-xs shadow-sm transition-colors"
            >
              <Edit3 className="w-4 h-4" />
              {currentUser ? 'Edit My Profile & Skills' : 'Join Team'}
            </button>

            {/* Admin or Senior Coordinator can add members directly */}
            {isSenior && (
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                Add Team Member
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-700 border border-red-200 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {successMsg && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {successMsg}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center p-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-100 text-slate-600 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Member Name</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Seniority</th>
                  <th className="py-3 px-4">Skills</th>
                  {(isAdmin || isSenior) && <th className="py-3 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map(u => {
                  const isCurrent = currentUser?._id === u._id;
                  return (
                    <tr key={u._id} className={`hover:bg-slate-50 transition-colors ${isCurrent ? 'bg-indigo-50/30' : ''}`}>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {u.name}
                        {isCurrent && (
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-semibold">
                            You
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500">{u.email}</td>
                      <td className="py-3 px-4 text-slate-500 font-mono">
                        {u.phone || '—'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                          u.role === 'admin' ? 'bg-indigo-100 text-indigo-800' : u.role === 'senior' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 px-4 capitalize font-medium">{u.seniority?.replace('_', ' ')}</td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {u.skills && u.skills.length > 0 ? (
                            u.skills.map(s => (
                              <span key={s} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded font-medium text-[10px] capitalize">
                                {s}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-400 italic">No skills listed</span>
                          )}
                        </div>
                      </td>
                      {(isAdmin || isSenior) && (
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isAdmin && (
                              <button
                                onClick={() => {
                                  setRoleChangeUser(u);
                                  setNewRole(u.role);
                                  setNewSeniority(u.seniority);
                                }}
                                className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold text-xs"
                              >
                                Edit Role
                              </button>
                            )}

                            {/* Delete button: Coordinator / Admin can delete members (cannot delete oneself, non-admin cannot delete admin) */}
                            {currentUser?._id !== u._id && (isAdmin || u.role !== 'admin') && (
                              <button
                                onClick={() => setDeleteConfirmUser(u)}
                                className="p-1.5 rounded-lg border border-slate-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 font-semibold transition-colors"
                                title={`Remove ${u.name} from team`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Add Team Member Modal (Coordinator / Admin) */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-bold text-slate-900">Add Team Member</h2>
                <span className="text-xs px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold">Coordinator Action</span>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                Pre-register team members so coordinators can allocate events to them immediately.
              </p>

              <form onSubmit={handleAddMemberSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Aryan Sharma"
                    value={addForm.name}
                    onChange={e => setAddForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. aryan@college.edu"
                    value={addForm.email}
                    onChange={e => setAddForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-xl text-xs font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Their account will link automatically when they sign in with this email.</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">System Role</label>
                    <select
                      value={addForm.role}
                      onChange={e => setAddForm(prev => ({ ...prev, role: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-xl text-xs bg-white"
                    >
                      <option value="junior">Junior (Crew)</option>
                      <option value="senior">Senior (Lead / Mentor)</option>
                      <option value="admin">Admin (Coordinator)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Seniority Year</label>
                    <select
                      value={addForm.seniority}
                      onChange={e => setAddForm(prev => ({ ...prev, seniority: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-xl text-xs bg-white"
                    >
                      <option value="1st_year">1st Year</option>
                      <option value="2nd_year">2nd Year</option>
                      <option value="3rd_year">3rd Year</option>
                      <option value="4th_year">4th Year</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Phone Number (Optional)</label>
                  <input
                    type="tel"
                    placeholder="e.g. +91 9876543210"
                    value={addForm.phone}
                    onChange={e => setAddForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">Specialization Skills</label>
                  <div className="flex flex-wrap gap-1.5">
                    {ALL_SKILLS.map(s => {
                      const selected = addForm.skills.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => handleToggleAddSkill(s.id)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                            selected
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={adding}
                    className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {adding ? 'Adding...' : 'Add to Team'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Self Profile & Skills Modal (Any logged in user) */}
        {showProfileModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
              <h2 className="text-lg font-bold text-slate-900 mb-1">My Team Profile & Skills</h2>
              <p className="text-xs text-slate-500 mb-4">
                Set your coverage skills so the allocation engine matches you to relevant fest events.
              </p>

              <form onSubmit={handleProfileSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Display Name</label>
                  <input
                    type="text"
                    required
                    value={profileForm.name}
                    onChange={e => setProfileForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Phone Number</label>
                  <input
                    type="tel"
                    placeholder="e.g. +91 9876543210"
                    value={profileForm.phone}
                    onChange={e => setProfileForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Current College Year</label>
                  <select
                    value={profileForm.seniority}
                    onChange={e => setProfileForm(prev => ({ ...prev, seniority: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-xl text-xs bg-white"
                  >
                    <option value="1st_year">1st Year (Junior)</option>
                    <option value="2nd_year">2nd Year</option>
                    <option value="3rd_year">3rd Year</option>
                    <option value="4th_year">4th Year (Senior)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">My Media Skills</label>
                  <div className="flex flex-wrap gap-1.5">
                    {ALL_SKILLS.map(s => {
                      const selected = profileForm.skills.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => handleToggleProfileSkill(s.id)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                            selected
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowProfileModal(false)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {savingProfile ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Role Modal (Admin) */}
        {roleChangeUser && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl">
              <h2 className="text-lg font-bold text-slate-900 mb-1">Update Member Role</h2>
              <p className="text-xs text-slate-500 mb-4">{roleChangeUser.name} ({roleChangeUser.email})</p>

              <form onSubmit={handleRoleUpdate} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">System Role</label>
                  <select
                    value={newRole}
                    onChange={e => setNewRole(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-xs bg-white"
                  >
                    <option value="junior">Junior (Team Member)</option>
                    <option value="senior">Senior (Team Lead)</option>
                    <option value="admin">Admin (Coordinator / 4th Year)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">College Seniority</label>
                  <select
                    value={newSeniority}
                    onChange={e => setNewSeniority(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-xs bg-white"
                  >
                    <option value="1st_year">1st Year (Junior)</option>
                    <option value="2nd_year">2nd Year</option>
                    <option value="3rd_year">3rd Year</option>
                    <option value="4th_year">4th Year</option>
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setRoleChangeUser(null)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updating}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                  >
                    {updating ? 'Saving...' : 'Save Role'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirmUser && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-3">
                <Trash2 className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 mb-1">Remove Team Member</h2>
              <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                Are you sure you want to remove <strong className="text-slate-900">{deleteConfirmUser.name}</strong> ({deleteConfirmUser.email}) from the team roster?
                They will no longer be allocated to upcoming fest events.
              </p>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setDeleteConfirmUser(null)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleDeleteUser}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  {deleting ? 'Removing...' : 'Yes, Remove Member'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
