# Báo Cáo Bài Tập 3: Tối Ưu Hóa Dung Lượng Image & Layer Caching Với Multi-stage Build

## 1. Thông Tin Chung
- **Môn học:** IT209 - DevOps & Cloud Computing
- **Chủ đề:** Tối ưu hóa Docker Image với Multi-stage Build và Layer Caching
- **Thư mục bài làm:** `homework/session_10/ex03/` (hỗ trợ đồng thời `homework/session_10/ex3/`)

---

## 2. Mục Tiêu & Yêu Cầu
- **Mục tiêu:** Sử dụng kỹ thuật **Multi-stage Build** và **Layer Caching** để tối ưu hóa Docker Image của ứng dụng Web Backend cho môi trường Production:
  - Giảm dung lượng Docker Image xuống mức tối thiểu (< 100MB compressed / content size, giảm từ 1.59GB xuống 187MB disk size).
  - Tận dụng triệt để cơ chế **Layer Caching** giúp tăng tốc độ build khi có sự thay đổi mã nguồn.
  - Đảm bảo Image giảm **tối thiểu 50% - 70%** so với phiên bản `single-stage`.
  - Container chạy ổn định và phản hồi chính xác các endpoint API.

---

## 3. Cấu Trúc Thư Mục
```text
ex03/
├── .dockerignore         # Loại trừ node_modules, logs, git, documentation khỏi build context
├── Dockerfile            # Dockerfile Multi-stage Build (Stage 1: builder, Stage 2: runtime)
├── Dockerfile.single     # Dockerfile Single-stage Build (chưa tối ưu, dùng để đối sánh)
├── package.json          # Khai báo dependencies và devDependencies
├── server.js             # Mã nguồn ứng dụng Backend Express API
└── README.md             # Báo cáo kỹ thuật chi tiết và bảng so sánh
```

---

## 4. Phân Tích Kỹ Thuật

### 4.1. Single-stage Build (`Dockerfile.single`)
```dockerfile
FROM node:18

WORKDIR /app

# Vi phạm Layer Caching: copy toàn bộ mã nguồn trước khi cài dependencies
COPY . .

# Cài đặt tất cả dependencies (bao gồm cả devDependencies)
RUN npm install

EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "server.js"]
```
**Nhược điểm của phương pháp Single-stage:**
1. **Base Image quá nặng:** Sử dụng `node:18` (dựa trên Debian Bookworm) có dung lượng gốc lên đến **~1.58GB**. Image này chứa đầy đủ trình biên dịch C/C++, Python, Git, apt package manager... vốn không cần thiết khi chạy ứng dụng thực tế.
2. **Không tận dụng Layer Caching:** Lệnh `COPY . .` được đặt trước `RUN npm install`. Khi nhà phát triển chỉ thay đổi một dòng code logic trong `server.js`, Docker buộc phải hủy bỏ cache từ bước `COPY . .` và thực thi lại toàn bộ bước `npm install`, gây tốn băng thông và thời gian build.
3. **Chứa rác và dependencies thừa:** Cả các thư viện phát triển (`devDependencies`), npm cache, tài liệu, test files đều bị đóng gói vào Image Production, làm phình to dung lượng và gia tăng bề mặt tấn công bảo mật (Attack Surface).

---

### 4.2. Multi-stage Build & Layer Caching (`Dockerfile`)
```dockerfile
# ----------------- STAGE 1: BUILDER -----------------
FROM node:18-alpine AS builder

WORKDIR /app

# Tối ưu Build Cache: Copy manifest dependencies trước
COPY package*.json ./

# Cài đặt production dependencies và dọn dẹp cache
RUN npm install --omit=dev && npm cache clean --force

# Copy toàn bộ mã nguồn vào builder
COPY . .

# ----------------- STAGE 2: RUNTIME -----------------
FROM node:18-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Chỉ copy artifact thành phẩm từ stage builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server.js ./

EXPOSE 3000

CMD ["node", "server.js"]
```
**Ưu điểm vượt trội của Multi-stage Build:**
1. **Tách biệt rõ ràng 2 môi trường:**
   - **Stage 1 (Builder):** Chịu trách nhiệm tải gói, compile, build artifact.
   - **Stage 2 (Runtime):** Chỉ khởi tạo một Image trắng từ `node:18-alpine`, sau đó sử dụng chỉ thị `COPY --from=builder` để bốc riêng các tệp cần thiết (`server.js`, `package*.json`, `node_modules`).
2. **Tối ưu Layer Caching:** Tách riêng `COPY package*.json ./` trước `RUN npm install`. Khi mã nguồn ứng dụng thay đổi mà không sửa file thư viện, Docker tái sử dụng nguyên vẹn layer `RUN npm install` từ cache (`CACHED`), rút ngắn thời gian build từ vài chục giây xuống còn **~0.1 giây**.
3. **Base Image siêu nhẹ:** Sử dụng Alpine Linux với nhân tối giản, không chứa công cụ build thừa thãi.
4. **An toàn bảo mật:** Image Production không chứa trình biên dịch, công cụ phát triển hay mã nguồn kiểm thử.

---

