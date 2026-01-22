'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Modal from '@/components/Modal';
import { TruckIcon, Trash2, MapPin } from 'lucide-react';

export default function Purchases() {
    const [purchases, setPurchases] = useState([]);
    const [parts, setParts] = useState([]);
    const [locations, setLocations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        part_id: '', quantity: '', unit_cost: '', supplier: '', notes: '', location_id: ''
    });

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const [purchasesRes, partsRes, locationsRes] = await Promise.all([
                fetch('/api/purchases'), fetch('/api/parts'), fetch('/api/locations')
            ]);
            const [purchasesData, partsData, locationsData] = await Promise.all([
                purchasesRes.json(), partsRes.json(), locationsRes.json()
            ]);
            setPurchases(purchasesData);
            setParts(partsData);
            setLocations(locationsData);
        } catch (error) {
            console.error('Error:', error);
        } finally { setLoading(false); }
    };

    const openAddModal = () => {
        setFormData({ part_id: '', quantity: '', unit_cost: '', supplier: '', notes: '', location_id: '' });
        setModalOpen(true);
    };

    const handlePartChange = (partId) => {
        const part = parts.find(p => p.id === parseInt(partId));
        setFormData({
            ...formData, part_id: partId,
            unit_cost: part ? part.purchase_price.toString() : '',
            supplier: part ? part.supplier : '',
            location_id: '' // Reset location when part changes
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.part_id || !formData.quantity || !formData.unit_cost) {
            alert('Please fill in all required fields'); return;
        }
        try {
            const res = await fetch('/api/purchases', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    part_id: parseInt(formData.part_id),
                    quantity: parseInt(formData.quantity),
                    unit_cost: parseFloat(formData.unit_cost),
                    supplier: formData.supplier,
                    notes: formData.notes,
                    location_id: formData.location_id ? parseInt(formData.location_id) : null
                })
            });
            if (!res.ok) { const data = await res.json(); alert(data.error); return; }
            setModalOpen(false);
            fetchData();
        } catch (error) { alert('Failed to add purchase'); }
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this purchase? Stock will be reduced.')) return;
        try {
            const res = await fetch(`/api/purchases?id=${id}`, { method: 'DELETE' });
            if (!res.ok) { const data = await res.json(); alert(data.error); return; }
            fetchData();
        } catch (error) { console.error('Error:', error); }
    };

    const formatCurrency = (a) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format(a || 0);
    const formatDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const total = (parseFloat(formData.unit_cost) || 0) * (parseInt(formData.quantity) || 0);

    if (loading) return <><Header title="Stock Purchases" /><div className="loading-overlay"><div className="spinner"></div></div></>;

    return (
        <>
            <Header title="Stock Purchases" onAdd={openAddModal} addLabel="Add Stock" onRefresh={fetchData} />
            <div className="page-enter">
                {purchases.length === 0 ? (
                    <div className="empty-state">
                        <TruckIcon size={64} className="empty-state-icon" />
                        <h3 className="empty-state-title">No purchases yet</h3>
                        <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={openAddModal}>Add Stock</button>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead><tr><th>Date</th><th>Part</th><th>Location</th><th>Qty</th><th>Unit Cost</th><th>Total</th><th>Supplier</th><th>Actions</th></tr></thead>
                            <tbody>
                                {purchases.map((p) => (
                                    <tr key={p.id}>
                                        <td>{formatDate(p.purchase_date)}</td>
                                        <td><strong>{p.part_name}</strong></td>
                                        <td>{p.location_name ? <span className="badge badge-info"><MapPin size={12} style={{ marginRight: '4px' }} />{p.location_name}</span> : <span className="text-muted">-</span>}</td>
                                        <td>{p.quantity}</td>
                                        <td>{formatCurrency(p.unit_cost)}</td>
                                        <td><strong>{formatCurrency(p.total_cost)}</strong></td>
                                        <td>{p.supplier || '-'}</td>
                                        <td><button className="btn btn-secondary btn-icon" onClick={() => handleDelete(p.id)}><Trash2 size={16} /></button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Add Stock Purchase"
                footer={<><button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button><button className="btn btn-primary" onClick={handleSubmit}>Add Stock</button></>}>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Part *</label>
                        <select className="form-select" value={formData.part_id} onChange={(e) => handlePartChange(e.target.value)} required>
                            <option value="">Select a part</option>
                            {parts.map(p => <option key={p.id} value={p.id}>{p.part_name} (Stock: {p.quantity_in_stock})</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Destination Location</label>
                        <select className="form-select" value={formData.location_id} onChange={(e) => setFormData({ ...formData, location_id: e.target.value })}>
                            <option value="">Select location (optional)</option>
                            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                        <div className="text-muted" style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                            Stock will be added to this warehouse/location
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group"><label className="form-label">Quantity *</label><input type="number" min="1" className="form-input" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} required /></div>
                        <div className="form-group"><label className="form-label">Unit Cost (€) *</label><input type="number" step="0.01" className="form-input" value={formData.unit_cost} onChange={(e) => setFormData({ ...formData, unit_cost: e.target.value })} required /></div>
                    </div>
                    <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: 'var(--radius-md)', marginBottom: '16px', textAlign: 'center' }}>
                        <div className="text-muted">Total Cost</div><div style={{ fontSize: '1.5rem', fontWeight: '700' }}>{formatCurrency(total)}</div>
                    </div>
                    <div className="form-group"><label className="form-label">Supplier</label><input type="text" className="form-input" value={formData.supplier} onChange={(e) => setFormData({ ...formData, supplier: e.target.value })} /></div>
                    <div className="form-group"><label className="form-label">Notes</label><textarea className="form-textarea" rows={2} value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })}></textarea></div>
                </form>
            </Modal>
        </>
    );
}
