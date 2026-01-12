import { getDb } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { logActivity } from '@/lib/activityLog';

// GET all parts or search
export async function GET(request) {
    try {
        const db = getDb();
        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search') || '';
        const category = searchParams.get('category') || '';
        const location = searchParams.get('location') || ''; // Added location filter
        const lowStock = searchParams.get('lowStock') === 'true';

        let query = 'SELECT * FROM parts WHERE 1=1';
        const params = [];

        if (search) {
            query += ' AND (part_name LIKE ? OR description LIKE ? OR serial_number LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (category) {
            query += ' AND category = ?';
            params.push(category);
        }

        if (location) {
            query += ' AND location = ?'; // Added location filter
            params.push(location);
        }

        if (lowStock) {
            query += ' AND quantity_in_stock <= min_stock_level';
        }

        query += ' ORDER BY part_name ASC';

        const parts = db.prepare(query).all(...params);
        return NextResponse.json(parts);
    } catch (error) {
        console.error('Error fetching parts:', error);
        return NextResponse.json({ error: 'Failed to fetch parts' }, { status: 500 });
    }
}

// POST create new part
export async function POST(request) {
    try {
        const session = await getServerSession();
        const db = getDb();
        const body = await request.json();

        const {
            part_name,
            category,
            location,
            serial_number,
            description,
            purchase_price,
            selling_price,
            quantity_in_stock,
            min_stock_level,
            supplier,
            guarantee_available,
            image_path
        } = body;

        const stmt = db.prepare(`
      INSERT INTO parts (
        part_name, category, location, serial_number, description, purchase_price, selling_price,
        quantity_in_stock, min_stock_level, supplier, guarantee_available, image_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

        const result = stmt.run(
            part_name,
            category,
            location || '',
            serial_number || '',
            description || '',
            purchase_price || 0,
            selling_price || 0,
            quantity_in_stock || 0,
            min_stock_level || 5,
            supplier || '',
            guarantee_available ? 1 : 0,
            image_path || ''
        );

        const newPart = db.prepare('SELECT * FROM parts WHERE id = ?').get(result.lastInsertRowid);

        // Log activity
        if (session?.user?.name) {
            logActivity({
                username: session.user.name,
                action: 'create',
                entityType: 'part',
                entityId: newPart.id,
                entityName: part_name,
                details: `Created part "${part_name}" in category "${category}"`
            });
        }

        return NextResponse.json(newPart, { status: 201 });
    } catch (error) {
        console.error('Error creating part:', error);
        return NextResponse.json({ error: 'Failed to create part' }, { status: 500 });
    }
}

// PUT update part
export async function PUT(request) {
    try {
        const session = await getServerSession();
        const db = getDb();
        const body = await request.json();
        const { id, ...updates } = body;

        if (!id) {
            return NextResponse.json({ error: 'Part ID is required' }, { status: 400 });
        }

        // Get original part for logging
        const originalPart = db.prepare('SELECT * FROM parts WHERE id = ?').get(id);

        const fields = Object.keys(updates)
            .filter(key => updates[key] !== undefined)
            .map(key => `${key} = ?`);

        if (fields.length === 0) {
            return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
        }

        fields.push("updated_at = datetime('now')");

        const values = Object.keys(updates)
            .filter(key => updates[key] !== undefined)
            .map(key => key === 'guarantee_available' ? (updates[key] ? 1 : 0) : updates[key]);

        const stmt = db.prepare(`UPDATE parts SET ${fields.join(', ')} WHERE id = ?`);
        stmt.run(...values, id);

        const updatedPart = db.prepare('SELECT * FROM parts WHERE id = ?').get(id);

        // Log activity
        if (session?.user?.name && originalPart) {
            logActivity({
                username: session.user.name,
                action: 'update',
                entityType: 'part',
                entityId: id,
                entityName: updatedPart.part_name,
                details: `Updated part "${updatedPart.part_name}"`
            });
        }

        return NextResponse.json(updatedPart);
    } catch (error) {
        console.error('Error updating part:', error);
        return NextResponse.json({ error: 'Failed to update part' }, { status: 500 });
    }
}

// DELETE part
export async function DELETE(request) {
    try {
        const session = await getServerSession();
        const db = getDb();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Part ID is required' }, { status: 400 });
        }

        // Get part info before deleting for logging
        const part = db.prepare('SELECT * FROM parts WHERE id = ?').get(id);

        // Check if part is used in any sales
        const salesCount = db.prepare('SELECT COUNT(*) as count FROM sales WHERE part_id = ?').get(id);
        if (salesCount.count > 0) {
            return NextResponse.json({
                error: 'Cannot delete part that has sales records. Consider setting stock to 0 instead.'
            }, { status: 400 });
        }

        db.prepare('DELETE FROM parts WHERE id = ?').run(id);

        // Log activity
        if (session?.user?.name && part) {
            logActivity({
                username: session.user.name,
                action: 'delete',
                entityType: 'part',
                entityId: id,
                entityName: part.part_name,
                details: `Deleted part "${part.part_name}"`
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting part:', error);
        return NextResponse.json({ error: 'Failed to delete part' }, { status: 500 });
    }
}
