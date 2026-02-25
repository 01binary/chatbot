FROM node:18-alpine
WORKDIR /app

# Install dependencies
COPY server/package.json server/package-lock.json* ./
RUN npm install --production

# Copy app source
COPY server/index.js ./

EXPOSE 3001
CMD ["node", "index.js"]
