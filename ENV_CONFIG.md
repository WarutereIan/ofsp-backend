# Environment Configuration

**Create a `.env` file in the backend root directory with these variables:**

---

## Required Configuration

Copy this template into your `.env` file and update the values:

```env
# ============================================
# APPLICATION
# ============================================
NODE_ENV=development
PORT=3000
API_PREFIX=api/v1

# ============================================
# DATABASE
# ============================================
# PostgreSQL connection string
# Format: postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=SCHEMA
DATABASE_URL="postgresql://jirani_user:your_password@localhost:5432/jirani_ofsp?schema=public"

# ============================================
# JWT AUTHENTICATION
# ============================================
# IMPORTANT: Change these to strong random strings in production
# Generate secrets: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=your-super-secret-jwt-key-change-in-production-12345
JWT_EXPIRATION=7d

JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-in-production-67890
JWT_REFRESH_EXPIRATION=30d

# ============================================
# CORS
# ============================================
# Comma-separated list of allowed origins
CORS_ORIGIN=http://localhost:5173,http://localhost:3000,http://localhost:5174

# ============================================
# RATE LIMITING
# ============================================
THROTTLE_TTL=60
THROTTLE_LIMIT=100

# ============================================
# FILE UPLOAD
# ============================================
MAX_FILE_SIZE=10485760
UPLOAD_DESTINATION=./uploads

# ============================================
# S3-COMPATIBLE STORAGE (Optional - e.g. MinIO)
# ============================================
# When set, images are uploaded to S3 instead of local disk.
# Works with MinIO, AWS S3, or any S3-compatible API.
# MinIO quick start: docker run -p 9000:9000 -p 9001:9001 minio/minio server /data --console-address ":9001"
# S3_ENDPOINT=http://localhost:9000
# S3_BUCKET=uploads
# S3_ACCESS_KEY=minioadmin
# S3_SECRET_KEY=minioadmin
# S3_REGION=us-east-1
# S3_FORCE_PATH_STYLE=true
# Public URL for stored objects (required for correct img src). Use MinIO console or nginx to make bucket public.
# S3_PUBLIC_URL=http://localhost:9000/uploads

# ============================================
# SMS/NOTIFICATIONS (Optional)
# ============================================
SMS_API_KEY=
SMS_API_URL=
SMS_SENDER_ID=JIRANI-OFSP

# ============================================
# WEB PUSH NOTIFICATIONS (VAPID Keys)
# ============================================
# Generate VAPID keys using: npx web-push generate-vapid-keys
# Or use online tool: https://web-push-codelab.glitch.me/
# Format: Base64 URL-safe encoded strings
VAPID_PUBLIC_KEY=your-vapid-public-key-here
VAPID_PRIVATE_KEY=your-vapid-private-key-here
VAPID_SUBJECT=mailto:admin@ofsp.com

# ============================================
# EMAIL NOTIFICATIONS (Resend)
# ============================================
# Get API key from https://resend.com/api-keys
# FROM must be a verified domain in Resend (e.g. notifications@yourdomain.com)
RESEND_API_KEY=re_your_api_key_here
RESEND_FROM_EMAIL=notifications@yourdomain.com

# ============================================
# PAYMENT GATEWAY (Optional)
# ============================================
# M-Pesa/Safaricom
MPESA_CONSUMER_KEY=
MPESA_CONSUMER_SECRET=
MPESA_SHORTCODE=
MPESA_PASSKEY=
MPESA_CALLBACK_URL=

# ============================================
# EMAIL (Optional)
# ============================================
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@jirani-ofsp.com

# ============================================
# LOGGING & MONITORING (Optional)
# ============================================
LOG_LEVEL=debug
SENTRY_DSN=

# ============================================
# REDIS (Optional - for caching)
# ============================================
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

---

## 🔒 Security Best Practices

### JWT Secrets

**Generate strong secrets:**

```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Using OpenSSL
openssl rand -hex 32
```

**Use different secrets for:**
- `JWT_SECRET` (access tokens)
- `JWT_REFRESH_SECRET` (refresh tokens)

### Database Credentials

- Use strong passwords
- Never commit `.env` to version control
- Use different credentials for production

---

## 🌍 Environment-Specific Configurations

### Development (`.env`)

```env
NODE_ENV=development
PORT=3000
DATABASE_URL="postgresql://localhost:5432/jirani_ofsp_dev"
CORS_ORIGIN=http://localhost:5173
LOG_LEVEL=debug
```

### Production (`.env.production`)

```env
NODE_ENV=production
PORT=8080
DATABASE_URL="postgresql://prod_user:strong_password@prod-db-host:5432/jirani_ofsp_prod?sslmode=require"
CORS_ORIGIN=https://jirani-ofsp.com,https://www.jirani-ofsp.com
LOG_LEVEL=info
```

### Testing (`.env.test`)

```env
NODE_ENV=test
PORT=3001
DATABASE_URL="postgresql://localhost:5432/jirani_ofsp_test"
JWT_SECRET=test-secret
JWT_REFRESH_SECRET=test-refresh-secret
```

---

## ✅ Verification

After setting up your `.env` file:

1. **Verify database connection:**
```bash
npx prisma db push
```

2. **Test environment loading:**
```bash
npm run start:dev
```

3. **Check logs for:**
```
🚀 Application is running on: http://localhost:3000/api/v1
📚 API Documentation: http://localhost:3000/api/docs
🗄️  Database: localhost:5432/jirani_ofsp
```

---

## 🐛 Troubleshooting

### "Environment variable not found: DATABASE_URL"

**Solution:** Ensure `.env` file exists in the backend root directory.

### "Can't reach database server"

**Solutions:**
1. Check PostgreSQL is running: `pg_isready`
2. Verify `DATABASE_URL` format
3. Check firewall/port 5432 access

### "JWT secret not configured"

**Solution:** Set `JWT_SECRET` and `JWT_REFRESH_SECRET` in `.env`

---

## 📝 Notes

- The `.env` file is gitignored for security
- Never share your `.env` file or commit it to version control
- Use environment-specific files for different deployments
- Update secrets regularly in production
- Keep a secure backup of production `.env` file

---

**Need help? Check the main README.md or SETUP_GUIDE.md**
