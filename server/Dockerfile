FROM node:24-alpine
WORKDIR /app

# Контекст сборки — корень репозитория (npm workspaces)
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
RUN npm ci --omit=dev --workspace server --include-workspace-root=false

COPY shared shared
COPY server server

WORKDIR /app/server
ENV NODE_ENV=production
EXPOSE 3000
CMD ["sh", "-c", "npm run db:migrate && npm start"]
