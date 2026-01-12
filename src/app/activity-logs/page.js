'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import { Activity, Package, Users, ShoppingCart, TruckIcon, UserCog, Filter, ChevronLeft, ChevronRight, ShieldOff } from 'lucide-react';

const entityIcons = {
    part: Package,
    customer: Users,
    sale: ShoppingCart,
    purchase: TruckIcon,
    user: UserCog
};

const actionColors = {
    create: 'badge-success',
    update: 'badge-info',
    delete: 'badge-danger'
};

export default function ActivityLogsPage() {
    const [logs, setLogs] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [page, setPage] = useState(0);
    const [filters, setFilters] = useState({
        username: '',
        entityType: '',
        action: ''
    });
    const limit = 50;

    useEffect(() => {
        fetchLogs();
    }, [page, filters]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('limit', limit);
            params.set('offset', page * limit);
            if (filters.username) params.set('username', filters.username);
            if (filters.entityType) params.set('entityType', filters.entityType);
            if (filters.action) params.set('action', filters.action);

            const res = await fetch(`/api/activity-logs?${params}`);
            if (res.status === 403) {
                setIsAdmin(false);
                setLoading(false);
                return;
            }
            if (res.ok) {
                setIsAdmin(true);
                const data = await res.json();
                setLogs(data.logs);
                setTotal(data.total);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const totalPages = Math.ceil(total / limit);

    if (loading && logs.length === 0) {
        return (
            <>
                <Header title="Activity Logs" />
                <div className="loading-overlay"><div className="spinner"></div></div>
            </>
        );
    }

    if (!isAdmin) {
        return (
            <>
                <Header title="Activity Logs" />
                <div className="page-enter">
                    <div className="empty-state">
                        <ShieldOff size={64} className="empty-state-icon" />
                        <h3 className="empty-state-title">Access Denied</h3>
                        <p className="text-muted">Only administrators can view activity logs.</p>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <Header title="Activity Logs" onRefresh={fetchLogs} />
            <div className="page-enter">
                {/* Filters */}
                <div className="flex gap-4 mb-6" style={{ flexWrap: 'wrap' }}>
                    <div className="flex gap-2 items-center">
                        <Filter size={18} className="text-muted" />
                        <span className="text-muted">Filters:</span>
                    </div>
                    <select
                        className="form-select"
                        style={{ width: 'auto', minWidth: '150px' }}
                        value={filters.entityType}
                        onChange={(e) => { setFilters({ ...filters, entityType: e.target.value }); setPage(0); }}
                    >
                        <option value="">All Types</option>
                        <option value="part">Parts</option>
                        <option value="customer">Customers</option>
                        <option value="sale">Sales</option>
                        <option value="purchase">Purchases</option>
                        <option value="user">Users</option>
                    </select>
                    <select
                        className="form-select"
                        style={{ width: 'auto', minWidth: '150px' }}
                        value={filters.action}
                        onChange={(e) => { setFilters({ ...filters, action: e.target.value }); setPage(0); }}
                    >
                        <option value="">All Actions</option>
                        <option value="create">Created</option>
                        <option value="update">Updated</option>
                        <option value="delete">Deleted</option>
                    </select>
                    <input
                        type="text"
                        className="form-input"
                        placeholder="Filter by username..."
                        style={{ width: 'auto', minWidth: '180px' }}
                        value={filters.username}
                        onChange={(e) => { setFilters({ ...filters, username: e.target.value }); setPage(0); }}
                    />
                    {(filters.username || filters.entityType || filters.action) && (
                        <button
                            className="btn btn-secondary"
                            onClick={() => { setFilters({ username: '', entityType: '', action: '' }); setPage(0); }}
                        >
                            Clear Filters
                        </button>
                    )}
                </div>

                {/* Stats */}
                <div className="text-muted mb-4" style={{ fontSize: '0.9rem' }}>
                    Showing {logs.length} of {total} activities
                </div>

                {logs.length === 0 ? (
                    <div className="empty-state">
                        <Activity size={64} className="empty-state-icon" />
                        <h3 className="empty-state-title">No activity logs found</h3>
                        <p className="text-muted">Activity will appear here as users perform actions.</p>
                    </div>
                ) : (
                    <>
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Date & Time</th>
                                        <th>User</th>
                                        <th>Action</th>
                                        <th>Type</th>
                                        <th>Details</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map((log) => {
                                        const Icon = entityIcons[log.entity_type] || Activity;
                                        return (
                                            <tr key={log.id}>
                                                <td>
                                                    <span style={{ fontSize: '0.9rem' }}>{formatDate(log.created_at)}</span>
                                                </td>
                                                <td>
                                                    <strong>{log.username}</strong>
                                                </td>
                                                <td>
                                                    <span className={`badge ${actionColors[log.action] || 'badge-default'}`}>
                                                        {log.action}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="flex items-center gap-2">
                                                        <Icon size={16} className="text-muted" />
                                                        <span style={{ textTransform: 'capitalize' }}>{log.entity_type}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div>
                                                        <strong>{log.entity_name}</strong>
                                                        {log.details && (
                                                            <div className="text-muted" style={{ fontSize: '0.85rem' }}>
                                                                {log.details}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex justify-center gap-2 mt-6">
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => setPage(p => Math.max(0, p - 1))}
                                    disabled={page === 0}
                                >
                                    <ChevronLeft size={18} /> Previous
                                </button>
                                <span style={{ padding: '12px 16px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                                    Page {page + 1} of {totalPages}
                                </span>
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                                    disabled={page >= totalPages - 1}
                                >
                                    Next <ChevronRight size={18} />
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </>
    );
}
