# Backend Setup Guide

**Step-by-step guide to set up the Jirani OFSP Platform backend**

---

## 📋 Prerequisites Checklist

Before starting, ensure you have:

- [ ] **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- [ ] **npm** or **yarn** (comes with Node.js)
- [ ] **PostgreSQL** (v14 or higher) - [Download](https://www.postgresql.org/download/)
- [ ] **Git** (for version control)
- [ ] A code editor (VS Code recommended)

---

## 🚀 Step 1: Install Dependencies

```bash
cd C:\Users\nmwan\projects\jirani-f\ospf\backend\backend

# Install all dependencies
npm install
```

**This installs:**
- NestJS framework
- Prisma ORM
- Passport + JWT authentication
- Swagger documentation
- All required packages

---

## 🗄️ Step 2: Set Up PostgreSQL Database

### Option A: Local PostgreSQL Installation

1. **Install PostgreSQL** if not already installed
2. **Create a new database:**

```sql
-- Connect to PostgreSQL
psql -U postgres

-- Create database
CREATE DATABASE jirani_ofsp;

-- Create user (optional)
CREATE USER jirani_user WITH ENCRYPTED PASSWORD 'your_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE jirani_ofsp TO jirani_user;

-- Exit
\q
```

### Option B: Docker PostgreSQL (Recommended)

```bash
# Run PostgreSQL in Docker
docker run --name jirani-postgres \
  -e POSTGRES_DB=jirani_ofsp \
  -e POSTGRES_USER=jirani_user \
  -e POSTGRES_PASSWORD=your_password \
  -p 5432:5432 \
  -d postgres:14
```

---

## ⚙️ Step 3: Configure Environment Variables

1. **Copy the example environment file:**

```bash
# Create .env file (manually since .env.example is gitignored)
# Copy the content below into a new .env file
```

2. **Create `.env` in the backend root with this content:**

```env
# Application
NODE_ENV=development
PORT=3000
API_PREFIX=api/v1

# Database - UPDATE THIS WITH YOUR DATABASE CREDENTIALS
DATABASE_URL="postgresql://jirani_user:your_password@localhost:5432/jirani_ofsp?schema=public"

# JWT - CHANGE THESE SECRETS IN PRODUCTION
JWT_SECRET=your-super-secret-jwt-key-change-in-production-12345
JWT_EXPIRATION=7d
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-in-production-67890
JWT_REFRESH_EXPIRATION=30d

# CORS - Add your frontend URLs
CORS_ORIGIN=http://localhost:5173,http://localhost:3000

# Rate Limiting
THROTTLE_TTL=60
THROTTLE_LIMIT=100
```

**Important:** 
- Update `DATABASE_URL` with your actual database credentials
- Change JWT secrets to strong random strings in production

---

## 🔧 Step 4: Set Up Prisma & Database

```bash
# Generate Prisma Client from schema
npm run prisma:generate

# Create database tables (run migrations)
npm run prisma:migrate

# Seed database with initial data (optional but recommended)
npm run prisma:seed
```

**Seed data includes:**
- Admin user: `admin@jirani-ofsp.com` (Password: `Admin123!`)
- Sample farmer: `farmer@example.com` (Password: `Admin123!`)
- Sample buyer: `buyer@example.com` (Password: `Admin123!`)
- Sample aggregation center

---

## ▶️ Step 5: Start the Development Server

```bash
# Start in development mode (with hot-reload)
npm run start:dev
```

**You should see:**
```
🚀 Application is running on: http://localhost:3000/api/v1
📚 API Documentation: http://localhost:3000/api/docs
🗄️  Database: localhost:5432/jirani_ofsp
```

---

## ✅ Step 6: Verify Installation

### Test 1: Health Check

Open your browser or use curl:

```bash
curl http://localhost:3000
```

Should return: `Hello World!`

### Test 2: API Documentation

Open in browser:
```
http://localhost:3000/api/docs
```

You should see the interactive Swagger UI.

### Test 3: Login Test

```bash
# Login with seeded admin account
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@jirani-ofsp.com",
    "password": "Admin123!"
  }'
```

Should return:
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "user": { ... },
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc..."
  }
}
```

---

## 🔍 Step 7: Explore Prisma Studio (Optional)

View and edit database data visually:

```bash
npm run prisma:studio
```

Opens at: `http://localhost:5555`

---

## 🛠️ Development Workflow

### Common Commands

```bash
# Start development server (hot-reload)
npm run start:dev

# Build for production
npm run build

# Start production server
npm run start:prod

# Run tests
npm run test

# Lint code
npm run lint

# Format code
npm run format
```

### Database Operations

```bash
# Create new migration (after schema changes)
npx prisma migrate dev --name your_migration_name

# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Re-seed database
npm run prisma:seed

# Open Prisma Studio
npm run prisma:studio
```

---

## 📚 Next Steps

1. **Test API Endpoints:**
   - Use Swagger UI: `http://localhost:3000/api/docs`
   - Or use Postman/Insomnia

2. **Register a New User:**
   - Use `/auth/register` endpoint
   - Test different roles (FARMER, BUYER, etc.)

3. **Explore the Code:**
   - `src/modules/auth/` - Authentication logic
   - `src/modules/users/` - User management
   - `src/common/` - Shared utilities
   - `prisma/schema.prisma` - Database schema

4. **Start Building Features:**
   - Marketplace module
   - Transport module
   - Aggregation module
   - Payment module

---

## 🐛 Troubleshooting

### Issue: "Cannot connect to database"

**Solution:**
1. Verify PostgreSQL is running: `pg_isready`
2. Check `DATABASE_URL` in `.env`
3. Test connection: `psql -U jirani_user -d jirani_ofsp`

### Issue: "Prisma Client not generated"

**Solution:**
```bash
npm run prisma:generate
```

### Issue: "Port 3000 already in use"

**Solution:**
```bash
# Change PORT in .env file
PORT=3001
```

Or kill the process using port 3000:
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:3000 | xargs kill -9
```

### Issue: "Migration failed"

**Solution:**
```bash
# Reset database and re-run migrations
npm run prisma:migrate reset
npm run prisma:migrate
npm run prisma:seed
```

---

## 📖 Additional Resources

- [NestJS Documentation](https://docs.nestjs.com/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [Passport.js Documentation](http://www.passportjs.org/docs/)
- [Swagger/OpenAPI Docs](https://swagger.io/docs/)

---

## ✅ Setup Complete!

You're now ready to develop the Jirani OFSP Platform backend. Happy coding! 🚀

**For questions or issues, refer to the main README.md or contact the development team.**
