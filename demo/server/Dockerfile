FROM node:18-alpine
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install --production

# Copy app source
COPY index.js ./

EXPOSE 3001
CMD ["node", "index.js"]
