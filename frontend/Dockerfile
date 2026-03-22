FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

# Build with dynamic rendering for all pages
RUN NEXT_PRIVATE_STANDALONE=true npm run build || true

EXPOSE 3000

# Use production server if build succeeded, fallback to dev
CMD ["sh", "-c", "if [ -f .next/prerender-manifest.json ]; then npm start; else npm run dev; fi"]
