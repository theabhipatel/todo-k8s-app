FROM node:22-alpine AS builder

WORKDIR /app

COPY . . 

RUN npm install

RUN npm run build

# second Stage

FROM node:22-alpine

WORKDIR /app

COPY package*.json .

RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 3100

CMD ["node", "dist/index.js"]