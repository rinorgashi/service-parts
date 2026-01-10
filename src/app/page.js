'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import {
  Package, Users, ShoppingCart, DollarSign,
  AlertTriangle, TrendingUp, ArrowRight
} from 'lucide-react';
import Link from 'next/link';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount || 0);
  };

  if (loading) {
    return (
      <>
        <Header title="Dashboard" onRefresh={fetchStats} />
        <div className="loading-overlay">
          <div className="spinner"></div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="Dashboard" onRefresh={fetchStats} />

      <div className="page-enter">
        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon primary">
              <Package size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-label">Total Parts</div>
              <div className="stat-value">{stats?.totalParts || 0}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon warning">
              <AlertTriangle size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-label">Low Stock Items</div>
              <div className="stat-value">{stats?.lowStockParts || 0}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon success">
              <Users size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-label">Total Customers</div>
              <div className="stat-value">{stats?.totalCustomers || 0}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon primary">
              <DollarSign size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-label">Today's Revenue</div>
              <div className="stat-value">{formatCurrency(stats?.todaySales?.revenue)}</div>
              <div className="stat-change positive">{stats?.todaySales?.count || 0} sales</div>
            </div>
          </div>
        </div>

        {/* Secondary Stats */}
        <div className="stats-grid" style={{ marginBottom: '24px' }}>
          <div className="stat-card">
            <div className="stat-icon success">
              <TrendingUp size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-label">Monthly Revenue</div>
              <div className="stat-value">{formatCurrency(stats?.monthSales?.revenue)}</div>
              <div className="stat-change positive">{stats?.monthSales?.count || 0} sales this month</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon primary">
              <Package size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-label">Inventory Value</div>
              <div className="stat-value">{formatCurrency(stats?.inventoryValue)}</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
          {/* Recent Sales */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Recent Sales</h3>
              <Link href="/sales" className="btn btn-secondary btn-sm">
                View All <ArrowRight size={14} />
              </Link>
            </div>
            {stats?.recentSales?.length > 0 ? (
              <div className="table-container" style={{ border: 'none' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Part</th>
                      <th>Customer</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentSales.map((sale) => (
                      <tr key={sale.id}>
                        <td>{sale.part_name}</td>
                        <td>
                          {sale.customer_name
                            ? `${sale.customer_name} ${sale.customer_surname}`
                            : 'Walk-in'}
                        </td>
                        <td>{formatCurrency(sale.total_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <ShoppingCart size={48} className="empty-state-icon" />
                <p>No sales yet</p>
              </div>
            )}
          </div>

          {/* Low Stock Alert */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Low Stock Alert</h3>
              <Link href="/inventory?filter=lowStock" className="btn btn-secondary btn-sm">
                View All <ArrowRight size={14} />
              </Link>
            </div>
            {stats?.lowStockItems?.length > 0 ? (
              <div className="table-container" style={{ border: 'none' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Part Name</th>
                      <th>Category</th>
                      <th>Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.lowStockItems.map((item) => (
                      <tr key={item.id}>
                        <td>{item.part_name}</td>
                        <td>
                          <span className="badge badge-default">{item.category}</span>
                        </td>
                        <td>
                          <div className="stock-indicator">
                            <span className={`stock-dot ${item.quantity_in_stock === 0 ? 'low' : 'medium'}`}></span>
                            {item.quantity_in_stock} / {item.min_stock_level}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <Package size={48} className="empty-state-icon" />
                <p>All items are well stocked!</p>
              </div>
            )}
          </div>
        </div>

        {/* Categories Breakdown */}
        {stats?.categories?.length > 0 && (
          <div className="card" style={{ marginTop: '24px' }}>
            <div className="card-header">
              <h3 className="card-title">Categories Overview</h3>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              {stats.categories.map((cat) => (
                <div
                  key={cat.category}
                  style={{
                    background: 'var(--bg-tertiary)',
                    padding: '16px 20px',
                    borderRadius: 'var(--radius-md)',
                    minWidth: '150px'
                  }}
                >
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{cat.category}</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '600' }}>{cat.count} parts</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{cat.total_stock} in stock</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
