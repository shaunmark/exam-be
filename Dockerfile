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
RUN npm run build

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

# Expose port (Railway will override via PORT env)
EXPOSE 3000

# Start app
CMD ["node", "dist/main.js"]