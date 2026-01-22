# Service Parts Management System

A comprehensive web application designed for service centers to manage inventory, track repairs, handle sales, and maintain customer records. Built with Next.js and SQLite.

## 🚀 Features

### 📦 Inventory Management
- **Detailed Part Tracking**: Manage parts with attributes like category, serial number, location, and pricing (purchase/selling).
- **Multi-Location Support**: Track stock levels across different warehouses or storage locations (`part_locations`).
- **Stock Transfers**: Record and track movement of inventory between locations.
- **Low Stock Alerts**: Define minimum stock levels to trigger replenishment needs.
- **Categorization**: Organize parts into user-defined categories.

### 🛠️ Service & Repair Tracking
- **Service Records**: Create and manage service jobs linked to specific customers.
- **Job Details**: Record product models, serial numbers, reported issues, and repair status (e.g., Pending, Completed).
- **Integration**: Link used parts and sales directly to service records.

### 👥 Customer Management
- **Customer Database**: Store contact details (phone, email, address) and notes for each client.
- **History**: View service and purchase history for individual customers.

### 💰 Sales & Purchases
- **Sales Processing**: Record sales of parts, including labour costs and guarantee details.
- **Purchase Orders**: Track incoming stock from suppliers with cost analysis.
- **Financial Tracking**: Monitor unit costs, selling prices, and margins.

### 🛡️ Administration & Security
- **User Authentication**: Secure login system with role-based access (Admin/User).
- **User Management**: Admins can manage system users.
- **Activity Logging**: Comprehensive audit trail of user actions (`activity_logs`) for security and accountability.
- **Settings**: Configurable application settings.

## 🏗️ Technical Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **Language**: JavaScript (ES6+)
- **Database**: [SQLite](https://www.sqlite.org/) (via `better-sqlite3`)
- **Authentication**: [NextAuth.js](https://next-auth.js.org/)
- **UI Components**: React 19, Lucide React (Icons)
- **Styling**: CSS Modules

## 📂 Project Structure

```
├── src/
│   ├── app/                 # Next.js App Router pages and API routes
│   │   ├── api/             # Backend API endpoints
│   │   ├── inventory/       # Inventory management pages
│   │   ├── services/        # Service record pages
│   │   ├── sales/           # Sales interface
│   │   └── ...              # Other feature pages
│   ├── components/          # Reusable React components (Sidebar, Layout, etc.)
│   └── lib/                 # Utilities and database connection (db.js)
├── database/                # SQLite database file and schema
└── public/                  # Static assets
```

## 🔌 API Endpoints

The application exposes a RESTful API for frontend consumption:

- `/api/auth/*` - Authentication handling
- `/api/parts` - CRUD operations for parts
- `/api/customers` - Customer management
- `/api/service-records` - Service job tracking
- `/api/sales` & `/api/purchases` - Transaction management
- `/api/stock-transfer` - Inventory movement
- `/api/stats` - Dashboard statistics

## 💾 Database Schema

The data model uses a relational structure with SQLite:
- **Core**: `parts`, `customers`, `users`
- **Transactions**: `sales`, `purchases`, `service_records`
- **Inventory Extensions**: `locations`, `part_locations`, `stock_transfers`
- **System**: `activity_logs`, `categories`

## 🔑 Getting Started & Access

### Default Login
The application comes with a pre-configured administrator account:
- **Username:** `demo`
- **Password:** `demo`

> **⚠️ Security Warning:** Please create a new admin user and delete this default `demo` account immediately after your first successful login.

### 🚀 Deployment Guide

#### 1. Push Changes (Local)
To save your local changes and upload them to your repository:
```bash
# 1. Stage all changes
git add .

# 2. Commit changes with a description
git commit -m "Description of your changes"

# 3. Push to remote server
git push origin main
```

#### 2. Update Server (VPS)
To update the live application on your Hetzner VPS (`195.201.95.159`):

**1. Connect to your VPS:**
```bash
ssh root@195.201.95.159
```

**2. Navigate to your project folder:**
```bash
cd service-parts
```

**3. Download the latest changes:**
```bash
git pull
```

**4. Rebuild and Restart:**
```bash
# Install any new dependencies
npm install

# Rebuild the Next.js application
npm run build

# Restart the application (example using PM2)
pm2 restart parts-server
# OR using systemd
# systemctl restart parts-server
```
