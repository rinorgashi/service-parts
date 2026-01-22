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
        const locationId = searchParams.get('location_id');

        let query = `
      SELECT
        s.*,
        p.part_name,
        p.category,
        c.name as customer_name,
        c.surname as customer_surname,
        c.phone as customer_phone,
        l.name as location_name
      FROM sales s
      LEFT JOIN parts p ON s.part_id = p.id
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN locations l ON s.location_id = l.id
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

        if (locationId) {
            query += ' AND s.location_id = ?';
            params.push(locationId);
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
            notes,
            location_id
        } = body;

        if (!part_id || !quantity) {
            return NextResponse.json({
                error: 'Part and quantity are required'
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
            locationName = location?.name;
        }

        // Check stock availability - check part_locations first, then fallback to parts table
        let stockSource = 'parts'; // Track where we're getting stock from
        let availableStock = part.quantity_in_stock;

        if (location_id) {
            // Check stock at specific location
            const partLocation = db.prepare(
                'SELECT * FROM part_locations WHERE part_id = ? AND location_id = ?'
            ).get(part_id, location_id);

            if (partLocation) {
                availableStock = partLocation.quantity;
                stockSource = 'part_locations';
            } else {
                // No stock at this location
                availableStock = 0;
            }
        } else {
            // No location specified - check if part has entries in part_locations
            const totalLocationStock = db.prepare(
                'SELECT COALESCE(SUM(quantity), 0) as total FROM part_locations WHERE part_id = ?'
            ).get(part_id);

            if (totalLocationStock.total > 0) {
                availableStock = totalLocationStock.total;
                stockSource = 'part_locations_total';
            }
        }

        if (availableStock < quantity) {
            const locationInfo = locationName ? ` at ${locationName}` : '';
            return NextResponse.json({
                error: `Insufficient stock${locationInfo}. Available: ${availableStock}`
            }, { status: 400 });
        }

        // If guarantee is included, part price is 0 (customer doesn't pay for the part)
        const effectiveUnitPrice = guarantee_included ? 0 : (unit_price || part.selling_price);
        const effectiveLabourCost = parseFloat(labour_cost) || 0;
        const partsTotal = quantity * effectiveUnitPrice;
        const total_price = partsTotal + effectiveLabourCost;

        // Start transaction
        const insertSale = db.transaction(() => {
            // Create sale record with location_id
            const saleStmt = db.prepare(`
        INSERT INTO sales (
          part_id, customer_id, service_record_id, quantity,
          unit_price, labour_cost, total_price, guarantee_included, notes, location_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                notes || '',
                location_id || null
            );

            // Update stock based on where we tracked it
            if (location_id && stockSource === 'part_locations') {
                // Update stock at specific location in part_locations
                db.prepare(`
                    UPDATE part_locations
                    SET quantity = quantity - ?,
                        updated_at = datetime('now')
                    WHERE part_id = ? AND location_id = ?
                `).run(quantity, part_id, location_id);

                // Also update the parts table for backward compatibility
                const totalStock = db.prepare(
                    'SELECT COALESCE(SUM(quantity), 0) as total FROM part_locations WHERE part_id = ?'
                ).get(part_id);
                db.prepare(`
                    UPDATE parts
                    SET quantity_in_stock = ?,
                        updated_at = datetime('now')
                    WHERE id = ?
                `).run(totalStock.total, part_id);
            } else if (!location_id && stockSource === 'part_locations_total') {
                // No specific location - just update parts table (legacy behavior)
                // This should be avoided in new flows; location should be required
                db.prepare(`
                    UPDATE parts
                    SET quantity_in_stock = quantity_in_stock - ?,
                        updated_at = datetime('now')
                    WHERE id = ?
                `).run(quantity, part_id);
            } else {
                // Legacy: update parts table directly
                db.prepare(`
                    UPDATE parts
                    SET quantity_in_stock = quantity_in_stock - ?,
                        updated_at = datetime('now')
                    WHERE id = ?
                `).run(quantity, part_id);
            }

            return result.lastInsertRowid;
        });

        const saleId = insertSale();

        const newSale = db.prepare(`
      SELECT
        s.*,
        p.part_name,
        p.category,
        c.name as customer_name,
        c.surname as customer_surname,
        l.name as location_name
      FROM sales s
      LEFT JOIN parts p ON s.part_id = p.id
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN locations l ON s.location_id = l.id
      WHERE s.id = ?
    `).get(saleId);

        // Log activity
        if (session?.user?.name) {
            const locationInfo = locationName ? ` from ${locationName}` : '';
            logActivity({
                username: session.user.name,
                action: 'create',
                entityType: 'sale',
                entityId: saleId,
                entityName: `${part.part_name} x${quantity}`,
                details: `Sold ${quantity}x "${part.part_name}"${locationInfo} for €${total_price.toFixed(2)}${guarantee_included ? ' (guarantee)' : ''}`
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

        // Get sale info first with part name and location
        const sale = db.prepare(`
            SELECT s.*, p.part_name, l.name as location_name
            FROM sales s
            LEFT JOIN parts p ON s.part_id = p.id
            LEFT JOIN locations l ON s.location_id = l.id
            WHERE s.id = ?
        `).get(id);
        if (!sale) {
            return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
        }

        // Restore stock and delete sale
        const deleteSale = db.transaction(() => {
            // Restore stock to the location it came from
            if (sale.location_id) {
                // Check if part_location entry exists
                const partLocation = db.prepare(
                    'SELECT * FROM part_locations WHERE part_id = ? AND location_id = ?'
                ).get(sale.part_id, sale.location_id);

                if (partLocation) {
                    // Update existing entry
                    db.prepare(`
                        UPDATE part_locations
                        SET quantity = quantity + ?,
                            updated_at = datetime('now')
                        WHERE part_id = ? AND location_id = ?
                    `).run(sale.quantity, sale.part_id, sale.location_id);
                } else {
                    // Create new entry (in case location was deleted and recreated)
                    db.prepare(`
                        INSERT INTO part_locations (part_id, location_id, quantity, min_stock_level)
                        VALUES (?, ?, ?, 5)
                    `).run(sale.part_id, sale.location_id, sale.quantity);
                }

                // Update parts table for backward compatibility
                const totalStock = db.prepare(
                    'SELECT COALESCE(SUM(quantity), 0) as total FROM part_locations WHERE part_id = ?'
                ).get(sale.part_id);
                db.prepare(`
                    UPDATE parts
                    SET quantity_in_stock = ?,
                        updated_at = datetime('now')
                    WHERE id = ?
                `).run(totalStock.total, sale.part_id);
            } else {
                // Legacy sale without location - restore to parts table
                db.prepare(`
                    UPDATE parts
                    SET quantity_in_stock = quantity_in_stock + ?,
                        updated_at = datetime('now')
                    WHERE id = ?
                `).run(sale.quantity, sale.part_id);
            }

            // Delete sale
            db.prepare('DELETE FROM sales WHERE id = ?').run(id);
        });

        deleteSale();

        // Log activity
        if (session?.user?.name) {
            const locationInfo = sale.location_name ? ` (${sale.location_name})` : '';
            logActivity({
                username: session.user.name,
                action: 'delete',
                entityType: 'sale',
                entityId: id,
                entityName: `${sale.part_name || 'Part'} x${sale.quantity}`,
                details: `Deleted sale of ${sale.quantity}x "${sale.part_name || 'Part'}"${locationInfo} (€${sale.total_price.toFixed(2)})`
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting sale:', error);
        return NextResponse.json({ error: 'Failed to delete sale' }, { status: 500 });
    }
}
