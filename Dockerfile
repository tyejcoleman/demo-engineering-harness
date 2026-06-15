# Forge — production image. Runtime conversation uses Gemini (API key); platform self-evolution /
# fresh suggestions use Claude Code (CLI) and degrade gracefully when the CLI isn't present in-container.
FROM node:20-slim
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 5178
CMD ["npm", "run", "start"]
