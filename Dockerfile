# Questbound, hosted: one container that builds the game and runs serve.cjs (the Dungeon Master and the table service
# on loopback, the gateway on $PORT). Keep /data on a volume: it holds accounts, saves, sessions, pictures and logs.
# Build:  docker build -t questbound .
# Run:    docker run -p 8080:8080 -v questbound-data:/data -e OPENAI_API_KEY=... -e OPENAI_MODEL=gpt-6-luna \
#           -e QUESTBOUND_PUBLIC_ORIGIN=https://play.example.com questbound
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx expo export --platform web --output-dir dist-phone
ENV NODE_ENV=production PORT=8080 QUESTBOUND_DATA=/data
# The game runs as an ordinary user: it can write only to /data, never to its own code.
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 8080
CMD ["node","serve.cjs"]
