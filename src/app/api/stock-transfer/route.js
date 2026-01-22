import { getDb } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { logActivity } from '@/lib/activityLog';

// GET stock transfers (with optional filtering)
export async function GET(request) {
    try {
        const db = getDb();
        const { searchParams } = new URL(request.url);
        const partId = searchParams.get('part_id');
        const fromLocationId = searchParams.get('from_location_id');
        const toLocationId = searchParams.get('to_location_id');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        let query = `
            SELECT
                st.*,
                p.part_name,
                p.category,
                fl.name as from_location_name,
                tl.name as to_location_name
            FROM stock_transfers st
            LEFT JOIN parts p ON st.part_id = p.id
            LEFT JOIN locations fl ON st.from_location_id = fl.id
            LEFT JOIN locations tl ON st.to_location_id = tl.id
            WHERE 1=1
        `;
        const params = [];

        if (partId) {
            query += ' AND st.part_id = ?';
            params.push(partId);
        }

        if (fromLocationId) {
            query += ' AND st.from_location_id = ?';
            params.push(fromLocationId);
        }

        if (toLocationId) {
            query += ' AND st.to_location_id = ?';
            params.push(toLocationId);
        }

        if (startDate) {
            query += ' AND st.created_at >= ?';
            params.push(startDate);
        }

        if (endDate) {
            query += ' AND st.created_at <= ?';
            params.push(endDate);
        }

        query += ' ORDER BY st.created_at DESC';

        const transfers = db.prepare(query).all(...params);
        return NextResponse.json(transfers);
    } catch (error) {
        console.error('Error fetching stock transfers:', error);
        return NextResponse.json({ error: 'Failed to fetch stock transfers' }, { status: 500 });
    }
}

// POST create new stock transfer
export async function POST(request) {
    try {
        const session = await getServerSession();
        const db = getDb();
        const body = await request.json();

        const { part_id, from_location_id, to_location_id, quantity, notes } = body;

        // Validate required fields
        if (!part_id || !from_location_id || !to_location_id || !quantity) {
            return NextResponse.json({
                error: 'Part ID, from location, to location, and quantity are required'
            }, { status: 400 });
        }

        if (quantity <= 0) {
            return NextResponse.json({ error: 'Quantity must be positive' }, { status: 400 });
        }

        if (from_location_id === to_location_id) {
            return NextResponse.json({ error: 'Source and destination locations must be different' }, { status: 400 });
        }

        // Check if part exists
        const part = db.prepare('SELECT * FROM parts WHERE id = ?').get(part_id);
        if (!part) {
            return NextResponse.json({ error: 'Part not found' }, { status: 404 });
        }

        // Check if locations exist
        const fromLocation = db.prepare('SELECT * FROM locations WHERE id = ?').get(from_location_id);
        const toLocation = db.prepare('SELECT * FROM locations WHERE id = ?').get(to_location_id);

        if (!fromLocation) {
            return NextResponse.json({ error: 'Source location not found' }, { status: 404 });
        }
        if (!toLocation) {
            return NextResponse.json({ error: 'Destination location not found' }, { status: 404 });
        }

        // Check stock at source location
        const sourceStock = db.prepare(`
            SELECT * FROM part_locations WHERE part_id = ? AND location_id = ?
        `).get(part_id, from_location_id);

        if (!sourceStock || sourceStock.quantity < quantity) {
            const available = sourceStock?.quantity || 0;
            return NextResponse.json({
                error: `Insufficient stock at ${fromLocation.name}. Available: ${available}`
            }, { status: 400 });
        }

        // Perform transfer atomically
        const performTransfer = db.transaction(() => {
            // Decrease stock at source location
            db.prepare(`
                UPDATE part_locations
                SET quantity = quantity - ?, updated_at = datetime('now')
                WHERE part_id = ? AND location_id = ?
            `).run(quantity, part_id, from_location_id);

            // Increase stock at destination (or create entry if doesn't exist)
            db.prepare(`
                INSERT INTO part_locations (part_id, location_id, quantity, min_stock_level)
                VALUES (?, ?, ?, 5)
                ON CONFLICT(part_id, location_id) DO UPDATE SET
                    quantity = quantity + ?,
                    updated_at = datetime('now')
            `).run(part_id, to_location_id, quantity, quantity);

            // Record the transfer
            const result = db.prepare(`
                INSERT INTO stock_transfers (part_id, from_location_id, to_location_id, quantity, notes, created_by)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(part_id, from_location_id, to_location_id, quantity, notes || '', session?.user?.name || 'system');

            return result.lastInsertRowid;
        });

        const transferId = performTransfer();

        // Get the created transfer record
        const transfer = db.prepare(`
            SELECT
                st.*,
                p.part_name,
                fl.name as from_location_name,
                tl.name as to_location_name
            FROM stock_transfers st
            LEFT JOIN parts p ON st.part_id = p.id
            LEFT JOIN locations fl ON st.from_location_id = fl.id
            LEFT JOIN locations tl ON st.to_location_id = tl.id
            WHERE st.id = ?
        `).get(transferId);

        // Log activity
        if (session?.user?.name) {
            logActivity({
                username: session.user.name,
                action: 'create',
                entityType: 'stock_transfer',
                entityId: transferId,
                entityName: `${part.part_name} x${quantity}`,
                details: `Transferred ${quantity}x "${part.part_name}" from "${fromLocation.name}" to "${toLocation.name}"`
            });
        }

        return NextResponse.json(transfer, { status: 201 });
    } catch (error) {
        console.error('Error creating stock transfer:', error);
        return NextResponse.json({ error: 'Failed to create stock transfer' }, { status: 500 });
    }
}

// DELETE is not typically allowed for transfers (audit trail), but can be added if needed
export async function DELETE(request) {
    return NextResponse.json({
        error: 'Stock transfers cannot be deleted to maintain audit trail. Create a reverse transfer instead.'
    }, { status: 405 });
}
