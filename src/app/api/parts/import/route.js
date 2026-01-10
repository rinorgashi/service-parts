import { getDb } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const { parts } = await request.json();

        if (!Array.isArray(parts) || parts.length === 0) {
            return NextResponse.json({ error: 'No parts data provided' }, { status: 400 });
        }

        const db = getDb();
        const insert = db.prepare(`
      INSERT INTO parts (
        part_name, category, location, serial_number, description,
        purchase_price, selling_price, quantity_in_stock, min_stock_level, 
        supplier, guarantee_available
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

        let successCount = 0;
        let errors = [];

        // Use a transaction for bulk insert
        const transaction = db.transaction((partsList) => {
            for (const part of partsList) {
                try {
                    insert.run(
                        part.part_name,
                        part.category || 'Other',
                        part.location || '',
                        part.serial_number || '',
                        part.description || '',
                        part.purchase_price || 0,
                        part.selling_price || 0,
                        part.quantity_in_stock || 0,
                        part.min_stock_level || 5,
                        part.supplier || '',
                        part.guarantee_available ? 1 : 0
                    );
                    successCount++;
                } catch (err) {
                    errors.push(`Failed to import "${part.part_name}": ${err.message}`);
                }
            }
        });

        transaction(parts);

        return NextResponse.json({
            success: true,
            count: successCount,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error) {
        console.error('Import error:', error);
        return NextResponse.json({ error: 'Failed to process import: ' + error.message }, { status: 500 });
    }
}
