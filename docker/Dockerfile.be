FROM node:22-alpine

WORKDIR /app

COPY ./package.json ./package.json

COPY ./package-lock.json ./package-lock.json

COPY . .

RUN npm install

EXPOSE 3000

CMD [ "npm", "run", "start" ]