FROM node:24.22.2-bookworm-slim

ENV COREPACK_HOME=/home/node/.cache/node/corepack
ENV HOME=/home/node

RUN corepack enable \
  && mkdir -p "$COREPACK_HOME" \
  && corepack prepare pnpm@12.16.1 --activate \
  && chown -R node:node /home/node

WORKDIR /workspace

COPY docker/dev-entrypoint.sh /usr/local/bin/dev-entrypoint
RUN chmod 755 /usr/local/bin/dev-entrypoint \
  && chown node:node /workspace

# The entrypoint starts as root only long enough to hand the named volumes to
# the node user, then continues as that user.
USER root

ENTRYPOINT ["dev-entrypoint"]
CMD ["pnpm", "--filter", "@culture-space/api", "dev"]
