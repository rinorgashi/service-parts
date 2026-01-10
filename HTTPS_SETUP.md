# How to Enable HTTPS (Secure Lock Icon)

To get HTTPS (the green lock) and enable the camera, you strictly need a **Domain Name** (like `myshop.com`). You cannot get a valid SSL certificate for a raw IP address easily.

## Step 1: Get a Domain Name (approx €10/year)
1. Go to a registrar like **Namecheap**, **GoDaddy**, or **Cloudflare**.
2. Buy a cheap domain (e.g., `myservice-parts.com`).
3. In the domain settings, look for **DNS Management**.
4. Add an **A Record**:
   - **Type**: A
   - **Name/Host**: @ (or leave blank)
   - **Value/Target**: Your VPS IPv4 Address (e.g., `1.2.3.4`)
   - **TTL**: Automatic or 3600

*Wait 15-30 minutes for this to propagate.*

---

## Step 2: Install Nginx (The Web Server)
Connect to your VPS (`ssh root@YOUR_IP`) and run:

```bash
# 1. Install Nginx
apt update
apt install -y nginx

# 2. Start Nginx
systemctl start nginx
systemctl enable nginx
```

If you go to `http://YOUR_DOMAIN.com` now, you should see "Welcome to nginx".

---

## Step 3: Configure Nginx to show your App
We need to tell Nginx to send traffic to your app running on port 3000.

1. Create a config file:
```bash
nano /etc/nginx/sites-available/service-parts
```

2. Paste this content (Right-click to paste):
   **Replace `your-domain.com` with your actual domain!**

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

3. Save and Exit:
   - Press `Ctrl + X`
   - Press `Y`
   - Press `Enter`

4. Activate the site:
```bash
# Remove default site
rm /etc/nginx/sites-enabled/default

# Enable your site
ln -s /etc/nginx/sites-available/service-parts /etc/nginx/sites-enabled/

# Test configuration (should say "successful")
nginx -t

# Restart Nginx
systemctl restart nginx
```

Now visiting `http://your-domain.com` should show your Service Parts app!

---

## Step 4: Get Free SSL (HTTPS) with Certbot

```bash
# 1. Install Certbot
apt install -y certbot python3-certbot-nginx

# 2. Request Certificate
certbot --nginx -d your-domain.com -d www.your-domain.com
```

- It will ask for your email (for renewal warnings).
- Type `Y` to agree to terms.
- It might ask to "Redirect HTTP to HTTPS". Choose **2 (Redirect)**.

---

## 🎉 Success!
1. Go to `https://your-domain.com`
2. You will see the **Lock Icon**.
3. **The Camera Scanner will now work!**

---

## Troubleshooting
If `certbot` fails, check:
1. Did you replace `your-domain.com` in the Nginx config?
2. Did you set up the DNS A Record correctly?
3. try `ping your-domain.com` on your computer to see if it replies with your VPS IP.
