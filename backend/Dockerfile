# Updated Dockerfile (backend/Dockerfile)
FROM node:18-alpine

# Install build tools and Python for native dependencies
RUN apk add --no-cache make gcc g++ python3 curl

# Configure Yarn before installing dependencies
WORKDIR /app

# Copy critical Yarn config FIRST
COPY .yarnrc.yml .
COPY package.json yarn.lock ./

# Install Yarn 4.7.0 explicitly and activate
RUN corepack enable && \
    corepack prepare yarn@4.7.0 --activate

# Install production dependencies with frozen lockfile
RUN yarn install --immutable && yarn workspaces focus --production

# Copy application code
COPY . .

EXPOSE 3001
CMD ["yarn", "start"]