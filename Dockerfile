# ==========================================
# Fase 1: Build dell'applicazione Angular
# ==========================================
FROM node:20-alpine AS builder
WORKDIR /app

# Copia package.json e installa le dipendenze
COPY package*.json ./
RUN npm install

# Copia tutto il resto e compila per la produzione
COPY . .
RUN npm run build --configuration=production

# ==========================================
# Fase 2: Server Nginx per servire l'app
# ==========================================
FROM nginx:alpine

# Rimuove la pagina di default di nginx
RUN rm -rf /usr/share/nginx/html/*

# Copia la build di Angular (assicurati che il percorso corrisponda al nome in package.json)
COPY --from=builder /app/dist/tool-falegnameria/browser /usr/share/nginx/html

# Aggiunge una configurazione per gestire il routing della Single Page Application
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

ENTRYPOINT ["nginx", "-g", "daemon off;"]
