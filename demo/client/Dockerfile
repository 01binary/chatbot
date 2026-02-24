FROM node:18-alpine AS build
WORKDIR /app

# Install deps and build
COPY package.json package-lock.json* ./
COPY vite.config.js ./
COPY public ./public
COPY src ./src
COPY few-shot.json ../few-shot.json
COPY ../system-prompt.md ../system-prompt.md
RUN npm install
RUN npm run build

FROM nginx:stable-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
