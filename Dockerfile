# =========================
# STAGE 1 — deps
# =========================
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# =========================
# STAGE 2 — build
# =========================
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Variáveis públicas (se forem necessárias em build-time)
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_EVOLUTION_API_URL
ARG NEXT_PUBLIC_EVOLUTION_API_KEY

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_EVOLUTION_API_URL=$NEXT_PUBLIC_EVOLUTION_API_URL
ENV NEXT_PUBLIC_EVOLUTION_API_KEY=$NEXT_PUBLIC_EVOLUTION_API_KEY

RUN npm run build

# =========================
# STAGE 3 — runner
# =========================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Copia o standalone gerado pelo Next
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# Se tiver pasta public, copie também (se não existir, não tem problema)
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]