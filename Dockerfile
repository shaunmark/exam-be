# ---------- Stage 1: Build ----------
FROM node:20-alpine AS builder

WORKDIR /app

# Install Yarn
RUN corepack enable

# Install dependencies first (better caching)
COPY package*.json ./
COPY yarn.lock ./
COPY .yarnrc.yml ./

RUN yarn install

# Copy rest of the code
COPY . .

# Generate Prisma client
ARG DATABASE_URL
RUN DATABASE_URL=$DATABASE_URL ./node_modules/.bin/prisma generate

# Build NestJS
RUN yarn build

# Check build output and show errors
RUN ls -la dist/ || echo "No dist folder created"
RUN test -f dist/main.js && echo "Build successful" || (echo "Build failed - running build again to see errors:" && yarn build)


# ---------- Stage 2: Production ----------
FROM node:20-alpine

WORKDIR /app

# Install Yarn
RUN corepack enable

# Copy package files and install dependencies
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/yarn.lock ./
COPY --from=builder /app/.yarnrc.yml ./
RUN yarn install

# Copy built app and Prisma files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Verify the copied files
RUN ls -la dist/ && test -f dist/main.js || (echo "dist/main.js not found after copy" && exit 1)

# Expose port (Railway will override via PORT env)
EXPOSE 3000

# Start app
CMD ["node", "dist/main.js"]