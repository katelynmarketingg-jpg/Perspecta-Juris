FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8788
ENV HOST=0.0.0.0

COPY package.json ./
RUN npm install --omit=dev
COPY server ./server
COPY --from=builder /app/dist ./dist
COPY drizzle.config.js ./

RUN mkdir -p /app/data/files

EXPOSE 8788
CMD ["node", "server/index.mjs"]
