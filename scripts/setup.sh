#!/bin/bash

# Exit if any subcommand fails
set -e

# One-shot local setup for Artsy engineers. Installs language + JS dependencies
# and pulls the shared local configuration from Citadel (S3) so you don't have
# to fill in secrets by hand.
#
# Run like:
#   yarn setup:artsy
#
# Requires AWS S3 access to the artsy-citadel bucket.

if command -v mise >/dev/null; then
  echo "Installing language dependencies with mise..."
  mise install
else
  echo "Skipping language dependencies (mise not found; see .tool-versions)."
fi

echo "Installing dependencies..."
yarn install

echo "Updating .env.local (shared configuration from Citadel)..."
aws s3 cp s3://artsy-citadel/orbit/.env.local ./ ||
  echo "Unable to download shared configuration — ensure you have S3 access to artsy-citadel."

# Prisma's CLI reads a plain .env, not .env.local, so keep a copy in sync.
if [ -f .env.local ]; then
  cp .env.local .env
  echo "Copied .env.local to .env (for the Prisma CLI)."
fi

echo "Setup complete! Next:
  yarn db:up            # start Postgres
  yarn prisma:migrate   # apply migrations
  yarn seed             # seed sample data
  yarn dev              # start the app"
