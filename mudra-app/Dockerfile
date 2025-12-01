# ============================================
# PRODUCTION DOCKERFILE - MULTI-STAGE BUILD
# ============================================

# ---------------------------------------------
# Stage 1: Dependencies (Base)
# ---------------------------------------------
FROM node:20-alpine AS deps

# Install system dependencies required for native modules
RUN apk add --no-cache \
    libc6-compat \
    openssl \
    ca-certificates \
    && update-ca-certificates

WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy prisma schema before installing dependencies (needed for postinstall)
COPY prisma ./prisma/

# Install production dependencies only
# Use clean install for reproducible builds
RUN npm ci --only=production --legacy-peer-deps && \
    npm cache clean --force

# ---------------------------------------------
# Stage 2: Builder
# ---------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache \
    libc6-compat \
    openssl \
    ca-certificates \
    python3 \
    make \
    g++

# Copy package files and install ALL dependencies (including dev)
COPY package*.json ./

# Copy prisma schema before installing dependencies (needed for postinstall)
COPY prisma ./prisma/

RUN npm ci --legacy-peer-deps

# Copy prisma schema and generate client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy source code (respects .dockerignore)
COPY . .

# Set build-time environment variables
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV NEXT_TELEMETRY_DISABLED=1

# Build the Next.js application
RUN npm run build

# ---------------------------------------------
# Stage 3: Production Runner
# ---------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

# Install runtime dependencies only
RUN apk add --no-cache \
    libc6-compat \
    openssl \
    ca-certificates \
    dumb-init \
    && update-ca-certificates

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Set environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Copy production dependencies from deps stage
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules

# Copy built application from builder stage
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/package*.json ./
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Copy next.config (if exists)
COPY --from=builder --chown=nextjs:nodejs /app/next.config.* ./

# Ensure prisma client is available
RUN npx prisma generate

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check to ensure container is healthy
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["npm", "start"]
