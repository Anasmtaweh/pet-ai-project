FROM node:18-alpine

# Install build tools
RUN apk add --no-cache make gcc g++ python3

# Enable Corepack with EXACT yarn version from package.json
RUN corepack enable && \
    corepack prepare "yarn@4.7.0+sha512.5a0afa1d4c1d844b3447ee3319633797bcd6385d9a44be07993ae52ff4facabccafb4af5dcd1c2f9a94ac113e5e9ff56f6130431905884414229e284e37bb7c9" --activate

WORKDIR /app

COPY package.json yarn.lock ./

# Install dependencies using pinned Yarn version
RUN yarn install --immutable

COPY . .

EXPOSE 3001
CMD ["yarn", "start"]