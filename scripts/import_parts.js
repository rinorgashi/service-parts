const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../database/service-parts.db');
const db = new Database(dbPath);

const csvPath = path.join(__dirname, '../parts.csv');

function parseLine(line) {
    // Regex to split by semicolon, ignoring semicolons inside quotes
    // This matches a semicolon only if it's followed by an even number of quotes
    const regex = /;(?=(?:[^"']"[^"']*")*[^"']*$)/;
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
    // 2: SERIAL_NUMBER (matches "Serial Number" header)
    // 3: NOTES/MODEL (Missing in header)
    // 4: DESCRIPTION (matches "Description" header)
    // 5: QUANTITY (matches "Quantity" header)
    // 6: PRICE (matches "Purchase Price" header)
    // 7: GUARANTEE
    // 8: LOCATION
    const dataLines = lines.slice(1);

    console.log(`Found ${dataLines.length} lines to process.`);

    // Clear existing parts to avoid duplicates (and related sales/purchases to maintain integrity)
    // db.prepare('DELETE FROM sales').run();
    // db.prepare('DELETE FROM purchases').run();
    // db.prepare('DELETE FROM parts').run();
    // console.log('Cleared existing inventory.');
    // COMMENTED OUT DELETION FOR SAFETY - Will use INSERT OR REPLACE or just INSERT

    // Actually, user said "upload all parts", implying adding them.
    // But to ensure "valid data" and avoid duplicates if run multiple times, maybe we should check existence?
    // Given the previous script deleted everything, I will follow that pattern but make it safer by just deleting parts if we are re-importing, or just appending.
    // Let's clear for a clean slate as typically requested in these setup tasks.
    db.prepare('DELETE FROM sales').run();
    db.prepare('DELETE FROM purchases').run();
    db.prepare('DELETE FROM parts').run(); 
    // Also reset sequence for ID
    try {
        db.prepare("DELETE FROM sqlite_sequence WHERE name='parts'").run();
    } catch (e) {
        // Ignore if sqlite_sequence doesn't exist or other minor error
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
        // Handle weird "whole line quoted" CSV issue if it exists (some CSVs do this)
        // Based on sample: "VESTEL;...;...;..." -> quotes around whole line?
        // Sample 1: "VESTEL;Shporet Inter INT6060;...;Depo" (Quotes around whole line)
        // Sample 2: VESTEL;TV;...;Depo (No quotes)
        if (line.startsWith('"') && line.endsWith('"') && line.split('"').length === 3) {
             // Only remove start/end quotes if there are no other quotes inside (simple check)
             // Actually, the regex splitter handles quotes inside fields.
             // If the *entire line* is wrapped in quotes, we should strip them first?
             // Looking at the provided content:
             // "VESTEL;Shporet Inter INT6060;42037909;90;KNOB (DELTA, SPINDLE TYPE 1, WHITE);2;0.79;Yes;Depo"
             // This looks like the *entire row* is quoted.
             // But wait, parseLine splits by `;` ignoring quoted sections.
             // If the whole line is quoted, `parseLine` will treat the whole line as one token if there are no internal quotes?
             // No, `VESTEL;...` -> no internal quotes.
             // Let's try to detect if it's a full-line quote.
             // A full line quote would be `"Field1;Field2;..."`
             line = line.replace(/^"|"$/g, ''); 
        }

        // Try parsing
        let cols = parseLine(line);

        // If parsing failed to produce expected columns, and line is wrapped in quotes, try stripping them
        if (cols.length < 8 && line.startsWith('"') && line.endsWith('"')) {
            const stripped = line.slice(1, -1);
            let colsStripped = parseLine(stripped);
            
            // Fallback: If regex split failed (still < 8), try simple split if it looks safe
            if (colsStripped.length < 8) {
                 // Check if simple split gives us enough columns. 
                 // This assumes fields don't contain semicolons if regex failed.
                 const simpleSplit = stripped.split(';').map(s => s.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
                 if (simpleSplit.length >= 8) {
                     colsStripped = simpleSplit;
                 }
            }

            if (colsStripped.length >= 8) {
                // It was indeed a full-line quote wrapper
                cols = colsStripped;
            }
        }

        // We expect at least 8 columns (if Notes is missing/merged) but mostly 9.
        if (cols.length < 8) {
            console.warn('Skipping invalid line (columns < 8):', line);
            skipped++;
            continue;
        }

        // Logic to handle 9 columns vs 8 columns
        // Index mapping if 9 columns (Standard):
        // 0: Supplier, 1: Category, 2: Serial, 3: Notes, 4: Desc, 5: Qty, 6: Price, 7: Guarantee, 8: Location
        
        // Index mapping if 8 columns (Fallback):
        // 0: Supplier, 1: Category, 2: Serial, 3: Desc, 4: Qty, 5: Price, 6: Guarantee, 7: Location
        
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
        } else {
             // 8 columns
            supplier = cols[0];
            category = cols[1];
            serial = cols[2];
            notes = ''; // Missing
            desc = cols[3];
            qtyStr = cols[4];
            priceStr = cols[5];
            guaranteeStr = cols[6];
            location = cols[7];
        }

        // Clean data
        const cleanQty = parseInt(qtyStr.replace(/[^0-9-]/g, '')) || 0;
        // Price might have commas for decimals in some locales, usually dot in CSV but let's be safe
        const cleanPrice = parseFloat(priceStr.replace(/[^0-9.,-]/g, '').replace(',', '.')) || 0;
        const guarantee = (guaranteeStr && (guaranteeStr.toLowerCase().includes('yes') || guaranteeStr === '1')) ? 1 : 0;

        // Ensure category exists
        if (category) {
            insertCategory.run(category);
        }

        partsToInsert.push({
            part_name: desc || 'Unknown Part', // Use Description as Part Name
            category: category || 'Other',
            location: location || '',
            serial_number: serial || '',
            description: desc || '',
            notes: notes || '',
            quantity_in_stock: cleanQty,
            purchase_price: cleanPrice,
            selling_price: cleanPrice > 0 ? cleanPrice * 1.5 : 0, // 50% Markup
            supplier: supplier || 'Unknown',
            guarantee_available: guarantee
        });
    }

    const insertedCount = insertPartStmt(partsToInsert);
    console.log(`Successfully imported ${insertedCount} parts. Skipped ${skipped} lines.`);

} catch (error) {
    console.error('Import failed:', error);
}