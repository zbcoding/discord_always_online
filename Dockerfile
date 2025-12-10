# Use official Node.js LTS (Long Term Support) image
FROM node:20-alpine

# Create app directory
WORKDIR /app

# Create a non-root user and group
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application files
COPY --chown=nodejs:nodejs . .

# Switch to non-root user
USER nodejs

# Expose port (default 3000, can be overridden with PORT env var)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=5m --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://localhost:${PORT:-3000}').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Start the application
CMD ["node", "index.js"]
