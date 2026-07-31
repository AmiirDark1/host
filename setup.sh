#!/bin/bash
# ============================================================
# Setup Script for WordPress Panel Docker Stack
# ============================================================
# این اسکریپت شبکه و پوشه‌های لازم را قبل از docker compose up می‌سازد
# ============================================================

set -e

echo "🚀 Setting up WordPress Panel Docker Stack..."
echo ""

# 1. Create docker network for nginx-proxy
echo "📡 Creating nginx-proxy network..."
docker network create nginx-proxy 2>/dev/null || echo "   ✅ Network already exists"

# 2. Create necessary directories
echo "📁 Creating directories..."
mkdir -p nginx/custom nginx/vhost.d nginx/html nginx/certs nginx/conf.d nginx/acme
echo "   ✅ Directories created"

# 3. Create a simple error page for unknown domains
echo "📄 Creating error page..."
cat > nginx/html/error.html << 'EOF'
<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>دامنه پیدا نشد</title>
    <style>
        body { font-family: Tahoma, Arial, sans-serif; background: #1a1a2e; color: #fff; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
        .container { text-align: center; }
        h1 { font-size: 3em; color: #e94560; }
        p { font-size: 1.2em; color: #ccc; }
    </style>
</head>
<body>
    <div class="container">
        <h1>⚠️ دامنه پیدا نشد</h1>
        <p>این دامنه به هیچ سایتی متصل نیست.</p>
        <p>لطفاً ابتدا در پنل مدیریت یک سایت برای این دامنه ایجاد کنید.</p>
    </div>
</body>
</html>
EOF
echo "   ✅ Error page created"

echo ""
echo "============================================"
echo "✅ Setup complete!"
echo ""
echo "حالا برای بالا آوردن همه سرویس‌ها اجرا کنید:"
echo "   docker compose up -d"
echo ""
echo "پنل مدیریت روی پورت 3000 در دسترس است:"
echo "   http://localhost:3000"
echo "============================================"