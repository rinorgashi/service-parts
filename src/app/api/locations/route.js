import { getDb } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
    const db = getDb();
    const locations = db.prepare('SELECT * FROM locations ORDER BY name').all();
    return NextResponse.json(locations);
}

export async function POST(request) {
    try {
        const { name, description } = await request.json();

        if (!name) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }

        const db = getDb();

        try {
            const stmt = db.prepare('INSERT INTO locations (name, description) VALUES (?, ?)');
            const result = stmt.run(name, description || '');
            return NextResponse.json({ id: result.lastInsertRowid, name, description }, { status: 201 });
        } catch (error) {
            if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                return NextResponse.json({ error: 'Location already exists' }, { status: 400 });
            }
            throw error;
        }
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const db = getDb();

    // Check if location is used
    const location = db.prepare('SELECT name FROM locations WHERE id = ?').get(id);
    if (location) {
        const usedCount = db.prepare('SELECT COUNT(*) as count FROM parts WHERE location = ?').get(location.name);
        if (usedCount.count > 0) {
            return NextResponse.json({ error: `Cannot delete location. It is used by ${usedCount.count} parts.` }, { status: 400 });
        }
    }

    db.prepare('DELETE FROM locations WHERE id = ?').run(id);
    return NextResponse.json({ success: true });
}
