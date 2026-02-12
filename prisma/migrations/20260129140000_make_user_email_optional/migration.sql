-- Make User.email optional so users can be created without email (empty string from frontend stored as NULL)
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;
