# Service Parts Management System

A full-stack inventory management application for home appliance repair businesses.

## Purpose

Helps repair shops manage spare parts inventory, customers, sales, purchases, and service records. Key business features include guarantee handling (parts free, labor charged) and automatic stock management.

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
│   ├── page.js              # Dashboard
│   ├── inventory/page.js    # Parts inventory management
│   ├── customers/page.js    # Customer management
│   ├── sales/page.js        # Sales transactions
│   ├── purchases/page.js    # Stock purchases
│   ├── services/page.js     # Service/repair records
│   ├── settings/page.js     # User settings
│   ├── login/page.js        # Authentication
│   └── api/                 # REST API endpoints
│       ├── auth/[...nextauth]/route.js
│       ├── parts/route.js
│       ├── customers/route.js
│       ├── sales/route.js
│       ├── purchases/route.js
│       ├── service-records/route.js
│       ├── categories/route.js
│       ├── locations/route.js
│       ├── stats/route.js
│       ├── upload/route.js       # Image upload endpoint
│       ├── users/route.js        # User management (admin only)
│       └── user/route.js
├── components/
│   ├── AppLayout.js         # Main layout with sidebar
│   ├── Sidebar.js           # Navigation
│   ├── Header.js            # Page headers
│   ├── Modal.js             # Reusable modal
│   └── AuthProvider.js      # NextAuth provider
└── lib/
    └── db.js                # Database connection & init

database/
├── service-parts.db         # SQLite database (gitignored)
└── schema.js                # Schema documentation

public/uploads/              # Uploaded part images (gitignored)
```

## Database Tables

1. **users** - Authentication (username, password_hash, is_admin)
2. **categories** - Part categories (TV, Refrigerator, etc.)
3. **locations** - Storage locations (shelves, warehouses)
4. **parts** - Inventory (name, category, location, serial, prices, stock, supplier, has_guarantee, image_path)
5. **customers** - Customer records
6. **service_records** - Repair jobs with status tracking
7. **sales** - Transactions (part, customer, quantity, unit_price, labour_cost, guarantee_included)
8. **purchases** - Stock acquisition records
9. **activity_logs** - User activity audit trail (username, action, entity_type, entity_id, details)

## Key Business Logic

### Stock Management
- Sales automatically decrement stock
- Deleting sales restores stock
- Purchases automatically increment stock
- Deleting purchases decrements stock

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
- Users have equal access to all features
- Admin status stored in `is_admin` column
- Session includes `isAdmin` flag for frontend checks

### Activity Logging
- All create/update/delete actions are logged
- Logs include: username, action, entity type, entity name, details
- Viewable at /activity-logs (admin only)
- Logged entities: parts, customers, sales, purchases

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

## Common Commands

```bash
npm run dev      # Development server
npm run build    # Production build
npm start        # Start production server
```

## Default Credentials

- Username: `demo`
- Password: `demo`
