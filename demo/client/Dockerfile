FROM node:20-alpine AS build
WORKDIR /app

# Copy root-level config files
COPY few-shot.json .
COPY system-prompt.md .

# Copy client directory
COPY client ./client

WORKDIR /app/client
RUN npm install
RUN npm run build

FROM nginx:stable-alpine
COPY --from=build /app/client/dist /usr/share/nginx/html
COPY client/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
