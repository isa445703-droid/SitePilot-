-- Add email confirmation and password reset fields to User model
ALTER TABLE "User" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "emailToken" TEXT;
ALTER TABLE "User" ADD COLUMN "emailTokenExpiry" TIMESTAMPTZ;
ALTER TABLE "User" ADD COLUMN "passwordResetToken" TEXT;
ALTER TABLE "User" ADD COLUMN "passwordResetExpiry" TIMESTAMPTZ;