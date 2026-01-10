import { getDb } from '@/lib/db';
import { NextResponse } from 'next/server';

// GET all customers
export async function GET(request) {
    try {
        const db = getDb();
        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search') || '';

        let query = 'SELECT * FROM customers WHERE 1=1';
        const params = [];

        if (search) {
            query += ' AND (name LIKE ? OR surname LIKE ? OR phone LIKE ? OR email LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }

        query += ' ORDER BY surname, name ASC';

        const customers = db.prepare(query).all(...params);
        return NextResponse.json(customers);
    } catch (error) {
        console.error('Error fetching customers:', error);
        return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
    }
}

// POST create new customer
export async function POST(request) {
    try {
        const db = getDb();
        const body = await request.json();

        const { name, surname, phone, email, address, notes } = body;

        if (!name || !surname) {
            return NextResponse.json({ error: 'Name and surname are required' }, { status: 400 });
        }

        const stmt = db.prepare(`
      INSERT INTO customers (name, surname, phone, email, address, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

        const result = stmt.run(name, surname, phone || '', email || '', address || '', notes || '');

        const newCustomer = db.prepare('SELECT * FROM customers WHERE id = ?').get(result.lastInsertRowid);
        return NextResponse.json(newCustomer, { status: 201 });
    } catch (error) {
        console.error('Error creating customer:', error);
        return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 });
    }
}

// PUT update customer
export async function PUT(request) {
    try {
        const db = getDb();
        const body = await request.json();
        const { id, ...updates } = body;

        if (!id) {
            return NextResponse.json({ error: 'Customer ID is required' }, { status: 400 });
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

        const stmt = db.prepare(`UPDATE customers SET ${fields.join(', ')} WHERE id = ?`);
        stmt.run(...values, id);

        const updatedCustomer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
        return NextResponse.json(updatedCustomer);
    } catch (error) {
        console.error('Error updating customer:', error);
        return NextResponse.json({ error: 'Failed to update customer' }, { status: 500 });
    }
}

// DELETE customer
export async function DELETE(request) {
    try {
        const db = getDb();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Customer ID is required' }, { status: 400 });
        }

        db.prepare('DELETE FROM customers WHERE id = ?').run(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting customer:', error);
        return NextResponse.json({ error: 'Failed to delete customer' }, { status: 500 });
    }
}
