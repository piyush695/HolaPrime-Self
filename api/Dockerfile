FROM node:22-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install --ignore-scripts

COPY . .

EXPOSE 8080
CMD ["npx", "tsx", "src/index.ts"]
