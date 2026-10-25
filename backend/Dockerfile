FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY data ./data
RUN mkdir -p /app/uploads
EXPOSE 8080
CMD ["node", "src/server.js"]
