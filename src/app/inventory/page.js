'use client';

import { useState, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import Modal from '@/components/Modal';
import { Search, Edit, Trash2, Package, AlertTriangle, Camera, Plus, X, MapPin, Upload, Image as ImageIcon, ArrowRightLeft, ChevronDown, ChevronUp } from 'lucide-react';

export default function Inventory() {
    const [parts, setParts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [locations, setLocations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [locationFilter, setLocationFilter] = useState('');
    const [showLowStock, setShowLowStock] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [categoryModalOpen, setCategoryModalOpen] = useState(false);
    const [locationModalOpen, setLocationModalOpen] = useState(false);
    const [transferModalOpen, setTransferModalOpen] = useState(false);
    const [newCategory, setNewCategory] = useState('');
    const [newLocation, setNewLocation] = useState('');
    const [editingPart, setEditingPart] = useState(null);
    const [scanning, setScanning] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [expandedRows, setExpandedRows] = useState({});
    const videoRef = useRef(null);
    const fileInputRef = useRef(null);
    const [formData, setFormData] = useState({
        part_name: '', category: '', location: '', serial_number: '', description: '',
        purchase_price: '', selling_price: '', quantity_in_stock: '',
        min_stock_level: '5', supplier: '', guarantee_available: false, image_path: '',
        location_stocks: [] // Array of { location_id, quantity, min_stock_level }
    });
    const [transferData, setTransferData] = useState({
        part_id: '', from_location_id: '', to_location_id: '', quantity: '', notes: ''
    });

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const [partsRes, catsRes, locsRes] = await Promise.all([
                fetch('/api/parts'), fetch('/api/categories'), fetch('/api/locations')
            ]);
            setParts(await partsRes.json());
            setCategories(await catsRes.json());
            setLocations(await locsRes.json());
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const fetchParts = async () => {
        try {
            const params = new URLSearchParams();
            if (search) params.set('search', search);
            if (categoryFilter) params.set('category', categoryFilter);
            if (locationFilter) params.set('location', locationFilter);
            if (showLowStock) params.set('lowStock', 'true');
            const res = await fetch(`/api/parts?${params}`);
            setParts(await res.json());
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        const timer = setTimeout(() => { fetchParts(); }, 300);
        return () => clearTimeout(timer);
    }, [search, categoryFilter, locationFilter, showLowStock]);

    const openAddModal = () => {
        setEditingPart(null);
        setFormData({
            part_name: '', category: categories[0]?.name || '', location: '',
            serial_number: '', description: '',
            purchase_price: '', selling_price: '', quantity_in_stock: '',
            min_stock_level: '5', supplier: '', guarantee_available: false, image_path: '',
            location_stocks: []
        });
        setModalOpen(true);
    };

    const openEditModal = (part) => {
        setEditingPart(part);
        // Convert location_breakdown to location_stocks format
        const locationStocks = (part.location_breakdown || []).map(lb => ({
            location_id: lb.location_id,
            quantity: lb.quantity,
            min_stock_level: lb.min_stock_level || 5
        }));
        setFormData({
            part_name: part.part_name, category: part.category, location: part.location || '',
            serial_number: part.serial_number || '',
            description: part.description || '', purchase_price: part.purchase_price?.toString() || '',
            selling_price: part.selling_price?.toString() || '', quantity_in_stock: part.quantity_in_stock?.toString() || '',
            min_stock_level: part.min_stock_level?.toString() || '5', supplier: part.supplier || '',
            guarantee_available: !!part.guarantee_available, image_path: part.image_path || '',
            location_stocks: locationStocks
        });
        setModalOpen(true);
    };

    const openTransferModal = (part = null) => {
        setTransferData({
            part_id: part?.id || '',
            from_location_id: '',
            to_location_id: '',
            quantity: '',
            notes: ''
        });
        setTransferModalOpen(true);
    };

    const addLocationStock = () => {
        const availableLocations = locations.filter(
            loc => !formData.location_stocks.some(ls => ls.location_id === loc.id)
        );
        if (availableLocations.length === 0) return;
        setFormData({
            ...formData,
            location_stocks: [...formData.location_stocks, {
                location_id: availableLocations[0].id,
                quantity: 0,
                min_stock_level: 5
            }]
        });
    };

    const removeLocationStock = (index) => {
        const newStocks = [...formData.location_stocks];
        newStocks.splice(index, 1);
        setFormData({ ...formData, location_stocks: newStocks });
    };

    const updateLocationStock = (index, field, value) => {
        const newStocks = [...formData.location_stocks];
        newStocks[index] = { ...newStocks[index], [field]: field === 'location_id' ? parseInt(value) : parseInt(value) || 0 };
        setFormData({ ...formData, location_stocks: newStocks });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...formData,
                purchase_price: parseFloat(formData.purchase_price) || 0,
                selling_price: parseFloat(formData.selling_price) || 0,
                quantity_in_stock: parseInt(formData.quantity_in_stock) || 0,
                min_stock_level: parseInt(formData.min_stock_level) || 5,
                location_stocks: formData.location_stocks.filter(ls => ls.location_id)
            };
            if (editingPart) payload.id = editingPart.id;
            await fetch('/api/parts', {
                method: editingPart ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            setModalOpen(false);
            fetchParts();
        } catch (e) { alert('Failed to save'); }
    };

    const handleTransfer = async (e) => {
        e.preventDefault();
        if (!transferData.part_id || !transferData.from_location_id || !transferData.to_location_id || !transferData.quantity) {
            alert('Please fill in all required fields');
            return;
        }
        if (transferData.from_location_id === transferData.to_location_id) {
            alert('Source and destination locations must be different');
            return;
        }
        try {
            const res = await fetch('/api/stock-transfer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    part_id: parseInt(transferData.part_id),
                    from_location_id: parseInt(transferData.from_location_id),
                    to_location_id: parseInt(transferData.to_location_id),
                    quantity: parseInt(transferData.quantity),
                    notes: transferData.notes
                })
            });
            if (!res.ok) {
                const data = await res.json();
                alert(data.error || 'Failed to transfer stock');
                return;
            }
            setTransferModalOpen(false);
            fetchParts();
        } catch (e) { alert('Failed to transfer stock'); }
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this part?')) return;
        const res = await fetch(`/api/parts?id=${id}`, { method: 'DELETE' });
        if (!res.ok) { const d = await res.json(); alert(d.error); return; }
        fetchParts();
    };

    const addCategory = async () => {
        if (!newCategory.trim()) return;
        try {
            const res = await fetch('/api/categories', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newCategory.trim() })
            });
            if (!res.ok) { const d = await res.json(); alert(d.error); return; }
            setNewCategory('');
            const catsRes = await fetch('/api/categories');
            setCategories(await catsRes.json());
        } catch (e) { alert('Failed to add'); }
    };

    const deleteCategory = async (id) => {
        if (!confirm('Delete this category?')) return;
        const res = await fetch(`/api/categories?id=${id}`, { method: 'DELETE' });
        if (!res.ok) { const d = await res.json(); alert(d.error); return; }
        const catsRes = await fetch('/api/categories');
        setCategories(await catsRes.json());
    };

    const addLocation = async () => {
        if (!newLocation.trim()) return;
        try {
            const res = await fetch('/api/locations', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newLocation.trim() })
            });
            if (!res.ok) { const d = await res.json(); alert(d.error); return; }
            setNewLocation('');
            const locRes = await fetch('/api/locations');
            setLocations(await locRes.json());
        } catch (e) { alert('Failed to add'); }
    };

    const deleteLocation = async (id) => {
        if (!confirm('Delete this location?')) return;
        const res = await fetch(`/api/locations?id=${id}`, { method: 'DELETE' });
        if (!res.ok) { const d = await res.json(); alert(d.error); return; }
        const locRes = await fetch('/api/locations');
        setLocations(await locRes.json());
    };

    const toggleRowExpand = (partId) => {
        setExpandedRows(prev => ({ ...prev, [partId]: !prev[partId] }));
    };

    // Camera scanning for serial numbers
    const startScanning = async () => {
        if (typeof window !== 'undefined' && !window.isSecureContext && window.location.hostname !== 'localhost') {
            alert('Camera access requires HTTPS or localhost.');
            return;
        }
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert('Camera API not supported in this browser.');
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
            }
            setScanning(true);
        } catch (e) {
            console.error(e);
            alert('Camera access denied.');
        }
    };

    const stopScanning = () => {
        if (videoRef.current?.srcObject) {
            videoRef.current.srcObject.getTracks().forEach(t => t.stop());
        }
        setScanning(false);
    };

    const captureFrame = () => {
        if (!videoRef.current) return;
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
        const serial = prompt('Enter the serial number you see on the screen:');
        if (serial) setFormData({ ...formData, serial_number: serial });
        stopScanning();
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            const formDataUpload = new FormData();
            formDataUpload.append('file', file);
            const res = await fetch('/api/upload', { method: 'POST', body: formDataUpload });
            const data = await res.json();
            if (!res.ok) { alert(data.error || 'Failed to upload image'); return; }
            setFormData({ ...formData, image_path: data.imagePath });
        } catch (err) {
            console.error('Upload error:', err);
            alert('Failed to upload image');
        } finally { setUploading(false); }
    };

    const removeImage = () => {
        setFormData({ ...formData, image_path: '' });
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const formatCurrency = (a) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format(a || 0);
    const getStockStatus = (qty, min) => qty === 0 ? 'low' : qty <= min ? 'medium' : 'high';

    const getSelectedPartStock = () => {
        if (!transferData.part_id || !transferData.from_location_id) return 0;
        const part = parts.find(p => p.id === parseInt(transferData.part_id));
        if (!part?.location_breakdown) return 0;
        const loc = part.location_breakdown.find(l => l.location_id === parseInt(transferData.from_location_id));
        return loc?.quantity || 0;
    };

    if (loading) return <><Header title="Parts Inventory" /><div className="loading-overlay"><div className="spinner"></div></div></>;

    return (
        <>
            <Header title="Parts Inventory" onAdd={openAddModal} addLabel="Add Part" onRefresh={fetchData} />
            <div className="page-enter">
                <div className="flex gap-4 mb-6" style={{ flexWrap: 'wrap' }}>
                    <div className="search-bar" style={{ flex: 1, minWidth: '250px' }}>
                        <Search size={18} className="search-bar-icon" />
                        <input type="text" placeholder="Search parts or serial numbers..." value={search} onChange={(e) => setSearch(e.target.value)} />
                    </div>
                    <select className="form-select" style={{ width: 'auto', minWidth: '150px' }} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                        <option value="">All Categories</option>
                        {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                    <select className="form-select" style={{ width: 'auto', minWidth: '150px' }} value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
                        <option value="">All Locations</option>
                        {locations.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                    </select>
                    <div className="flex gap-2">
                        <button className="btn btn-secondary" onClick={() => setCategoryModalOpen(true)} title="Manage Categories"><Package size={16} /></button>
                        <button className="btn btn-secondary" onClick={() => setLocationModalOpen(true)} title="Manage Locations"><MapPin size={16} /></button>
                        <button className="btn btn-secondary" onClick={() => openTransferModal()} title="Transfer Stock"><ArrowRightLeft size={16} /></button>
                    </div>
                    <label className="form-checkbox" style={{ padding: '12px 16px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                        <input type="checkbox" checked={showLowStock} onChange={(e) => setShowLowStock(e.target.checked)} />
                        <span>Low Stock Only</span>
                    </label>
                </div>

                {parts.length === 0 ? (
                    <div className="empty-state">
                        <Package size={64} className="empty-state-icon" />
                        <h3 className="empty-state-title">No parts found</h3>
                        <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={openAddModal}>Add Part</button>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead><tr><th style={{ width: '60px' }}>Image</th><th>Part Name</th><th>Serial #</th><th>Category</th><th>Stock</th><th>Purchase</th><th>Selling</th><th>Supplier</th><th>Guarantee</th><th>Actions</th></tr></thead>
                            <tbody>
                                {parts.map((p) => (
                                    <>
                                        <tr key={p.id}>
                                            <td>{p.image_path ? <img src={p.image_path} alt={p.part_name} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} /> : <div style={{ width: '40px', height: '40px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ImageIcon size={18} className="text-muted" /></div>}</td>
                                            <td><strong>{p.part_name}</strong>{p.description && <div className="text-muted" style={{ fontSize: '0.8rem' }}>{p.description}</div>}</td>
                                            <td><span className="font-mono" style={{ fontSize: '0.85rem' }}>{p.serial_number || '-'}</span></td>
                                            <td><span className="badge badge-default">{p.category}</span></td>
                                            <td>
                                                <div className="stock-indicator" style={{ cursor: p.location_breakdown?.length > 0 ? 'pointer' : 'default' }} onClick={() => p.location_breakdown?.length > 0 && toggleRowExpand(p.id)}>
                                                    <span className={`stock-dot ${getStockStatus(p.quantity_in_stock, p.min_stock_level)}`}></span>
                                                    {p.quantity_in_stock} total
                                                    {p.quantity_in_stock <= p.min_stock_level && <AlertTriangle size={14} className="text-warning" style={{ marginLeft: '4px' }} />}
                                                    {p.location_breakdown?.length > 0 && (
                                                        expandedRows[p.id] ? <ChevronUp size={14} style={{ marginLeft: '4px' }} /> : <ChevronDown size={14} style={{ marginLeft: '4px' }} />
                                                    )}
                                                </div>
                                            </td>
                                            <td>{formatCurrency(p.purchase_price)}</td>
                                            <td>{formatCurrency(p.selling_price)}</td>
                                            <td>{p.supplier || '-'}</td>
                                            <td><span className={`badge ${p.guarantee_available ? 'badge-success' : 'badge-default'}`}>{p.guarantee_available ? 'Yes' : 'No'}</span></td>
                                            <td>
                                                <div className="flex gap-2">
                                                    <button className="btn btn-secondary btn-icon" onClick={() => openTransferModal(p)} title="Transfer Stock"><ArrowRightLeft size={16} /></button>
                                                    <button className="btn btn-secondary btn-icon" onClick={() => openEditModal(p)}><Edit size={16} /></button>
                                                    <button className="btn btn-secondary btn-icon" onClick={() => handleDelete(p.id)}><Trash2 size={16} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                        {expandedRows[p.id] && p.location_breakdown?.length > 0 && (
                                            <tr key={`${p.id}-locations`} style={{ background: 'var(--bg-tertiary)' }}>
                                                <td colSpan="10" style={{ padding: '12px 16px' }}>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                                                        {p.location_breakdown.map(loc => (
                                                            <div key={loc.location_id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                                                                <MapPin size={14} className="text-muted" />
                                                                <span style={{ fontWeight: '500' }}>{loc.location_name}:</span>
                                                                <span className={`stock-dot ${getStockStatus(loc.quantity, loc.min_stock_level)}`}></span>
                                                                <span>{loc.quantity}</span>
                                                                {loc.quantity <= loc.min_stock_level && <AlertTriangle size={12} className="text-warning" />}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Add/Edit Part Modal */}
            <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); stopScanning(); }} title={editingPart ? 'Edit Part' : 'Add New Part'}
                footer={<><button className="btn btn-secondary" onClick={() => { setModalOpen(false); stopScanning(); }}>Cancel</button><button className="btn btn-primary" onClick={handleSubmit}>{editingPart ? 'Save' : 'Add Part'}</button></>}>
                <form onSubmit={handleSubmit}>
                    <div className="form-group"><label className="form-label">Part Name *</label><input type="text" className="form-input" value={formData.part_name} onChange={(e) => setFormData({ ...formData, part_name: e.target.value })} required /></div>
                    <div className="form-row">
                        <div className="form-group"><label className="form-label">Category *</label>
                            <select className="form-select" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })}>
                                {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="form-group"><label className="form-label">Supplier</label><input type="text" className="form-input" value={formData.supplier} onChange={(e) => setFormData({ ...formData, supplier: e.target.value })} /></div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Serial Number</label>
                        <div className="flex gap-2">
                            <input type="text" className="form-input" value={formData.serial_number} onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })} placeholder="Enter or scan..." />
                            <button type="button" className="btn btn-secondary" onClick={scanning ? stopScanning : startScanning}><Camera size={18} /> {scanning ? 'Stop' : 'Scan'}</button>
                        </div>
                        {scanning && (
                            <div style={{ marginTop: '12px', position: 'relative' }}>
                                <video ref={videoRef} style={{ width: '100%', borderRadius: 'var(--radius-md)' }} />
                                <button type="button" className="btn btn-primary" style={{ position: 'absolute', bottom: '12px', left: '50%', transform: 'translateX(-50%)' }} onClick={captureFrame}>Capture</button>
                            </div>
                        )}
                    </div>
                    <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" rows={2} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })}></textarea></div>
                    <div className="form-group">
                        <label className="form-label">Part Image</label>
                        {formData.image_path ? (
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                                <img src={formData.image_path} alt="Part" style={{ maxWidth: '200px', maxHeight: '150px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }} />
                                <button type="button" className="btn btn-secondary btn-icon" style={{ position: 'absolute', top: '-8px', right: '-8px', width: '24px', height: '24px', padding: 0, borderRadius: '50%' }} onClick={removeImage}><X size={14} /></button>
                            </div>
                        ) : (
                            <div>
                                <input type="file" ref={fileInputRef} accept="image/jpeg,image/png,image/gif,image/webp" onChange={handleImageUpload} style={{ display: 'none' }} />
                                <button type="button" className="btn btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                                    {uploading ? <><div className="spinner" style={{ width: '16px', height: '16px', marginRight: '8px' }}></div> Uploading...</> : <><Upload size={18} /> Upload Image</>}
                                </button>
                                <span className="text-muted" style={{ marginLeft: '12px', fontSize: '0.85rem' }}>Max 5MB</span>
                            </div>
                        )}
                    </div>
                    <div className="form-row">
                        <div className="form-group"><label className="form-label">Purchase Price (€)</label><input type="number" step="0.01" className="form-input" value={formData.purchase_price} onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })} /></div>
                        <div className="form-group"><label className="form-label">Selling Price (€)</label><input type="number" step="0.01" className="form-input" value={formData.selling_price} onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })} /></div>
                    </div>
                    <div className="form-group"><label className="form-checkbox"><input type="checkbox" checked={formData.guarantee_available} onChange={(e) => setFormData({ ...formData, guarantee_available: e.target.checked })} /><span>Guarantee Available</span></label></div>

                    {/* Multi-location stock editor */}
                    <div className="form-group" style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <label className="form-label" style={{ margin: 0 }}>Stock by Location</label>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={addLocationStock} disabled={formData.location_stocks.length >= locations.length}>
                                <Plus size={14} /> Add Location
                            </button>
                        </div>
                        {formData.location_stocks.length === 0 ? (
                            <div className="text-muted" style={{ fontSize: '0.9rem', textAlign: 'center', padding: '12px' }}>
                                No locations configured. Click "Add Location" to track stock by warehouse.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {formData.location_stocks.map((ls, index) => (
                                    <div key={index} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <select className="form-select" style={{ flex: 2 }} value={ls.location_id} onChange={(e) => updateLocationStock(index, 'location_id', e.target.value)}>
                                            {locations.map(l => (
                                                <option key={l.id} value={l.id} disabled={formData.location_stocks.some((s, i) => i !== index && s.location_id === l.id)}>
                                                    {l.name}
                                                </option>
                                            ))}
                                        </select>
                                        <input type="number" className="form-input" style={{ flex: 1 }} placeholder="Qty" value={ls.quantity} onChange={(e) => updateLocationStock(index, 'quantity', e.target.value)} min="0" />
                                        <input type="number" className="form-input" style={{ flex: 1 }} placeholder="Min" value={ls.min_stock_level} onChange={(e) => updateLocationStock(index, 'min_stock_level', e.target.value)} min="0" title="Min stock level" />
                                        <button type="button" className="btn btn-secondary btn-icon" onClick={() => removeLocationStock(index)}><X size={14} /></button>
                                    </div>
                                ))}
                            </div>
                        )}
                        {formData.location_stocks.length > 0 && (
                            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
                                <span style={{ fontWeight: '600' }}>Total: {formData.location_stocks.reduce((sum, ls) => sum + (ls.quantity || 0), 0)}</span>
                            </div>
                        )}
                    </div>
                </form>
            </Modal>

            {/* Stock Transfer Modal */}
            <Modal isOpen={transferModalOpen} onClose={() => setTransferModalOpen(false)} title="Transfer Stock Between Locations"
                footer={<><button className="btn btn-secondary" onClick={() => setTransferModalOpen(false)}>Cancel</button><button className="btn btn-primary" onClick={handleTransfer}>Transfer</button></>}>
                <form onSubmit={handleTransfer}>
                    <div className="form-group">
                        <label className="form-label">Part *</label>
                        <select className="form-select" value={transferData.part_id} onChange={(e) => setTransferData({ ...transferData, part_id: e.target.value, from_location_id: '', quantity: '' })} required>
                            <option value="">Select a part</option>
                            {parts.filter(p => p.location_breakdown?.length > 0).map(p => (
                                <option key={p.id} value={p.id}>{p.part_name} ({p.quantity_in_stock} total)</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">From Location *</label>
                            <select className="form-select" value={transferData.from_location_id} onChange={(e) => setTransferData({ ...transferData, from_location_id: e.target.value })} required disabled={!transferData.part_id}>
                                <option value="">Select source</option>
                                {transferData.part_id && parts.find(p => p.id === parseInt(transferData.part_id))?.location_breakdown?.filter(l => l.quantity > 0).map(l => (
                                    <option key={l.location_id} value={l.location_id}>{l.location_name} ({l.quantity} available)</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">To Location *</label>
                            <select className="form-select" value={transferData.to_location_id} onChange={(e) => setTransferData({ ...transferData, to_location_id: e.target.value })} required disabled={!transferData.part_id}>
                                <option value="">Select destination</option>
                                {locations.filter(l => l.id !== parseInt(transferData.from_location_id)).map(l => (
                                    <option key={l.id} value={l.id}>{l.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Quantity * (Max: {getSelectedPartStock()})</label>
                        <input type="number" className="form-input" value={transferData.quantity} onChange={(e) => setTransferData({ ...transferData, quantity: e.target.value })} min="1" max={getSelectedPartStock()} required />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Notes</label>
                        <textarea className="form-textarea" rows={2} value={transferData.notes} onChange={(e) => setTransferData({ ...transferData, notes: e.target.value })} placeholder="Optional transfer notes..."></textarea>
                    </div>
                </form>
            </Modal>

            {/* Manage Categories Modal */}
            <Modal isOpen={categoryModalOpen} onClose={() => setCategoryModalOpen(false)} title="Manage Categories"
                footer={<button className="btn btn-secondary" onClick={() => setCategoryModalOpen(false)}>Close</button>}>
                <div className="form-group">
                    <label className="form-label">Add New Category</label>
                    <div className="flex gap-2">
                        <input type="text" className="form-input" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Category name..." />
                        <button className="btn btn-primary" onClick={addCategory}><Plus size={18} /> Add</button>
                    </div>
                </div>
                <div style={{ marginTop: '20px' }}>
                    <label className="form-label">Existing Categories</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {categories.map(c => (
                            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-tertiary)', padding: '8px 12px', borderRadius: 'var(--radius-md)' }}>
                                <span>{c.name}</span>
                                <button className="btn btn-secondary btn-icon" style={{ width: '24px', height: '24px', padding: 0 }} onClick={() => deleteCategory(c.id)}><X size={14} /></button>
                            </div>
                        ))}
                    </div>
                </div>
            </Modal>

            {/* Manage Locations Modal */}
            <Modal isOpen={locationModalOpen} onClose={() => setLocationModalOpen(false)} title="Manage Locations"
                footer={<button className="btn btn-secondary" onClick={() => setLocationModalOpen(false)}>Close</button>}>
                <div className="form-group">
                    <label className="form-label">Add New Location</label>
                    <div className="flex gap-2">
                        <input type="text" className="form-input" value={newLocation} onChange={(e) => setNewLocation(e.target.value)} placeholder="Location name (e.g. Warehouse A)..." />
                        <button className="btn btn-primary" onClick={addLocation}><Plus size={18} /> Add</button>
                    </div>
                </div>
                <div style={{ marginTop: '20px' }}>
                    <label className="form-label">Existing Locations</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {locations.map(l => (
                            <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-tertiary)', padding: '8px 12px', borderRadius: 'var(--radius-md)' }}>
                                <span>{l.name}</span>
                                <button className="btn btn-secondary btn-icon" style={{ width: '24px', height: '24px', padding: 0 }} onClick={() => deleteLocation(l.id)}><X size={14} /></button>
                            </div>
                        ))}
                    </div>
                </div>
            </Modal>
        </>
    );
}
