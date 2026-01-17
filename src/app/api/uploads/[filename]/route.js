import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

// GET serve uploaded image
export async function GET(request, { params }) {
    try {
        const { filename } = await params;

        // Sanitize filename to prevent directory traversal
        const sanitizedFilename = path.basename(filename);
        const filepath = path.join(process.cwd(), 'public', 'uploads', sanitizedFilename);

        if (!existsSync(filepath)) {
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        const file = await readFile(filepath);

        // Determine content type from extension
        const ext = path.extname(sanitizedFilename).toLowerCase();
        const contentTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp'
        };

        const contentType = contentTypes[ext] || 'application/octet-stream';

        return new NextResponse(file, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=31536000, immutable'
            }
        });
    } catch (error) {
        console.error('Error serving file:', error);
        return NextResponse.json({ error: 'Failed to serve file' }, { status: 500 });
    }
}
