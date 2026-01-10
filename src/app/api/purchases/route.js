import { getDb } from '@/lib/db';
import { NextResponse } from 'next/server';

// GET all purchases with joins
export async function GET(request) {
    try {
        const db = getDb();
        const { searchParams } = new URL(request.url);
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const partId = searchParams.get('partId');

        let query = `
      SELECT 
        pur.*,
        p.part_name,
        p.category
      FROM purchases pur
      LEFT JOIN parts p ON pur.part_id = p.id
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
        const db = getDb();
        const body = await request.json();

        const {
            part_id,
            quantity,
            unit_cost,
            supplier,
            notes
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

        const total_cost = quantity * unit_cost;

        // Start transaction
        const insertPurchase = db.transaction(() => {
            // Create purchase record
            const purchaseStmt = db.prepare(`
        INSERT INTO purchases (
          part_id, quantity, unit_cost, total_cost, supplier, notes
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);

            const result = purchaseStmt.run(
                part_id,
                quantity,
                unit_cost,
                total_cost,
                supplier || part.supplier || '',
                notes || ''
            );

            // Update stock
            db.prepare(`
        UPDATE parts 
        SET quantity_in_stock = quantity_in_stock + ?, 
            purchase_price = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(quantity, unit_cost, part_id);

            return result.lastInsertRowid;
        });

        const purchaseId = insertPurchase();

        const newPurchase = db.prepare(`
      SELECT 
        pur.*,
        p.part_name,
        p.category
      FROM purchases pur
      LEFT JOIN parts p ON pur.part_id = p.id
      WHERE pur.id = ?
    `).get(purchaseId);

        return NextResponse.json(newPurchase, { status: 201 });
    } catch (error) {
        console.error('Error creating purchase:', error);
        return NextResponse.json({ error: 'Failed to create purchase' }, { status: 500 });
    }
}

// DELETE purchase (for corrections - also removes stock)
export async function DELETE(request) {
    try {
        const db = getDb();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Purchase ID is required' }, { status: 400 });
        }

        // Get purchase info first
        const purchase = db.prepare('SELECT * FROM purchases WHERE id = ?').get(id);
        if (!purchase) {
            return NextResponse.json({ error: 'Purchase not found' }, { status: 404 });
        }

        // Check if we have enough stock to remove
        const part = db.prepare('SELECT * FROM parts WHERE id = ?').get(purchase.part_id);
        if (part && part.quantity_in_stock < purchase.quantity) {
            return NextResponse.json({
                error: 'Cannot delete purchase: would result in negative stock'
            }, { status: 400 });
        }

        // Remove stock and delete purchase
        const deletePurchase = db.transaction(() => {
            // Remove stock
            db.prepare(`
        UPDATE parts 
        SET quantity_in_stock = quantity_in_stock - ?,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(purchase.quantity, purchase.part_id);

            // Delete purchase
            db.prepare('DELETE FROM purchases WHERE id = ?').run(id);
        });

        deletePurchase();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting purchase:', error);
        return NextResponse.json({ error: 'Failed to delete purchase' }, { status: 500 });
    }
}
