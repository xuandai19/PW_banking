# Backend - Node.js Express API
FROM node:20-alpine

WORKDIR /app

# curl dùng cho healthcheck
RUN apk add --no-cache curl

# Cài dependencies trước để tận dụng cache layer
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

# Copy source code
COPY . .

# Không copy .env vào image (dùng env từ docker-compose)
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Chờ MySQL sẵn sàng rồi mới start (healthcheck ở compose)
CMD ["node", "app.js"]
