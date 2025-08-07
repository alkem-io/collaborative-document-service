# Alpine images are significantly smaller than their slim or full counterparts, reducing the overall image size.
FROM node:22.17.1-alpine AS builder

WORKDIR /usr/src/app

COPY package.json pnpm-lock.yaml ./

# Combining multiple RUN commands reduces the number of layers in the Docker image, which helps optimize the image size and build time.
# Each RUN command creates a new layer, so minimizing the number of layers is a best practice.
RUN npm install -g pnpm@10.14.0 && pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build

# Alpine images are significantly smaller than their slim or full counterparts, reducing the overall image size.
FROM node:22.17.1-alpine

WORKDIR /usr/src/app

COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/package.json ./package.json
COPY --from=builder /usr/src/app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /usr/src/app/config.yml ./config.yml

# Re-install dependencies in the final stage
# This step is crucial for pnpm. We install only production dependencies
# to keep the image as small as possible.
RUN npm install -g pnpm@10.14.0 && pnpm install --frozen-lockfile --prod

ENV NODE_ENV=production

EXPOSE 4004

CMD ["/bin/sh", "-c", "npm run start:prod NODE_OPTIONS=--max-old-space-size=4096"]
