'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDispatch } from 'react-redux';
import Link from 'next/link';
import api from '@/lib/api';
import { clearAuth } from '@/lib/authSlice';
import { toast } from 'react-hot-toast';
import Navbar from '@/components/Navbar';

interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  date_joined: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const dispatch = useDispatch();
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  // Edit profile states
  const [editingProfile, setEditingProfile] = useState(false);
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [updatingProfile, setUpdatingProfile] = useState(false);

  // Password change states
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push('/login');
      return;
    }

    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const initialTheme = savedTheme || systemTheme;
    
    setTheme(initialTheme);
    document.documentElement.classList.toggle('dark', initialTheme === 'dark');

    fetchUserData();
  }, [router]);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  const fetchUserData = async () => {
    try {
      setLoading(true);
      // ✅ FIX: Use correct endpoint
      const response = await api.get('/auth/profile/');
      setUser(response.data);
      setEmail(response.data.email);
      setFirstName(response.data.first_name || '');
      setLastName(response.data.last_name || '');
    } catch (error: any) {
      console.error('Failed to fetch user data:', error);
      toast.error('Failed to load profile');
      
      if (error.response?.status === 401) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        router.push('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      dispatch(clearAuth());
      toast.success('Logged out successfully');
      router.push('/');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Failed to logout');
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast.error('Email is required');
      return;
    }

    setUpdatingProfile(true);

    try {
      // ✅ FIX: Use PATCH and correct endpoint
      const response = await api.patch('/auth/profile/', {
        email: email.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim()
      });

      setUser(response.data);
      setEditingProfile(false);
      toast.success('Profile updated successfully');
    } catch (error: any) {
      console.error('Failed to update profile:', error);
      const errorMsg = error.response?.data?.detail || 'Failed to update profile';
      toast.error(errorMsg);
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Please fill in all password fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setChangingPassword(true);

    try {
      // ✅ FIX: Use correct endpoint and field names
      await api.post('/auth/change-password/', {
        old_password: currentPassword,
        new_password: newPassword
      });

      toast.success('Password changed successfully');
      setShowPasswordForm(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Failed to change password:', error);
      const errorMsg = error.response?.data?.detail || 'Failed to change password';
      toast.error(errorMsg);
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar currentPage="profile" />

      <div className="max-w-4xl mx-auto px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-1">Profile & Settings</h1>
          <p className="text-muted-foreground">Manage your account and preferences</p>
        </div>

        {/* User Info Card */}
        <div className="bg-card border border-border rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-foreground">Account Information</h2>
            {!editingProfile && (
              <button
                onClick={() => setEditingProfile(true)}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
              >
                Edit Profile
              </button>
            )}
          </div>
          
          {editingProfile ? (
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">First Name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Optional"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Optional"
                />
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingProfile(false);
                    setEmail(user?.email || '');
                    setFirstName(user?.first_name || '');
                    setLastName(user?.last_name || '');
                  }}
                  disabled={updatingProfile}
                  className="flex-1 py-2.5 px-4 bg-background border border-border text-foreground rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingProfile}
                  className="flex-1 py-2.5 px-4 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity font-semibold disabled:opacity-50"
                >
                  {updatingProfile ? 'Updating...' : 'Save Changes'}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Username</label>
                <p className="text-foreground font-medium">{user?.username || 'Not set'}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Email</label>
                <p className="text-foreground font-medium">{user?.email || 'Not set'}</p>
              </div>

              {(user?.first_name || user?.last_name) && (
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Full Name</label>
                  <p className="text-foreground font-medium">
                    {user.first_name} {user.last_name}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Member Since</label>
                <p className="text-foreground font-medium">
                  {user?.date_joined 
                    ? new Date(user.date_joined).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })
                    : 'N/A'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Password Change Card */}
        <div className="bg-card border border-border rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-foreground">Change Password</h2>
            {!showPasswordForm && (
              <button
                onClick={() => setShowPasswordForm(true)}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
              >
                Update Password
              </button>
            )}
          </div>

          {showPasswordForm ? (
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Current Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Enter current password"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  New Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Enter new password"
                />
                <p className="text-xs text-muted-foreground mt-1">At least 8 characters</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Confirm New Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Confirm new password"
                />
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordForm(false);
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                  disabled={changingPassword}
                  className="flex-1 py-2.5 px-4 bg-background border border-border text-foreground rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={changingPassword}
                  className="flex-1 py-2.5 px-4 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity font-semibold disabled:opacity-50"
                >
                  {changingPassword ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">
              Click "Update Password" to change your password
            </p>
          )}
        </div>

        {/* App Preferences */}
        <div className="bg-card border border-border rounded-xl p-6 mb-6">
          <h2 className="text-xl font-bold text-foreground mb-6">App Preferences</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Theme</p>
                <p className="text-sm text-muted-foreground">Choose your preferred color scheme</p>
              </div>
              <button
                onClick={toggleTheme}
                className="px-4 py-2 bg-background border border-border rounded-lg hover:bg-muted transition-colors flex items-center space-x-2"
              >
                {theme === 'dark' ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                    <span className="text-sm">Dark</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <span className="text-sm">Light</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border">
              <div>
                <p className="font-medium text-foreground">Default Currency</p>
                <p className="text-sm text-muted-foreground">Your preferred currency for transactions</p>
              </div>
              <select 
                className="px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                onChange={(e) => {
                  localStorage.setItem('default_currency', e.target.value);
                  toast.success(`Default currency set to ${e.target.value}`);
                }}
                defaultValue={localStorage.getItem('default_currency') || 'USD'}
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="INR">INR (₹)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-card border border-red-500/20 rounded-xl p-6">
          <h2 className="text-xl font-bold text-red-500 mb-4">Danger Zone</h2>
          
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-foreground mb-1">Delete Account</p>
                <p className="text-sm text-muted-foreground">
                  Permanently delete your account and all data. This action cannot be undone.
                </p>
              </div>
              <button
                onClick={() => {
                  if (confirm('⚠️ Are you absolutely sure you want to delete your account?\n\nThis will:\n- Delete all your transactions\n- Delete all your categories\n- Remove all your data permanently\n\nThis action CANNOT be undone!')) {
                    toast.error('Account deletion feature is not yet implemented');
                  }
                }}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium whitespace-nowrap"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}