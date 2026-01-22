import { getDb } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { logActivity } from '@/lib/activityLog';

// GET all parts or search (with location breakdown)
export async function GET(request) {
    try {
        const db = getDb();
        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search') || '';
        const category = searchParams.get('category') || '';
        const location = searchParams.get('location') || '';
        const locationId = searchParams.get('location_id') || '';
        const lowStock = searchParams.get('lowStock') === 'true';

        // Build base query - now aggregate stock from part_locations
        let query = `
            SELECT p.*,
                   COALESCE(SUM(pl.quantity), p.quantity_in_stock) as total_stock
            FROM parts p
            LEFT JOIN part_locations pl ON p.id = pl.part_id
            WHERE 1=1
        `;
        const params = [];

        if (search) {
            query += ' AND (p.part_name LIKE ? OR p.description LIKE ? OR p.serial_number LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (category) {
            query += ' AND p.category = ?';
            params.push(category);
        }

        if (location) {
            query += ' AND p.location = ?';
            params.push(location);
        }

        if (locationId) {
            query += ' AND pl.location_id = ?';
            params.push(locationId);
        }

        query += ' GROUP BY p.id';

        if (lowStock) {
            // Check low stock based on part_locations or fallback to parts table
            query = `
                SELECT p.*,
                       COALESCE(SUM(pl.quantity), p.quantity_in_stock) as total_stock
                FROM parts p
                LEFT JOIN part_locations pl ON p.id = pl.part_id
                WHERE 1=1
            `;

            if (search) {
                query += ' AND (p.part_name LIKE ? OR p.description LIKE ? OR p.serial_number LIKE ?)';
            }
            if (category) {
                query += ' AND p.category = ?';
            }
            if (location) {
                query += ' AND p.location = ?';
            }
            if (locationId) {
                query += ' AND pl.location_id = ?';
            }

            query += ' GROUP BY p.id HAVING COALESCE(SUM(pl.quantity), p.quantity_in_stock) <= p.min_stock_level';
        }

        query += ' ORDER BY p.part_name ASC';

        const parts = db.prepare(query).all(...params);

        // Fetch location breakdown for each part
        const partIds = parts.map(p => p.id);
        let locationBreakdowns = {};

        if (partIds.length > 0) {
            const placeholders = partIds.map(() => '?').join(',');
            const locations = db.prepare(`
                SELECT
                    pl.part_id,
                    pl.location_id,
                    pl.quantity,
                    pl.min_stock_level,
                    l.name as location_name
                FROM part_locations pl
                LEFT JOIN locations l ON pl.location_id = l.id
                WHERE pl.part_id IN (${placeholders})
                ORDER BY l.name
            `).all(...partIds);

            // Group by part_id
            for (const loc of locations) {
                if (!locationBreakdowns[loc.part_id]) {
                    locationBreakdowns[loc.part_id] = [];
                }
                locationBreakdowns[loc.part_id].push(loc);
            }
        }

        // Attach location breakdown to each part
        const partsWithLocations = parts.map(part => ({
            ...part,
            quantity_in_stock: part.total_stock || part.quantity_in_stock || 0,
            location_breakdown: locationBreakdowns[part.id] || []
        }));

        return NextResponse.json(partsWithLocations);
    } catch (error) {
        console.error('Error fetching parts:', error);
        return NextResponse.json({ error: 'Failed to fetch parts' }, { status: 500 });
    }
}

