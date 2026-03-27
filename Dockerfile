FROM node:22-alpine
WORKDIR /app

COPY api/package*.json ./
RUN npm install --ignore-scripts

COPY api/ .

# Do NOT set PORT — Cloud Run injects it automatically as 8080
# The app reads process.env.PORT which defaults to 8080 in config/index.ts
EXPOSE 8080
CMD ["npx", "tsx", "src/index.ts"]
