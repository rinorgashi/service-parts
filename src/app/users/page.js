'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Modal from '@/components/Modal';
import { Users, Edit, Trash2, Shield, ShieldOff } from 'lucide-react';

export default function UsersPage() {
    const { data: session } = useSession();
    const router = useRouter();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [formData, setFormData] = useState({ username: '', password: '' });
    const [error, setError] = useState('');

    useEffect(() => {
        checkAdminAndFetch();
    }, []);

    const checkAdminAndFetch = async () => {
        try {
            const res = await fetch('/api/users');
            if (res.status === 403) {
                setIsAdmin(false);
                setLoading(false);
                return;
            }
            if (res.ok) {
                setIsAdmin(true);
                setUsers(await res.json());
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        try {
            const res = await fetch('/api/users');
            if (res.ok) setUsers(await res.json());
        } catch (e) {
            console.error(e);
        }
    };

    const openAddModal = () => {
        setEditingUser(null);
        setFormData({ username: '', password: '' });
        setError('');
        setModalOpen(true);
    };

    const openEditModal = (user) => {
        setEditingUser(user);
        setFormData({ username: user.username, password: '' });
        setError('');
        setModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        try {
            const payload = { ...formData };
            if (editingUser) payload.id = editingUser.id;

            // Don't send empty password on edit
            if (editingUser && !payload.password) {
                delete payload.password;
            }

            const res = await fetch('/api/users', {
                method: editingUser ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'Failed to save user');
                return;
            }

            setModalOpen(false);
            fetchUsers();
        } catch (e) {
            setError('Failed to save user');
        }
    };

    const handleDelete = async (id, username) => {
        if (!confirm(`Delete user "${username}"?`)) return;

        const res = await fetch(`/api/users?id=${id}`, { method: 'DELETE' });
        if (!res.ok) {
            const d = await res.json();
            alert(d.error);
            return;
        }
        fetchUsers();
    };

    const formatDate = (dateStr) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric'
        });
    };

    if (loading) {
        return (
            <>
                <Header title="User Management" />
                <div className="loading-overlay"><div className="spinner"></div></div>
            </>
        );
    }

    if (!isAdmin) {
        return (
            <>
                <Header title="User Management" />
                <div className="page-enter">
                    <div className="empty-state">
                        <ShieldOff size={64} className="empty-state-icon" />
                        <h3 className="empty-state-title">Access Denied</h3>
                        <p className="text-muted">Only administrators can manage users.</p>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <Header title="User Management" onAdd={openAddModal} addLabel="Add User" onRefresh={fetchUsers} />
            <div className="page-enter">
                {users.length === 0 ? (
                    <div className="empty-state">
                        <Users size={64} className="empty-state-icon" />
                        <h3 className="empty-state-title">No users found</h3>
                        <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={openAddModal}>Add User</button>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Username</th>
                                    <th>Role</th>
                                    <th>Created</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((u) => (
                                    <tr key={u.id}>
                                        <td>
                                            <strong>{u.username}</strong>
                                            {session?.user?.name === u.username && <span className="badge badge-info" style={{ marginLeft: '8px' }}>You</span>}
                                        </td>
                                        <td>
                                            {u.is_admin ? (
                                                <span className="badge badge-success"><Shield size={12} style={{ marginRight: '4px' }} /> Admin</span>
                                            ) : (
                                                <span className="badge badge-default">User</span>
                                            )}
                                        </td>
                                        <td>{formatDate(u.created_at)}</td>
                                        <td>
                                            <div className="flex gap-2">
                                                <button className="btn btn-secondary btn-icon" onClick={() => openEditModal(u)} title="Edit">
                                                    <Edit size={16} />
                                                </button>
                                                {session?.user?.name !== u.username && (
                                                    <button className="btn btn-secondary btn-icon" onClick={() => handleDelete(u.id, u.username)} title="Delete">
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <Modal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                title={editingUser ? 'Edit User' : 'Add New User'}
                footer={
                    <>
                        <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleSubmit}>{editingUser ? 'Save' : 'Add User'}</button>
                    </>
                }
            >
                <form onSubmit={handleSubmit}>
                    {error && <div className="alert alert-danger" style={{ marginBottom: '16px' }}>{error}</div>}
                    <div className="form-group">
                        <label className="form-label">Username *</label>
                        <input
                            type="text"
                            className="form-input"
                            value={formData.username}
                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                            required
                            autoComplete="off"
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Password {editingUser ? '(leave empty to keep current)' : '*'}</label>
                        <input
                            type="password"
                            className="form-input"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            required={!editingUser}
                            autoComplete="new-password"
                            minLength={4}
                        />
                    </div>
                </form>
            </Modal>
        </>
    );
}
