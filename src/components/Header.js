'use client';

import { Plus, RefreshCw } from 'lucide-react';

export default function Header({ title, onAdd, addLabel, onRefresh }) {
    return (
        <header className="header">
            <h1 className="header-title">{title}</h1>
            <div className="header-actions">
                {onRefresh && (
                    <button className="btn btn-secondary btn-icon" onClick={onRefresh} title="Refresh">
                        <RefreshCw size={18} />
                    </button>
                )}
                {onAdd && (
                    <button className="btn btn-primary" onClick={onAdd}>
                        <Plus size={18} />
                        {addLabel || 'Add New'}
                    </button>
                )}
            </div>
        </header>
    );
}
