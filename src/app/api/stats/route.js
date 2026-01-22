import { getDb } from '@/lib/db';
import { NextResponse } from 'next/server';

// GET dashboard statistics
export async function GET() {
    try {
        const db = getDb();

        // Total parts count
        const totalParts = db.prepare('SELECT COUNT(*) as count FROM parts').get().count;

        // Low stock parts count (check part_locations first, fallback to parts table)
        const lowStockParts = db.prepare(`
            SELECT COUNT(DISTINCT p.id) as count
            FROM parts p
            LEFT JOIN part_locations pl ON p.id = pl.part_id
            WHERE COALESCE((SELECT SUM(pl2.quantity) FROM part_locations pl2 WHERE pl2.part_id = p.id), p.quantity_in_stock) <= p.min_stock_level
        `).get().count;

        // Total customers
        const totalCustomers = db.prepare('SELECT COUNT(*) as count FROM customers').get().count;

        // Today's sales
        const today = new Date().toISOString().split('T')[0];
        const todaySales = db.prepare(`
      SELECT
        COUNT(*) as count,
        COALESCE(SUM(total_price), 0) as revenue
      FROM sales
      WHERE date(sale_date) = date(?)
    `).get(today);

        // This month's sales
        const monthStart = new Date();
        monthStart.setDate(1);
        const monthSales = db.prepare(`
      SELECT
        COUNT(*) as count,
        COALESCE(SUM(total_price), 0) as revenue
      FROM sales
      WHERE date(sale_date) >= date(?)
    `).get(monthStart.toISOString().split('T')[0]);

        // Total inventory value (use part_locations if available, fallback to parts)
        const inventoryValue = db.prepare(`
      SELECT COALESCE(SUM(
        COALESCE(
          (SELECT SUM(pl.quantity) FROM part_locations pl WHERE pl.part_id = p.id),
          p.quantity_in_stock
        ) * p.selling_price
      ), 0) as value
      FROM parts p
    `).get().value;

        // Recent sales (last 5) with location info
        const recentSales = db.prepare(`
      SELECT
        s.id,
        s.quantity,
        s.total_price,
        s.sale_date,
        p.part_name,
        c.name as customer_name,
        c.surname as customer_surname,
        l.name as location_name
      FROM sales s
      LEFT JOIN parts p ON s.part_id = p.id
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN locations l ON s.location_id = l.id
      ORDER BY s.sale_date DESC
      LIMIT 5
    `).all();

        // Low stock items with location info (first 5)
        const lowStockItems = db.prepare(`
      SELECT
        p.id,
        p.part_name,
        p.category,
        p.min_stock_level,
        COALESCE((SELECT SUM(pl.quantity) FROM part_locations pl WHERE pl.part_id = p.id), p.quantity_in_stock) as quantity_in_stock
      FROM parts p
      WHERE COALESCE((SELECT SUM(pl.quantity) FROM part_locations pl WHERE pl.part_id = p.id), p.quantity_in_stock) <= p.min_stock_level
      ORDER BY quantity_in_stock ASC
      LIMIT 5
    `).all();

        // Categories breakdown
        const categories = db.prepare(`
      SELECT
        p.category,
        COUNT(*) as count,
        SUM(COALESCE((SELECT SUM(pl.quantity) FROM part_locations pl WHERE pl.part_id = p.id), p.quantity_in_stock)) as total_stock
      FROM parts p
      GROUP BY p.category
      ORDER BY count DESC
    `).all();

        // Location stock breakdown
        const locationStats = db.prepare(`
      SELECT
        l.id as location_id,
        l.name as location_name,
        COUNT(DISTINCT pl.part_id) as parts_count,
        COALESCE(SUM(pl.quantity), 0) as total_stock,
        COALESCE(SUM(pl.quantity * p.selling_price), 0) as stock_value
      FROM locations l
      LEFT JOIN part_locations pl ON l.id = pl.location_id
      LEFT JOIN parts p ON pl.part_id = p.id
      GROUP BY l.id, l.name
      ORDER BY total_stock DESC
    `).all();

        // Low stock by location (items below min_stock_level at each location)
        const lowStockByLocation = db.prepare(`
      SELECT
        l.id as location_id,
        l.name as location_name,
        p.id as part_id,
        p.part_name,
        p.category,
        pl.quantity,
        pl.min_stock_level
      FROM part_locations pl
      JOIN locations l ON pl.location_id = l.id
      JOIN parts p ON pl.part_id = p.id
      WHERE pl.quantity <= pl.min_stock_level
      ORDER BY l.name, pl.quantity ASC
      LIMIT 10
    `).all();

        // Recent stock transfers (last 5)
        const recentTransfers = db.prepare(`
      SELECT
        st.id,
        st.quantity,
        st.created_at,
        st.created_by,
        p.part_name,
        fl.name as from_location_name,
        tl.name as to_location_name
      FROM stock_transfers st
      LEFT JOIN parts p ON st.part_id = p.id
      LEFT JOIN locations fl ON st.from_location_id = fl.id
      LEFT JOIN locations tl ON st.to_location_id = tl.id
      ORDER BY st.created_at DESC
      LIMIT 5
    `).all();

        return NextResponse.json({
            totalParts,
            lowStockParts,
            totalCustomers,
            todaySales: {
                count: todaySales.count,
                revenue: todaySales.revenue
            },
            monthSales: {
                count: monthSales.count,
                revenue: monthSales.revenue
            },
            inventoryValue,
            recentSales,
            lowStockItems,
            categories,
            locationStats,
            lowStockByLocation,
            recentTransfers
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }
}
