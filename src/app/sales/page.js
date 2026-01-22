'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Modal from '@/components/Modal';
import { ShoppingCart, Trash2, MapPin } from 'lucide-react';

export default function Sales() {
    const [sales, setSales] = useState([]);
    const [parts, setParts] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [locations, setLocations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        part_id: '', customer_id: '', quantity: '1', unit_price: '',
        labour_cost: '0', guarantee_included: false, notes: '', location_id: ''
    });

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const [salesRes, partsRes, customersRes, locationsRes] = await Promise.all([
                fetch('/api/sales'), fetch('/api/parts'), fetch('/api/customers'), fetch('/api/locations')
            ]);
            setSales(await salesRes.json());
            setParts(await partsRes.json());
            setCustomers(await customersRes.json());
            setLocations(await locationsRes.json());
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const openAddModal = () => {
        setFormData({ part_id: '', customer_id: '', quantity: '1', unit_price: '', labour_cost: '0', guarantee_included: false, notes: '', location_id: '' });
        setModalOpen(true);
    };

    const handlePartChange = (partId) => {
        const part = parts.find(p => p.id === parseInt(partId));
        setFormData({
            ...formData,
            part_id: partId,
            unit_price: part ? part.selling_price.toString() : '',
            location_id: '' // Reset location when part changes
        });
    };

    const handleLocationChange = (locationId) => {
        setFormData({ ...formData, location_id: locationId });
    };

    const getAvailableLocationsForPart = () => {
        if (!formData.part_id) return [];
        const part = parts.find(p => p.id === parseInt(formData.part_id));
        if (!part?.location_breakdown || part.location_breakdown.length === 0) {
            // No multi-location setup, return empty (will use legacy stock)
            return [];
        }
        return part.location_breakdown.filter(lb => lb.quantity > 0);
    };

    const getStockAtSelectedLocation = () => {
        if (!formData.part_id) return 0;
        const part = parts.find(p => p.id === parseInt(formData.part_id));
        if (!part) return 0;

        if (formData.location_id) {
            const locStock = part.location_breakdown?.find(lb => lb.location_id === parseInt(formData.location_id));
            return locStock?.quantity || 0;
        }

        // No location selected - return total stock
        return part.quantity_in_stock || 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.part_id || !formData.quantity) { alert('Please select a part and quantity'); return; }

        // Check if part has multi-location setup and location is required
        const part = parts.find(p => p.id === parseInt(formData.part_id));
        const hasLocations = part?.location_breakdown?.length > 0;
        if (hasLocations && !formData.location_id) {
            alert('Please select a location for this sale');
            return;
        }

        try {
            const res = await fetch('/api/sales', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    part_id: parseInt(formData.part_id),
                    customer_id: formData.customer_id ? parseInt(formData.customer_id) : null,
                    quantity: parseInt(formData.quantity),
                    unit_price: parseFloat(formData.unit_price) || 0,
                    labour_cost: parseFloat(formData.labour_cost) || 0,
                    guarantee_included: formData.guarantee_included,
                    notes: formData.notes,
                    location_id: formData.location_id ? parseInt(formData.location_id) : null
                })
            });
            if (!res.ok) { const d = await res.json(); alert(d.error); return; }
            setModalOpen(false);
            fetchData();
        } catch (e) { alert('Failed to create sale'); }
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this sale? Stock will be restored.')) return;
        await fetch(`/api/sales?id=${id}`, { method: 'DELETE' });
        fetchData();
    };

    const formatCurrency = (a) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format(a || 0);
    const formatDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    const selectedPart = parts.find(p => p.id === parseInt(formData.part_id));
    const availableLocations = getAvailableLocationsForPart();
    const stockAtLocation = getStockAtSelectedLocation();

    // If guarantee included, part is free - only labour cost applies
    const effectiveUnitPrice = formData.guarantee_included ? 0 : (parseFloat(formData.unit_price) || 0);
    const partsTotal = effectiveUnitPrice * (parseInt(formData.quantity) || 0);
    const labourCost = parseFloat(formData.labour_cost) || 0;
    const calculatedTotal = partsTotal + labourCost;

    if (loading) return <><Header title="Sales" /><div className="loading-overlay"><div className="spinner"></div></div></>;

    return (
        <>
            <Header title="Sales" onAdd={openAddModal} addLabel="New Sale" onRefresh={fetchData} />
            <div className="page-enter">
                {sales.length === 0 ? (
                    <div className="empty-state">
                        <ShoppingCart size={64} className="empty-state-icon" />
                        <h3 className="empty-state-title">No sales yet</h3>
                        <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={openAddModal}>New Sale</button>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead><tr><th>Date</th><th>Part</th><th>Location</th><th>Customer</th><th>Qty</th><th>Unit Price</th><th>Labour</th><th>Total</th><th>Guarantee</th><th>Actions</th></tr></thead>
                            <tbody>
                                {sales.map((s) => (
                                    <tr key={s.id}>
                                        <td style={{ whiteSpace: 'nowrap' }}>{formatDate(s.sale_date)}</td>
                                        <td><strong>{s.part_name}</strong><div className="text-muted" style={{ fontSize: '0.8rem' }}>{s.category}</div></td>
                                        <td>{s.location_name ? <span className="badge badge-info"><MapPin size={12} style={{ marginRight: '4px' }} />{s.location_name}</span> : <span className="text-muted">-</span>}</td>
                                        <td>{s.customer_name ? `${s.customer_name} ${s.customer_surname}` : <span className="text-muted">Walk-in</span>}{s.customer_phone && <div className="text-muted" style={{ fontSize: '0.8rem' }}>{s.customer_phone}</div>}</td>
                                        <td>{s.quantity}</td>
                                        <td>{s.guarantee_included ? <span className="text-success">FREE</span> : formatCurrency(s.unit_price)}</td>
                                        <td>{formatCurrency(s.labour_cost || 0)}</td>
                                        <td><strong>{formatCurrency(s.total_price)}</strong></td>
                                        <td><span className={`badge ${s.guarantee_included ? 'badge-success' : 'badge-default'}`}>{s.guarantee_included ? 'Yes' : 'No'}</span></td>
                                        <td><button className="btn btn-secondary btn-icon" onClick={() => handleDelete(s.id)}><Trash2 size={16} /></button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="New Sale"
                footer={<><button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button><button className="btn btn-primary" onClick={handleSubmit}>Complete Sale</button></>}>
                <form onSubmit={handleSubmit}>
                    <div className="form-group"><label className="form-label">Part *</label>
                        <select className="form-select" value={formData.part_id} onChange={(e) => handlePartChange(e.target.value)} required>
                            <option value="">Select a part</option>
                            {parts.filter(p => p.quantity_in_stock > 0).map(p => (
                                <option key={p.id} value={p.id}>{p.part_name} - {formatCurrency(p.selling_price)} (Stock: {p.quantity_in_stock})</option>
                            ))}
                        </select>
                    </div>

                    {/* Location selector - only show if part has multi-location setup */}
                    {selectedPart && availableLocations.length > 0 && (
                        <div className="form-group">
                            <label className="form-label">Stock Location *</label>
                            <select className="form-select" value={formData.location_id} onChange={(e) => handleLocationChange(e.target.value)} required>
                                <option value="">Select location</option>
                                {availableLocations.map(loc => (
                                    <option key={loc.location_id} value={loc.location_id}>
                                        {loc.location_name} ({loc.quantity} available)
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {selectedPart && stockAtLocation < 10 && (
                        <div style={{ background: 'var(--warning-bg)', color: 'var(--warning)', padding: '12px', borderRadius: 'var(--radius-sm)', marginBottom: '16px', fontSize: '0.9rem' }}>
                            Only {stockAtLocation} items available{formData.location_id ? ` at selected location` : ''}
                        </div>
                    )}
                    <div className="form-group"><label className="form-label">Customer (optional)</label>
                        <select className="form-select" value={formData.customer_id} onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}>
                            <option value="">Walk-in Customer</option>
                            {customers.map(c => <option key={c.id} value={c.id}>{c.name} {c.surname} {c.phone ? `(${c.phone})` : ''}</option>)}
                        </select>
                    </div>
                    <div className="form-row">
                        <div className="form-group"><label className="form-label">Quantity *</label><input type="number" min="1" max={stockAtLocation || 999} className="form-input" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} required /></div>
                        <div className="form-group"><label className="form-label">Unit Price (€)</label><input type="number" step="0.01" className="form-input" value={formData.unit_price} onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })} disabled={formData.guarantee_included} style={formData.guarantee_included ? { opacity: 0.5 } : {}} /></div>
                    </div>
                    <div className="form-group"><label className="form-label">Labour Cost (€)</label><input type="number" step="0.01" className="form-input" value={formData.labour_cost} onChange={(e) => setFormData({ ...formData, labour_cost: e.target.value })} placeholder="Enter labour/service cost..." /></div>
                    <div className="form-group">
                        <label className="form-checkbox"><input type="checkbox" checked={formData.guarantee_included} onChange={(e) => setFormData({ ...formData, guarantee_included: e.target.checked })} /><span>Guarantee Included (Part is FREE)</span></label>
                    </div>
                    {formData.guarantee_included && (
                        <div style={{ background: 'var(--success-bg)', color: 'var(--success)', padding: '12px', borderRadius: 'var(--radius-sm)', marginBottom: '16px', fontSize: '0.9rem' }}>
                            Part covered by guarantee - customer only pays for labour
                        </div>
                    )}
                    <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: 'var(--radius-md)', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span className="text-muted">Parts ({formData.quantity}x):</span>
                            <span>{formData.guarantee_included ? <span className="text-success">FREE</span> : formatCurrency(partsTotal)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span className="text-muted">Labour:</span>
                            <span>{formatCurrency(labourCost)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
                            <span style={{ fontWeight: '600' }}>Total:</span>
                            <span style={{ fontSize: '1.25rem', fontWeight: '700' }}>{formatCurrency(calculatedTotal)}</span>
                        </div>
                    </div>
                    <div className="form-group"><label className="form-label">Notes</label><textarea className="form-textarea" rows={2} value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })}></textarea></div>
                </form>
            </Modal>
        </>
    );
}
