const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../database/service-parts.db');
const db = new Database(dbPath);

try {
    console.log('Clearing database...');
    db.transaction(() => {
        db.prepare('DELETE FROM sales').run();
        db.prepare('DELETE FROM purchases').run();
        db.prepare('DELETE FROM parts').run();
    })();
    console.log('Successfully deleted all parts, sales, and purchases.');
} catch (error) {
    console.error('Failed to clear database:', error);
}
