import { getDb } from '@/lib/db';
import { NextResponse } from 'next/server';

// GET all service records
export async function GET(request) {
    try {
        const db = getDb();
        const { searchParams } = new URL(request.url);
        const customerId = searchParams.get('customerId');
        const status = searchParams.get('status');

        let query = `
      SELECT 
        sr.*,
        c.name as customer_name,
        c.surname as customer_surname,
        c.phone as customer_phone
      FROM service_records sr
      LEFT JOIN customers c ON sr.customer_id = c.id
      WHERE 1=1
    `;
        const params = [];

        if (customerId) {
            query += ' AND sr.customer_id = ?';
            params.push(customerId);
        }

        if (status) {
            query += ' AND sr.status = ?';
            params.push(status);
        }

        query += ' ORDER BY sr.service_date DESC';

        const records = db.prepare(query).all(...params);
        return NextResponse.json(records);
    } catch (error) {
        console.error('Error fetching service records:', error);
        return NextResponse.json({ error: 'Failed to fetch service records' }, { status: 500 });
    }
}

// POST create new service record
export async function POST(request) {
    try {
        const db = getDb();
        const body = await request.json();

        const {
            customer_id,
            product_type,
            product_model,
            serial_number,
            issue_description,
            service_date,
            status,
            notes
        } = body;

        if (!customer_id || !product_type) {
            return NextResponse.json({
                error: 'Customer and product type are required'
            }, { status: 400 });
        }

        const stmt = db.prepare(`
      INSERT INTO service_records (
        customer_id, product_type, product_model, serial_number,
        issue_description, service_date, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

        const result = stmt.run(
            customer_id,
            product_type,
            product_model || '',
            serial_number || '',
            issue_description || '',
            service_date || new Date().toISOString(),
            status || 'pending',
            notes || ''
        );

        const newRecord = db.prepare(`
      SELECT 
        sr.*,
        c.name as customer_name,
        c.surname as customer_surname
      FROM service_records sr
      LEFT JOIN customers c ON sr.customer_id = c.id
      WHERE sr.id = ?
    `).get(result.lastInsertRowid);

        return NextResponse.json(newRecord, { status: 201 });
    } catch (error) {
        console.error('Error creating service record:', error);
        return NextResponse.json({ error: 'Failed to create service record' }, { status: 500 });
    }
}

// PUT update service record
export async function PUT(request) {
    try {
        const db = getDb();
        const body = await request.json();
        const { id, ...updates } = body;

        if (!id) {
            return NextResponse.json({ error: 'Record ID is required' }, { status: 400 });
        }

        const fields = Object.keys(updates)
            .filter(key => updates[key] !== undefined)
            .map(key => `${key} = ?`);

        if (fields.length === 0) {
            return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
        }

        fields.push("updated_at = datetime('now')");

        const values = Object.keys(updates)
            .filter(key => updates[key] !== undefined)
            .map(key => updates[key]);

        const stmt = db.prepare(`UPDATE service_records SET ${fields.join(', ')} WHERE id = ?`);
        stmt.run(...values, id);

        const updatedRecord = db.prepare(`
      SELECT 
        sr.*,
        c.name as customer_name,
        c.surname as customer_surname
      FROM service_records sr
      LEFT JOIN customers c ON sr.customer_id = c.id
      WHERE sr.id = ?
    `).get(id);

        return NextResponse.json(updatedRecord);
    } catch (error) {
        console.error('Error updating service record:', error);
        return NextResponse.json({ error: 'Failed to update service record' }, { status: 500 });
    }
}

// DELETE service record
export async function DELETE(request) {
    try {
        const db = getDb();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Record ID is required' }, { status: 400 });
        }

        db.prepare('DELETE FROM service_records WHERE id = ?').run(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting service record:', error);
        return NextResponse.json({ error: 'Failed to delete service record' }, { status: 500 });
    }
}
