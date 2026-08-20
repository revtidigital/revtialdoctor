FROM node:20-alpine AS builder
WORKDIR /app
# Build tools needed to compile node-canvas from source (no musl prebuilts)
RUN apk add --no-cache python3 make g++ pkgconfig \
    cairo-dev pango-dev libjpeg-turbo-dev giflib-dev freetype-dev
COPY package*.json ./
RUN npm ci --legacy-peer-deps --include=dev
COPY . .
RUN rm -rf node_modules
RUN npm install --legacy-peer-deps --include=dev
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
# Runtime libs for canvas + fonts (Latin + Arabic for UAE winner names)
RUN apk add --no-cache \
    cairo pango libjpeg-turbo giflib freetype fontconfig \
    font-noto font-noto-arabic ttf-freefont \
    && fc-cache -f
RUN npm install -g pm2
COPY package*.json ./
# Skip native build scripts — canvas is copied pre-compiled from builder
RUN npm ci --omit=dev --legacy-peer-deps --ignore-scripts
COPY --from=builder /app/node_modules/canvas ./node_modules/canvas
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY scripts/ ./scripts/
EXPOSE 3000
CMD ["pm2-runtime", "start", "dist/server/server.js", "-i", "2"]
