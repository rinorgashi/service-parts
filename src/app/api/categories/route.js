import { getDb } from '@/lib/db';
import { NextResponse } from 'next/server';

// GET all categories
export async function GET() {
    try {
        const db = getDb();
        const categories = db.prepare('SELECT * FROM categories ORDER BY name ASC').all();
        return NextResponse.json(categories);
    } catch (error) {
        console.error('Error fetching categories:', error);
        return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
    }
}

// POST create new category
export async function POST(request) {
    try {
        const db = getDb();
        const body = await request.json();
        const { name } = body;

        if (!name || !name.trim()) {
            return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
        }

        const stmt = db.prepare('INSERT INTO categories (name) VALUES (?)');
        const result = stmt.run(name.trim());

        const newCategory = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
        return NextResponse.json(newCategory, { status: 201 });
    } catch (error) {
        if (error.message.includes('UNIQUE constraint')) {
            return NextResponse.json({ error: 'Category already exists' }, { status: 400 });
        }
        console.error('Error creating category:', error);
        return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
    }
}

// DELETE category
export async function DELETE(request) {
    try {
        const db = getDb();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Category ID is required' }, { status: 400 });
        }

        // Check if category is used by any parts
        const partsCount = db.prepare('SELECT COUNT(*) as count FROM parts WHERE category = (SELECT name FROM categories WHERE id = ?)').get(id);
        if (partsCount.count > 0) {
            return NextResponse.json({ error: 'Cannot delete category that is used by parts' }, { status: 400 });
        }

        db.prepare('DELETE FROM categories WHERE id = ?').run(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting category:', error);
        return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
    }
}
