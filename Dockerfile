FROM node:22-alpine
WORKDIR /app

COPY api/package*.json ./
RUN npm ci --ignore-scripts

COPY api/ .

EXPOSE 3001
CMD ["npx", "tsx", "src/index.ts"]
