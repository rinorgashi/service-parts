import { getDb } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { logActivity } from '@/lib/activityLog';

// GET part locations (with optional filtering by part_id or location_id)
export async function GET(request) {
    try {
        const db = getDb();
        const { searchParams } = new URL(request.url);
        const partId = searchParams.get('part_id');
        const locationId = searchParams.get('location_id');

        let query = `
            SELECT
                pl.*,
                p.part_name,
                p.category,
                p.selling_price,
                l.name as location_name,
                l.description as location_description
            FROM part_locations pl
            LEFT JOIN parts p ON pl.part_id = p.id
            LEFT JOIN locations l ON pl.location_id = l.id
            WHERE 1=1
        `;
        const params = [];

        if (partId) {
            query += ' AND pl.part_id = ?';
            params.push(partId);
        }

        if (locationId) {
            query += ' AND pl.location_id = ?';
            params.push(locationId);
        }

        query += ' ORDER BY p.part_name, l.name';

        const partLocations = db.prepare(query).all(...params);
        return NextResponse.json(partLocations);
    } catch (error) {
        console.error('Error fetching part locations:', error);
        return NextResponse.json({ error: 'Failed to fetch part locations' }, { status: 500 });
    }
}

// POST create or update part-location relationship
export async function POST(request) {
    try {
        const session = await getServerSession();
        const db = getDb();
        const body = await request.json();

        const { part_id, location_id, quantity, min_stock_level } = body;

        if (!part_id || !location_id) {
            return NextResponse.json({ error: 'Part ID and Location ID are required' }, { status: 400 });
        }

        // Check if part exists
        const part = db.prepare('SELECT * FROM parts WHERE id = ?').get(part_id);
        if (!part) {
            return NextResponse.json({ error: 'Part not found' }, { status: 404 });
        }

        // Check if location exists
        const location = db.prepare('SELECT * FROM locations WHERE id = ?').get(location_id);
        if (!location) {
            return NextResponse.json({ error: 'Location not found' }, { status: 404 });
        }

        // Use INSERT OR REPLACE to upsert
        const stmt = db.prepare(`
            INSERT INTO part_locations (part_id, location_id, quantity, min_stock_level, updated_at)
            VALUES (?, ?, ?, ?, datetime('now'))
            ON CONFLICT(part_id, location_id) DO UPDATE SET
                quantity = excluded.quantity,
                min_stock_level = excluded.min_stock_level,
                updated_at = datetime('now')
        `);

        stmt.run(part_id, location_id, quantity || 0, min_stock_level || 5);

        // Get the updated record
        const partLocation = db.prepare(`
            SELECT
                pl.*,
                p.part_name,
                l.name as location_name
            FROM part_locations pl
            LEFT JOIN parts p ON pl.part_id = p.id
            LEFT JOIN locations l ON pl.location_id = l.id
            WHERE pl.part_id = ? AND pl.location_id = ?
        `).get(part_id, location_id);

        // Log activity
        if (session?.user?.name) {
            logActivity({
                username: session.user.name,
                action: 'update',
                entityType: 'part_location',
                entityId: partLocation.id,
                entityName: `${part.part_name} @ ${location.name}`,
                details: `Set stock of "${part.part_name}" at "${location.name}" to ${quantity || 0}`
            });
        }

        return NextResponse.json(partLocation, { status: 201 });
    } catch (error) {
        console.error('Error creating/updating part location:', error);
        return NextResponse.json({ error: 'Failed to create/update part location' }, { status: 500 });
    }
}

// PUT update part-location stock
export async function PUT(request) {
    try {
        const session = await getServerSession();
        const db = getDb();
        const body = await request.json();

        const { id, part_id, location_id, quantity, min_stock_level } = body;

        // Can update by id or by part_id + location_id
        let whereClause = '';
        let whereParams = [];

        if (id) {
            whereClause = 'id = ?';
            whereParams = [id];
        } else if (part_id && location_id) {
            whereClause = 'part_id = ? AND location_id = ?';
            whereParams = [part_id, location_id];
        } else {
            return NextResponse.json({ error: 'ID or Part ID + Location ID required' }, { status: 400 });
        }

        // Get existing record
        const existing = db.prepare(`SELECT * FROM part_locations WHERE ${whereClause}`).get(...whereParams);
        if (!existing) {
            return NextResponse.json({ error: 'Part location not found' }, { status: 404 });
        }

        // Build update fields
        const updates = {};
        if (quantity !== undefined) updates.quantity = quantity;
        if (min_stock_level !== undefined) updates.min_stock_level = min_stock_level;

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
        }

        const fields = Object.keys(updates).map(key => `${key} = ?`);
        fields.push("updated_at = datetime('now')");
        const values = Object.values(updates);

        const stmt = db.prepare(`UPDATE part_locations SET ${fields.join(', ')} WHERE ${whereClause}`);
        stmt.run(...values, ...whereParams);

        // Get updated record with joins
        const updated = db.prepare(`
            SELECT
                pl.*,
                p.part_name,
                l.name as location_name
            FROM part_locations pl
            LEFT JOIN parts p ON pl.part_id = p.id
            LEFT JOIN locations l ON pl.location_id = l.id
            WHERE pl.${whereClause.replace('id = ?', 'id = ?').replace('part_id = ? AND location_id = ?', 'part_id = ? AND pl.location_id = ?')}
        `).get(...whereParams);

        return NextResponse.json(updated);
    } catch (error) {
        console.error('Error updating part location:', error);
        return NextResponse.json({ error: 'Failed to update part location' }, { status: 500 });
    }
}

// DELETE remove part from location
export async function DELETE(request) {
    try {
        const session = await getServerSession();
        const db = getDb();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const partId = searchParams.get('part_id');
        const locationId = searchParams.get('location_id');

        let whereClause = '';
        let whereParams = [];

        if (id) {
            whereClause = 'id = ?';
            whereParams = [id];
        } else if (partId && locationId) {
            whereClause = 'part_id = ? AND location_id = ?';
            whereParams = [partId, locationId];
        } else {
            return NextResponse.json({ error: 'ID or Part ID + Location ID required' }, { status: 400 });
        }

        // Get record before deletion
        const partLocation = db.prepare(`
            SELECT pl.*, p.part_name, l.name as location_name
            FROM part_locations pl
            LEFT JOIN parts p ON pl.part_id = p.id
            LEFT JOIN locations l ON pl.location_id = l.id
            WHERE ${whereClause}
        `).get(...whereParams);

        if (!partLocation) {
            return NextResponse.json({ error: 'Part location not found' }, { status: 404 });
        }

        // Check if there's stock - warn if deleting with stock
        if (partLocation.quantity > 0) {
            return NextResponse.json({
                error: `Cannot remove part from location with ${partLocation.quantity} items in stock. Transfer or adjust stock first.`
            }, { status: 400 });
        }

        db.prepare(`DELETE FROM part_locations WHERE ${whereClause}`).run(...whereParams);

        // Log activity
        if (session?.user?.name) {
            logActivity({
                username: session.user.name,
                action: 'delete',
                entityType: 'part_location',
                entityId: partLocation.id,
                entityName: `${partLocation.part_name} @ ${partLocation.location_name}`,
                details: `Removed "${partLocation.part_name}" from "${partLocation.location_name}"`
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting part location:', error);
        return NextResponse.json({ error: 'Failed to delete part location' }, { status: 500 });
    }
}
