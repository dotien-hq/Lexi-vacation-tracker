#!/bin/bash

echo "🚀 Setting up Lexi Vacation Tracker with Next.js + Prisma"
echo ""

# Check if node_modules exists
if [ -d "node_modules" ]; then
    echo "⚠️  Removing old node_modules..."
    rm -rf node_modules package-lock.json
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Generate Prisma Client
echo "🔧 Generating Prisma Client..."
npx prisma generate

# Run migrations
echo "🗄️  Creating database..."
npx prisma migrate dev --name init

# Seed database
echo "🌱 Seeding database with initial employees..."
npm run prisma:seed

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Run 'npm run dev' to start the development server"
echo "  2. Open http://localhost:3000 in your browser"
echo "  3. Run 'npm run prisma:studio' to view the database"
echo ""