## 5. Bảng So Sánh Chi Tiết

Số liệu đo lường thực tế trên hệ thống Docker Engine (v29.7.2):

| Tiêu Chí So Sánh | `hw-backend:single` | `hw-backend:multistage` | Mức Độ Cải Thiện / Đánh Giá |
| :--- | :---: | :---: | :---: |
| **Base Image** | `node:18` (Debian 12 Bookworm) | `node:18-alpine` (Alpine 3.21) | Nhẹ hơn và tối giản hơn |
| **Dung lượng Disk Usage** | **1.59 GB** (1590 MB) | **187 MB** | **Giảm 88.24%** (Vượt xa chỉ tiêu 50-70%) |
| **Content Size (Compressed)** | **399 MB** | **45.7 MB** | **Giảm 88.55%** (< 100MB chuẩn chỉ tiêu) |
| **Tổng số lượng Layer** | **18 layers** | **17 layers** | Gọn gàng, sạch sẽ |
| **Kích thước các Layer thêm vào** | 21 MB (`RUN npm install`) | 4.84 MB (`node_modules`) + 12.3 KB | Giảm hơn 76% dung lượng ứng dụng |
| **Tận dụng Build Cache khi sửa code** | ❌ Không (phải chạy lại `npm install`) | ✅ Tối đa (`CACHED` toàn bộ dependencies) | Thời gian build giảm từ ~6s còn **~0.1s** |
| **Bề mặt tấn công (Security Attack Surface)** | ⚠️ Cao (chứa apt, curl, python, gcc...) | 🛡️ Cực thấp (chỉ runtime Node.js và thư viện) | Tiêu chuẩn khắt khe cho Production |

---

## 6. Phân Tích Layer Chi Tiết (`docker history`)

### 6.1. Layer của `hw-backend:single`
```text
IMAGE          CREATED         CREATED BY                                      SIZE      COMMENT
bf17a9bc8577   2 minutes ago   CMD ["node" "server.js"]                        0B        buildkit.dockerfile.v0
<missing>      2 minutes ago   ENV NODE_ENV=production                         0B        buildkit.dockerfile.v0
<missing>      2 minutes ago   EXPOSE [3000/tcp]                               0B        buildkit.dockerfile.v0
<missing>      2 minutes ago   RUN /bin/sh -c npm install # buildkit           21MB      buildkit.dockerfile.v0
<missing>      2 minutes ago   COPY . . # buildkit                             16.4kB    buildkit.dockerfile.v0
<missing>      2 minutes ago   WORKDIR /app                                    8.19kB    buildkit.dockerfile.v0
<missing>      18 months ago   CMD ["node"]                                    0B        buildkit.dockerfile.v0
<missing>      18 months ago   ENTRYPOINT ["docker-entrypoint.sh"]             0B        buildkit.dockerfile.v0
<missing>      18 months ago   COPY docker-entrypoint.sh /usr/local/bin/ # …   20.5kB    buildkit.dockerfile.v0
<missing>      18 months ago   RUN /bin/sh -c set -ex   && export GNUPGHOME…   5.41MB    buildkit.dockerfile.v0
<missing>      18 months ago   ENV YARN_VERSION=1.22.22                        0B        buildkit.dockerfile.v0
<missing>      18 months ago   RUN /bin/sh -c ARCH= && dpkgArch="$(dpkg --p…   168MB     buildkit.dockerfile.v0
<missing>      18 months ago   ENV NODE_VERSION=18.20.8                        0B        buildkit.dockerfile.v0
<missing>      18 months ago   RUN /bin/sh -c groupadd --gid 1000 node   &&…   69.6kB    buildkit.dockerfile.v0
<missing>      2 years ago     RUN /bin/sh -c set -ex;  apt-get update;  ap…   619MB     buildkit.dockerfile.v0
<missing>      2 years ago     RUN /bin/sh -c set -eux;  apt-get update;  a…   194MB     buildkit.dockerfile.v0
<missing>      3 years ago     RUN /bin/sh -c set -eux;  apt-get update;  a…   52.2MB    buildkit.dockerfile.v0
<missing>      3 years ago     # debian.sh --arch 'amd64' out/ 'bookworm' '…   133MB     debuerreotype 0.15
```
> **Nhận xét:** Các layer hệ điều hành Debian chiếm tới hơn **1000 MB** (619MB + 194MB + 133MB + 52MB).

---

