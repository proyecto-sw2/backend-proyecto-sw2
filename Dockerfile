FROM node:20-alpine

WORKDIR /app

# Copiar archivos de dependencias
COPY package.json yarn.lock ./

# Instalar todas las dependencias
RUN yarn install --frozen-lockfile

# Copiar código fuente
COPY . .

# Compilar la aplicación
RUN yarn build

# Exponer el puerto
EXPOSE 3000

# Comando para iniciar la aplicación
CMD ["node", "dist/main"]