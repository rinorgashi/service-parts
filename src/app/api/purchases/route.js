import { getDb } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { logActivity } from '@/lib/activityLog';

// GET all purchases with joins
export async function GET(request) {
    try {
        const db = getDb();
        const { searchParams } = new URL(request.url);
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const partId = searchParams.get('partId');
        const locationId = searchParams.get('location_id');

        let query = `
      SELECT
        pur.*,
        p.part_name,
        p.category,
        l.name as location_name
      FROM purchases pur
      LEFT JOIN parts p ON pur.part_id = p.id
      LEFT JOIN locations l ON pur.location_id = l.id
      WHERE 1=1
    `;
        const params = [];

        if (startDate) {
            query += ' AND pur.purchase_date >= ?';
            params.push(startDate);
        }

        if (endDate) {
            query += ' AND pur.purchase_date <= ?';
            params.push(endDate);
        }

        if (partId) {
            query += ' AND pur.part_id = ?';
            params.push(partId);
        }

        if (locationId) {
            query += ' AND pur.location_id = ?';
            params.push(locationId);
        }

        query += ' ORDER BY pur.purchase_date DESC';

        const purchases = db.prepare(query).all(...params);
        return NextResponse.json(purchases);
    } catch (error) {
        console.error('Error fetching purchases:', error);
        return NextResponse.json({ error: 'Failed to fetch purchases' }, { status: 500 });
    }
}

