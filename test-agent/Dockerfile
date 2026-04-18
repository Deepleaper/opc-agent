FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --production 2>/dev/null || npm install --production
COPY oad.yaml agent.yaml .env* ./
COPY src/ ./src/
COPY prompts/ ./prompts/ 2>/dev/null || true
EXPOSE 3000
CMD ["npx", "opc", "run"]
