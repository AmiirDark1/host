#!/bin/bash
# ============================================================
# Setup Script for WordPress Panel
# ============================================================
# این اسکریپت پوشه‌های مورد نیاز را ساخته و آماده می‌کند
# ============================================================

set -e

echo "🚀 Setting up WordPress Panel Infrastructure..."
echo ""

# 1. Create nginx directories
echo "📁 Creating nginx directories..."
mkdir -p nginx/custom
mkdir -p nginx/vhost.d
mkdir -p nginx/html
mkdir -p nginx/certs
mkdir -p nginx/conf.d
mkdir -p nginx/acme

# 2. Create a simple error page for unknown domains
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

echo ""
echo "✅ Setup complete!"
echo ""
echo "Now you can start all services with:"
echo "   docker-compose up -d"
echo ""
echo "And access the panel at: http://localhost:3000"
echo "   Username: admin"
echo "   Password: admin123"