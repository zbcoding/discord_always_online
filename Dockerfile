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

# Health check - verify the app is responding on port 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=5 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Start the application
CMD ["node", "index.js"]
