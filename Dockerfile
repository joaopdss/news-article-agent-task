FROM node:18 AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

FROM node:18-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./

RUN npm ci --only=production && npm install dotenv

COPY --from=builder /app/dist ./dist

EXPOSE 3000

USER node

# Command to run the application
CMD ["node", "dist/index.js"] 