'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Modal from '@/components/Modal';
import { Search, Edit, Trash2, Users, Phone, Mail, MapPin } from 'lucide-react';

export default function Customers() {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        surname: '',
        phone: '',
        email: '',
        address: '',
        notes: ''
    });

    useEffect(() => {
        fetchCustomers();
    }, []);

    const fetchCustomers = async () => {
        try {
            const params = new URLSearchParams();
            if (search) params.set('search', search);

            const res = await fetch(`/api/customers?${params}`);
            const data = await res.json();
            setCustomers(data);
        } catch (error) {
            console.error('Error fetching customers:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchCustomers();
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    const openAddModal = () => {
        setEditingCustomer(null);
        setFormData({
            name: '',
            surname: '',
            phone: '',
            email: '',
            address: '',
            notes: ''
        });
        setModalOpen(true);
    };

    const openEditModal = (customer) => {
        setEditingCustomer(customer);
        setFormData({
            name: customer.name,
            surname: customer.surname,
            phone: customer.phone || '',
            email: customer.email || '',
            address: customer.address || '',
            notes: customer.notes || ''
        });
        setModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingCustomer) {
                await fetch('/api/customers', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: editingCustomer.id, ...formData })
                });
            } else {
                await fetch('/api/customers', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });
            }

            setModalOpen(false);
            fetchCustomers();
        } catch (error) {
            console.error('Error saving customer:', error);
            alert('Failed to save customer');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this customer? This will also delete their service records.')) return;

        try {
            await fetch(`/api/customers?id=${id}`, { method: 'DELETE' });
            fetchCustomers();
        } catch (error) {
            console.error('Error deleting customer:', error);
        }
    };

    return (
        <>
            <Header
                title="Customers"
                onAdd={openAddModal}
                addLabel="Add Customer"
                onRefresh={fetchCustomers}
            />

            <div className="page-enter">
                {/* Search */}
                <div className="search-bar mb-6" style={{ maxWidth: '400px' }}>
                    <Search size={18} className="search-bar-icon" />
                    <input
                        type="text"
                        placeholder="Search customers..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                {/* Customers Grid */}
                {loading ? (
                    <div className="loading-overlay">
                        <div className="spinner"></div>
                    </div>
                ) : customers.length === 0 ? (
                    <div className="empty-state">
                        <Users size={64} className="empty-state-icon" />
                        <h3 className="empty-state-title">No customers found</h3>
                        <p>Add your first customer to get started</p>
                        <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={openAddModal}>
                            Add Customer
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '16px' }}>
                        {customers.map((customer) => (
                            <div key={customer.id} className="card" style={{ padding: '20px' }}>
                                <div className="flex justify-between items-center mb-4">
                                    <div>
                                        <h3 style={{ fontSize: '1.1rem', fontWeight: '600' }}>
                                            {customer.name} {customer.surname}
                                        </h3>
                                        <span className="text-muted" style={{ fontSize: '0.85rem' }}>
                                            Customer #{customer.id}
                                        </span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button className="btn btn-secondary btn-icon" onClick={() => openEditModal(customer)}>
                                            <Edit size={16} />
                                        </button>
                                        <button className="btn btn-secondary btn-icon" onClick={() => handleDelete(customer.id)}>
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2" style={{ fontSize: '0.9rem' }}>
                                    {customer.phone && (
                                        <div className="flex items-center gap-2 text-muted">
                                            <Phone size={16} />
                                            <span>{customer.phone}</span>
                                        </div>
                                    )}
                                    {customer.email && (
                                        <div className="flex items-center gap-2 text-muted">
                                            <Mail size={16} />
                                            <span>{customer.email}</span>
                                        </div>
                                    )}
                                    {customer.address && (
                                        <div className="flex items-center gap-2 text-muted">
                                            <MapPin size={16} />
                                            <span>{customer.address}</span>
                                        </div>
                                    )}
                                </div>

                                {customer.notes && (
                                    <div style={{ marginTop: '12px', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
                                        {customer.notes}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Add/Edit Modal */}
            <Modal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                title={editingCustomer ? 'Edit Customer' : 'Add New Customer'}
                footer={
                    <>
                        <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleSubmit}>
                            {editingCustomer ? 'Save Changes' : 'Add Customer'}
                        </button>
                    </>
                }
            >
                <form onSubmit={handleSubmit}>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Name *</label>
                            <input
                                type="text"
                                className="form-input"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Surname *</label>
                            <input
                                type="text"
                                className="form-input"
                                value={formData.surname}
                                onChange={(e) => setFormData({ ...formData, surname: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Phone</label>
                            <input
                                type="tel"
                                className="form-input"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Email</label>
                            <input
                                type="email"
                                className="form-input"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Address</label>
                        <input
                            type="text"
                            className="form-input"
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Notes</label>
                        <textarea
                            className="form-textarea"
                            rows={3}
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        ></textarea>
                    </div>
                </form>
            </Modal>
        </>
    );
}
