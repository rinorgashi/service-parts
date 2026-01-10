import { getDb } from '@/lib/db';
import { NextResponse } from 'next/server';

// GET dashboard statistics
export async function GET() {
    try {
        const db = getDb();

        // Total parts count
        const totalParts = db.prepare('SELECT COUNT(*) as count FROM parts').get().count;

        // Low stock parts count
        const lowStockParts = db.prepare(
            'SELECT COUNT(*) as count FROM parts WHERE quantity_in_stock <= min_stock_level'
        ).get().count;

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

        // Total inventory value
        const inventoryValue = db.prepare(`
      SELECT COALESCE(SUM(quantity_in_stock * selling_price), 0) as value
      FROM parts
    `).get().value;

        // Recent sales (last 5)
        const recentSales = db.prepare(`
      SELECT 
        s.id,
        s.quantity,
        s.total_price,
        s.sale_date,
        p.part_name,
        c.name as customer_name,
        c.surname as customer_surname
      FROM sales s
      LEFT JOIN parts p ON s.part_id = p.id
      LEFT JOIN customers c ON s.customer_id = c.id
      ORDER BY s.sale_date DESC
      LIMIT 5
    `).all();

        // Low stock items (first 5)
        const lowStockItems = db.prepare(`
      SELECT id, part_name, category, quantity_in_stock, min_stock_level
      FROM parts 
      WHERE quantity_in_stock <= min_stock_level
      ORDER BY quantity_in_stock ASC
      LIMIT 5
    `).all();

        // Categories breakdown
        const categories = db.prepare(`
      SELECT category, COUNT(*) as count, SUM(quantity_in_stock) as total_stock
      FROM parts
      GROUP BY category
      ORDER BY count DESC
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
            categories
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }
}
