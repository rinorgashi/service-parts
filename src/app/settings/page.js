'use client';

import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Header from '@/components/Header';
import { User, Lock, Save } from 'lucide-react';

export default function Settings() {
    const { data: session } = useSession();
    const [formData, setFormData] = useState({
        currentPassword: '', newUsername: '', newPassword: '', confirmPassword: ''
    });
    const [message, setMessage] = useState({ type: '', text: '' });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage({ type: '', text: '' });

        if (!formData.currentPassword) {
            setMessage({ type: 'error', text: 'Current password is required' });
            return;
        }

        if (formData.newPassword && formData.newPassword !== formData.confirmPassword) {
            setMessage({ type: 'error', text: 'New passwords do not match' });
            return;
        }

        if (formData.newPassword && formData.newPassword.length < 4) {
            setMessage({ type: 'error', text: 'New password must be at least 4 characters' });
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/user', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    currentPassword: formData.currentPassword,
                    newUsername: formData.newUsername || undefined,
                    newPassword: formData.newPassword || undefined
                })
            });

            const data = await res.json();
            if (!res.ok) {
                setMessage({ type: 'error', text: data.error });
            } else {
                setMessage({ type: 'success', text: 'Credentials updated! Signing out...' });
                setTimeout(() => signOut({ callbackUrl: '/login' }), 2000);
            }
        } catch (e) {
            setMessage({ type: 'error', text: 'Failed to update credentials' });
        } finally { setLoading(false); }
    };

    return (
        <>
            <Header title="Settings" />
            <div className="page-enter" style={{ maxWidth: '600px' }}>
                <div className="card">
                    <div className="card-header"><h3 className="card-title">Change Login Credentials</h3></div>

                    <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
                        Current username: <strong>{session?.user?.name}</strong>
                    </p>

                    <form onSubmit={handleSubmit}>
                        {message.text && (
                            <div style={{
                                background: message.type === 'error' ? 'var(--danger-bg)' : 'var(--success-bg)',
                                color: message.type === 'error' ? 'var(--danger)' : 'var(--success)',
                                padding: '12px 16px', borderRadius: 'var(--radius-md)', marginBottom: '20px'
                            }}>{message.text}</div>
                        )}

                        <div className="form-group">
                            <label className="form-label">Current Password *</label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input type="password" className="form-input" style={{ paddingLeft: '44px' }} value={formData.currentPassword} onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })} placeholder="Enter current password" required />
                            </div>
                        </div>

                        <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '24px 0' }} />

                        <div className="form-group">
                            <label className="form-label">New Username (optional)</label>
                            <div style={{ position: 'relative' }}>
                                <User size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input type="text" className="form-input" style={{ paddingLeft: '44px' }} value={formData.newUsername} onChange={(e) => setFormData({ ...formData, newUsername: e.target.value })} placeholder="Leave blank to keep current" />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">New Password (optional)</label>
                                <input type="password" className="form-input" value={formData.newPassword} onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })} placeholder="Leave blank to keep current" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Confirm New Password</label>
                                <input type="password" className="form-input" value={formData.confirmPassword} onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })} placeholder="Confirm new password" />
                            </div>
                        </div>

                        <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: '8px' }}>
                            <Save size={18} /> {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </form>
                </div>
            </div>
        </>
    );
}
