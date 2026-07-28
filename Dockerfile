# Pin to the Node version declared in .nvmrc / .tool-versions.
FROM node:22.22.2-alpine

# Install system dependencies:
# - dumb-init: proper PID 1 / signal handling
# - openssl + libc6-compat: required by Prisma's query engine on Alpine (musl)
# Add the non-privileged deploy user in the same layer.
RUN apk --no-cache --quiet add \
  dumb-init \
  openssl \
  libc6-compat && \
  adduser -D -g '' deploy

WORKDIR /app

# Copy the files needed to resolve dependencies first so this layer is cached
# until they change. The vendored Yarn 4 release (.yarn/releases) + .yarnrc.yml
# (yarnPath) mean the image's bundled Yarn delegates to the pinned Yarn 4.
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn

# Install against the immutable lockfile, then drop the download cache.
RUN yarn install --immutable && yarn cache clean

# Copy the rest of the application code.
COPY --chown=deploy:deploy . /app

# Generate the Prisma client and build the Next.js app, then hand ownership of
# the built tree to the deploy user.
RUN yarn prisma:generate && \
  yarn build && \
  chown -R deploy:deploy ./

# Switch to the less-privileged user.
USER deploy

ENTRYPOINT ["/usr/bin/dumb-init", "./scripts/load_secrets_and_run.sh"]
CMD ["yarn", "start"]
