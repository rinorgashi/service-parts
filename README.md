# Service Parts Management System

A comprehensive inventory management web application for home appliance service departments.

## Features

- **Secure Login** - Protected with username/password authentication
- **Parts Inventory** - Manage parts with serial numbers, categories, pricing, stock levels
- **Camera Scanning** - Scan serial numbers using your phone camera
- **Custom Categories** - Add your own part categories
- **Customer Management** - Track customer information and contact details
- **Sales Tracking** - Record sales with automatic stock updates
- **Labour Costs** - Add service/labour charges to sales
- **Guarantee Support** - When guarantee is included, part is free (customer only pays labour)
- **Service Records** - Track appliance repairs with model and serial numbers
- **Stock Purchases** - Add new stock when you buy parts
- **Low Stock Alerts** - Visual warnings for items below minimum stock level

---

## Quick Start

### Prerequisites
- Node.js 18+ installed ([Download here](https://nodejs.org/))

### Running Locally

```bash
# Navigate to the project folder
cd service-parts

# Install dependencies (first time only)
npm install

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Authentication

The app is protected with a login system.

### Default Credentials
- **Username:** `demo`
- **Password:** `demo`

### Changing Your Password
1. Log in with the default credentials
2. Click **Settings** in the sidebar
3. Enter your current password
4. Enter a new username and/or password
5. Click **Save Changes**
6. You'll be logged out and can log in with your new credentials

### Security Notes
- All pages are protected - you must log in to access them
- Session expires after 24 hours of inactivity
- For production, set `AUTH_SECRET` environment variable to a strong random string

---

## How to Use

### 1. Adding Parts to Inventory
1. Go to **Parts Inventory** from the sidebar
2. Click **Add Part**
3. Fill in the details (name, category, prices, stock quantity)
4. Use the **Scan** button to capture serial numbers with your camera
5. Click **Add Part** to save

### 2. Managing Categories
1. On the Inventory page, click **Manage Categories**
2. Type a new category name and click **Add**
3. Delete unused categories by clicking the X button

### 3. Recording a Sale
1. Go to **Sales** from the sidebar
2. Click **New Sale**
3. Select a part and customer
4. Enter quantity and adjust price if needed
5. Add **Labour Cost** for service charges
6. Check **Guarantee Included** if part is covered (price becomes €0)
7. Click **Complete Sale** - stock is automatically deducted

### 4. Adding Stock (Purchases)
1. Go to **Purchases** from the sidebar
2. Click **Add Stock**
3. Select the part and enter quantity purchased
4. Stock is automatically added to inventory

---

## Hosting Online (Step by Step)

### Option 1: Vercel (Recommended - Free)

Vercel is the company behind Next.js and offers free hosting.

**Step 1: Create a GitHub repository**
```bash
# In your service-parts folder
git init
git add .
git commit -m "Initial commit"
```

Create a new repository on [GitHub](https://github.com/new), then:
```bash
git remote add origin https://github.com/YOUR_USERNAME/service-parts.git
git branch -M main
git push -u origin main
```

**Step 2: Deploy to Vercel**
1. Go to [vercel.com](https://vercel.com) and sign up with GitHub
2. Click **Add New Project**
3. Import your `service-parts` repository
4. Click **Deploy**
5. Your app will be live at `https://your-project.vercel.app`

> ⚠️ **Note**: SQLite doesn't work well on Vercel's serverless functions. For production, you should:
> - Use a cloud database like [Turso](https://turso.tech/) (SQLite in the cloud) or
> - Use [PlanetScale](https://planetscale.com/) (MySQL) or
> - Use [Supabase](https://supabase.com/) (PostgreSQL)

### Option 2: Railway (Easy, has free tier)

1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Click **New Project** → **Deploy from GitHub repo**
4. Select your repository
5. Railway will auto-detect Next.js and deploy it

### Option 3: Self-Hosting on a VPS

For persistent SQLite database (your current setup), use a VPS:

**Step 1: Get a VPS**
- [DigitalOcean](https://digitalocean.com) - $5/month
- [Hetzner](https://hetzner.com) - €4/month
- [Contabo](https://contabo.com) - €5/month

**Step 2: Set up the server**
```bash
# SSH into your server
ssh root@your-server-ip

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 (keeps app running)
npm install -g pm2

# Clone your repository
git clone https://github.com/YOUR_USERNAME/service-parts.git
cd service-parts

# Install dependencies
npm install

# Build for production
npm run build

# Start with PM2
pm2 start npm --name "service-parts" -- start
pm2 save
pm2 startup
```

**Step 3: Set up a domain (optional)**
1. Buy a domain from Namecheap, GoDaddy, etc.
2. Point the domain to your server IP
3. Install Nginx and set up SSL with Let's Encrypt

---

## Project Structure

```
service-parts/
├── database/              # SQLite database file
├── src/
│   ├── app/
│   │   ├── page.js        # Dashboard
│   │   ├── inventory/     # Parts management
│   │   ├── customers/     # Customer management
│   │   ├── sales/         # Sales tracking
│   │   ├── purchases/     # Stock purchases
│   │   ├── services/      # Service records
│   │   └── api/           # Backend API routes
│   ├── components/        # Reusable UI components
│   └── lib/               # Database connection
└── package.json
```

---

## Backup Your Data

The database is stored in `database/service-parts.db`. To backup:

```bash
# Copy the database file
cp database/service-parts.db database/backup-$(date +%Y%m%d).db
```

---

## Troubleshooting

**Camera not working?**
- Make sure you're using HTTPS (or localhost)
- Grant camera permissions when prompted
- Try a different browser

**Database errors?**
- Delete `database/service-parts.db` to reset (you'll lose all data)
- Tables are auto-created on first run

**Build failed on deployment?**
- Make sure all dependencies are in `package.json`
- Check that Node.js version is 18+

---

## License

MIT License - Feel free to modify and use for your business.
