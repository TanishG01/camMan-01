import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Camera, Shield, Users, Sparkles, AlertCircle } from 'lucide-react';

export default function Login() {
  const { user, loginWithGoogle, loginWithMock, loading, error: authError } = useAuth();
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleGoogleLogin = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await loginWithGoogle();
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Google authentication failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDevLogin = async (role) => {
    setError(null);
    setIsSubmitting(true);
    try {
      await loginWithMock(role);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Dev login failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 border border-slate-100">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 text-white mb-4 shadow-lg shadow-indigo-500/30">
            <Camera className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">FestOps</h1>
          <p className="text-slate-500 mt-2 text-sm font-medium">College Media House Operations Management</p>
        </div>

        {(error || authError) && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 font-medium">{error || authError}</p>
          </div>
        )}

        <button
          onClick={handleGoogleLogin}
          disabled={isSubmitting || loading}
          className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold shadow-sm transition-all hover:shadow hover:border-slate-300 disabled:opacity-60"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
          </svg>
          {isSubmitting ? 'Authenticating...' : 'Sign in with Google'}
        </button>

        {/* Development Quick Role Switcher */}
        <div className="mt-8 pt-6 border-t border-slate-100">
          <div className="flex items-center gap-2 mb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            Dev Mode Quick Login
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handleDevLogin('admin')}
              disabled={isSubmitting}
              className="px-3 py-2 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
            >
              Admin (4th)
            </button>
            <button
              onClick={() => handleDevLogin('senior')}
              disabled={isSubmitting}
              className="px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
            >
              Senior (2nd/3rd)
            </button>
            <button
              onClick={() => handleDevLogin('junior')}
              disabled={isSubmitting}
              className="px-3 py-2 text-xs font-semibold rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
            >
              Junior (1st)
            </button>
          </div>
        </div>

        <div className="mt-8 text-center text-xs text-slate-400">
          Built for campus media crews • Oasis & Incident coverage
        </div>
      </div>
    </div>
  );
}
