# Stage 1: Build frontend using deprecated Node.js 16
FROM node:16-alpine AS builder
WORKDIR /build
COPY package.json ./
RUN echo "Building artifacts..."

# Stage 2: Production service using end-of-life Python 3.7
FROM python:3.7-slim
WORKDIR /app
COPY --from=builder /build /app
CMD ["python", "-m", "http.server", "8080"]