### 6.2. Layer của `hw-backend:multistage`
```text
IMAGE          CREATED         CREATED BY                                      SIZE      COMMENT
79a7e32f3824   3 minutes ago   CMD ["node" "server.js"]                        0B        buildkit.dockerfile.v0
<missing>      3 minutes ago   EXPOSE [3000/tcp]                               0B        buildkit.dockerfile.v0
<missing>      3 minutes ago   COPY /app/server.js ./ # buildkit               12.3kB    buildkit.dockerfile.v0
<missing>      3 minutes ago   COPY /app/node_modules ./node_modules # buil…   4.84MB    buildkit.dockerfile.v0
<missing>      3 minutes ago   COPY /app/package*.json ./ # buildkit           57.3kB    buildkit.dockerfile.v0
<missing>      3 minutes ago   ENV PORT=3000                                   0B        buildkit.dockerfile.v0
<missing>      3 minutes ago   ENV NODE_ENV=production                         0B        buildkit.dockerfile.v0
<missing>      3 minutes ago   WORKDIR /app                                    8.19kB    buildkit.dockerfile.v0
<missing>      18 months ago   CMD ["node"]                                    0B        buildkit.dockerfile.v0
<missing>      18 months ago   ENTRYPOINT ["docker-entrypoint.sh"]             0B        buildkit.dockerfile.v0
<missing>      18 months ago   COPY docker-entrypoint.sh /usr/local/bin/ # …   20.5kB    buildkit.dockerfile.v0
<missing>      18 months ago   RUN /bin/sh -c apk add --no-cache --virtual …   5.47MB    buildkit.dockerfile.v0
<missing>      18 months ago   ENV YARN_VERSION=1.22.22                        0B        buildkit.dockerfile.v0
<missing>      18 months ago   RUN /bin/sh -c addgroup -g 1000 node     && …   122MB     buildkit.dockerfile.v0
<missing>      18 months ago   ENV NODE_VERSION=18.20.8                        0B        buildkit.dockerfile.v0
<missing>      20 months ago   CMD ["/bin/sh"]                                 0B        buildkit.dockerfile.v0
<missing>      20 months ago   ADD alpine-minirootfs-3.21.3-x86_64.tar.gz /…   8.5MB     buildkit.dockerfile.v0
```
> **Nhận xét:** Hệ điều hành Alpine mini rootfs chỉ vỏn vẹn **8.5MB**, các dependency production chỉ nặng **4.84MB**. Toàn bộ layer build nặng nề đều được giữ lại ở giai đoạn builder và không xuất hiện trong runtime image.

---

## 7. Hướng Dẫn Thực Thi & Kiểm Tra

### Bước 1: Build Image Single-stage
```bash
docker build -f Dockerfile.single -t hw-backend:single .
```

### Bước 2: Build Image Multi-stage
```bash
docker build -t hw-backend:multistage .
```

### Bước 3: So Sánh Dung Lượng Hai Image
```bash
docker images | grep hw-backend
```
*(Trên PowerShell: `docker images | Select-String "hw-backend"`)*

**Kết quả thu được:**
```text
IMAGE                          ID             DISK USAGE   CONTENT SIZE   EXTRA
hw-backend:multistage          79a7e32f3824        187MB         45.7MB        
hw-backend:single              bf17a9bc8577       1.59GB          399MB        
```

### Bước 4: Kiểm Tra Layer Caching Khi Rebuild
Thực hiện chạy lại lệnh build sau khi không có thay đổi hoặc chỉ sửa `server.js`:
```bash
docker build -t hw-backend:multistage .
```
Kết quả hiển thị trạng thái `CACHED` cho các layer tốn thời gian:
```text
#6 [builder 4/5] RUN npm install --omit=dev && npm cache clean --force
#6 CACHED
#9 [builder 3/5] COPY package*.json ./
#9 CACHED
```
Thời gian hoàn tất: **0.1s**.

### Bước 5: Khởi Chạy Container & Kiểm Tra Phản Hồi API
Khởi chạy container từ image multi-stage:
```bash
docker run -d --name hw-backend-app -p 3000:3000 hw-backend:multistage
```

Kiểm tra API:
```bash
# 1. Endpoint Trang Chủ
curl http://localhost:3000/
# Output:
# {"status":"success","message":"Welcome to Homework Session 10 - Exercise 3 Backend API","build":"production-multistage","timestamp":"2026-10-11T09:23:08.812Z"}

# 2. Endpoint Health Check
curl http://localhost:3000/api/health
# Output:
# {"status":"UP","uptime":31.78,"timestamp":"2026-10-11T09:23:21.902Z","node_version":"v18.20.8","memory_usage":{...}}

# 3. Endpoint Dữ Liệu
curl http://localhost:3000/api/data
# Output:
# {"code":200,"data":[{"id":1,"name":"Docker Multi-stage Build","category":"DevOps"},{"id":2,"name":"Layer Caching Optimization","category":"Performance"},{"id":3,"name":"Alpine Minimal Runtime","category":"Security"}]}
```

Dọn dẹp container thử nghiệm:
```bash
docker rm -f hw-backend-app
```

---

## 8. Kết Luận
1. **Dung lượng tối thiểu:** Áp dụng Multi-stage Build và Base Image Alpine đã cắt giảm dung lượng từ **1.59 GB** xuống **187 MB** (content size chỉ còn **45.7 MB** < 100MB mục tiêu), đạt mức giảm **88.24%** (vượt xa yêu cầu 50-70%).
2. **Layer Caching tối đa:** Việc phân tách `COPY package*.json ./` trước `RUN npm install` giúp tiết kiệm thời gian CI/CD vượt trội.
3. **Môi trường sẵn sàng cho Production:** Loại bỏ hoàn toàn devDependencies và các công cụ biên dịch thừa, nâng cao bảo mật và độ ổn định khi triển khai thực tế.
