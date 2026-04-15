FROM node:22-alpine AS base
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --production 2>/dev/null || npm install --production

# Copy agent files
COPY oad.yaml ./
COPY .env* ./
COPY prompts/ ./prompts/ 2>/dev/null || true

EXPOSE 3000

CMD ["npx", "opc", "run"]
