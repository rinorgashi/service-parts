import { getDb } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import bcrypt from 'bcryptjs';

// Helper to check if current user is admin
async function isAdmin() {
    const session = await getServerSession();
    if (!session?.user?.name) return false;

    const db = getDb();
    const user = db.prepare('SELECT is_admin FROM users WHERE username = ?').get(session.user.name);
    return user?.is_admin === 1;
}

// GET all users (admin only)
export async function GET(request) {
    try {
        if (!await isAdmin()) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const db = getDb();
        const users = db.prepare('SELECT id, username, is_admin, created_at FROM users ORDER BY id ASC').all();
        return NextResponse.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }
}

// POST create new user (admin only)
export async function POST(request) {
    try {
        if (!await isAdmin()) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const db = getDb();
        const body = await request.json();
        const { username, password } = body;

        if (!username || !password) {
            return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
        }

        if (password.length < 4) {
            return NextResponse.json({ error: 'Password must be at least 4 characters' }, { status: 400 });
        }

        // Check if username already exists
        const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
        if (existing) {
            return NextResponse.json({ error: 'Username already exists' }, { status: 400 });
        }

        const passwordHash = bcrypt.hashSync(password, 10);
        const stmt = db.prepare('INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, 0)');
        const result = stmt.run(username, passwordHash);

        const newUser = db.prepare('SELECT id, username, is_admin, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
        return NextResponse.json(newUser, { status: 201 });
    } catch (error) {
        console.error('Error creating user:', error);
        return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }
}

// PUT update user (admin only)
export async function PUT(request) {
    try {
        if (!await isAdmin()) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const db = getDb();
        const body = await request.json();
        const { id, username, password } = body;

        if (!id) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Check if new username conflicts with another user
        if (username && username !== user.username) {
            const existing = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, id);
            if (existing) {
                return NextResponse.json({ error: 'Username already exists' }, { status: 400 });
            }
        }

        // Build update query
        if (password) {
            if (password.length < 4) {
                return NextResponse.json({ error: 'Password must be at least 4 characters' }, { status: 400 });
            }
            const passwordHash = bcrypt.hashSync(password, 10);
            db.prepare("UPDATE users SET username = ?, password_hash = ?, updated_at = datetime('now') WHERE id = ?")
                .run(username || user.username, passwordHash, id);
        } else {
            db.prepare("UPDATE users SET username = ?, updated_at = datetime('now') WHERE id = ?")
                .run(username || user.username, id);
        }

        const updatedUser = db.prepare('SELECT id, username, is_admin, created_at FROM users WHERE id = ?').get(id);
        return NextResponse.json(updatedUser);
    } catch (error) {
        console.error('Error updating user:', error);
        return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }
}

// DELETE user (admin only)
export async function DELETE(request) {
    try {
        if (!await isAdmin()) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const db = getDb();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Prevent deleting the last admin
        if (user.is_admin === 1) {
            const adminCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE is_admin = 1').get();
            if (adminCount.count <= 1) {
                return NextResponse.json({ error: 'Cannot delete the last admin user' }, { status: 400 });
            }
        }

        // Prevent deleting yourself
        const session = await getServerSession();
        if (session?.user?.name === user.username) {
            return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
        }

        db.prepare('DELETE FROM users WHERE id = ?').run(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting user:', error);
        return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
    }
}