// POST create new part (with optional multi-location stock)
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
            image_path,
            location_stocks // Array of { location_id, quantity, min_stock_level }
        } = body;

        // Create part in transaction
        const createPart = db.transaction(() => {
            const stmt = db.prepare(`
                INSERT INTO parts (
                    part_name, category, location, serial_number, description, purchase_price, selling_price,
                    quantity_in_stock, min_stock_level, supplier, guarantee_available, image_path
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            // If location_stocks provided, set quantity_in_stock to 0 (will be tracked in part_locations)
            const stockValue = location_stocks && location_stocks.length > 0 ? 0 : (quantity_in_stock || 0);

            const result = stmt.run(
                part_name,
                category,
                location || '',
                serial_number || '',
                description || '',
                purchase_price || 0,
                selling_price || 0,
                stockValue,
                min_stock_level || 5,
                supplier || '',
                guarantee_available ? 1 : 0,
                image_path || ''
            );

            const partId = result.lastInsertRowid;

            // If location_stocks provided, create entries in part_locations
            if (location_stocks && location_stocks.length > 0) {
                const insertPartLocation = db.prepare(`
                    INSERT INTO part_locations (part_id, location_id, quantity, min_stock_level)
                    VALUES (?, ?, ?, ?)
                `);

                for (const loc of location_stocks) {
                    if (loc.location_id && loc.quantity >= 0) {
                        insertPartLocation.run(partId, loc.location_id, loc.quantity, loc.min_stock_level || 5);
                    }
                }
            } else if (quantity_in_stock > 0 && location) {
                // If single location and stock provided, also create part_locations entry
                const locationRecord = db.prepare('SELECT id FROM locations WHERE name = ?').get(location);
                if (locationRecord) {
                    db.prepare(`
                        INSERT INTO part_locations (part_id, location_id, quantity, min_stock_level)
                        VALUES (?, ?, ?, ?)
                    `).run(partId, locationRecord.id, quantity_in_stock, min_stock_level || 5);
                }
            }

            return partId;
        });

        const partId = createPart();

        // Fetch the created part with location breakdown
        const newPart = db.prepare('SELECT * FROM parts WHERE id = ?').get(partId);
        const locationBreakdown = db.prepare(`
            SELECT pl.*, l.name as location_name
            FROM part_locations pl
            LEFT JOIN locations l ON pl.location_id = l.id
            WHERE pl.part_id = ?
        `).all(partId);

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

        return NextResponse.json({ ...newPart, location_breakdown: locationBreakdown }, { status: 201 });
    } catch (error) {
        console.error('Error creating part:', error);
        return NextResponse.json({ error: 'Failed to create part' }, { status: 500 });
    }
}

// PUT update part (with optional location_stocks update)
export async function PUT(request) {
    try {
        const session = await getServerSession();
        const db = getDb();
        const body = await request.json();
        const { id, location_stocks, ...updates } = body;

        if (!id) {
            return NextResponse.json({ error: 'Part ID is required' }, { status: 400 });
        }

        // Get original part for logging
        const originalPart = db.prepare('SELECT * FROM parts WHERE id = ?').get(id);
        if (!originalPart) {
            return NextResponse.json({ error: 'Part not found' }, { status: 404 });
        }

        const updatePart = db.transaction(() => {
            // Update basic part fields
            const fields = Object.keys(updates)
                .filter(key => updates[key] !== undefined)
                .map(key => `${key} = ?`);

            if (fields.length > 0) {
                fields.push("updated_at = datetime('now')");

                const values = Object.keys(updates)
                    .filter(key => updates[key] !== undefined)
                    .map(key => key === 'guarantee_available' ? (updates[key] ? 1 : 0) : updates[key]);

                const stmt = db.prepare(`UPDATE parts SET ${fields.join(', ')} WHERE id = ?`);
                stmt.run(...values, id);
            }

            // If location_stocks provided, update part_locations
            if (location_stocks && Array.isArray(location_stocks)) {
                // Get existing location entries
                const existing = db.prepare('SELECT location_id FROM part_locations WHERE part_id = ?').all(id);
                const existingLocationIds = new Set(existing.map(e => e.location_id));

                const upsertLocation = db.prepare(`
                    INSERT INTO part_locations (part_id, location_id, quantity, min_stock_level)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(part_id, location_id) DO UPDATE SET
                        quantity = excluded.quantity,
                        min_stock_level = excluded.min_stock_level,
                        updated_at = datetime('now')
                `);

                const newLocationIds = new Set();

                for (const loc of location_stocks) {
                    if (loc.location_id) {
                        upsertLocation.run(id, loc.location_id, loc.quantity || 0, loc.min_stock_level || 5);
                        newLocationIds.add(loc.location_id);
                    }
                }

                // Remove locations that are no longer in the list (only if quantity is 0)
                for (const existingLocId of existingLocationIds) {
                    if (!newLocationIds.has(existingLocId)) {
                        const entry = db.prepare('SELECT quantity FROM part_locations WHERE part_id = ? AND location_id = ?').get(id, existingLocId);
                        if (entry && entry.quantity === 0) {
                            db.prepare('DELETE FROM part_locations WHERE part_id = ? AND location_id = ?').run(id, existingLocId);
                        }
                    }
                }

                // Update total stock in parts table for backward compatibility
                const totalStock = db.prepare('SELECT COALESCE(SUM(quantity), 0) as total FROM part_locations WHERE part_id = ?').get(id);
                db.prepare('UPDATE parts SET quantity_in_stock = ? WHERE id = ?').run(totalStock.total, id);
            }
        });

        updatePart();

        // Fetch updated part with location breakdown
        const updatedPart = db.prepare('SELECT * FROM parts WHERE id = ?').get(id);
        const locationBreakdown = db.prepare(`
            SELECT pl.*, l.name as location_name
            FROM part_locations pl
            LEFT JOIN locations l ON pl.location_id = l.id
            WHERE pl.part_id = ?
        `).all(id);

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

        return NextResponse.json({ ...updatedPart, location_breakdown: locationBreakdown });
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

        // Delete part (part_locations will cascade delete)
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
