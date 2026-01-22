# Service Parts Management System

A full-stack inventory management application for home appliance repair businesses.

## Purpose

Helps repair shops manage spare parts inventory, customers, sales, purchases, and service records. Key business features include guarantee handling (parts free, labor charged), automatic stock management, and activity logging.

## Tech Stack

- **Framework:** Next.js 16 with App Router
- **Frontend:** React 19, Lucide React icons
- **Backend:** Next.js API Routes
- **Database:** SQLite via better-sqlite3
- **Auth:** NextAuth v4 (JWT, 24h sessions)
- **Styling:** Custom CSS with dark theme

## Project Structure

```
src/
├── app/
│   ├── page.js                # Dashboard
│   ├── inventory/page.js      # Parts inventory management
│   ├── customers/page.js      # Customer management
│   ├── sales/page.js          # Sales transactions
│   ├── purchases/page.js      # Stock purchases
│   ├── services/page.js       # Service/repair records
│   ├── users/page.js          # User management (admin only)
│   ├── activity-logs/page.js  # Activity logs (admin only)
│   ├── settings/page.js       # User settings
│   ├── login/page.js          # Authentication
│   └── api/                   # REST API endpoints
│       ├── auth/[...nextauth]/route.js
│       ├── parts/route.js
│       ├── customers/route.js
│       ├── sales/route.js
│       ├── purchases/route.js
│       ├── service-records/route.js
│       ├── categories/route.js
│       ├── locations/route.js
│       ├── part-locations/route.js  # Multi-warehouse stock management
│       ├── stock-transfer/route.js  # Inter-warehouse transfers
│       ├── stats/route.js
│       ├── upload/route.js         # Image upload
│       ├── users/route.js          # User CRUD (admin only)
│       ├── activity-logs/route.js  # Activity logs (admin only)
│       └── user/route.js           # Current user settings
├── components/
│   ├── AppLayout.js           # Main layout with sidebar
│   ├── Sidebar.js             # Navigation
│   ├── Header.js              # Page headers
│   ├── Modal.js               # Reusable modal
│   └── AuthProvider.js        # NextAuth provider
└── lib/
    ├── db.js                  # Database connection & init
    └── activityLog.js         # Activity logging helper

database/
├── service-parts.db           # SQLite database (gitignored)
└── schema.js                  # Schema documentation

public/uploads/                # Uploaded part images (gitignored)
```

## Database Tables

1. **users** - Authentication (username, password_hash, is_admin)
2. **categories** - Part categories (TV, Refrigerator, etc.)
3. **locations** - Storage locations (shelves, warehouses)
4. **parts** - Inventory (name, category, location, serial, prices, stock, supplier, has_guarantee, image_path)
5. **part_locations** - Multi-warehouse stock tracking (part_id, location_id, quantity, min_stock_level)
6. **customers** - Customer records (name, surname, phone, email, address, notes)
7. **service_records** - Repair jobs with status tracking
8. **sales** - Transactions (part, customer, quantity, unit_price, labour_cost, guarantee_included, location_id)
9. **purchases** - Stock acquisition records (includes location_id)
10. **stock_transfers** - Inter-warehouse transfers (part_id, from_location_id, to_location_id, quantity, notes)
11. **activity_logs** - User activity audit trail (username, action, entity_type, entity_id, entity_name, details)

## Key Business Logic

### Stock Management
- Sales automatically decrement stock
- Deleting sales restores stock
- Purchases automatically increment stock
- Deleting purchases decrements stock

### Multi-Warehouse Inventory
- Parts can have stock in multiple locations (warehouses)
- `part_locations` table tracks quantity per location
- Sales require selecting a source location (if part has multiple locations)
- Purchases can specify a destination location
- Stock transfers move inventory between locations atomically
- Dashboard shows stock breakdown by location
- Low stock alerts are per-location

### Stock Flow
```
Sale → UPDATE part_locations SET quantity = quantity - X
       WHERE part_id = ? AND location_id = ?
       (Also updates parts.quantity_in_stock for backward compatibility)

Purchase → INSERT/UPDATE part_locations
           (Upserts quantity at specified location)

Transfer → Decrements source location, increments destination
           (Atomic transaction, recorded in stock_transfers table)
```

### Guarantee System
When `guarantee_included = true`:
- Part price becomes €0
- Customer pays only labour_cost
- Stock still deducted

### Price Calculation
```
total_price = (unit_price × quantity) + labour_cost
If guarantee: total_price = labour_cost only
```

### Image Upload
- Parts can have one image attached
- Images stored in `public/uploads/`
- Max file size: 5MB
- Allowed formats: JPEG, PNG, GIF, WebP
- Upload API: `POST /api/upload` (multipart form data)

### User Management
- First user is automatically admin
- Only admins can create/edit/delete users
- Users have equal access to all features (except user management & logs)
- Admin status stored in `is_admin` column
- Session includes `isAdmin` flag for frontend checks
- Cannot delete last admin or yourself

### Activity Logging
- All create/update/delete actions are logged automatically
- Logs include: timestamp, username, action, entity type, entity name, details
- Viewable at /activity-logs (admin only)
- Logged entities: parts, customers, sales, purchases
- Filterable by user, action type, entity type
- Paginated (50 per page)

## API Conventions

All endpoints in `src/app/api/` follow REST patterns:
- `GET` - List/fetch
- `POST` - Create
- `PUT` - Update
- `DELETE` - Remove

Response format: `{ success: true, data: ... }` or `{ error: "message" }`

## Styling Conventions

- Dark theme with CSS custom properties in `globals.css`
- Purple/blue gradient accents
- Card-based layouts
- Use existing CSS classes from globals.css
- Lucide React for icons

## Common Commands

```bash
npm run dev      # Development server (localhost:3000)
npm run build    # Production build
npm start        # Start production server
```

## Deployment

VPS deployment via Git:
```bash
cd ~/service-parts
git pull origin main
npm run build
pm2 restart service-parts
```

## Default Credentials

- Username: `demo`
- Password: `demo`
- Role: Admin (first user)