// POST create new purchase (add stock)
export async function POST(request) {
    try {
        const session = await getServerSession();
        const db = getDb();
        const body = await request.json();

        const {
            part_id,
            quantity,
            unit_cost,
            supplier,
            notes,
            location_id
        } = body;

        if (!part_id || !quantity || unit_cost === undefined) {
            return NextResponse.json({
                error: 'Part, quantity, and unit cost are required'
            }, { status: 400 });
        }

        // Check if part exists
        const part = db.prepare('SELECT * FROM parts WHERE id = ?').get(part_id);
        if (!part) {
            return NextResponse.json({ error: 'Part not found' }, { status: 404 });
        }

        // Get location info if provided
        let locationName = null;
        if (location_id) {
            const location = db.prepare('SELECT name FROM locations WHERE id = ?').get(location_id);
            if (!location) {
                return NextResponse.json({ error: 'Location not found' }, { status: 404 });
            }
            locationName = location.name;
        }

        const total_cost = quantity * unit_cost;

        // Start transaction
        const insertPurchase = db.transaction(() => {
            // Create purchase record with location_id
            const purchaseStmt = db.prepare(`
        INSERT INTO purchases (
          part_id, quantity, unit_cost, total_cost, supplier, notes, location_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

            const result = purchaseStmt.run(
                part_id,
                quantity,
                unit_cost,
                total_cost,
                supplier || part.supplier || '',
                notes || '',
                location_id || null
            );

            // Update stock at specific location if provided
            if (location_id) {
                // Upsert into part_locations
                db.prepare(`
                    INSERT INTO part_locations (part_id, location_id, quantity, min_stock_level)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(part_id, location_id) DO UPDATE SET
                        quantity = quantity + ?,
                        updated_at = datetime('now')
                `).run(part_id, location_id, quantity, 5, quantity);

                // Update parts table with total stock from all locations
                const totalStock = db.prepare(
                    'SELECT COALESCE(SUM(quantity), 0) as total FROM part_locations WHERE part_id = ?'
                ).get(part_id);
                db.prepare(`
                    UPDATE parts
                    SET quantity_in_stock = ?,
                        purchase_price = ?,
                        updated_at = datetime('now')
                    WHERE id = ?
                `).run(totalStock.total, unit_cost, part_id);
            } else {
                // No location specified - update parts table directly (legacy behavior)
                db.prepare(`
                    UPDATE parts
                    SET quantity_in_stock = quantity_in_stock + ?,
                        purchase_price = ?,
                        updated_at = datetime('now')
                    WHERE id = ?
                `).run(quantity, unit_cost, part_id);
            }

            return result.lastInsertRowid;
        });

        const purchaseId = insertPurchase();

        const newPurchase = db.prepare(`
      SELECT
        pur.*,
        p.part_name,
        p.category,
        l.name as location_name
      FROM purchases pur
      LEFT JOIN parts p ON pur.part_id = p.id
      LEFT JOIN locations l ON pur.location_id = l.id
      WHERE pur.id = ?
    `).get(purchaseId);

        // Log activity
        if (session?.user?.name) {
            const locationInfo = locationName ? ` to ${locationName}` : '';
            logActivity({
                username: session.user.name,
                action: 'create',
                entityType: 'purchase',
                entityId: purchaseId,
                entityName: `${part.part_name} x${quantity}`,
                details: `Purchased ${quantity}x "${part.part_name}"${locationInfo} for €${total_cost.toFixed(2)}`
            });
        }

        return NextResponse.json(newPurchase, { status: 201 });
    } catch (error) {
        console.error('Error creating purchase:', error);
        return NextResponse.json({ error: 'Failed to create purchase' }, { status: 500 });
    }
}

// DELETE purchase (for corrections - also removes stock)
export async function DELETE(request) {
    try {
        const session = await getServerSession();
        const db = getDb();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Purchase ID is required' }, { status: 400 });
        }

        // Get purchase info first with part name and location
        const purchase = db.prepare(`
            SELECT pur.*, p.part_name, l.name as location_name
            FROM purchases pur
            LEFT JOIN parts p ON pur.part_id = p.id
            LEFT JOIN locations l ON pur.location_id = l.id
            WHERE pur.id = ?
        `).get(id);
        if (!purchase) {
            return NextResponse.json({ error: 'Purchase not found' }, { status: 404 });
        }

        // Check if we have enough stock to remove
        if (purchase.location_id) {
            // Check stock at specific location
            const partLocation = db.prepare(
                'SELECT quantity FROM part_locations WHERE part_id = ? AND location_id = ?'
            ).get(purchase.part_id, purchase.location_id);

            if (!partLocation || partLocation.quantity < purchase.quantity) {
                const available = partLocation?.quantity || 0;
                return NextResponse.json({
                    error: `Cannot delete purchase: would result in negative stock at ${purchase.location_name || 'location'}. Available: ${available}`
                }, { status: 400 });
            }
        } else {
            // Check total stock in parts table
            const part = db.prepare('SELECT * FROM parts WHERE id = ?').get(purchase.part_id);
            if (part && part.quantity_in_stock < purchase.quantity) {
                return NextResponse.json({
                    error: 'Cannot delete purchase: would result in negative stock'
                }, { status: 400 });
            }
        }

        // Remove stock and delete purchase
        const deletePurchase = db.transaction(() => {
            if (purchase.location_id) {
                // Remove from specific location
                db.prepare(`
                    UPDATE part_locations
                    SET quantity = quantity - ?,
                        updated_at = datetime('now')
                    WHERE part_id = ? AND location_id = ?
                `).run(purchase.quantity, purchase.part_id, purchase.location_id);

                // Update parts table total
                const totalStock = db.prepare(
                    'SELECT COALESCE(SUM(quantity), 0) as total FROM part_locations WHERE part_id = ?'
                ).get(purchase.part_id);
                db.prepare(`
                    UPDATE parts
                    SET quantity_in_stock = ?,
                        updated_at = datetime('now')
                    WHERE id = ?
                `).run(totalStock.total, purchase.part_id);
            } else {
                // Legacy: remove from parts table directly
                db.prepare(`
                    UPDATE parts
                    SET quantity_in_stock = quantity_in_stock - ?,
                        updated_at = datetime('now')
                    WHERE id = ?
                `).run(purchase.quantity, purchase.part_id);
            }

            // Delete purchase
            db.prepare('DELETE FROM purchases WHERE id = ?').run(id);
        });

        deletePurchase();

        // Log activity
        if (session?.user?.name) {
            const locationInfo = purchase.location_name ? ` (${purchase.location_name})` : '';
            logActivity({
                username: session.user.name,
                action: 'delete',
                entityType: 'purchase',
                entityId: id,
                entityName: `${purchase.part_name || 'Part'} x${purchase.quantity}`,
                details: `Deleted purchase of ${purchase.quantity}x "${purchase.part_name || 'Part'}"${locationInfo} (€${purchase.total_cost.toFixed(2)})`
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting purchase:', error);
        return NextResponse.json({ error: 'Failed to delete purchase' }, { status: 500 });
    }
}
