# Use official Node.js LTS (Long Term Support) image
FROM node:20-alpine

# Install curl for health checks
RUN apk add --no-cache curl

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

# Health check - curl is more reliable than node fetch for this
HEALTHCHECK --interval=30m --timeout=10s --retries=5 \
  CMD curl -f http://localhost:3000/ || exit 1

# Start the application
CMD ["node", "index.js"]
