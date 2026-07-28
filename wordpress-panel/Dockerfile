FROM node:18-alpine

WORKDIR /app

# Install Docker CLI inside the container for dockerode to work
RUN apk add --no-cache docker-cli

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]