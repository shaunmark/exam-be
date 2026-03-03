# ---------- Stage 1: Build ----------
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (better caching)
COPY package*.json ./

# Clean up any Yarn PnP remnants
RUN rm -f .pnp.cjs .pnp.loader.mjs

RUN npm install

# Copy rest of the code
COPY . .

# Generate Prisma client
ARG DATABASE_URL
RUN DATABASE_URL=$DATABASE_URL npx prisma generate

# Build NestJS
RUN echo "Starting build..." && npx nest build --verbose || (echo "Build failed with error:" && npx nest build 2>&1 && exit 1)

# Check build output
RUN ls -la dist/ && echo "Dist contents:" || (echo "No dist folder created" && exit 1)
RUN test -f dist/main.js && echo "Build successful - main.js found" || (echo "ERROR: dist/main.js not found" && exit 1)


# ---------- Stage 2: Production ----------
FROM node:20-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/package-lock.json ./

RUN npm install --omit=dev

# Copy built app and Prisma files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Verify the copied files
RUN ls -la dist/ && test -f dist/main.js || (echo "dist/main.js not found after copy" && exit 1)

# Expose port (Railway will override via PORT env)
EXPOSE 3000

# Start app
RUN npm run start