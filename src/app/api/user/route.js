import { getDb } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

// PUT - Change password
export async function PUT(request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const db = getDb();
        const body = await request.json();
        const { currentPassword, newPassword, newUsername } = body;

        // Get current user
        const user = db.prepare('SELECT * FROM users WHERE username = ?').get(session.user.name);
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Verify current password
        if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
            return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
        }

        // Update username if provided
        if (newUsername && newUsername !== user.username) {
            const existing = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(newUsername, user.id);
            if (existing) {
                return NextResponse.json({ error: 'Username already taken' }, { status: 400 });
            }
            db.prepare("UPDATE users SET username = ?, updated_at = datetime('now') WHERE id = ?").run(newUsername, user.id);
        }

        // Update password if provided
        if (newPassword) {
            const newHash = bcrypt.hashSync(newPassword, 10);
            db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(newHash, user.id);
        }

        return NextResponse.json({ success: true, message: 'Credentials updated. Please log in again.' });
    } catch (error) {
        console.error('Error updating credentials:', error);
        return NextResponse.json({ error: 'Failed to update credentials' }, { status: 500 });
    }
}
