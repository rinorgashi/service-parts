import { getDb } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { logActivity } from '@/lib/activityLog';

// GET all sales with joins
export async function GET(request) {
    try {
        const db = getDb();
        const { searchParams } = new URL(request.url);
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const customerId = searchParams.get('customerId');

        let query = `
      SELECT 
        s.*,
        p.part_name,
        p.category,
        c.name as customer_name,
        c.surname as customer_surname,
        c.phone as customer_phone
      FROM sales s
      LEFT JOIN parts p ON s.part_id = p.id
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE 1=1
    `;
        const params = [];

        if (startDate) {
            query += ' AND s.sale_date >= ?';
            params.push(startDate);
        }

        if (endDate) {
            query += ' AND s.sale_date <= ?';
            params.push(endDate);
        }

        if (customerId) {
            query += ' AND s.customer_id = ?';
            params.push(customerId);
        }

        query += ' ORDER BY s.sale_date DESC';

        const sales = db.prepare(query).all(...params);
        return NextResponse.json(sales);
    } catch (error) {
        console.error('Error fetching sales:', error);
        return NextResponse.json({ error: 'Failed to fetch sales' }, { status: 500 });
    }
}

// POST create new sale
export async function POST(request) {
    try {
        const session = await getServerSession();
        const db = getDb();
        const body = await request.json();

        const {
            part_id,
            customer_id,
            service_record_id,
            quantity,
            unit_price,
            labour_cost,
            guarantee_included,
            notes
        } = body;

        if (!part_id || !quantity) {
            return NextResponse.json({
                error: 'Part and quantity are required'
            }, { status: 400 });
        }

        // Check stock availability
        const part = db.prepare('SELECT * FROM parts WHERE id = ?').get(part_id);
        if (!part) {
            return NextResponse.json({ error: 'Part not found' }, { status: 404 });
        }

        if (part.quantity_in_stock < quantity) {
            return NextResponse.json({
                error: `Insufficient stock. Available: ${part.quantity_in_stock}`
            }, { status: 400 });
        }

        // If guarantee is included, part price is 0 (customer doesn't pay for the part)
        const effectiveUnitPrice = guarantee_included ? 0 : (unit_price || part.selling_price);
        const effectiveLabourCost = parseFloat(labour_cost) || 0;
        const partsTotal = quantity * effectiveUnitPrice;
        const total_price = partsTotal + effectiveLabourCost;

        // Start transaction
        const insertSale = db.transaction(() => {
            // Create sale record
            const saleStmt = db.prepare(`
        INSERT INTO sales (
          part_id, customer_id, service_record_id, quantity, 
          unit_price, labour_cost, total_price, guarantee_included, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

            const result = saleStmt.run(
                part_id,
                customer_id || null,
                service_record_id || null,
                quantity,
                effectiveUnitPrice,
                effectiveLabourCost,
                total_price,
                guarantee_included ? 1 : 0,
                notes || ''
            );

            // Update stock
            db.prepare(`
        UPDATE parts 
        SET quantity_in_stock = quantity_in_stock - ?, 
            updated_at = datetime('now')
        WHERE id = ?
      `).run(quantity, part_id);

            return result.lastInsertRowid;
        });

        const saleId = insertSale();

        const newSale = db.prepare(`
      SELECT 
        s.*,
        p.part_name,
        p.category,
        c.name as customer_name,
        c.surname as customer_surname
      FROM sales s
      LEFT JOIN parts p ON s.part_id = p.id
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE s.id = ?
    `).get(saleId);

        // Log activity
        if (session?.user?.name) {
            logActivity({
                username: session.user.name,
                action: 'create',
                entityType: 'sale',
                entityId: saleId,
                entityName: `${part.part_name} x${quantity}`,
                details: `Sold ${quantity}x "${part.part_name}" for €${total_price.toFixed(2)}${guarantee_included ? ' (guarantee)' : ''}`
            });
        }

        return NextResponse.json(newSale, { status: 201 });
    } catch (error) {
        console.error('Error creating sale:', error);
        return NextResponse.json({ error: 'Failed to create sale' }, { status: 500 });
    }
}

// DELETE sale (with stock restoration)
export async function DELETE(request) {
    try {
        const session = await getServerSession();
        const db = getDb();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Sale ID is required' }, { status: 400 });
        }

        // Get sale info first with part name
        const sale = db.prepare(`
            SELECT s.*, p.part_name
            FROM sales s
            LEFT JOIN parts p ON s.part_id = p.id
            WHERE s.id = ?
        `).get(id);
        if (!sale) {
            return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
        }

        // Restore stock and delete sale
        const deleteSale = db.transaction(() => {
            // Restore stock
            db.prepare(`
        UPDATE parts 
        SET quantity_in_stock = quantity_in_stock + ?,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(sale.quantity, sale.part_id);

            // Delete sale
            db.prepare('DELETE FROM sales WHERE id = ?').run(id);
        });

        deleteSale();

        // Log activity
        if (session?.user?.name) {
            logActivity({
                username: session.user.name,
                action: 'delete',
                entityType: 'sale',
                entityId: id,
                entityName: `${sale.part_name || 'Part'} x${sale.quantity}`,
                details: `Deleted sale of ${sale.quantity}x "${sale.part_name || 'Part'}" (€${sale.total_price.toFixed(2)})`
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting sale:', error);
        return NextResponse.json({ error: 'Failed to delete sale' }, { status: 500 });
    }
}
