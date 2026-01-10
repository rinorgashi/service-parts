'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import {
    LayoutDashboard, Package, Users, ShoppingCart, TruckIcon,
    Wrench, Settings, LogOut, X
} from 'lucide-react';

const navItems = [
    {
        section: 'Main',
        items: [
            { href: '/', label: 'Dashboard', icon: LayoutDashboard },
            { href: '/inventory', label: 'Parts Inventory', icon: Package },
            { href: '/customers', label: 'Customers', icon: Users },
        ]
    },
    {
        section: 'Transactions',
        items: [
            { href: '/sales', label: 'Sales', icon: ShoppingCart },
            { href: '/purchases', label: 'Purchases', icon: TruckIcon },
            { href: '/services', label: 'Service Records', icon: Wrench },
        ]
    }
];

export default function Sidebar({ isOpen, onClose }) {
    const pathname = usePathname();
    const { data: session } = useSession();

    // Close sidebar when navigating on mobile
    const handleNavClick = () => {
        if (onClose && window.innerWidth < 769) {
            onClose();
        }
    };

    return (
        <aside className={`sidebar ${isOpen ? 'mobile-open' : ''}`}>
            <div className="sidebar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Link href="/" className="sidebar-logo" onClick={handleNavClick}>
                    <div className="sidebar-logo-icon">
                        <Wrench size={22} color="white" />
                    </div>
                    <span>ServiceParts</span>
                </Link>
                {/* Close button for mobile */}
                <button
                    onClick={onClose}
                    className="btn-icon"
                    style={{ display: isOpen ? 'flex' : 'none', background: 'transparent', border: 'none', color: 'var(--text-muted)' }}
                    aria-label="Close menu"
                >
                    <X size={24} />
                </button>
            </div>

            <nav className="sidebar-nav">
                {navItems.map((section) => (
                    <div key={section.section} className="nav-section">
                        <div className="nav-section-title">{section.section}</div>
                        {section.items.map((item) => {
                            const Icon = item.icon;
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`nav-link ${isActive ? 'active' : ''}`}
                                    onClick={handleNavClick}
                                >
                                    <Icon size={20} className="nav-link-icon" />
                                    <span>{item.label}</span>
                                </Link>
                            );
                        })}
                    </div>
                ))}

                <div className="nav-section">
                    <div className="nav-section-title">Account</div>
                    <Link
                        href="/settings"
                        className={`nav-link ${pathname === '/settings' ? 'active' : ''}`}
                        onClick={handleNavClick}
                    >
                        <Settings size={20} className="nav-link-icon" />
                        <span>Settings</span>
                    </Link>
                    <button
                        className="nav-link"
                        onClick={() => signOut({ callbackUrl: '/login' })}
                        style={{ width: '100%', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                    >
                        <LogOut size={20} className="nav-link-icon" />
                        <span>Logout</span>
                    </button>
                </div>
            </nav>

            {session?.user && (
                <div style={{
                    padding: '16px 20px',
                    borderTop: '1px solid var(--border-color)',
                    fontSize: '0.85rem'
                }}>
                    <div style={{ color: 'var(--text-muted)' }}>Logged in as</div>
                    <div style={{ fontWeight: '600' }}>{session.user.name}</div>
                </div>
            )}
        </aside>
    );
}
