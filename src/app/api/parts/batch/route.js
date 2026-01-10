import { getDb } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const body = await request.json();
        const { action, ids } = body;
        const db = getDb();

        if (action === 'delete_selected') {
            // For selected delete, we must check dependencies or catch error
            // Here we try to delete. If it fails due to FK, the catch block handles it.
            if (!Array.isArray(ids) || ids.length === 0) {
                return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });
            }

            const placeholders = ids.map(() => '?').join(',');
            const stmt = db.prepare(`DELETE FROM parts WHERE id IN (${placeholders})`);
            const result = stmt.run(...ids);

            return NextResponse.json({ success: true, count: result.changes });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('Batch operation failed:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
