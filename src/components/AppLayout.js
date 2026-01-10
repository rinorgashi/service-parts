'use client';

import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Sidebar from './Sidebar';

export default function AppLayout({ children }) {
    const pathname = usePathname();
    const { status } = useSession();

    // Don't show sidebar on login page
    if (pathname === '/login') {
        return <>{children}</>;
    }

    // Show loading while checking auth
    if (status === 'loading') {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--bg-primary)'
            }}>
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div className="app-container">
            <Sidebar />
            <main className="main-content">
                {children}
            </main>
        </div>
    );
}
