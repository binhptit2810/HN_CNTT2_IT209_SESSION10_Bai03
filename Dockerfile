# ========================================================
# Dockerfile - Multi-stage Build & Layer Caching
# Stage 1 (builder): Cài đặt dependencies và chuẩn bị artifact
# Stage 2 (runtime): Image siêu nhẹ chứa artifact chạy production
# ========================================================

# ----------------- STAGE 1: BUILDER -----------------
FROM node:18-alpine AS builder

WORKDIR /app

# Tối ưu Build Cache: Copy tệp khai báo phụ thuộc trước
# Docker sẽ cache layer này nếu package.json không đổi
COPY package*.json ./

# Cài đặt dependencies phục vụ production và dọn dẹp cache npm
RUN npm install --omit=dev && npm cache clean --force

# Copy toàn bộ mã nguồn vào builder
COPY . .

# ----------------- STAGE 2: RUNTIME -----------------
FROM node:18-alpine

WORKDIR /app

# Thiết lập môi trường Production
ENV NODE_ENV=production
ENV PORT=3000

# Chỉ copy những file thực sự cần thiết từ builder stage
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server.js ./

# Mở cổng ứng dụng
EXPOSE 3000

# Khởi chạy ứng dụng
CMD ["node", "server.js"]
