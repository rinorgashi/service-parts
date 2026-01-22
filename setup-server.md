# Server Update Guide: Multi-Warehouse Inventory

This guide walks you through updating your production server with the new multi-warehouse inventory feature.

## Pre-Update Checklist

- [ ] Backup your database before updating
- [ ] Note down your current stock levels for verification after update
- [ ] Schedule update during low-traffic period

---

## Step 1: Backup Your Database

**IMPORTANT:** Always backup before major updates.

```bash
# SSH into your server
ssh your-user@your-server-ip

# Navigate to your app directory
cd ~/service-parts

# Create a backup of the database
cp database/service-parts.db database/service-parts.db.backup-$(date +%Y%m%d)

# Verify backup was created
ls -la database/
```

---

## Step 2: Pull Latest Code

```bash
# Make sure you're in the app directory
cd ~/service-parts

# Pull the latest changes
git pull origin main
```

---

## Step 3: Install Dependencies (if any new ones)

```bash
npm install
```

---

## Step 4: Build the Application

```bash
npm run build
```

---

## Step 5: Restart the Application

```bash
# If using PM2
pm2 restart service-parts

# Or if using systemd
sudo systemctl restart service-parts
```

---

## What Happens Automatically

When the application starts, the database will be automatically updated:

### New Tables Created

1. **`part_locations`** - Tracks stock per warehouse location
   ```sql
   CREATE TABLE part_locations (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     part_id INTEGER NOT NULL,
     location_id INTEGER NOT NULL,
     quantity INTEGER DEFAULT 0,
     min_stock_level INTEGER DEFAULT 5,
     created_at TEXT,
     updated_at TEXT,
     UNIQUE(part_id, location_id)
   )
   ```

2. **`stock_transfers`** - Records transfers between locations
   ```sql
   CREATE TABLE stock_transfers (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     part_id INTEGER NOT NULL,
     from_location_id INTEGER NOT NULL,
     to_location_id INTEGER NOT NULL,
     quantity INTEGER NOT NULL,
     notes TEXT,
     created_by TEXT,
     created_at TEXT
   )
   ```

### Columns Added

- `sales.location_id` - Tracks which warehouse the sale came from
- `purchases.location_id` - Tracks which warehouse received the stock

### Data Migration

The system automatically migrates existing parts:
- Parts with existing stock are assigned to the first available location
- If a part's `location` field matches an existing location name, it uses that
- Otherwise, a "Main Warehouse" location is created as default

---

## Step 6: Verify the Update

### Check Application is Running

```bash
# Check PM2 status
pm2 status

# Check logs for any errors
pm2 logs service-parts --lines 50
```

### Check Database Tables Were Created

```bash
# Open SQLite
sqlite3 database/service-parts.db

# Check new tables exist
.tables

# You should see: part_locations, stock_transfers (among others)

# Verify part_locations has data
SELECT COUNT(*) FROM part_locations;

# Check a sample of migrated data
SELECT pl.*, p.part_name, l.name as location_name
FROM part_locations pl
JOIN parts p ON pl.part_id = p.id
JOIN locations l ON pl.location_id = l.id
LIMIT 5;

# Exit SQLite
.quit
```

### Test in Browser

1. Go to your application URL
2. Navigate to **Inventory** page
3. Click on the stock number for any part - it should expand to show location breakdown
4. Try the **Transfer Stock** button (arrow icon) in the toolbar
5. Check the **Dashboard** - you should see "Stock by Location" section

---

## New Features to Configure

### 1. Create Your Warehouse Locations

If you haven't already, create your warehouse locations:

1. Go to **Inventory** page
2. Click the **Map Pin** icon in the toolbar
3. Add your locations (e.g., "Prishtina Warehouse", "Mitrovice Warehouse")

### 2. Assign Parts to Multiple Locations

For each part you want in multiple warehouses:

1. Go to **Inventory** page
2. Click **Edit** on a part
3. Scroll to **"Stock by Location"** section
4. Click **"Add Location"** button
5. Select location and enter quantity
6. Repeat for additional locations
7. Click **Save**

### 3. Transfer Stock Between Locations

To move stock from one warehouse to another:

1. Go to **Inventory** page
2. Click the **Transfer** button (↔ icon) on a part row, OR
3. Click the **Transfer Stock** button in the toolbar
4. Select: Part, From Location, To Location, Quantity
5. Click **Transfer**

---

## Troubleshooting

### Error: "SQLITE_ERROR: table already exists"
This is normal - the migration uses `CREATE TABLE IF NOT EXISTS`. Check if tables exist:
```bash
sqlite3 database/service-parts.db ".tables"
```

### Error: "column location_id already exists"
This is also normal - the migration catches this error silently. No action needed.

### Parts Don't Show Location Breakdown
- Make sure at least one location exists
- Edit the part and add stock to specific locations using the "Stock by Location" editor

### Stock Numbers Don't Match
After migration, verify:
```bash
sqlite3 database/service-parts.db

-- Compare parts.quantity_in_stock with sum from part_locations
SELECT
  p.id,
  p.part_name,
  p.quantity_in_stock as parts_table_stock,
  COALESCE(SUM(pl.quantity), 0) as locations_total
FROM parts p
LEFT JOIN part_locations pl ON p.id = pl.part_id
GROUP BY p.id
HAVING parts_table_stock != locations_total;

.quit
```

If there are mismatches, they will auto-correct when you next edit/save the part.

### Application Won't Start
Check the logs:
```bash
pm2 logs service-parts --err --lines 100
```

Common issues:
- Permission issues on database file
- Port already in use
- Missing environment variables

---

## Rollback (If Needed)

If something goes wrong:

```bash
# Stop the application
pm2 stop service-parts

# Restore database backup
cp database/service-parts.db.backup-YYYYMMDD database/service-parts.db

# Revert code (find the previous commit)
git log --oneline -10
git checkout <previous-commit-hash>

# Rebuild and restart
npm run build
pm2 restart service-parts
```

---

## New API Endpoints

For reference, these new endpoints are now available:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/part-locations` | GET | List part-location relationships |
| `/api/part-locations` | POST | Create/update part at location |
| `/api/part-locations` | PUT | Update stock at location |
| `/api/part-locations` | DELETE | Remove part from location |
| `/api/stock-transfer` | GET | List transfer history |
| `/api/stock-transfer` | POST | Transfer stock between locations |

---

## Questions?

If you encounter issues:
1. Check PM2 logs: `pm2 logs service-parts`
2. Check the database backup exists
3. Verify all tables were created in SQLite
