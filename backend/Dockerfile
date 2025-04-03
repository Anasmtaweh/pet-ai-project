# Updated Dockerfile (backend/Dockerfile)
FROM node:18-alpine

# Install build tools
RUN apk add --no-cache make gcc g++ python3

# Install Yarn via Corepack (simplified)
RUN corepack enable && \
    corepack prepare yarn@4.7.0 --activate

WORKDIR /app

COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install --immutable

COPY . .

EXPOSE 3001
CMD ["yarn", "start"]