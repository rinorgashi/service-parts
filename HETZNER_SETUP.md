# Hetzner VPS Setup Guide

This guide will help you set up your Service Parts application on a Hetzner Cloud VPS (Virtual Private Server) from scratch.

## Phase 1: Get the Server

1. **Create an Account**: Go to [Hetzner Cloud](https://console.hetzner.cloud/) and sign up.
2. **Create a Project**: Name it "ServiceParts".
3. **Add a Server**:
   - Click "Add Server".
   - **Location**: Choose one close to you (e.g., Nuremberg, Falkenstein, or Helsinki).
   - **Image**: Select **Ubuntu 24.04** (or latest 22.04/20.04).
   - **Type**: **Shared vCPU** -> **CPX11** (approx €4-5/month). This is powerful enough for this app.
   - **SSH Key**: If you know how to use SSH keys, add yours. If not, don't select one; Hetzner will email you the root password.
   - **Name**: Give it a name like `parts-server`.
   - Click **Create & Buy**.

## Phase 2: Connect to Your Server

You need a terminal to connect.
- **Windows**: Use **PowerShell** or **Command Prompt**.
- **Mac/Linux**: Use **Terminal**.

Run this command (replace `YOUR_SERVER_IP` with the IP address from the Hetzner email/dashboard):

```bash
ssh root@YOUR_SERVER_IP
```

*Note: If asked "Are you sure you want to continue connecting?", type `yes` and press Enter. Then enter the password from the email (you won't see characters while typing).*

## Phase 3: Install Required Software

Run these commands one by one on your server to set up the environment.

### 1. Update the system
```bash
apt update && apt upgrade -y
```

### 2. Install Node.js (Version 20)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | -E bash -
apt install -y nodejs
```

### 3. Install Git and PM2 (Process Manager)
PM2 keeps your app running 24/7.
```bash
apt install -y git
npm install -g pm2
```

## Phase 4: Deploy Your App

### 1. Prepare your Code (On your local computer)
Before deploying, make sure your code is on GitHub.

1. Create a repository on GitHub (e.g., `service-parts`).
2. Push your code:
   ```bash
   # Run these in your local VS Code terminal
   git init
   git add .
   git commit -m "Ready for deploy"
   # Replace with your actual repo URL
   git remote add origin https://github.com/YOUR_USERNAME/service-parts.git
   git push -u origin main
   ```

### 2. Download Code (On the Server)
Back in your **VPS terminal** (SSH session):

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/service-parts.git

# Go into the folder
cd service-parts

# Install dependencies
npm install

# Build the application
npm run build
```

### 3. Start the App
```bash
# Start with PM2
pm2 start npm --name "service-parts" -- start

# Save the list so it auto-starts on reboot
pm2 save
pm2 startup
# (Run the command that 'pm2 startup' outputs if asked)
```

**🎉 Your app is now running!**
You can access it at `http://YOUR_SERVER_IP:3000`.

---

## Phase 5: How to Update Code (Safe Method)

This is the most important part. You want to update the website design/features **without deleting your database** (your customers, parts, sales data).

### How it works
Your database is stored in `database/service-parts.db`.
I have configured the project to **ignore** this file in Git. This means:
1. When you push code changes to GitHub, the database file is NOT sent.
2. When you pull changes on the server, the database file is NOT touched.

### The Update Workflow

**Step 1: On your Computer**
Make your code changes, then push them:
```bash
git add .
git commit -m "Added new features"
git push
```

**Step 2: On the Server**
Connect via SSH (`ssh root@YOUR_IP`) and run:

```bash
cd service-parts

# 1. Download new code
git pull

# 2. Install any new libraries (if needed)
npm install

# 3. Rebuild the app (Next.js needs this)
npm run build

# 4. Restart the app to apply changes
pm2 restart service-parts
```

**That's it!** Your data remains safe in `database/service-parts.db` while the application code around it is updated.

---

## Phase 6: Safety Backups (Recommended)

Since your data is just a file, backing it up is easy. You can download the database to your computer.

**Run this on your LOCAL computer (not the server):**

```bash
# Replace 1.2.3.4 with your server IP
scp root@1.2.3.4:/root/service-parts/database/service-parts.db ./backup-latest.db
```
This copies the live database from the server to your current local folder.

---

## Optional: getting rid of :3000 (Port 80)

To access your site at `http://YOUR_IP` instead of `http://YOUR_IP:3000`:

```bash
# Allow traffic on port 80
iptables -A INPUT -p tcp --dport 80 -j ACCEPT

# Redirect port 80 to 3000
iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-port 3000
```
*(Note: For a professional domain setup with HTTPS, you would typically reinstall with Nginx and Certbot, but the above is the quickest way to get a clean URL for internal use.)*
