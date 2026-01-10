'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Modal from '@/components/Modal';
import { Wrench, Edit, Trash2 } from 'lucide-react';

const PRODUCT_TYPES = ['TV', 'Refrigerator', 'Washing Machine', 'Air Conditioner', 'Dishwasher', 'Microwave', 'Other'];
const STATUSES = ['pending', 'in_progress', 'completed', 'cancelled'];

export default function Services() {
    const [records, setRecords] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState(null);
    const [formData, setFormData] = useState({
        customer_id: '', product_type: 'TV', product_model: '', serial_number: '',
        issue_description: '', status: 'pending', notes: ''
    });

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const [recordsRes, customersRes] = await Promise.all([
                fetch('/api/service-records'), fetch('/api/customers')
            ]);
            setRecords(await recordsRes.json());
            setCustomers(await customersRes.json());
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const openAddModal = () => {
        setEditingRecord(null);
        setFormData({ customer_id: '', product_type: 'TV', product_model: '', serial_number: '', issue_description: '', status: 'pending', notes: '' });
        setModalOpen(true);
    };

    const openEditModal = (r) => {
        setEditingRecord(r);
        setFormData({
            customer_id: r.customer_id.toString(), product_type: r.product_type, product_model: r.product_model || '',
            serial_number: r.serial_number || '', issue_description: r.issue_description || '', status: r.status, notes: r.notes || ''
        });
        setModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.customer_id || !formData.product_type) { alert('Customer and product type required'); return; }
        try {
            const payload = { ...formData, customer_id: parseInt(formData.customer_id) };
            if (editingRecord) payload.id = editingRecord.id;

            await fetch('/api/service-records', {
                method: editingRecord ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            setModalOpen(false);
            fetchData();
        } catch (e) { alert('Failed to save'); }
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this service record?')) return;
        await fetch(`/api/service-records?id=${id}`, { method: 'DELETE' });
        fetchData();
    };

    const formatDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const statusBadge = (s) => ({ pending: 'badge-warning', in_progress: 'badge-info', completed: 'badge-success', cancelled: 'badge-danger' }[s] || 'badge-default');

    if (loading) return <><Header title="Service Records" /><div className="loading-overlay"><div className="spinner"></div></div></>;

    return (
        <>
            <Header title="Service Records" onAdd={openAddModal} addLabel="New Service" onRefresh={fetchData} />
            <div className="page-enter">
                {records.length === 0 ? (
                    <div className="empty-state">
                        <Wrench size={64} className="empty-state-icon" />
                        <h3 className="empty-state-title">No service records</h3>
                        <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={openAddModal}>New Service</button>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead><tr><th>Date</th><th>Customer</th><th>Product</th><th>Model / Serial</th><th>Issue</th><th>Status</th><th>Actions</th></tr></thead>
                            <tbody>
                                {records.map((r) => (
                                    <tr key={r.id}>
                                        <td>{formatDate(r.service_date)}</td>
                                        <td><strong>{r.customer_name} {r.customer_surname}</strong><div className="text-muted" style={{ fontSize: '0.8rem' }}>{r.customer_phone}</div></td>
                                        <td><span className="badge badge-default">{r.product_type}</span></td>
                                        <td><div>{r.product_model || '-'}</div><div className="text-muted font-mono" style={{ fontSize: '0.8rem' }}>{r.serial_number || '-'}</div></td>
                                        <td style={{ maxWidth: '200px' }}>{r.issue_description || '-'}</td>
                                        <td><span className={`badge ${statusBadge(r.status)}`}>{r.status.replace('_', ' ')}</span></td>
                                        <td><div className="flex gap-2">
                                            <button className="btn btn-secondary btn-icon" onClick={() => openEditModal(r)}><Edit size={16} /></button>
                                            <button className="btn btn-secondary btn-icon" onClick={() => handleDelete(r.id)}><Trash2 size={16} /></button>
                                        </div></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingRecord ? 'Edit Service' : 'New Service Record'}
                footer={<><button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button><button className="btn btn-primary" onClick={handleSubmit}>{editingRecord ? 'Save' : 'Create'}</button></>}>
                <form onSubmit={handleSubmit}>
                    <div className="form-group"><label className="form-label">Customer *</label>
                        <select className="form-select" value={formData.customer_id} onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })} required>
                            <option value="">Select customer</option>
                            {customers.map(c => <option key={c.id} value={c.id}>{c.name} {c.surname} {c.phone ? `(${c.phone})` : ''}</option>)}
                        </select>
                    </div>
                    <div className="form-row">
                        <div className="form-group"><label className="form-label">Product Type *</label>
                            <select className="form-select" value={formData.product_type} onChange={(e) => setFormData({ ...formData, product_type: e.target.value })}>
                                {PRODUCT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div className="form-group"><label className="form-label">Status</label>
                            <select className="form-select" value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
                                {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group"><label className="form-label">Model</label><input type="text" className="form-input" value={formData.product_model} onChange={(e) => setFormData({ ...formData, product_model: e.target.value })} /></div>
                        <div className="form-group"><label className="form-label">Serial Number</label><input type="text" className="form-input" value={formData.serial_number} onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })} /></div>
                    </div>
                    <div className="form-group"><label className="form-label">Issue Description</label><textarea className="form-textarea" rows={3} value={formData.issue_description} onChange={(e) => setFormData({ ...formData, issue_description: e.target.value })}></textarea></div>
                    <div className="form-group"><label className="form-label">Notes</label><textarea className="form-textarea" rows={2} value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })}></textarea></div>
                </form>
            </Modal>
        </>
    );
}
