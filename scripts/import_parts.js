const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../database/service-parts.db');
const db = new Database(dbPath);

// --- MIGRATION: Ensure columns exist ---
try { db.prepare("ALTER TABLE parts ADD COLUMN serial_number TEXT").run(); } catch (e) {}
try { db.prepare("ALTER TABLE parts ADD COLUMN location TEXT").run(); } catch (e) {}
try { db.prepare("ALTER TABLE parts ADD COLUMN notes TEXT").run(); } catch (e) {}
// ---------------------------------------

const csvPath = path.join(__dirname, '../parts.csv');

function parseLine(line) {
    // Regex to split by semicolon, ignoring semicolons inside quotes (Standard CSV uses double quotes)
    // This matches a semicolon only if it's followed by an even number of double quotes
    const regex = /;(?=(?:[^"]*"[^"]*")*[^"]*$)/;
    return line.split(regex).map(s => s.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
}

try {
    if (!fs.existsSync(csvPath)) {
        console.error('parts.csv not found at:', csvPath);
        process.exit(1);
    }

    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = fileContent.split('\n').filter(l => l.trim().length > 0);

    // Skip header
    // Header: SUPPLIER;CATEGORY;Serial Number;Description;Quantity in Stock;Purchase Price;GUARANTEE;Location
    // Data has 9 columns:
    // 0: SUPPLIER
    // 1: CATEGORY
    // 2: SERIAL_NUMBER
    // 3: NOTES/MODEL (Missing in header)
    // 4: DESCRIPTION
    // 5: QUANTITY
    // 6: PRICE
    // 7: GUARANTEE
    // 8: LOCATION
    const dataLines = lines.slice(1);

    console.log(`Found ${dataLines.length} lines to process.`);

    // Clear existing parts to avoid duplicates
    db.prepare('DELETE FROM sales').run();
    db.prepare('DELETE FROM purchases').run();
    db.prepare('DELETE FROM parts').run(); 
    // Also reset sequence for ID
    try {
        db.prepare("DELETE FROM sqlite_sequence WHERE name='parts'").run();
    } catch (e) {
        // Ignore if sqlite_sequence doesn't exist
    }
    console.log('Cleared existing inventory for clean import.');

    const insertCategory = db.prepare('INSERT OR IGNORE INTO categories (name) VALUES (?)');
    const insertPart = db.prepare(`
        INSERT INTO parts (
            part_name, 
            category, 
            location, 
            serial_number, 
            description, 
            notes,
            quantity_in_stock, 
            purchase_price, 
            selling_price, 
            supplier, 
            guarantee_available
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertPartStmt = db.transaction((parts) => {
        let count = 0;
        for (const part of parts) {
            insertPart.run(
                part.part_name,
                part.category,
                part.location,
                part.serial_number,
                part.description,
                part.notes,
                part.quantity_in_stock,
                part.purchase_price,
                part.selling_price,
                part.supplier,
                part.guarantee_available
            );
            count++;
        }
        return count;
    });

    const partsToInsert = [];
    let skipped = 0;

    for (let line of dataLines) {
        line = line.trim();
        
        // Handle whole line quoted if format is weird
        if (line.startsWith('"') && line.endsWith('"') && line.split('"').length === 3) {
             line = line.replace(/^"|"$/g, ''); 
        }

        // Try parsing
        let cols = parseLine(line);

        // Fallback for stripped line if needed
        if (cols.length < 8 && line.startsWith('"') && line.endsWith('"')) {
            const stripped = line.slice(1, -1);
            let colsStripped = parseLine(stripped);
            
            if (colsStripped.length < 8) {
                 const simpleSplit = stripped.split(';').map(s => s.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
                 if (simpleSplit.length >= 8) {
                     colsStripped = simpleSplit;
                 }
            }

            if (colsStripped.length >= 8) {
                cols = colsStripped;
            }
        }

        if (cols.length < 8) {
            console.warn('Skipping invalid line (columns < 8):', line);
            skipped++;
            continue;
        }

        let supplier, category, serial, notes, desc, qtyStr, priceStr, guaranteeStr, location;

        if (cols.length >= 9) {
            supplier = cols[0];
            category = cols[1];
            serial = cols[2];
            notes = cols[3];
            desc = cols[4];
            qtyStr = cols[5];
            priceStr = cols[6];
            guaranteeStr = cols[7];
            location = cols[8];
        } else { // 8 columns fallback
            supplier = cols[0];
            category = cols[1];
            serial = cols[2];
            notes = ''; 
            desc = cols[3];
            qtyStr = cols[4];
            priceStr = cols[5];
            guaranteeStr = cols[6];
            location = cols[7];
        }

        // Clean data
        const cleanQty = parseInt(qtyStr.replace(/[^0-9-]/g, '')) || 0;
        const cleanPrice = parseFloat(priceStr.replace(/[^0-9.,-]/g, '').replace(',', '.')) || 0;
        const guarantee = (guaranteeStr && (guaranteeStr.toLowerCase().includes('yes') || guaranteeStr === '1')) ? 1 : 0;

        // Ensure category exists
        if (category) {
            insertCategory.run(category);
        }

        // Combine notes and description for full context
        // If notes and desc are different, show both.
        let fullDescription = desc || '';
        if (notes && notes !== desc && !fullDescription.includes(notes)) {
            fullDescription = `${notes} - ${fullDescription}`;
        }

        partsToInsert.push({
            part_name: desc || 'Unknown Part',
            category: category || 'Other',
            location: location || '',
            serial_number: serial || '',
            description: fullDescription,
            notes: notes || '',
            quantity_in_stock: cleanQty,
            purchase_price: cleanPrice,
            selling_price: cleanPrice > 0 ? cleanPrice * 1.5 : 0, 
            supplier: supplier || 'Unknown',
            guarantee_available: guarantee
        });
    }

    const insertedCount = insertPartStmt(partsToInsert);
    console.log(`Successfully imported ${insertedCount} parts. Skipped ${skipped} lines.`);

} catch (error) {
    console.error('Import failed:', error);
}
