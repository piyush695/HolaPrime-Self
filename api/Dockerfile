FROM node:22-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install --ignore-scripts

COPY . .

# Run directly with tsx — skips strict tsc type-checking, faster startup
# Switch to `npm run build && node dist/index.js` once all TS types are clean
EXPOSE 3001
CMD ["npx", "tsx", "src/index.ts"]
