import { getDb } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

// GET activity logs (admin only)
export async function GET(request) {
    try {
        const session = await getServerSession();
        if (!session?.user?.name) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if user is admin
        const db = getDb();
        const user = db.prepare('SELECT is_admin FROM users WHERE username = ?').get(session.user.name);
        if (!user?.is_admin) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit')) || 100;
        const offset = parseInt(searchParams.get('offset')) || 0;
        const username = searchParams.get('username') || '';
        const entityType = searchParams.get('entityType') || '';
        const action = searchParams.get('action') || '';

        let query = 'SELECT * FROM activity_logs WHERE 1=1';
        const params = [];

        if (username) {
            query += ' AND username = ?';
            params.push(username);
        }

        if (entityType) {
            query += ' AND entity_type = ?';
            params.push(entityType);
        }

        if (action) {
            query += ' AND action = ?';
            params.push(action);
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const logs = db.prepare(query).all(...params);

        // Get total count for pagination
        let countQuery = 'SELECT COUNT(*) as count FROM activity_logs WHERE 1=1';
        const countParams = [];

        if (username) {
            countQuery += ' AND username = ?';
            countParams.push(username);
        }

        if (entityType) {
            countQuery += ' AND entity_type = ?';
            countParams.push(entityType);
        }

        if (action) {
            countQuery += ' AND action = ?';
            countParams.push(action);
        }

        const total = db.prepare(countQuery).get(...countParams);

        return NextResponse.json({ logs, total: total.count });
    } catch (error) {
        console.error('Error fetching activity logs:', error);
        return NextResponse.json({ error: 'Failed to fetch activity logs' }, { status: 500 });
    }
}
